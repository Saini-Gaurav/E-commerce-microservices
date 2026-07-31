import { query } from "../config/db";

export interface PermissionRow {
  id: string;
  role_code: string;
  permission_code: string;
  description: string | null;
  created_at: Date;
}

/** Used by the admin-facing "list all permission grants" endpoint. */
export async function findAllPermissions(): Promise<PermissionRow[]> {
  const result = await query<PermissionRow>(
    `SELECT * FROM permissions ORDER BY role_code, permission_code`
  );
  return result.rows;
}

/**
 * Feeds the in-memory RBAC cache (see rbac.cache.ts). Notice this is a
 * plain single-table SELECT — no JOIN needed, since role_code and
 * permission_code now live on the same row. This is the direct
 * performance win from dropping the separate roles/role_permissions
 * tables: this query (and every permission check that used to require
 * one) is cheaper.
 */
export async function findAllRolePermissionPairs(): Promise<
  Pick<PermissionRow, "role_code" | "permission_code">[]
> {
  const result = await query<
    Pick<PermissionRow, "role_code" | "permission_code">
  >(`SELECT role_code, permission_code FROM permissions`);
  return result.rows;
}