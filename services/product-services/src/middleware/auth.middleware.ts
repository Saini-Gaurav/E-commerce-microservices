import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token.util";

/**
 * Identical logic to auth-service's requireAuth: reads the access_token
 * cookie the browser is already sending (cookies are shared across
 * different ports on the same hostname, e.g. localhost:3000 talking to
 * localhost:4001 AND localhost:4002), verifies its signature locally
 * against the shared secret, and attaches the payload to req.user.
 *
 * No requireAdmin here (auth-service has one) - that was a blunt
 * boolean check from before RBAC existed. Every route in this service
 * that needs authorization uses requirePermission() instead, from
 * rbac.middleware.ts.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const accessToken = req.cookies?.access_token;

  if (!accessToken) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  try {
    req.user = verifyAccessToken(accessToken);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired access token" });
  }
}