import { query } from "../config/db";

export async function recordPurchase(userId: string, productId: string): Promise<void> {
  await query(
    `INSERT INTO product_purchases (user_id, product_id) VALUES ($1, $2)
     ON CONFLICT (user_id, product_id) DO NOTHING`,
    [userId, productId]
  );
}

export async function hasUserPurchased(userId: string, productId: string): Promise<boolean> {
  const result = await query(
    "SELECT 1 FROM product_purchases WHERE user_id = $1 AND product_id = $2",
    [userId, productId]
  );
  return result.rows.length > 0;
}