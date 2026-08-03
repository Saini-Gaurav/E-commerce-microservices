import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token.util";

// This is the "show me your ID card" checkpoint. It reads the card (cookie) you're carrying, checks it's real, and if so, remembers who you are for the rest of this one request.
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