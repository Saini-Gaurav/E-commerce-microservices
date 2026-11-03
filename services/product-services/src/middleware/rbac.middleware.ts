import { Request, Response, NextFunction } from "express";

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