import rateLimit from "express-rate-limit";

export const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true, // adds RateLimit-Limit / RateLimit-Remaining headers
  legacyHeaders: false, // disables the older X-RateLimit-* headers
  message: {
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many refresh attempts. Please try again shortly.",
  },
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});