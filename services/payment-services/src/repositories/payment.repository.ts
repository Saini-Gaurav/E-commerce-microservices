import { query } from "../config/db";

export interface PaymentRow {
  id: string;
  order_id: string;
  user_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount: string;
  currency: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export async function createPaymentRecord(input: {
  orderId: string;
  userId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
}): Promise<PaymentRow> {
  const result = await query<PaymentRow>(
    `INSERT INTO payments (order_id, user_id, razorpay_order_id, amount, currency, status)
     VALUES ($1, $2, $3, $4, $5, 'CREATED')
     RETURNING *`,
    [input.orderId, input.userId, input.razorpayOrderId, input.amount, input.currency]
  );
  return result.rows[0];
}

export async function findPaymentByOrderId(orderId: string): Promise<PaymentRow | null> {
  const result = await query<PaymentRow>(
    "SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1",
    [orderId]
  );
  return result.rows[0] ?? null;
}

export async function findPaymentByRazorpayOrderId(razorpayOrderId: string): Promise<PaymentRow | null> {
  const result = await query<PaymentRow>(
    "SELECT * FROM payments WHERE razorpay_order_id = $1",
    [razorpayOrderId]
  );
  return result.rows[0] ?? null;
}

export async function markPaymentPaid(
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<PaymentRow | null> {
  const result = await query<PaymentRow>(
    `UPDATE payments SET status = 'PAID', razorpay_payment_id = $1, updated_at = now()
     WHERE razorpay_order_id = $2
     RETURNING *`,
    [razorpayPaymentId, razorpayOrderId]
  );
  return result.rows[0] ?? null;
}

export async function markPaymentFailed(razorpayOrderId: string): Promise<PaymentRow | null> {
  const result = await query<PaymentRow>(
    `UPDATE payments SET status = 'FAILED', updated_at = now()
     WHERE razorpay_order_id = $1
     RETURNING *`,
    [razorpayOrderId]
  );
  return result.rows[0] ?? null;
}