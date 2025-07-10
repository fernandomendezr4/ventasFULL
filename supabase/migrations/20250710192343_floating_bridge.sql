/*
  # Sistema de roles y permisos

  1. Nuevas tablas
    - `roles` - Define los roles del sistema (admin, manager, employee)
    - `permissions` - Define los permisos disponibles
    - `role_permissions` - Relación muchos a muchos entre roles y permisos
    - `profiles` - Perfiles de usuario con referencia a roles

  2. Datos iniciales
    - Roles: admin, manager, employee
    - Permisos básicos para cada módulo del sistema
    - Asignación de permisos a roles

  3. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas para lectura y escritura según el rol
*/

-- Crear tabla de roles
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de permisos
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  module text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de relación roles-permisos
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Crear tabla de perfiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role_id uuid REFERENCES roles(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para roles
CREATE POLICY "Todos pueden leer roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

-- Políticas para permisos
CREATE POLICY "Todos pueden leer permisos"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

-- Políticas para role_permissions
CREATE POLICY "Todos pueden leer role_permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Políticas para profiles
CREATE POLICY "Los usuarios pueden leer todos los perfiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Los usuarios pueden insertar su propio perfil"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Insertar roles básicos
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrador del sistema con acceso completo'),
  ('manager', 'Gerente con permisos de gestión'),
  ('employee', 'Empleado con permisos básicos')
ON CONFLICT (name) DO NOTHING;

-- Insertar permisos básicos
INSERT INTO permissions (name, description, module) VALUES
  ('users.read', 'Ver usuarios', 'users'),
  ('users.create', 'Crear usuarios', 'users'),
  ('users.update', 'Actualizar usuarios', 'users'),
  ('users.delete', 'Eliminar usuarios', 'users'),
  ('products.read', 'Ver productos', 'products'),
  ('products.create', 'Crear productos', 'products'),
  ('products.update', 'Actualizar productos', 'products'),
  ('products.delete', 'Eliminar productos', 'products'),
  ('sales.read', 'Ver ventas', 'sales'),
  ('sales.create', 'Crear ventas', 'sales'),
  ('sales.update', 'Actualizar ventas', 'sales'),
  ('sales.delete', 'Eliminar ventas', 'sales'),
  ('categories.read', 'Ver categorías', 'categories'),
  ('categories.create', 'Crear categorías', 'categories'),
  ('categories.update', 'Actualizar categorías', 'categories'),
  ('categories.delete', 'Eliminar categorías', 'categories'),
  ('suppliers.read', 'Ver proveedores', 'suppliers'),
  ('suppliers.create', 'Crear proveedores', 'suppliers'),
  ('suppliers.update', 'Actualizar proveedores', 'suppliers'),
  ('suppliers.delete', 'Eliminar proveedores', 'suppliers'),
  ('customers.read', 'Ver clientes', 'customers'),
  ('customers.create', 'Crear clientes', 'customers'),
  ('customers.update', 'Actualizar clientes', 'customers'),
  ('customers.delete', 'Eliminar clientes', 'customers'),
  ('reports.read', 'Ver reportes', 'reports'),
  ('dashboard.read', 'Ver dashboard', 'dashboard')
ON CONFLICT (name) DO NOTHING;

-- Asignar todos los permisos al rol admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'admin'),
  p.id
FROM permissions p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Asignar permisos limitados al rol manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'manager'),
  p.id
FROM permissions p
WHERE p.name IN (
  'products.read', 'products.create', 'products.update',
  'sales.read', 'sales.create', 'sales.update',
  'categories.read', 'categories.create', 'categories.update',
  'suppliers.read', 'suppliers.create', 'suppliers.update',
  'customers.read', 'customers.create', 'customers.update',
  'reports.read', 'dashboard.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Asignar permisos básicos al rol employee
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'employee'),
  p.id
FROM permissions p
WHERE p.name IN (
  'products.read',
  'sales.read', 'sales.create',
  'categories.read',
  'customers.read', 'customers.create',
  'dashboard.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;