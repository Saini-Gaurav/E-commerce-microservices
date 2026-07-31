-- Step 1: add both new columns nullable first — same safe-migration
-- pattern as before (can't add NOT NULL to a table with existing rows
-- in one step).
ALTER TABLE users ADD COLUMN role_code VARCHAR(50);
ALTER TABLE users ADD COLUMN role VARCHAR(100);

-- Step 2: backfill from the old boolean flag.
UPDATE users
SET role_code = CASE WHEN is_admin THEN 'ADMIN' ELSE 'CUSTOMER' END,
    role      = CASE WHEN is_admin THEN 'Administrator' ELSE 'Customer' END;

-- Step 3: now safe to enforce NOT NULL, and restrict role_code to the
-- same known set used in the permissions table (migration 003).
ALTER TABLE users ALTER COLUMN role_code SET NOT NULL;
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users
  ADD CONSTRAINT chk_users_role_code CHECK (role_code IN ('ADMIN', 'CUSTOMER'));

-- Step 4: is_admin is now fully replaced.
ALTER TABLE users DROP COLUMN is_admin;

-- Step 5: this column is filtered/joined against often enough
-- (permission checks conceptually relate to it) to be worth its own
-- index, even though it's not a foreign key.
CREATE INDEX IF NOT EXISTS idx_users_role_code ON users(role_code);