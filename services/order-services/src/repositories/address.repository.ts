import { query, getClient } from "../config/db";

export interface AddressRow {
  id: string;
  user_id: string;
  label: string;
  shipping_address1: string;
  shipping_address2: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAddressInput {
  label: string;
  shippingAddress1: string;
  shippingAddress2: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
}

export async function findAddressesByUserId(userId: string): Promise<AddressRow[]> {
  const result = await query<AddressRow>(
    "SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
    [userId]
  );
  return result.rows;
}

export async function countAddressesByUserId(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) FROM addresses WHERE user_id = $1",
    [userId]
  );
  return Number(result.rows[0].count);
}

export async function findAddressById(id: string): Promise<AddressRow | null> {
  const result = await query<AddressRow>("SELECT * FROM addresses WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function createAddress(
  userId: string,
  input: CreateAddressInput,
  makeDefault: boolean
): Promise<AddressRow> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await client.query<AddressRow>(
      `INSERT INTO addresses
         (user_id, label, shipping_address1, shipping_address2, city, zip, country, phone, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        input.label,
        input.shippingAddress1,
        input.shippingAddress2,
        input.city,
        input.zip,
        input.country,
        input.phone,
        makeDefault,
      ]
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

// Two separate statements on purpose: the unique index is checked row by
// row, so flipping one row to true while another is still true in the
// same UPDATE can trip it. Clear first, then set.
export async function setDefaultAddress(id: string, userId: string): Promise<void> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE addresses SET is_default = false, updated_at = now() WHERE user_id = $1 AND is_default = true",
      [userId]
    );
    await client.query(
      "UPDATE addresses SET is_default = true, updated_at = now() WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteAddress(id: string, userId: string): Promise<boolean> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const deleted = await client.query<{ is_default: boolean }>(
      "DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING is_default",
      [id, userId]
    );

    if ((deleted.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    // Deleted the default? Promote the newest one left so the user
    // never ends up with addresses but no default.
    if (deleted.rows[0].is_default) {
      await client.query(
        `UPDATE addresses SET is_default = true, updated_at = now()
         WHERE id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)`,
        [userId]
      );
    }

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}