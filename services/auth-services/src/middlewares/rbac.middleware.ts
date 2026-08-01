import { Request, Response, NextFunction } from "express";

/**
 * The fine-grained guard: "does this request's TOKEN carry this
 * specific permission?" Since permissions now live directly inside the
 * verified JWT (see token.util.ts / auth.service.ts), this check is a
 * pure in-memory array read — no database, no cache lookup, nothing.
 * This is what makes it safe to copy this exact file into every other
 * service (catalog-service, order-service, ...): each one authorizes
 * requests completely independently, with zero runtime dependency on
 * auth-service or any shared cache being warm/available.
 *
 * Must run AFTER requireAuth — relies on req.user already being set
 * from the verified token.
 *
 * Usage: router.delete("/:id", requireAuth, requirePermission("PRODUCT_DELETE"), deleteProductHandler)
 */
export function requirePermission(permissionCode: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    if (!req.user.permissions.includes(permissionCode)) {
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