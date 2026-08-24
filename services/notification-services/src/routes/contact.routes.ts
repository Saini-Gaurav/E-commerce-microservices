import { Router } from "express";
import * as contactController from "../controllers/contact.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { generalLimiter, publicFormLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

router.post("/", publicFormLimiter, contactController.submitContactHandler);

router.get(
  "/messages",
  generalLimiter,
  requireAuth,
  requirePermission("CONTACT_READ"),
  contactController.listMessagesHandler
);

export default router;