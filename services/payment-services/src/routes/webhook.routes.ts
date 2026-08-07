import { Router } from "express";
import express from "express";
import { razorpayWebhookHandler } from "../controllers/webhook.controller";

const router = Router();

// express.raw() here, NOT express.json() - this route needs the exact original bytes for signature verification, see webhook.controller.ts.
router.post("/razorpay", express.raw({ type: "application/json" }), razorpayWebhookHandler);

export default router;