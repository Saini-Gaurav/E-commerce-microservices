import { Response } from "express";

// A simple "something went wrong, and here's the right HTTP status code to send back" box, so every part of this service can throw errors the same clean way instead of guessing at status codes.
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