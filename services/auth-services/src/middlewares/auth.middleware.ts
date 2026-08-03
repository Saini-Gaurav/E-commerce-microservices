import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token.util";

/**
 * Protects a route: requires a valid, unexpired access token cookie.
 * On success, attaches the decoded payload to req.user and calls next().
 * On failure, responds 401 immediately — the route handler never runs.
 *
 * Note this does NOT hit the database. Verifying a JWT is pure math
 * (checking the cryptographic signature) — this is what makes JWT-based
 * auth cheap to check on every single request across every service.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const accessToken = req.cookies?.access_token;

  if (!accessToken) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  try {
    const payload = verifyAccessToken(accessToken);
    req.user = payload;
    next();
  } catch (err) {
    // Covers both "signature invalid / tampered" and "expired" —
    // jwt.verify throws for both, we treat them the same from the
    // client's point of view: "go refresh or log in again."
    res.status(401).json({ message: "Invalid or expired access token" });
  }
}

/**
 * Extra guard for admin-only routes. Must run AFTER requireAuth, since it
 * relies on req.user already being set.
 */
// export function requireAdmin(
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): void {
//   if (!req.user?.isAdmin) {
//     res.status(403).json({ message: "Admin access required" });
//     return;
//   }
//   next();
// }