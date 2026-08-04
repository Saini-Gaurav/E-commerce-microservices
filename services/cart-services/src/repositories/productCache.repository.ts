import { query } from "../config/db";

export interface ProductCacheRow {
  id: string;
  name: string;
  price: string;
  image: string;
  count_in_stock: number;
  updated_at: Date;
}

export async function upsertProductCache(product: {
  id: string; name: string; price: number; image: string; countInStock: number;
}): Promise<void> {
  await query(
    `INSERT INTO product_cache (id, name, price, image, count_in_stock, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, price = EXCLUDED.price, image = EXCLUDED.image,
       count_in_stock = EXCLUDED.count_in_stock, updated_at = now()`,
    [product.id, product.name, product.price, product.image, product.countInStock]
  );
}

export async function deleteProductCache(productId: string): Promise<void> {
  await query("DELETE FROM product_cache WHERE id = $1", [productId]);
}

export async function findProductInCache(productId: string): Promise<ProductCacheRow | null> {
  const result = await query<ProductCacheRow>(
    "SELECT * FROM product_cache WHERE id = $1", [productId]
  );
  return result.rows[0] ?? null;
}