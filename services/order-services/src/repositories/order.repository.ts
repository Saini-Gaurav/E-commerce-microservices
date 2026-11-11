import { query, getClient } from "../config/db";

export interface OrderRow {
  id: string;
  user_id: string;
  shipping_address1: string;
  shipping_address2: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
  status: string;
  total_price: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: string;
  quantity: number;
  line_total: string;
  created_at: Date;
}

export interface CreateOrderInput {
  userId: string;
  shippingAddress1: string;
  shippingAddress2?: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
  items: {
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  totalPrice: number;
  idempotencyKey?: string; 

}

export async function createOrderWithItems(
  input: CreateOrderInput
): Promise<{ order: OrderRow; items: OrderItemRow[] }> {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const orderResult = await client.query<OrderRow>(
      `INSERT INTO orders (user_id, shipping_address1, shipping_address2, city, zip, country, phone, total_price, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.userId,
        input.shippingAddress1,
        input.shippingAddress2 ?? "",
        input.city,
        input.zip,
        input.country,
        input.phone,
        input.totalPrice,
        input.idempotencyKey ?? null,
      ]
    );
    const order = orderResult.rows[0];

    const items: OrderItemRow[] = [];
    for (const item of input.items) {
      const itemResult = await client.query<OrderItemRow>(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [order.id, item.productId, item.productName, item.unitPrice, item.quantity, item.lineTotal]
      );
      items.push(itemResult.rows[0]);
    }

    await client.query("COMMIT");
    return { order, items };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function findOrderById(id: string): Promise<OrderRow | null> {
  const result = await query<OrderRow>("SELECT * FROM orders WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function findOrderItemsByOrderId(orderId: string): Promise<OrderItemRow[]> {
  const result = await query<OrderItemRow>(
    "SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC",
    [orderId]
  );
  return result.rows;
}

export async function findOrdersByUserId(
  userId: string,
  limit: number,
  offset: number
): Promise<OrderRow[]> {
  const result = await query<OrderRow>(
    `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
}

export async function countOrdersByUserId(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) FROM orders WHERE user_id = $1", [userId]
  );
  return Number(result.rows[0].count);
}

export async function findAllOrders(
  status: string | undefined,
  limit: number,
  offset: number
): Promise<OrderRow[]> {
  if (status) {
    const result = await query<OrderRow>(
      `SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
    return result.rows;
  }
  const result = await query<OrderRow>(
    `SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

export async function countAllOrders(status: string | undefined): Promise<number> {
  if (status) {
    const result = await query<{ count: string }>(
      "SELECT COUNT(*) FROM orders WHERE status = $1", [status]
    );
    return Number(result.rows[0].count);
  }
  const result = await query<{ count: string }>("SELECT COUNT(*) FROM orders");
  return Number(result.rows[0].count);
}

export async function updateOrderStatus(id: string, status: string): Promise<OrderRow | null> {
  const result = await query<OrderRow>(
    `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0] ?? null;
}

export async function findOrderByIdempotencyKey(
  userId: string,
  idempotencyKey: string
): Promise<OrderRow | null> {
  const result = await query<OrderRow>(
    "SELECT * FROM orders WHERE user_id = $1 AND idempotency_key = $2",
    [userId, idempotencyKey]
  );
  return result.rows[0] ?? null;
}

export async function findAbandonedPendingOrders(olderThan: Date): Promise<OrderRow[]> {
  const result = await query<OrderRow>(
    "SELECT * FROM orders WHERE status = 'PENDING' AND created_at < $1",
    [olderThan]
  );
  return result.rows;
}

export async function getOrderStatusBreakdown(): Promise<
  { status: string; count: number; total: number }[]
> {
  const result = await query<{ status: string; count: string; total: string }>(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(total_price), 0) AS total
     FROM orders GROUP BY status`
  );
  return result.rows.map((r) => ({
    status: r.status,
    count: Number(r.count),
    total: Number(r.total),
  }));
}

export async function getOrderTotalsSince(
  days: number,
  paidStatuses: string[]
): Promise<{ orders: number; revenue: number }> {
  const result = await query<{ orders: string; revenue: string }>(
    `SELECT COUNT(*) AS orders,
            COALESCE(SUM(total_price) FILTER (WHERE status = ANY($2::text[])), 0) AS revenue
     FROM orders
     WHERE created_at >= now() - make_interval(days => $1::int)`,
    [days, paidStatuses]
  );
  return {
    orders: Number(result.rows[0].orders),
    revenue: Number(result.rows[0].revenue),
  };
}