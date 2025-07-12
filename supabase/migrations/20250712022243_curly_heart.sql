/*
  # Sistema de autenticación y permisos para empleados

  1. Nuevas tablas
    - `employee_sessions` - Sesiones de empleados
    - `role_permissions` - Relación entre roles y permisos (ya existe)
    - `permissions` - Permisos del sistema (ya existe)
    - `roles` - Roles del sistema (ya existe)

  2. Funciones
    - `authenticate_employee` - Autenticar empleado con email/password
    - `get_employee_permissions` - Obtener permisos de un empleado
    - `check_employee_permission` - Verificar si empleado tiene permiso específico

  3. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas para empleados autenticados
*/

-- Crear tabla de sesiones de empleados
CREATE TABLE IF NOT EXISTS employee_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text
);

-- Índices para employee_sessions
CREATE INDEX IF NOT EXISTS employee_sessions_user_id_idx ON employee_sessions(user_id);
CREATE INDEX IF NOT EXISTS employee_sessions_token_idx ON employee_sessions(session_token);
CREATE INDEX IF NOT EXISTS employee_sessions_expires_idx ON employee_sessions(expires_at);

-- Habilitar RLS
ALTER TABLE employee_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas para employee_sessions
CREATE POLICY "Empleados pueden ver sus propias sesiones"
  ON employee_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Sistema puede insertar sesiones"
  ON employee_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Empleados pueden actualizar sus sesiones"
  ON employee_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Empleados pueden eliminar sus sesiones"
  ON employee_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Función para autenticar empleado
