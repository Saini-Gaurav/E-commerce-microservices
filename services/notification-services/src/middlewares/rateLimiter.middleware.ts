import rateLimit from "express-rate-limit";

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * A tighter limit specifically for the two PUBLIC, unauthenticated
 * routes (subscribe, contact). Every other service's public routes so
 * far were pure reads (GET /products) - reads are cheap and hard to
 * abuse. These two routes both trigger an OUTBOUND email send, and
 * they require no login at all - without a stricter limit here,
 * someone could script thousands of rapid submissions and either spam
 * a real inbox or burn through Gmail's daily sending quota in minutes.
 */
export const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests - please try again later" },
});