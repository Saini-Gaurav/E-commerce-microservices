INSERT INTO permissions (role_code, permission_code, description) VALUES
  ('ADMIN', 'USER_CREATE_ADMIN', 'Create new user accounts, including other admins')
ON CONFLICT (role_code, permission_code) DO NOTHING;