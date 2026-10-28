import { Request, Response, NextFunction } from "express";

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