CREATE OR REPLACE FUNCTION authenticate_employee(
  p_email text,
  p_password text
)
RETURNS TABLE(
  user_id uuid,
  name text,
  email text,
  role text,
  is_active boolean,
  session_token text,
  expires_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record users%ROWTYPE;
  v_session_token text;
  v_expires_at timestamptz;
BEGIN
  -- Buscar usuario por email
  SELECT * INTO v_user_record
  FROM users
  WHERE users.email = p_email
    AND users.is_active = true;

  -- Verificar si el usuario existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credenciales inválidas';
  END IF;

  -- En un sistema real, aquí verificarías el hash de la contraseña
  -- Por simplicidad, usamos una contraseña fija para demo
  IF p_password != 'empleado123' THEN
    RAISE EXCEPTION 'Credenciales inválidas';
  END IF;

  -- Generar token de sesión
  v_session_token := encode(gen_random_bytes(32), 'base64');
  v_expires_at := now() + interval '8 hours';

  -- Crear sesión
  INSERT INTO employee_sessions (user_id, session_token, expires_at)
  VALUES (v_user_record.id, v_session_token, v_expires_at);

  -- Retornar datos del usuario y sesión
  RETURN QUERY
  SELECT 
    v_user_record.id,
    v_user_record.name,
    v_user_record.email,
    v_user_record.role,
    v_user_record.is_active,
    v_session_token,
    v_expires_at;
END;
$$;

-- Función para obtener permisos de empleado
CREATE OR REPLACE FUNCTION get_employee_permissions(p_user_id uuid)
RETURNS TABLE(
  permission_name text,
  permission_description text,
  module text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name,
    p.description,
    p.module
  FROM users u
  JOIN roles r ON u.role = r.name
  JOIN role_permissions rp ON r.id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE u.id = p_user_id
    AND u.is_active = true;
END;
$$;

-- Función para verificar permiso específico
CREATE OR REPLACE FUNCTION check_employee_permission(
  p_user_id uuid,
  p_permission_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_permission boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM users u
    JOIN roles r ON u.role = r.name
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = p_user_id
      AND u.is_active = true
      AND p.name = p_permission_name
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$;

-- Función para validar sesión de empleado
CREATE OR REPLACE FUNCTION validate_employee_session(p_session_token text)
RETURNS TABLE(
  user_id uuid,
  name text,
  email text,
  role text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record employee_sessions%ROWTYPE;
  v_user_record users%ROWTYPE;
BEGIN
  -- Buscar sesión válida
  SELECT * INTO v_session_record
  FROM employee_sessions
  WHERE session_token = p_session_token
    AND expires_at > now();

  -- Verificar si la sesión existe y es válida
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión inválida o expirada';
  END IF;

  -- Obtener datos del usuario
  SELECT * INTO v_user_record
  FROM users
  WHERE id = v_session_record.user_id
    AND is_active = true;

  -- Verificar si el usuario está activo
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  -- Actualizar última actividad
  UPDATE employee_sessions
  SET last_activity = now()
  WHERE id = v_session_record.id;

  -- Retornar datos del usuario
  RETURN QUERY
  SELECT 
    v_user_record.id,
    v_user_record.name,
    v_user_record.email,
    v_user_record.role,
    v_user_record.is_active;
END;
$$;

-- Función para cerrar sesión de empleado
CREATE OR REPLACE FUNCTION logout_employee(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM employee_sessions
  WHERE session_token = p_session_token;

  RETURN FOUND;
END;
$$;

-- Insertar permisos básicos si no existen
INSERT INTO permissions (name, description, module) VALUES
  ('view_dashboard', 'Ver dashboard principal', 'dashboard'),
  ('manage_products', 'Gestionar productos', 'inventory'),
  ('view_products', 'Ver productos', 'inventory'),
  ('manage_categories', 'Gestionar categorías', 'inventory'),
  ('view_categories', 'Ver categorías', 'inventory'),
  ('create_sales', 'Crear ventas', 'sales'),
  ('view_sales', 'Ver historial de ventas', 'sales'),
  ('manage_sales', 'Gestionar ventas (editar/eliminar)', 'sales'),
  ('manage_installments', 'Gestionar abonos', 'sales'),
  ('manage_cash_register', 'Gestionar caja registradora', 'sales'),
  ('manage_customers', 'Gestionar clientes', 'customers'),
  ('view_customers', 'Ver clientes', 'customers'),
  ('manage_suppliers', 'Gestionar proveedores', 'suppliers'),
  ('view_suppliers', 'Ver proveedores', 'suppliers'),
  ('manage_users', 'Gestionar usuarios', 'admin'),
  ('view_reports', 'Ver reportes', 'reports')
ON CONFLICT (name) DO NOTHING;

-- Insertar roles básicos si no existen
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrador del sistema'),
  ('manager', 'Gerente con permisos avanzados'),
  ('employee', 'Empleado con permisos básicos'),
  ('cashier', 'Cajero con permisos de ventas')
ON CONFLICT (name) DO NOTHING;

-- Asignar permisos a roles
DO $$
DECLARE
  admin_role_id uuid;
  manager_role_id uuid;
  employee_role_id uuid;
  cashier_role_id uuid;
BEGIN
  -- Obtener IDs de roles
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
  SELECT id INTO manager_role_id FROM roles WHERE name = 'manager';
  SELECT id INTO employee_role_id FROM roles WHERE name = 'employee';
  SELECT id INTO cashier_role_id FROM roles WHERE name = 'cashier';

  -- Permisos para admin (todos)
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT admin_role_id, id FROM permissions
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- Permisos para manager
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT manager_role_id, id FROM permissions 
  WHERE name IN (
    'view_dashboard', 'manage_products', 'view_products', 'manage_categories', 'view_categories',
    'create_sales', 'view_sales', 'manage_sales', 'manage_installments', 'manage_cash_register',
    'manage_customers', 'view_customers', 'manage_suppliers', 'view_suppliers', 'view_reports'
  )
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- Permisos para employee
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT employee_role_id, id FROM permissions 
  WHERE name IN (
    'view_dashboard', 'view_products', 'view_categories', 'create_sales', 'view_sales',
    'view_customers', 'view_suppliers'
  )
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- Permisos para cashier
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT cashier_role_id, id FROM permissions 
  WHERE name IN (
    'view_dashboard', 'view_products', 'create_sales', 'view_sales', 'manage_cash_register',
    'view_customers', 'manage_customers'
  )
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END $$;

-- Crear algunos usuarios de ejemplo para testing
INSERT INTO users (name, email, role, is_active) VALUES
  ('Juan Pérez', 'juan@empresa.com', 'employee', true),
  ('María García', 'maria@empresa.com', 'cashier', true),
  ('Carlos López', 'carlos@empresa.com', 'manager', true)
ON CONFLICT (email) DO NOTHING;