import { query } from "../config/db";

export interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  created_at: Date;
  updated_at: Date;
}

export async function findAllCategories(): Promise<CategoryRow[]> {
  const result = await query<CategoryRow>(
    "SELECT * FROM categories ORDER BY name ASC"
  );
  return result.rows;
}

export async function findCategoryById(id: string): Promise<CategoryRow | null> {
  const result = await query<CategoryRow>(
    "SELECT * FROM categories WHERE id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}

// Used by the service layer to give a friendly "category already exists"
// 409 instead of letting the DB's unique index throw a raw constraint
// violation error up to the client.
export async function findCategoryByName(name: string): Promise<CategoryRow | null> {
  const result = await query<CategoryRow>(
    "SELECT * FROM categories WHERE LOWER(name) = LOWER($1)",
    [name]
  );
  return result.rows[0] ?? null;
}

export async function createCategory(input: {
  name: string;
  icon?: string;
  color?: string;
}): Promise<CategoryRow> {
  const result = await query<CategoryRow>(
    `INSERT INTO categories (name, icon, color)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.name, input.icon ?? "", input.color ?? ""]
  );
  return result.rows[0];
}

export async function updateCategory(
  id: string,
  fields: Partial<Pick<CategoryRow, "name" | "icon" | "color">>
): Promise<CategoryRow | null> {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findCategoryById(id);

  // Parameterized dynamic SET clause: column names come from our own
  // trusted `keys` list (never from user input directly), only the
  // VALUES are placeholders - this is safe. Never do this if the column
  // names themselves came from req.body.
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");
  const values = keys.map((key) => (fields as Record<string, unknown>)[key]);

  const result = await query<CategoryRow>(
    `UPDATE categories SET ${setClause}, updated_at = now() WHERE id = $${keys.length + 1} RETURNING *`,
    [...values, id]
  );
  return result.rows[0] ?? null;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const result = await query("DELETE FROM categories WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}