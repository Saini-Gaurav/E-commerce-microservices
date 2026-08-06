import { Router } from "express";
import * as paymentController from "../controllers/payment.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { generalLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

// Every route is ownership-based (requireAuth only, no requirePermission)
// - matches the design decision from a couple messages back.
router.post("/initiate", generalLimiter, requireAuth, paymentController.initiatePaymentHandler);
router.post("/verify", generalLimiter, requireAuth, paymentController.verifyPaymentHandler);
router.get("/order/:orderId", generalLimiter, requireAuth, paymentController.getPaymentForOrderHandler);

export default router;