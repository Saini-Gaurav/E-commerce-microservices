import rateLimit from "express-rate-limit";

/**
 * One general-purpose limiter for this service. Unlike auth-service,
 * there's no login/register endpoint here to brute-force, so we don't
 * need the STRICT/MODERATE/GENERAL three-tier split - a single
 * reasonable ceiling across all routes is enough.
 *
 * Same in-memory-store caveat as auth-service: fine for one instance,
 * needs a shared Redis store once this runs behind a load balancer
 * with multiple replicas.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});