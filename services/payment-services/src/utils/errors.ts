import { Response } from "express";

export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function handleServiceError(err: unknown, res: Response): void {
  if (err instanceof ServiceError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }
  console.error("Unexpected error:", err);
  res.status(500).json({ message: "Something went wrong" });
}