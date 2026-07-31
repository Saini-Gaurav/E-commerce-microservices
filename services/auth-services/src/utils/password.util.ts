import bcrypt from "bcryptjs";

// "Salt rounds" = how much work bcrypt does when hashing. Higher = slower to hash (and slower for an attacker to brute-force guess), but also slower for YOUR server on every login. 10 is a solid, widely-used default in 2026 — high enough to be safe, low enough to not slow down real logins noticeably.
const SALT_ROUNDS = 10;

/**
 * Turns a plain-text password into a one-way hash before we ever store
 * it. We NEVER store the actual password anywhere, not even encrypted —
 * hashed, so it can be checked but never reversed back to the original.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Checks a login attempt's plain-text password against the stored hash.
 * bcrypt re-hashes the plain password with the same salt that's embedded
 * in the stored hash, and compares the results — it never "decrypts"
 * anything, because hashing can't be reversed.
 */
export async function comparePassword(
  plainPassword: string,
  storedHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, storedHash);
}