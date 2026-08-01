import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Everything a DOWNSTREAM service (catalog-service, order-service, ...)
// needs to authorize a request, with zero DB calls and zero calls back
// to auth-service. This is the whole point of putting these fields
// here: the token IS the answer to "who is this and what can they do."
export interface AccessTokenPayload {
  userId: string;
  name: string;
  roleCode: string; // machine-readable, e.g. 'ADMIN' — used for coarse requireRole() checks
  role: string; // human-readable, e.g. 'Administrator' — for display only, never for logic
  permissions: string[]; // e.g. ['PRODUCT_READ', 'ORDER_READ_OWN'] — used by requirePermission()
}

// --- RS256 key loading ---------------------------------------------
//
// WHY asymmetric (RS256) instead of a shared secret (HS256), now that
// more than one service verifies these tokens:
//
// With HS256, the SAME string both signs and verifies a token. Every
// service that needs to check a token would need that string — which
// means every service that can check a token can also forge one. If
// catalog-service were ever compromised, an attacker there could mint
// a fake admin token valid across the ENTIRE system.
//
// With RS256, auth-service alone holds keys/private.pem (signs).
// Every other service only ever holds keys/public.pem (verifies).
// A compromised downstream service can check tokens all day but can
// never create a valid one — it simply doesn't have the private key.
const PRIVATE_KEY_PATH =
  process.env.JWT_PRIVATE_KEY_PATH || "./keys/private.pem";
const PUBLIC_KEY_PATH =
  process.env.JWT_PUBLIC_KEY_PATH || "./keys/public.pem";

// Fail fast on boot if keys are missing, rather than failing
// confusingly on the first login/verify attempt.
const PRIVATE_KEY = fs.readFileSync(path.resolve(PRIVATE_KEY_PATH), "utf8");
const PUBLIC_KEY = fs.readFileSync(path.resolve(PUBLIC_KEY_PATH), "utf8");

const ACCESS_TOKEN_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ||
  "15m") as jwt.SignOptions["expiresIn"];

const REFRESH_TOKEN_EXPIRES_IN_MS =
  Number(process.env.REFRESH_TOKEN_EXPIRES_IN_MS) || 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Signs a JWT with the PRIVATE key. Only auth-service ever calls this
 * function — it's the only service that ever loads private.pem.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: "RS256",
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

/**
 * Verifies a JWT with the PUBLIC key. This exact function (using only
 * the public key + this algorithm restriction) is what gets copied
 * into every other service that needs to authorize requests.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, PUBLIC_KEY, {
    algorithms: ["RS256"], // explicitly pin the algorithm — never trust the token to declare its own
  }) as AccessTokenPayload;
}

/**
 * Generates a brand new refresh token. Still a random opaque string,
 * NOT a JWT — unaffected by the RS256 change, since refresh tokens are
 * only ever checked against the database, never independently verified
 * by any other service.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);
}