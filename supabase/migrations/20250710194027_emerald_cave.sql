/*
  # Arreglar sistema de usuarios y autenticación

  1. Cambios en la tabla profiles
    - Asegurar que funcione correctamente con auth.users
    - Agregar trigger para crear perfil automáticamente

  2. Datos iniciales
    - Crear roles básicos (admin, manager, employee)
    - Crear permisos básicos
    - Asignar permisos a roles

  3. Funciones
    - Función para manejar nuevos usuarios
    - Trigger automático para crear perfiles
*/

-- Crear función para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Obtener el rol de admin (crear si no existe)
  INSERT INTO roles (name, description)
  VALUES ('admin', 'Administrador del sistema')
  ON CONFLICT (name) DO NOTHING;

  INSERT INTO roles (name, description)
  VALUES ('manager', 'Gerente')
  ON CONFLICT (name) DO NOTHING;

  INSERT INTO roles (name, description)
  VALUES ('employee', 'Empleado')
  ON CONFLICT (name) DO NOTHING;

  -- Crear perfil para el nuevo usuario
  INSERT INTO profiles (id, email, name, role_id, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    (SELECT id FROM roles WHERE name = COALESCE(NEW.raw_user_meta_data->>'role', 'admin') LIMIT 1),
    true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para nuevos usuarios
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Insertar roles básicos
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrador del sistema'),
  ('manager', 'Gerente'),
  ('employee', 'Empleado')
ON CONFLICT (name) DO NOTHING;

-- Insertar permisos básicos
INSERT INTO permissions (name, description, resource, action) VALUES
  ('users.read', 'Ver usuarios', 'users', 'read'),
  ('users.create', 'Crear usuarios', 'users', 'create'),
  ('users.update', 'Actualizar usuarios', 'users', 'update'),
  ('users.delete', 'Eliminar usuarios', 'users', 'delete'),
  ('products.read', 'Ver productos', 'products', 'read'),
  ('products.create', 'Crear productos', 'products', 'create'),
  ('products.update', 'Actualizar productos', 'products', 'update'),
  ('products.delete', 'Eliminar productos', 'products', 'delete'),
  ('sales.read', 'Ver ventas', 'sales', 'read'),
  ('sales.create', 'Crear ventas', 'sales', 'create'),
  ('sales.update', 'Actualizar ventas', 'sales', 'update'),
  ('sales.delete', 'Eliminar ventas', 'sales', 'delete'),
  ('categories.read', 'Ver categorías', 'categories', 'read'),
  ('categories.create', 'Crear categorías', 'categories', 'create'),
  ('categories.update', 'Actualizar categorías', 'categories', 'update'),
  ('categories.delete', 'Eliminar categorías', 'categories', 'delete'),
  ('suppliers.read', 'Ver proveedores', 'suppliers', 'read'),
  ('suppliers.create', 'Crear proveedores', 'suppliers', 'create'),
  ('suppliers.update', 'Actualizar proveedores', 'suppliers', 'update'),
  ('suppliers.delete', 'Eliminar proveedores', 'suppliers', 'delete'),
  ('customers.read', 'Ver clientes', 'customers', 'read'),
  ('customers.create', 'Crear clientes', 'customers', 'create'),
  ('customers.update', 'Actualizar clientes', 'customers', 'update'),
  ('customers.delete', 'Eliminar clientes', 'customers', 'delete'),
  ('cash_register.read', 'Ver caja registradora', 'cash_register', 'read'),
  ('cash_register.create', 'Abrir caja registradora', 'cash_register', 'create'),
  ('cash_register.update', 'Cerrar caja registradora', 'cash_register', 'update')
ON CONFLICT (name) DO NOTHING;

-- Asignar todos los permisos al rol admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  r.id,
  p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Asignar permisos limitados al rol manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  r.id,
  p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager'
  AND p.resource IN ('products', 'sales', 'categories', 'suppliers', 'customers', 'cash_register')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Asignar permisos básicos al rol employee
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  r.id,
  p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'employee'
  AND p.resource IN ('products', 'sales', 'customers')
  AND p.action IN ('read', 'create')
ON CONFLICT (role_id, permission_id) DO NOTHING;