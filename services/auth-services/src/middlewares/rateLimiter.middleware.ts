import rateLimit from "express-rate-limit";

/**
 * STRICT limiter — for login and register.
 * 5 attempts per 15 minutes per IP. A real user mistyping their password
 * won't hit this; a brute-force script trying hundreds of passwords will.
 *
 * NOTE: default store is in-memory (per Node process). Fine for a single
 * instance / learning setup. In production with multiple instances of
 * this service running behind a load balancer, swap in a shared Redis
 * store (via `rate-limit-redis`) so all instances share one counter —
 * otherwise each instance enforces the limit independently, and the
 * effective limit multiplies by the number of instances.
 */
export const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true, // adds RateLimit-Limit / RateLimit-Remaining headers
  legacyHeaders: false, // disables the older X-RateLimit-* headers
  message: {
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

/**
 * MODERATE limiter — for refresh. Refreshing happens automatically and
 * fairly often as access tokens expire every 15 min, so this needs to
 * be more generous than login, but still capped — repeated failed
 * refresh attempts is itself a signal something's wrong (e.g. someone
 * probing with a stolen/expired token).
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many refresh attempts. Please try again shortly.",
  },
});

/**
 * GENERAL limiter — a light safety net across the whole service for
 * everything else (e.g. /me), so no single client can hammer the
 * service arbitrarily even on "harmless" routes.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});