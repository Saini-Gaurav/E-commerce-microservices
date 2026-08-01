import { Request, Response, NextFunction } from "express";

/**
 * Must run AFTER requireAuth. Checks the permissions array embedded IN
 * the JWT - no cache, no DB, no network call. Usage:
 *   router.post("/", requireAuth, requirePermission("PRODUCT_CREATE"), handler)
 *
 * Trade-off to know: a permission change only takes effect on a user's
 * NEXT fresh token (next login or refresh - access tokens expire every
 * 15m by default), not instantly. Acceptable for most systems; if you
 * ever need instant revocation, that's what a token blocklist (Redis)
 * or shorter-lived access tokens are for.
 */
export function requirePermission(permissionCode: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const permissions = req.user?.permissions;

    if (!permissions) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    if (!permissions.includes(permissionCode)) {
      res.status(403).json({ message: `Missing required permission: ${permissionCode}` });
      return;
    }

    next();
  };
}