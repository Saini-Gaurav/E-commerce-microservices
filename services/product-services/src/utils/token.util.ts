import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

// Mirrors auth-service's AccessTokenPayload exactly. Still duplicated,
// not imported from a shared package - see the npm-workspaces note from
// earlier in this build for the long-term fix once you have 3+ services.
export interface AccessTokenPayload {
  userId: string;
  name: string;
  roleCode: string;
  role: string;
  permissions: string[];
}

const PUBLIC_KEY_PATH = process.env.JWT_PUBLIC_KEY_PATH || "./keys/public.pem";
const PUBLIC_KEY = fs.readFileSync(path.resolve(PUBLIC_KEY_PATH), "utf8");

/**
 * product-service has no signAccessToken function - it is structurally
 * incapable of issuing a token, not just "trusted not to." Only
 * auth-service ever loads private.pem.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, PUBLIC_KEY, {
    algorithms: ["RS256"], // pin it - never trust the token's own alg header
  }) as AccessTokenPayload;
}