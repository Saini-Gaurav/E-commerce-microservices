import { Request, Response } from "express";
import { findAllPermissions } from "../repositories/permission.repository";

/**
 * Lists every (role_code, permission_code) grant. Since there's no
 * dedicated "roles" table anymore, this doubles as the way to see which
 * roles exist at all — any role_code that appears here is a role with
 * at least one permission. (A role with zero permissions simply
 * wouldn't show up — acceptable, since a permission-less role isn't
 * useful anyway.)
 */
export async function listPermissionsHandler(
  _req: Request,
  res: Response
): Promise<void> {
  const permissions = await findAllPermissions();
  res.status(200).json({ permissions });
}