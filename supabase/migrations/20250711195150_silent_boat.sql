/*
  # Sistema de Autenticación y Perfiles de Usuario

  1. Nuevas Tablas
    - Actualización de la tabla `profiles` para vincular con auth.users
    - Función para crear perfiles automáticamente al registrar usuarios
    - Políticas RLS para seguridad

  2. Seguridad
    - Enable RLS en todas las tablas
    - Políticas para que usuarios solo accedan a sus datos permitidos
    - Función trigger para crear perfiles automáticamente

  3. Funciones
    - handle_new_user(): Crea perfil automáticamente al registrar usuario
    - Políticas de acceso basadas en roles
*/

-- Función para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role_id, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    (SELECT id FROM public.roles WHERE name = 'employee' LIMIT 1),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Actualizar políticas de profiles para autenticación
DROP POLICY IF EXISTS "Los usuarios pueden leer todos los perfiles" ON profiles;
DROP POLICY IF EXISTS "Los usuarios pueden insertar su propio perfil" ON profiles;
DROP POLICY IF EXISTS "Los usuarios pueden actualizar su propio perfil" ON profiles;

CREATE POLICY "Usuarios autenticados pueden leer perfiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios pueden actualizar su propio perfil"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Sistema puede insertar perfiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Función para obtener el perfil del usuario actual
CREATE OR REPLACE FUNCTION get_current_user_profile()
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  role_name text,
  is_active boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.name,
    r.name as role_name,
    p.is_active
  FROM profiles p
  LEFT JOIN roles r ON p.role_id = r.id
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si el usuario tiene un rol específico
CREATE OR REPLACE FUNCTION user_has_role(role_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() 
    AND r.name = role_name 
    AND p.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insertar roles por defecto si no existen
INSERT INTO roles (name, description) VALUES 
  ('admin', 'Administrador del sistema'),
  ('manager', 'Gerente con permisos avanzados'),
  ('employee', 'Empleado con permisos básicos')
ON CONFLICT (name) DO NOTHING;

-- Insertar permisos por defecto si no existen
INSERT INTO permissions (name, description, module) VALUES 
  ('users.read', 'Leer usuarios', 'users'),
  ('users.write', 'Crear y editar usuarios', 'users'),
  ('users.delete', 'Eliminar usuarios', 'users'),
  ('products.read', 'Leer productos', 'products'),
  ('products.write', 'Crear y editar productos', 'products'),
  ('products.delete', 'Eliminar productos', 'products'),
  ('sales.read', 'Leer ventas', 'sales'),
  ('sales.write', 'Crear ventas', 'sales'),
  ('sales.delete', 'Eliminar ventas', 'sales'),
  ('cash_register.read', 'Leer caja registradora', 'cash_register'),
  ('cash_register.write', 'Operar caja registradora', 'cash_register'),
  ('reports.read', 'Ver reportes', 'reports')
ON CONFLICT (name) DO NOTHING;

-- Asignar permisos a roles
WITH admin_role AS (SELECT id FROM roles WHERE name = 'admin'),
     manager_role AS (SELECT id FROM roles WHERE name = 'manager'),
     employee_role AS (SELECT id FROM roles WHERE name = 'employee')
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (
  -- Admin tiene todos los permisos
  SELECT (SELECT id FROM admin_role) as role_id, id as permission_id FROM permissions
  UNION ALL
  -- Manager tiene permisos de lectura y escritura, no delete de usuarios
  SELECT (SELECT id FROM manager_role) as role_id, id as permission_id 
  FROM permissions 
  WHERE name NOT IN ('users.delete')
  UNION ALL
  -- Employee tiene permisos básicos
  SELECT (SELECT id FROM employee_role) as role_id, id as permission_id 
  FROM permissions 
  WHERE name IN ('products.read', 'sales.read', 'sales.write', 'cash_register.read', 'cash_register.write')
) AS role_perms
JOIN permissions p ON p.id = role_perms.permission_id
JOIN roles r ON r.id = role_perms.role_id
ON CONFLICT (role_id, permission_id) DO NOTHING;