-- Deliberately NO separate "roles" table. This app has a small, fixed
-- set of roles (max ~5), and that set changes essentially never — a
-- perfect candidate to treat as a constrained enum rather than its own
-- normalized table + join table. This keeps every permission check to
-- ONE table, no JOIN.
--
-- role_code is restricted via CHECK instead of a foreign key. This is
-- the trade-off: we lose the automatic guarantee that role_code always
-- points at a "real" role (a typo like 'CUSTOMR' would need to be
-- caught here, not by the database referencing a roles table) — but we
-- gain a simpler, faster schema for a dimension that rarely changes.
-- IMPORTANT: this same list must be kept in sync with the CHECK on
-- users.role_code (see migration 005).
CREATE TABLE IF NOT EXISTS permissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code        VARCHAR(50) NOT NULL
                    CHECK (role_code IN ('ADMIN', 'CUSTOMER')),
  permission_code  VARCHAR(100) NOT NULL,
  description      VARCHAR(255),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevents granting the same permission to the same role twice.
  -- Since role_code is the FIRST column in this composite UNIQUE
  -- constraint, Postgres can also use it directly to answer
  -- "WHERE role_code = 'ADMIN'" queries efficiently — no separate
  -- single-column index needed on role_code alone.
  UNIQUE (role_code, permission_code)
);