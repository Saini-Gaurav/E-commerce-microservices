import jwt from "jsonwebtoken";
import crypto from "crypto";

// The data we embed inside the access token JWT. Keep this SMALL — anything in here is readable by anyone who has the token (JWTs are signed, not encrypted — never put a password or secret in the payload).
export interface AccessTokenPayload {
  userId: string;
  roleCode: string;
}

// Fail fast on boot if this is missing, instead of failing confusingly later on the first login attempt. A common production pattern: validate required config up front, not lazily.
if (!process.env.JWT_ACCESS_SECRET) {
  throw new Error("Missing required env var: JWT_ACCESS_SECRET");
}
const ACCESS_TOKEN_SECRET: string = process.env.JWT_ACCESS_SECRET;

// jwt.sign()'s TypeScript types only accept a NUMBER of seconds, or a string matching a narrow literal pattern like "15m" / "7d" (imported internally from the "ms" package) — not a generic `string`. Since this value comes from process.env (always typed as plain `string`), we assert it into the shape jwt.sign() expects. We are the ones writing the .env value, so we know it's a valid pattern (e.g. "15m").
const ACCESS_TOKEN_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ||
  "15m") as jwt.SignOptions["expiresIn"];

const REFRESH_TOKEN_EXPIRES_IN_MS =
  Number(process.env.REFRESH_TOKEN_EXPIRES_IN_MS) || 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates a signed, short-lived JWT. This is what proves "this request
 * came from a logged-in user" on every normal API call. Any service that
 * knows ACCESS_TOKEN_SECRET can verify it without calling auth-service or
 * touching a database — that's the whole point of using JWTs here.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

/**
 * Verifies an access token's signature and expiry. Throws if the token
 * is invalid, expired, or tampered with — callers should wrap this in
 * try/catch (we'll do that in the auth middleware).
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as AccessTokenPayload;
}

/**
 * Generates a brand new refresh token. Unlike the access token, this is
 * NOT a JWT — just 64 bytes of cryptographically random data, hex-encoded
 * into a string. There's no "payload" to decode because we never trust
 * the token's own content — we only trust what's stored in our database
 * about it (see refreshToken.repository.ts).
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

/**
 * Hashes a refresh token before it touches the database, using SHA-256.
 *
 * Note: this is a different algorithm than bcrypt (used for passwords).
 * Passwords are short and human-chosen, so they're vulnerable to
 * brute-force/dictionary attacks — bcrypt is deliberately SLOW to make
 * that expensive. A refresh token is already 128 hex characters of true
 * randomness — there's no dictionary attack possible against it, so a
 * fast cryptographic hash (SHA-256) is the right and standard tool here.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Returns the Date when a freshly issued refresh token should expire.
 */
export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);
}