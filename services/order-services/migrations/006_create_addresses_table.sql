CREATE TABLE IF NOT EXISTS addresses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL,
  label              VARCHAR(30) NOT NULL DEFAULT 'Home',
  shipping_address1  VARCHAR(255) NOT NULL,
  shipping_address2  VARCHAR(255) DEFAULT '',
  city               VARCHAR(255) NOT NULL,
  zip                VARCHAR(32) NOT NULL,
  country            VARCHAR(255) NOT NULL,
  phone              VARCHAR(32) NOT NULL,
  is_default         BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- At most one default per user. The WHERE makes this index only apply
-- to default rows, so a user can have any number of non-defaults.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_addresses_one_default_per_user
  ON addresses(user_id) WHERE is_default = true;