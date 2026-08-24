import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token.util";

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