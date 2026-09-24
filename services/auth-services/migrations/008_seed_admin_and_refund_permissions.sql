INSERT INTO permissions (role_code, permission_code, description) VALUES
  ('ADMIN', 'PAYMENT_REFUND',    'Issue refunds for paid orders')
ON CONFLICT (role_code, permission_code) DO NOTHING;