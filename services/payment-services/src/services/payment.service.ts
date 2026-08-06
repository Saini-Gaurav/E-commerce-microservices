import crypto from "crypto";
import { razorpay } from "../utils/razorpay.client";
import { findOrderInCache } from "../repositories/orderCache.repository";
import {
  createPaymentRecord,
  findPaymentByOrderId,
  findPaymentByRazorpayOrderId,
  markPaymentPaid,
  markPaymentFailed,
  PaymentRow,
} from "../repositories/payment.repository";
import { publishPaymentCompleted } from "../events/paymentEvents.publisher";
import { ServiceError } from "../utils/errors";

export interface PaymentResponse {
  id: string;
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
}

function toPaymentResponse(row: PaymentRow): PaymentResponse {
  return {
    id: row.id,
    orderId: row.order_id,
    razorpayOrderId: row.razorpay_order_id,
    razorpayPaymentId: row.razorpay_payment_id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
  };
}

export interface InitiatePaymentResult extends PaymentResponse {
  // Extra fields the frontend's Razorpay checkout widget needs directly - not stored anywhere, just handed straight through from the SDK response.
  razorpayKeyId: string;
}

export async function initiatePayment(
  userId: string,
  orderId: string
): Promise<InitiatePaymentResult> {
  // THIS is the actual fix for the original bug: the amount comes from our own cache, populated by an event WE received from order-service ourselves - never from anything the client sent in this request.
  const cachedOrder = await findOrderInCache(orderId);
  if (!cachedOrder) {
    // Same reasoning as order-service's own cache-miss handling: either the order genuinely doesn't exist, or this service just hasn't heard about it yet (the eventual-consistency gap, again).
    throw new ServiceError("Order not found or not yet available for payment", 400);
  }

  if (cachedOrder.user_id !== userId) {
    // 404, not 403 - same ownership-privacy reasoning as order-service's getOrderById: don't confirm a guessed order id is real to someone who doesn't own it.
    throw new ServiceError("Order not found", 404);
  }

  // Idempotency guard: if a payment session already exists for this order and isn't in a dead-end FAILED state, reuse it instead of creating a second parallel Razorpay order. Without this, a user double-clicking "Pay Now" would spin up two separate checkout sessions for the same order - confusing at best, a duplicate charge risk at worst.
  const existing = await findPaymentByOrderId(orderId);
  if (existing && existing.status !== "FAILED") {
    return { ...toPaymentResponse(existing), razorpayKeyId: process.env.RAZORPAY_KEY_ID! };
  }

  const amount = Number(cachedOrder.total_price);

  // Razorpay expects amount in the SMALLEST currency unit - paise, not rupees (same idea as Stripe wanting cents, not dollars). ₹499.50 must be sent as 49950, or Razorpay will charge ₹4.99 instead. Math.round guards against floating-point artifacts like 499.5 * 100 potentially landing on 49949.999999994 in JS.
  const amountInPaise = Math.round(amount * 100);

  const razorpayOrder = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: orderId,
    payment_capture: true,
  });

  const payment = await createPaymentRecord({
    orderId,
    userId,
    razorpayOrderId: razorpayOrder.id,
    amount,
    currency: "INR",
  });

  return { ...toPaymentResponse(payment), razorpayKeyId: process.env.RAZORPAY_KEY_ID! };
}

export interface VerifyPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export async function verifyPayment(
  userId: string,
  input: VerifyPaymentInput
): Promise<PaymentResponse> {
  const payment = await findPaymentByRazorpayOrderId(input.razorpayOrderId);
  if (!payment) {
    throw new ServiceError("Payment record not found", 404);
  }
  if (payment.user_id !== userId) {
    throw new ServiceError("Payment record not found", 404);
  }
  if (payment.status === "PAID") {
    // Already verified once - happens if a client retries this call (e.g. a flaky network causing a duplicate POST). Return success again rather than erroring, since the actual state IS success.
    return toPaymentResponse(payment);
  }

  // Same HMAC check as your original razorpay.js, ported as-is - this part of the original code was already correct. Razorpay signs "{razorpay_order_id}|{razorpay_payment_id}" with YOUR secret key; recomputing that same signature yourself and comparing is how you prove the payment confirmation actually came from Razorpay and wasn't just a client POSTing a fake "success" straight to this endpoint without ever really paying.
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== input.razorpaySignature) {
    await markPaymentFailed(input.razorpayOrderId);
    throw new ServiceError("Payment verification failed: invalid signature", 400);
  }

  const updated = await markPaymentPaid(input.razorpayOrderId, input.razorpayPaymentId);
  if (!updated) {
    throw new ServiceError("Payment record not found", 404);
  }

  // Announce success AFTER the DB write committed, same ordering principle as order-service's publishOrderCreated - the payment record being marked PAID is the source of truth; the Kafka announcement is a side effect of that, not a precondition for it.
  await publishPaymentCompleted(updated.order_id, updated.id, Number(updated.amount));

  return toPaymentResponse(updated);
}

export async function getPaymentForOrder(userId: string, orderId: string): Promise<PaymentResponse> {
  const payment = await findPaymentByOrderId(orderId);
  if (!payment || payment.user_id !== userId) {
    throw new ServiceError("Payment not found", 404);
  }
  return toPaymentResponse(payment);
}