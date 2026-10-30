import { findAllRolePermissionPairs } from "../repositories/permission.repository";

let roleToPermissions: Map<string, Set<string>> = new Map();
let isLoaded = false;

export async function loadRbacCache(): Promise<void> {
  const mappings = await findAllRolePermissionPairs();

  const next = new Map<string, Set<string>>();
  for (const { role_code, permission_code } of mappings) {
    if (!next.has(role_code)) {
      next.set(role_code, new Set());
    }
    next.get(role_code)!.add(permission_code);
  }

  roleToPermissions = next;
  isLoaded = true;
  console.log(`RBAC cache loaded: ${next.size} role(s)`);
}

export function hasPermission(roleCode: string, permissionCode: string): boolean {
  if (!isLoaded) {
    console.warn("RBAC cache checked before it was loaded — denying by default");
    return false;
  }
  return roleToPermissions.get(roleCode)?.has(permissionCode) ?? false;
}

export function getPermissionsForRole(roleCode: string): string[] {
  if (!isLoaded) {
    console.warn("RBAC cache read before it was loaded — returning empty list");
    return [];
  }
  return Array.from(roleToPermissions.get(roleCode) ?? []);
}