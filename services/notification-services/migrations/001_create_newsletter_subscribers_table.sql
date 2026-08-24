CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255) NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  subscribed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

-- Same soft-delete instinct as everywhere else in this build - an
-- unsubscribe flips is_active to false rather than deleting the row,
-- so you keep real history (when someone subscribed, when they left)
-- instead of just erasing the fact they were ever there.
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_unique_idx ON newsletter_subscribers (LOWER(email));