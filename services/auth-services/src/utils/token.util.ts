import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export interface AccessTokenPayload {
  userId: string;
  name: string;
  roleCode: string; // machine-readable, e.g. 'ADMIN' — used for coarse requireRole() checks
  role: string; // human-readable, e.g. 'Administrator' — for display only, never for logic
  permissions: string[]; // e.g. ['PRODUCT_READ', 'ORDER_READ_OWN'] — used by requirePermission()
}

const PRIVATE_KEY_PATH =
  process.env.JWT_PRIVATE_KEY_PATH || "./keys/private.pem";
const PUBLIC_KEY_PATH =
  process.env.JWT_PUBLIC_KEY_PATH || "./keys/public.pem";

const PRIVATE_KEY = fs.readFileSync(path.resolve(PRIVATE_KEY_PATH), "utf8");
const PUBLIC_KEY = fs.readFileSync(path.resolve(PUBLIC_KEY_PATH), "utf8");

const ACCESS_TOKEN_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ||
  "15m") as jwt.SignOptions["expiresIn"];

const REFRESH_TOKEN_EXPIRES_IN_MS =
  Number(process.env.REFRESH_TOKEN_EXPIRES_IN_MS) || 7 * 24 * 60 * 60 * 1000; // 7 days

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: "RS256",
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}


export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, PUBLIC_KEY, {
    algorithms: ["RS256"], // explicitly pin the algorithm — never trust the token to declare its own
  }) as AccessTokenPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);
}