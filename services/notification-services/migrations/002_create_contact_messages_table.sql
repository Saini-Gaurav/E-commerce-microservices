CREATE TABLE IF NOT EXISTS contact_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  subject     VARCHAR(255) NOT NULL,
  message     TEXT NOT NULL,

  -- Lets an admin mark a message as handled without deleting the
  -- record - same "keep the history, just track its state" idea as
  -- newsletter's is_active.
  is_read     BOOLEAN NOT NULL DEFAULT false,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_is_read ON contact_messages(is_read);