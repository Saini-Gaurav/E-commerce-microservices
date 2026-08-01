import { query } from "../config/db";

export interface ProductRow {
  id: string;
  name: string;
  description: string;
  rich_description: string;
  image: string;
  images: string[];
  brand: string;
  price: string; // pg returns NUMERIC as a string to avoid silent precision loss - see product.service.ts for where we convert it
  category_id: string;
  count_in_stock: number;
  rating: string;
  num_reviews: number;
  is_featured: boolean;
  ingredients: string;
  usage_notes: string;
  benefits: string;
  precautions: string;
  quantity: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProductListFilters {
  categoryId?: string;
  isFeatured?: boolean;
  search?: string; // matches against name
  limit: number;
  offset: number;
}

// Builds the WHERE clause and its parameters together, so the clause
// text and the $N placeholders can never drift out of sync with each
// other - a common source of bugs when they're built separately.
function buildWhereClause(filters: Pick<ProductListFilters, "categoryId" | "isFeatured" | "search">) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.categoryId) {
    values.push(filters.categoryId);
    conditions.push(`category_id = $${values.length}`);
  }
  if (filters.isFeatured !== undefined) {
    values.push(filters.isFeatured);
    conditions.push(`is_featured = $${values.length}`);
  }
  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`name ILIKE $${values.length}`); // ILIKE = case-insensitive LIKE
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { whereClause, values };
}

export async function findProducts(filters: ProductListFilters): Promise<ProductRow[]> {
  const { whereClause, values } = buildWhereClause(filters);

  const limitParamIndex = values.length + 1;
  const offsetParamIndex = values.length + 2;

  const result = await query<ProductRow>(
    `SELECT * FROM products ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
    [...values, filters.limit, filters.offset]
  );
  return result.rows;
}

export async function countProducts(
  filters: Pick<ProductListFilters, "categoryId" | "isFeatured" | "search">
): Promise<number> {
  const { whereClause, values } = buildWhereClause(filters);
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) FROM products ${whereClause}`,
    values
  );
  return Number(result.rows[0].count);
}

export async function findProductById(id: string): Promise<ProductRow | null> {
  const result = await query<ProductRow>("SELECT * FROM products WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function countProductsInCategory(categoryId: string): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) FROM products WHERE category_id = $1",
    [categoryId]
  );
  return Number(result.rows[0].count);
}

export interface CreateProductInput {
  name: string;
  description: string;
  richDescription?: string;
  image?: string;
  images?: string[];
  brand?: string;
  price: number;
  categoryId: string;
  countInStock: number;
  isFeatured?: boolean;
  ingredients?: string;
  usageNotes?: string;
  benefits?: string;
  precautions?: string;
  quantity?: string;
}

export async function createProduct(input: CreateProductInput): Promise<ProductRow> {
  const result = await query<ProductRow>(
    `INSERT INTO products (
       name, description, rich_description, image, images, brand, price,
       category_id, count_in_stock, is_featured, ingredients, usage_notes,
       benefits, precautions, quantity
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      input.name,
      input.description,
      input.richDescription ?? "",
      input.image ?? "",
      input.images ?? [],
      input.brand ?? "",
      input.price,
      input.categoryId,
      input.countInStock,
      input.isFeatured ?? false,
      input.ingredients ?? "",
      input.usageNotes ?? "",
      input.benefits ?? "",
      input.precautions ?? "",
      input.quantity ?? "",
    ]
  );
  return result.rows[0];
}

const UPDATABLE_COLUMNS = [
  "name", "description", "rich_description", "image", "images", "brand",
  "price", "category_id", "count_in_stock", "is_featured", "ingredients",
  "usage_notes", "benefits", "precautions", "quantity",
] as const;

export async function updateProduct(
  id: string,
  fields: Partial<Record<(typeof UPDATABLE_COLUMNS)[number], unknown>>
): Promise<ProductRow | null> {
  const keys = Object.keys(fields).filter((k) =>
    (UPDATABLE_COLUMNS as readonly string[]).includes(k)
  );
  if (keys.length === 0) return findProductById(id);

  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");
  const values = keys.map((key) => fields[key as keyof typeof fields]);

  const result = await query<ProductRow>(
    `UPDATE products SET ${setClause}, updated_at = now() WHERE id = $${keys.length + 1} RETURNING *`,
    [...values, id]
  );
  return result.rows[0] ?? null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const result = await query("DELETE FROM products WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}