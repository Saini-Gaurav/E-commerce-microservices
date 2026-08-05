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
}

/**
 * Inserts the order AND all its items together in ONE database
 * transaction - this is the genuine, textbook use case for a
 * transaction: either the whole order (header + every line item) gets
 * saved, or NONE of it does. Without wrapping this in BEGIN/COMMIT, a
 * crash after inserting the order but before inserting item 3 of 5
 * would leave a half-complete order sitting in the database forever -
 * exactly the kind of inconsistency a transaction exists to prevent.
 *
 * Note this is a LOCAL transaction, entirely within order-service's own
 * database - completely different from the cross-service consistency
 * problem (order-service + product-service agreeing on stock), which
 * is what the Kafka event in order.service.ts solves instead. A
 * transaction can only ever protect writes to ONE database.
 */
export async function createOrderWithItems(
  input: CreateOrderInput
): Promise<{ order: OrderRow; items: OrderItemRow[] }> {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const orderResult = await client.query<OrderRow>(
      `INSERT INTO orders (user_id, shipping_address1, shipping_address2, city, zip, country, phone, total_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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