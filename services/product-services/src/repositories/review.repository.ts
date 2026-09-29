import { getClient, query } from "../config/db";

export interface ReviewRow {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: Date;
  updated_at: Date;
}

export async function findReviewsByProductId(
  productId: string,
  limit: number,
  offset: number
): Promise<ReviewRow[]> {
  const result = await query<ReviewRow>(
    "SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    [productId, limit, offset]
  );
  return result.rows;
}

export async function countReviewsByProductId(productId: string): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) FROM reviews WHERE product_id = $1",
    [productId]
  );
  return Number(result.rows[0].count);
}

export async function findReviewByUserAndProduct(
  userId: string,
  productId: string
): Promise<ReviewRow | null> {
  const result = await query<ReviewRow>(
    "SELECT * FROM reviews WHERE user_id = $1 AND product_id = $2",
    [userId, productId]
  );
  return result.rows[0] ?? null;
}

export async function findReviewById(id: string): Promise<ReviewRow | null> {
  const result = await query<ReviewRow>("SELECT * FROM reviews WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

/**
 * Writes the review AND recomputes the product's aggregate rating/count
 * in ONE transaction - the same "all or nothing" reasoning as order
 * creation earlier in this build. Without the transaction, a crash
 * between the two steps could leave a review saved but the product's
 * displayed rating stale and wrong.
 */
export async function upsertReviewAndRecalculate(input: {
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
}): Promise<ReviewRow> {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const result = await client.query<ReviewRow>(
      `INSERT INTO reviews (product_id, user_id, user_name, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (product_id, user_id)
       DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = now()
       RETURNING *`,
      [input.productId, input.userId, input.userName, input.rating, input.comment]
    );

    await client.query(
      `UPDATE products SET
         rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE product_id = $1),
         num_reviews = (SELECT COUNT(*) FROM reviews WHERE product_id = $1)
       WHERE id = $1`,
      [input.productId]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteReviewAndRecalculate(id: string, productId: string): Promise<boolean> {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const deleteResult = await client.query("DELETE FROM reviews WHERE id = $1", [id]);

    await client.query(
      `UPDATE products SET
         rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE product_id = $1),
         num_reviews = (SELECT COUNT(*) FROM reviews WHERE product_id = $1)
       WHERE id = $1`,
      [productId]
    );

    await client.query("COMMIT");
    return (deleteResult.rowCount ?? 0) > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}