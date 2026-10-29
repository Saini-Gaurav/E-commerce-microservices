import { query } from "../config/db";

export interface PermissionRow {
  id: string;
  role_code: string;
  permission_code: string;
  description: string | null;
  created_at: Date;
}

// Used by the admin-facing "list all permission grants" endpoint. 
export async function findAllPermissions(): Promise<PermissionRow[]> {
  const result = await query<PermissionRow>(
    `SELECT * FROM permissions ORDER BY role_code, permission_code`
  );
  return result.rows;
}

export async function findAllRolePermissionPairs(): Promise<
  Pick<PermissionRow, "role_code" | "permission_code">[]
> {
  const result = await query<
    Pick<PermissionRow, "role_code" | "permission_code">
  >(`SELECT role_code, permission_code FROM permissions`);
  return result.rows;
}