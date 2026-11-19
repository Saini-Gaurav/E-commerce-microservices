import { query } from "../config/db";

export interface CartItemRow {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: Date;
  updated_at: Date;
}

export async function ensureCartExists(userId: string): Promise<void> {
  await query(
    `INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

export async function getCartItems(userId: string): Promise<CartItemRow[]> {
  const result = await query<CartItemRow>(
    `SELECT * FROM cart_items WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows;
}

export async function findCartItem(
  userId: string,
  productId: string
): Promise<CartItemRow | null> {
  const result = await query<CartItemRow>(
    `SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2`,
    [userId, productId]
  );
  return result.rows[0] ?? null;
}

export async function upsertCartItem(
  userId: string,
  productId: string,
  quantity: number
): Promise<CartItemRow> {
  const result = await query<CartItemRow>(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = now()
     RETURNING *`,
    [userId, productId, quantity]
  );
  return result.rows[0];
}

export async function setCartItemQuantity(
  userId: string,
  productId: string,
  quantity: number
): Promise<CartItemRow | null> {
  const result = await query<CartItemRow>(
    `UPDATE cart_items SET quantity = $1, updated_at = now()
     WHERE user_id = $2 AND product_id = $3
     RETURNING *`,
    [quantity, userId, productId]
  );
  return result.rows[0] ?? null;
}

export async function removeCartItem(userId: string, productId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2`,
    [userId, productId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function clearCartItems(userId: string): Promise<void> {
  await query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
}