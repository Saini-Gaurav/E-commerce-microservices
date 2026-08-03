CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS carts (
  -- user_id IS the primary key - see the design note in chat for why
  -- there's no separate surrogate id here. One user, one cart, always.
  user_id     UUID PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);