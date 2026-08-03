import rateLimit from "express-rate-limit";

// Stops one person (or a bot) from hammering this service with hundreds of requests per minute.
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});