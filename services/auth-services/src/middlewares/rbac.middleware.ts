import { Request, Response, NextFunction } from "express";
import { hasPermission } from "../services/rbac.cache";

/**
 * The fine-grained guard: "does this user's role have this specific
 * permission?" Use this for most protected routes — it's the whole
 * point of RBAC over a blunt isAdmin check, since you can now express
 * things like "only PRODUCT_DELETE can delete a product" separately
 * from "only ADMIN can manage users," even if today the same role
 * happens to hold both.
 *
 * Must run AFTER requireAuth — relies on req.user already being set.
 *
 * Usage: router.delete("/:id", requireAuth, requirePermission("PRODUCT_DELETE"), deleteProductHandler)
 */
export function requirePermission(permissionCode: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const roleCode = req.user?.roleCode;

    if (!roleCode) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    if (!hasPermission(roleCode, permissionCode)) {
      res.status(403).json({
        message: `Missing required permission: ${permissionCode}`,
      });
      return;
    }

    next();
  };
}

/**
 * The coarse-grained guard: "is this user's role literally X?" Useful
 * for the rare case where a whole route belongs to one specific role
 * rather than one specific permission (e.g. an admin-only dashboard
 * route with no single obvious permission code). Prefer
 * requirePermission() where possible — it's more flexible if roles
 * change later.
 */
export function requireRole(...allowedRoleCodes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const roleCode = req.user?.roleCode;

    if (!roleCode) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    if (!allowedRoleCodes.includes(roleCode)) {
      res.status(403).json({ message: "Insufficient role" });
      return;
    }

    next();
  };
}