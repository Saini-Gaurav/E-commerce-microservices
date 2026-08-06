import { query } from "../config/db";

export interface OrderCacheRow {
  order_id: string;
  user_id: string;
  total_price: string;
  created_at: Date;
}

export async function upsertOrderCache(order: {
  orderId: string; userId: string; totalPrice: number;
}): Promise<void> {
  await query(
    `INSERT INTO order_cache (order_id, user_id, total_price)
     VALUES ($1, $2, $3)
     ON CONFLICT (order_id) DO UPDATE SET
       user_id = EXCLUDED.user_id, total_price = EXCLUDED.total_price`,
    [order.orderId, order.userId, order.totalPrice]
  );
}

export async function findOrderInCache(orderId: string): Promise<OrderCacheRow | null> {
  const result = await query<OrderCacheRow>(
    "SELECT * FROM order_cache WHERE order_id = $1", [orderId]
  );
  return result.rows[0] ?? null;
}