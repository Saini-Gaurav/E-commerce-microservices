import { Router } from "express";
import { listPermissionsHandler } from "../controllers/rbac.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { generalLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

// Chain order matters: rate-limit first (cheapest check), then confirm
// WHO the caller is (requireAuth), then confirm WHAT they're allowed to
// do (requirePermission). Each step only runs if the previous passed.
router.get(
  "/permissions",
  generalLimiter,
  requireAuth,
  requirePermission("USER_MANAGE"),
  listPermissionsHandler
);

export default router;