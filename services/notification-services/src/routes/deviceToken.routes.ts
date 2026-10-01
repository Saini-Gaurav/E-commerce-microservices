import { Router } from "express";
import { registerDeviceTokenHandler } from "../controllers/deviceToken.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { generalLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();
router.post("/register-device", generalLimiter, requireAuth, registerDeviceTokenHandler);

export default router;