import crypto from "crypto";

export function generateOtp(): string {
  // A random number between 100000 and 999999 - always exactly 6 digits.
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}