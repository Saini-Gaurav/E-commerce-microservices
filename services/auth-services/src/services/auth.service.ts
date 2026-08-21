import {
  createUser,
  findUserByEmail,
  findUserById,
  UserRow,
} from "../repositories/user.repository";
import {
  storeRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
} from "../repositories/refreshToken.repository";
import { hashPassword, comparePassword } from "../utils/password.util";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
} from "../utils/token.util";
import { getPermissionsForRole } from "./rbac.cache";
import { redis } from "../config/redis";
import { generateOtp, hashOtp } from "../utils/otp.util";
import { sendOtpEmail } from "../utils/mailer.util";

// Every new registration gets these unless a higher-privilege flow (e.g. an admin creating a staff account) explicitly assigns another role later. Hardcoded on purpose: self-registration should NEVER let the caller pick their own role — imagine a register endpoint that accepted { "roleCode": "ADMIN" } straight from the request body. Since there's no roles table to look these up from anymore, this pair IS the source of truth for "what a brand new user gets" — keep it in sync with the CHECK constraint values in migration 005 if you ever change it.
const DEFAULT_ROLE_CODE = "CUSTOMER";
const DEFAULT_ROLE_NAME = "Customer";

const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRY_SECONDS) || 600;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between resend requests
const MAX_OTP_ATTEMPTS = 5;

// A small custom error class so controllers can tell "bad input" apart from "something broke on our end" and respond with the right HTTP status code (400 vs 401 vs 500). Cleaner than throwing plain Error everywhere and guessing at the message string.
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// What we return to the controller after a successful login/register/ refresh: a safe (no password_hash!) user object — now including the FULL permissions array for that user's role — plus both raw tokens ready to be put in cookies.
export interface AuthResult {
  user: Omit<UserRow, "password_hash"> & { permissions: string[] };
  accessToken: string;
  refreshToken: string;
}

/**
 * Builds the user object sent back to the client: strips password_hash
 * (never send that anywhere), and attaches the current permission list
 * for this user's role, read straight from the in-memory RBAC cache —
 * no extra DB query needed, since that cache is already loaded.
 */
function buildAuthUser(
  user: UserRow
): Omit<UserRow, "password_hash"> & { permissions: string[] } {
  const { password_hash, ...safeUser } = user;
  return {
    ...safeUser,
    permissions: getPermissionsForRole(user.role_code),
  };
}

/**
 * Issues a fresh access + refresh token pair for a user, and persists the
 * new refresh token's hash. Shared by register, login, and refresh —
 * they all end with "give this user a new token pair."
 */
async function issueTokenPair(
  user: UserRow
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({
    userId: user.id,
    name: user.name,
    roleCode: user.role_code,
    role: user.role,
    permissions: getPermissionsForRole(user.role_code),
  });

  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);
  await storeRefreshToken(user.id, tokenHash, getRefreshTokenExpiry());

  return { accessToken, refreshToken };
}

// export async function register(input: {
//   name: string;
//   email: string;
//   password: string;
//   phone: string;
// }): Promise<AuthResult> {
//   const existing = await findUserByEmail(input.email);
//   if (existing) {
//     throw new AuthError("An account with this email already exists", 409);
//   }

//   const passwordHash = await hashPassword(input.password);
//   const user = await createUser({
//     name: input.name,
//     email: input.email,
//     passwordHash,
//     phone: input.phone,
//     roleCode: DEFAULT_ROLE_CODE,
//     role: DEFAULT_ROLE_NAME,
//   });

//   const tokens = await issueTokenPair(user);
//   return { user: buildAuthUser(user), ...tokens };
// }

// Shape of what actually sits in Redis while someone's mid-registration - nothing is in the REAL users table yet, this is the "pending" data only.
interface PendingRegistration {
  name: string;
  email: string;
  passwordHash: string;
  phone: string;
  otpHash: string;
  attempts: number;
  lastSentAt: number;
}

function pendingRegistrationKey(email: string): string {
  return `pending_registration:${email.toLowerCase()}`;
}

/**
 * Step 1 of registration. Does NOT touch the users table at all - see
 * the design note from our earlier discussion on why: creating a real
 * row now would permanently block this email if the person never
 * finishes verifying. Everything lives in Redis instead, with a TTL,
 * so an abandoned registration just quietly disappears on its own.
 */
