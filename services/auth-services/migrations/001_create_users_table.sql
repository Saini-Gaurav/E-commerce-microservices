CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(150) NOT NULL,
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  phone          VARCHAR(20) NOT NULL,
  is_admin       BOOLEAN NOT NULL DEFAULT false,
  street         VARCHAR(255) DEFAULT '',
  apartment      VARCHAR(255) DEFAULT '',
  zip            VARCHAR(20) DEFAULT '',
  city           VARCHAR(100) DEFAULT '',
  country        VARCHAR(100) DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);