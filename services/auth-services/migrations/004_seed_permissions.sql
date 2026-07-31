INSERT INTO permissions (role_code, permission_code, description) VALUES
  ('ADMIN', 'PRODUCT_CREATE',      'Create new products'),
  ('ADMIN', 'PRODUCT_UPDATE',      'Edit existing products'),
  ('ADMIN', 'PRODUCT_DELETE',      'Delete products'),
  ('ADMIN', 'PRODUCT_READ',        'View products'),
  ('ADMIN', 'CATEGORY_MANAGE',     'Create, update, or delete categories'),
  ('ADMIN', 'ORDER_READ_ANY',      'View any customer''s orders'),
  ('ADMIN', 'ORDER_UPDATE_STATUS', 'Update order status (e.g. shipped, delivered)'),
  ('ADMIN', 'COUPON_MANAGE',       'Create, update, or delete coupons'),
  ('ADMIN', 'USER_MANAGE',         'Manage user accounts and roles'),

  ('CUSTOMER', 'PRODUCT_READ',    'View products'),
  ('CUSTOMER', 'ORDER_READ_OWN',  'View your own orders')
ON CONFLICT (role_code, permission_code) DO NOTHING;