export async function initiateRegistration(input: {
  name: string;
  email: string;
  password: string;
  phone: string;
}): Promise<void> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new AuthError("An account with this email already exists", 409);
  }

  const key = pendingRegistrationKey(input.email);
  const existingPending = await redis.get(key);

  if (existingPending) {
    const parsed: PendingRegistration = JSON.parse(existingPending);
    const msSinceLastSend = Date.now() - parsed.lastSentAt;
    if (msSinceLastSend < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - msSinceLastSend) / 1000);
      throw new AuthError(`Please wait ${waitSeconds}s before requesting another code`, 429);
    }
  }

  const passwordHash = await hashPassword(input.password);
  const otp = generateOtp();

  const pending: PendingRegistration = {
    name: input.name,
    email: input.email,
    passwordHash,
    phone: input.phone,
    otpHash: hashOtp(otp),
    attempts: 0,
    lastSentAt: Date.now(),
  };

  // "EX" here means "expire after this many seconds" - this single option is the entire reason Redis fits this job so well: no separate cleanup job anywhere has to remember to delete this.
  await redis.set(key, JSON.stringify(pending), "EX", OTP_EXPIRY_SECONDS);

  await sendOtpEmail(input.email, otp);
}

/**
 * Step 2. Only HERE does a real row finally get created in the users
 * table - this is the actual "check-in" moment from the hotel analogy.
 */
export async function completeRegistration(input: {
  email: string;
  otp: string;
}): Promise<AuthResult> {
  const key = pendingRegistrationKey(input.email);
  const raw = await redis.get(key);

  if (!raw) {
    throw new AuthError("No pending registration found - please register again", 400);
  }

  const pending: PendingRegistration = JSON.parse(raw);

  if (pending.attempts >= MAX_OTP_ATTEMPTS) {
    await redis.del(key);
    throw new AuthError("Too many incorrect attempts - please register again", 400);
  }

  if (hashOtp(input.otp) !== pending.otpHash) {
    pending.attempts += 1;
    // Re-save with the incremented attempt count, keeping whatever time was left on the original TTL rather than resetting it - "KEEPTTL" means "don't extend the expiry just because they got it wrong," so a determined guesser can't keep the code alive forever by repeatedly failing.
    await redis.set(key, JSON.stringify(pending), "KEEPTTL");
    throw new AuthError("Incorrect verification code", 400);
  }

  // Correct code - NOW we actually create the account.
  const user = await createUser({
    name: pending.name,
    email: pending.email,
    passwordHash: pending.passwordHash,
    phone: pending.phone,
    roleCode: DEFAULT_ROLE_CODE,
    role: DEFAULT_ROLE_NAME,
  });

  await redis.del(key); // done with this - clean up immediately rather than waiting for the TTL

  const tokens = await issueTokenPair(user);
  return { user: buildAuthUser(user), ...tokens };
}


export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const user = await findUserByEmail(input.email);
  // Deliberately vague error message — don't reveal WHICH part was wrong ("no such email" vs "wrong password"). Telling an attacker "that email doesn't exist" lets them enumerate valid accounts one guess at a time. Same message either way.
  if (!user) {
    throw new AuthError("Invalid email or password", 401);
  }

  const passwordMatches = await comparePassword(
    input.password,
    user.password_hash
  );
  if (!passwordMatches) {
    throw new AuthError("Invalid email or password", 401);
  }

  const tokens = await issueTokenPair(user);
  return { user: buildAuthUser(user), ...tokens };
}

/**
 * Exchanges a still-valid refresh token for a brand new token pair, and
 * ROTATES the refresh token: the old one is revoked and permanently
 * linked to its replacement, so it can never be reused.
 *
 * Includes theft detection: if the given refresh token exists in the DB
 * but is already revoked, someone is replaying an old token that we
 * already rotated away — likely because it was stolen earlier. We
 * respond by revoking EVERY refresh token for that user, forcing a full
 * re-login on all devices, rather than just quietly rejecting this one
 * request.
 */
export async function refresh(rawRefreshToken: string): Promise<AuthResult> {
  const tokenHash = hashToken(rawRefreshToken);
  const existingToken = await findRefreshTokenByHash(tokenHash);

  if (!existingToken) {
    throw new AuthError("Invalid refresh token", 401);
  }

  const isExpired = existingToken.expires_at.getTime() < Date.now();
  const isRevoked = existingToken.revoked_at !== null;

  if (isRevoked) {
    // Theft signal — nuke every session for this user as a precaution.
    await revokeAllRefreshTokensForUser(existingToken.user_id);
    throw new AuthError(
      "Refresh token reuse detected — all sessions revoked, please log in again",
      401
    );
  }

  if (isExpired) {
    throw new AuthError("Refresh token expired, please log in again", 401);
  }

  const user = await findUserById(existingToken.user_id);
  if (!user) {
    throw new AuthError("User no longer exists", 401);
  }

  const tokens = await issueTokenPair(user);
  // Rotate: revoke the old token and point it at the new one's hash.
  await revokeRefreshToken(tokenHash, hashToken(tokens.refreshToken));

  return { user: buildAuthUser(user), ...tokens };
}

/** Logs out one session by revoking just the refresh token presented. */
export async function logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken);
  await revokeRefreshToken(tokenHash);
}