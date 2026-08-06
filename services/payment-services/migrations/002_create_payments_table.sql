CREATE TABLE IF NOT EXISTS payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- No FK - order_id belongs to order-service's database. Validated at
  -- write time against this service's own order_cache above, not by
  -- Postgres. Same cross-database trade-off as every prior service.
  order_id              UUID NOT NULL,
  user_id               UUID NOT NULL,

  razorpay_order_id     VARCHAR(255) NOT NULL UNIQUE,
  razorpay_payment_id   VARCHAR(255) UNIQUE, -- null until the client actually completes checkout

  amount                NUMERIC(10, 2) NOT NULL,
  currency              VARCHAR(3) NOT NULL DEFAULT 'INR',

  status                VARCHAR(20) NOT NULL DEFAULT 'CREATED'
                         CHECK (status IN ('CREATED', 'PAID', 'FAILED')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);