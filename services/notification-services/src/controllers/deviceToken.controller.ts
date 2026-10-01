import { Request, Response } from "express";
import { registerToken } from "../repositories/deviceToken.repository";
import { handleServiceError } from "../utils/errors";

export async function registerDeviceTokenHandler(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ message: "token is required" });
      return;
    }
    await registerToken(req.user!.userId, token);
    res.status(200).json({ message: "Device registered" });
  } catch (err) {
    handleServiceError(err, res);
  }
}