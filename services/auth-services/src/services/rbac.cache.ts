import { findAllRolePermissionPairs } from "../repositories/permission.repository";

// roleCode -> Set of permission codes that role is granted.
// A Set gives us O(1) "does this role have this permission" checks.
let roleToPermissions: Map<string, Set<string>> = new Map();
let isLoaded = false;

/**
 * Loads the full role -> permissions mapping from the database into
 * memory. Call this once at service startup (see server.ts), BEFORE the
 * server starts accepting requests — we never want a request to be
 * checked against an empty/not-yet-loaded cache.
 *
 * Can also be called again later to refresh the cache on demand (e.g.
 * from an admin "reload permissions" endpoint) after permissions change
 * in the database, without restarting the whole service.
 */
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

/**
 * The actual check used by middleware on every protected request.
 * Pure in-memory lookup — no database hit here, which is the whole
 * point of caching this rarely-changing data.
 */
export function hasPermission(roleCode: string, permissionCode: string): boolean {
  if (!isLoaded) {
    // Fail CLOSED (deny) rather than fail open, if this is ever somehow
    // checked before loadRbacCache() ran. Better to wrongly reject a
    // request than to wrongly allow one.
    console.warn("RBAC cache checked before it was loaded — denying by default");
    return false;
  }
  return roleToPermissions.get(roleCode)?.has(permissionCode) ?? false;
}