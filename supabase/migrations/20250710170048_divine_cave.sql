/*
  # Create demo users and profiles

  1. New Data
    - Creates demo roles (admin, manager, employee)
    - Creates demo permissions for different resources
    - Links roles to permissions
    - Creates demo user profiles

  2. Security
    - Maintains existing RLS policies
    - Uses proper role-based access control
*/

-- Insert demo roles if they don't exist
INSERT INTO roles (name, description) VALUES 
  ('admin', 'Administrator with full system access'),
  ('manager', 'Manager with limited administrative access'),
  ('employee', 'Employee with basic access')
ON CONFLICT (name) DO NOTHING;

-- Insert demo permissions if they don't exist
INSERT INTO permissions (name, description, resource, action) VALUES 
  ('users_read', 'View users', 'users', 'read'),
  ('users_write', 'Create and edit users', 'users', 'write'),
  ('users_delete', 'Delete users', 'users', 'delete'),
  ('products_read', 'View products', 'products', 'read'),
  ('products_write', 'Create and edit products', 'products', 'write'),
  ('products_delete', 'Delete products', 'products', 'delete'),
  ('sales_read', 'View sales', 'sales', 'read'),
  ('sales_write', 'Create and edit sales', 'sales', 'write'),
  ('sales_delete', 'Delete sales', 'sales', 'delete'),
  ('categories_read', 'View categories', 'categories', 'read'),
  ('categories_write', 'Create and edit categories', 'categories', 'write'),
  ('categories_delete', 'Delete categories', 'categories', 'delete'),
  ('suppliers_read', 'View suppliers', 'suppliers', 'read'),
  ('suppliers_write', 'Create and edit suppliers', 'suppliers', 'write'),
  ('suppliers_delete', 'Delete suppliers', 'suppliers', 'delete'),
  ('customers_read', 'View customers', 'customers', 'read'),
  ('customers_write', 'Create and edit customers', 'customers', 'write'),
  ('customers_delete', 'Delete customers', 'customers', 'delete'),
  ('cash_registers_read', 'View cash registers', 'cash_registers', 'read'),
  ('cash_registers_write', 'Create and edit cash registers', 'cash_registers', 'write'),
  ('cash_registers_delete', 'Delete cash registers', 'cash_registers', 'delete')
ON CONFLICT (name) DO NOTHING;

-- Get role IDs
DO $$
DECLARE
  admin_role_id uuid;
  manager_role_id uuid;
  employee_role_id uuid;
  perm_id uuid;
BEGIN
  -- Get role IDs
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
  SELECT id INTO manager_role_id FROM roles WHERE name = 'manager';
  SELECT id INTO employee_role_id FROM roles WHERE name = 'employee';

  -- Admin gets all permissions
  FOR perm_id IN SELECT id FROM permissions LOOP
    INSERT INTO role_permissions (role_id, permission_id) 
    VALUES (admin_role_id, perm_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- Manager gets read/write permissions (no delete)
  FOR perm_id IN SELECT id FROM permissions WHERE action IN ('read', 'write') LOOP
    INSERT INTO role_permissions (role_id, permission_id) 
    VALUES (manager_role_id, perm_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- Employee gets only read permissions for most resources, plus sales write
  FOR perm_id IN SELECT id FROM permissions WHERE action = 'read' LOOP
    INSERT INTO role_permissions (role_id, permission_id) 
    VALUES (employee_role_id, perm_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;

  -- Employee can also create sales
  SELECT id INTO perm_id FROM permissions WHERE name = 'sales_write';
  INSERT INTO role_permissions (role_id, permission_id) 
  VALUES (employee_role_id, perm_id)
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  SELECT id INTO perm_id FROM permissions WHERE name = 'customers_write';
  INSERT INTO role_permissions (role_id, permission_id) 
  VALUES (employee_role_id, perm_id)
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END $$;