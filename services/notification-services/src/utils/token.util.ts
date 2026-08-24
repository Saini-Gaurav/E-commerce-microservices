import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

export interface AccessTokenPayload {
  userId: string;
  name: string;
  roleCode: string;
  role: string;
  permissions: string[];
}

const PUBLIC_KEY_PATH = process.env.JWT_PUBLIC_KEY_PATH || "./keys/public.pem";
const PUBLIC_KEY = fs.readFileSync(path.resolve(PUBLIC_KEY_PATH), "utf8");

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, PUBLIC_KEY, {
    algorithms: ["RS256"],
  }) as AccessTokenPayload;
}