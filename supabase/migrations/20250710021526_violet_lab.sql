/*
  # Authentication System with Roles and Permissions

  1. New Tables
    - `profiles` - User profiles linked to Supabase auth
    - `roles` - System roles (admin, manager, employee)
    - `permissions` - System permissions
    - `role_permissions` - Many-to-many relationship between roles and permissions

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
    - Create triggers for automatic profile creation

  3. Default Data
    - Create default roles and permissions
    - Set up admin and employee users
*/

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  resource text NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for roles
CREATE POLICY "Anyone can view roles"
  ON roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage roles"
  ON roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- Create policies for permissions
CREATE POLICY "Anyone can view permissions"
  ON permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage permissions"
  ON permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- Create policies for role_permissions
CREATE POLICY "Anyone can view role permissions"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage role permissions"
  ON role_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- Create policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can view all profiles if they have permission"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions perm ON rp.permission_id = perm.id
      WHERE p.id = auth.uid() 
      AND perm.resource = 'users' 
      AND perm.action = 'read'
    )
  );

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can manage all profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'admin'
    )
  );

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  employee_role_id uuid;
BEGIN
  -- Get employee role id
  SELECT id INTO employee_role_id FROM roles WHERE name = 'employee';
  
  -- Insert profile for new user
  INSERT INTO profiles (id, email, name, role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    employee_role_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Insert default roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrator with full system access'),
  ('manager', 'Manager with limited administrative access'),
  ('employee', 'Employee with basic access')
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
  ('users_read', 'View users', 'users', 'read'),
  ('users_create', 'Create users', 'users', 'create'),
  ('users_update', 'Update users', 'users', 'update'),
  ('users_delete', 'Delete users', 'users', 'delete'),
  ('products_read', 'View products', 'products', 'read'),
  ('products_create', 'Create products', 'products', 'create'),
  ('products_update', 'Update products', 'products', 'update'),
  ('products_delete', 'Delete products', 'products', 'delete'),
  ('categories_read', 'View categories', 'categories', 'read'),
  ('categories_create', 'Create categories', 'categories', 'create'),
  ('categories_update', 'Update categories', 'categories', 'update'),
  ('categories_delete', 'Delete categories', 'categories', 'delete'),
  ('sales_read', 'View sales', 'sales', 'read'),
  ('sales_create', 'Create sales', 'sales', 'create'),
  ('sales_update', 'Update sales', 'sales', 'update'),
  ('sales_delete', 'Delete sales', 'sales', 'delete'),
  ('suppliers_read', 'View suppliers', 'suppliers', 'read'),
  ('suppliers_create', 'Create suppliers', 'suppliers', 'create'),
  ('suppliers_update', 'Update suppliers', 'suppliers', 'update'),
  ('suppliers_delete', 'Delete suppliers', 'suppliers', 'delete'),
  ('customers_read', 'View customers', 'customers', 'read'),
  ('customers_create', 'Create customers', 'customers', 'create'),
  ('customers_update', 'Update customers', 'customers', 'update'),
  ('customers_delete', 'Delete customers', 'customers', 'delete'),
  ('cash_register_read', 'View cash register', 'cash_register', 'read'),
  ('cash_register_create', 'Open cash register', 'cash_register', 'create'),
  ('cash_register_update', 'Close cash register', 'cash_register', 'update'),
  ('dashboard_read', 'View dashboard', 'dashboard', 'read')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign limited permissions to manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'manager'
AND p.name IN (
  'users_read', 'products_read', 'products_create', 'products_update',
  'categories_read', 'categories_create', 'categories_update',
  'sales_read', 'sales_create', 'suppliers_read', 'suppliers_create', 'suppliers_update',
  'customers_read', 'customers_create', 'customers_update',
  'cash_register_read', 'cash_register_create', 'cash_register_update',
  'dashboard_read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign basic permissions to employee role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'employee'
AND p.name IN (
  'products_read', 'categories_read', 'sales_read', 'sales_create',
  'customers_read', 'customers_create', 'cash_register_read',
  'cash_register_create', 'cash_register_update', 'dashboard_read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;