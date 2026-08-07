import { Request, Response } from "express";
import crypto from "crypto";
import * as paymentService from "../services/payment.service";

/**
 * Razorpay calls this directly - no cookie, no requireAuth, no logged-in
 * user at all. Trust here comes entirely from the signature check below,
 * not from anything about who's calling.
 */
export async function razorpayWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers["x-razorpay-signature"] as string | undefined;

  if (!signature) {
    res.status(400).json({ message: "Missing signature" });
    return;
  }

  // req.body is the RAW Buffer here (see app.ts - this route uses express.raw(), not express.json()) - signing/verifying must happen against the exact bytes Razorpay sent, not a re-serialized object, or the signature would never match even for a real webhook.
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(req.body)
    .digest("hex");

  if (expectedSignature !== signature) {
    console.error("Webhook signature mismatch - possible forged request");
    res.status(400).json({ message: "Invalid signature" });
    return;
  }

  const event = JSON.parse(req.body.toString());

  if (event.event === "payment.captured") {
    const razorpayOrderId = event.payload.payment.entity.order_id;
    const razorpayPaymentId = event.payload.payment.entity.id;

    await paymentService.markPaidFromWebhook(razorpayOrderId, razorpayPaymentId);
  }

  // Always 200, even for event types we don't care about - Razorpay
  // interprets anything other than 2xx as "delivery failed" and will
  // keep retrying this same webhook repeatedly, which we don't want
  // for events that were never going to do anything on our end anyway.
  res.status(200).json({ received: true });
}