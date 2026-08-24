import { Router } from "express";
import * as newsletterController from "../controllers/newsletter.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { generalLimiter, publicFormLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

// Public - no login needed, matches how a real newsletter form works. Uses the STRICTER limiter, since this triggers an outbound email with zero authentication in front of it.
router.post("/subscribe", publicFormLimiter, newsletterController.subscribeHandler);

// Admin-only - viewing the subscriber list is a real, sensitive action.
router.get(
  "/subscribers",
  generalLimiter,
  requireAuth,
  requirePermission("NEWSLETTER_READ"),
  newsletterController.listSubscribersHandler
);

export default router;