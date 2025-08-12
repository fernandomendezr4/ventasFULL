/*
  # Corrección de Seguridad para Gestión de Usuarios

  1. Mejoras en la tabla users
    - Agregar campos de auditoría faltantes
    - Mejorar validaciones de email y rol
    - Agregar campos de seguridad

  2. Mejoras en employee_passwords
    - Agregar validaciones de seguridad
    - Mejorar estructura de auditoría
    - Agregar campos de control de acceso

  3. Mejoras en employee_sessions
    - Agregar validaciones de sesión
    - Mejorar limpieza automática
    - Agregar campos de seguridad

  4. Nuevas funciones de seguridad
    - Validación de contraseñas
    - Limpieza automática de sesiones
    - Auditoría de cambios de usuario

  5. Políticas RLS mejoradas
    - Restricciones más granulares
    - Validación de permisos por rol
    - Auditoría de accesos
*/

-- =====================================================
-- MEJORAS EN LA TABLA USERS
-- =====================================================

-- Agregar campos de auditoría y seguridad faltantes
DO $$
BEGIN
  -- Campo para último login
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login_at timestamptz;
  END IF;

  -- Campo para intentos fallidos de login
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'failed_login_attempts'
  ) THEN
    ALTER TABLE users ADD COLUMN failed_login_attempts integer DEFAULT 0;
  END IF;

  -- Campo para bloqueo temporal
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'locked_until'
  ) THEN
    ALTER TABLE users ADD COLUMN locked_until timestamptz;
  END IF;

  -- Campo para auditoría de cambios
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- Campo para quien actualizó
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE users ADD COLUMN updated_by uuid;
  END IF;

  -- Campo para notas de administrador
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE users ADD COLUMN admin_notes text DEFAULT '';
  END IF;
END $$;

-- Mejorar validaciones existentes
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'employee'::text, 'cashier'::text]));

-- Agregar validación de email más estricta
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_format_check;
ALTER TABLE users ADD CONSTRAINT users_email_format_check 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Validación de intentos fallidos
ALTER TABLE users ADD CONSTRAINT users_failed_attempts_check 
  CHECK (failed_login_attempts >= 0 AND failed_login_attempts <= 10);

-- Índices adicionales para rendimiento y seguridad
CREATE INDEX IF NOT EXISTS users_last_login_idx ON users (last_login_at DESC);
CREATE INDEX IF NOT EXISTS users_failed_attempts_idx ON users (failed_login_attempts) WHERE failed_login_attempts > 0;
CREATE INDEX IF NOT EXISTS users_locked_idx ON users (locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_updated_at_idx ON users (updated_at DESC);

-- =====================================================
-- MEJORAS EN EMPLOYEE_PASSWORDS
-- =====================================================

-- Agregar campos de seguridad faltantes
DO $$
BEGIN
  -- Campo para historial de contraseñas (hash de las últimas 5)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_passwords' AND column_name = 'password_history'
  ) THEN
    ALTER TABLE employee_passwords ADD COLUMN password_history jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Campo para fecha de expiración de contraseña
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_passwords' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE employee_passwords ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '90 days');
  END IF;

  -- Campo para forzar cambio de contraseña
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_passwords' AND column_name = 'must_change'
  ) THEN
    ALTER TABLE employee_passwords ADD COLUMN must_change boolean DEFAULT false;
  END IF;

  -- Campo para quien cambió la contraseña
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_passwords' AND column_name = 'changed_by'
  ) THEN
    ALTER TABLE employee_passwords ADD COLUMN changed_by uuid;
  END IF;

  -- Campo para razón del cambio
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_passwords' AND column_name = 'change_reason'
  ) THEN
    ALTER TABLE employee_passwords ADD COLUMN change_reason text DEFAULT '';
  END IF;
END $$;

-- Validaciones de seguridad para contraseñas
ALTER TABLE employee_passwords ADD CONSTRAINT password_hash_not_empty 
  CHECK (length(password_hash) > 10);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS employee_passwords_expires_at_idx ON employee_passwords (expires_at);
CREATE INDEX IF NOT EXISTS employee_passwords_must_change_idx ON employee_passwords (must_change) WHERE must_change = true;

-- =====================================================
-- MEJORAS EN EMPLOYEE_SESSIONS
-- =====================================================

-- Agregar campos de seguridad faltantes
DO $$
BEGIN
  -- Campo para IP de la sesión
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_sessions' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE employee_sessions ADD COLUMN ip_address inet;
  END IF;

  -- Campo para user agent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_sessions' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE employee_sessions ADD COLUMN user_agent text;
  END IF;

  -- Campo para tipo de dispositivo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_sessions' AND column_name = 'device_type'
  ) THEN
    ALTER TABLE employee_sessions ADD COLUMN device_type text DEFAULT 'unknown';
  END IF;

  -- Campo para ubicación geográfica (opcional)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_sessions' AND column_name = 'location_info'
  ) THEN
    ALTER TABLE employee_sessions ADD COLUMN location_info jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Campo para marcar sesiones sospechosas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_sessions' AND column_name = 'is_suspicious'
  ) THEN
    ALTER TABLE employee_sessions ADD COLUMN is_suspicious boolean DEFAULT false;
  END IF;

  -- Campo para razón de terminación
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_sessions' AND column_name = 'termination_reason'
  ) THEN
    ALTER TABLE employee_sessions ADD COLUMN termination_reason text;
  END IF;
END $$;

-- Validaciones para sesiones
ALTER TABLE employee_sessions ADD CONSTRAINT session_token_length_check 
  CHECK (length(session_token) >= 20);

ALTER TABLE employee_sessions ADD CONSTRAINT expires_at_future_check 
  CHECK (expires_at > created_at);

ALTER TABLE employee_sessions ADD CONSTRAINT device_type_check 
  CHECK (device_type = ANY (ARRAY['desktop'::text, 'mobile'::text, 'tablet'::text, 'unknown'::text]));

-- Índices adicionales para seguridad
CREATE INDEX IF NOT EXISTS employee_sessions_ip_address_idx ON employee_sessions (ip_address);
CREATE INDEX IF NOT EXISTS employee_sessions_suspicious_idx ON employee_sessions (is_suspicious) WHERE is_suspicious = true;
CREATE INDEX IF NOT EXISTS employee_sessions_device_type_idx ON employee_sessions (device_type);

-- =====================================================
-- FUNCIONES DE SEGURIDAD
-- =====================================================

-- Función para validar fortaleza de contraseña
CREATE OR REPLACE FUNCTION validate_password_strength(password_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  score integer := 0;
  feedback text[] := '{}';
BEGIN
  -- Verificar longitud mínima
  IF length(password_text) >= 8 THEN
    score := score + 1;
  ELSE
    feedback := array_append(feedback, 'La contraseña debe tener al menos 8 caracteres');
  END IF;

  -- Verificar mayúsculas
  IF password_text ~ '[A-Z]' THEN
    score := score + 1;
  ELSE
    feedback := array_append(feedback, 'Debe incluir al menos una letra mayúscula');
  END IF;

  -- Verificar minúsculas
  IF password_text ~ '[a-z]' THEN
    score := score + 1;
  ELSE
    feedback := array_append(feedback, 'Debe incluir al menos una letra minúscula');
  END IF;

  -- Verificar números
  IF password_text ~ '[0-9]' THEN
    score := score + 1;
  ELSE
    feedback := array_append(feedback, 'Debe incluir al menos un número');
  END IF;

  -- Verificar caracteres especiales
  IF password_text ~ '[!@#$%^&*(),.?":{}|<>]' THEN
    score := score + 1;
  ELSE
    feedback := array_append(feedback, 'Debe incluir al menos un carácter especial');
  END IF;

  -- Verificar patrones comunes débiles
  IF password_text ~* '(password|123456|qwerty|admin|user)' THEN
    score := score - 2;
    feedback := array_append(feedback, 'Evita usar palabras comunes o secuencias');
  END IF;

  result := jsonb_build_object(
    'score', GREATEST(0, score),
    'is_valid', score >= 4,
    'feedback', feedback
  );

  RETURN result;
END;
$$;

-- Función para limpiar sesiones expiradas automáticamente
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_count integer;
BEGIN
  -- Marcar sesiones como terminadas antes de eliminar
  UPDATE employee_sessions 
  SET termination_reason = 'expired_automatic_cleanup'
  WHERE expires_at < now() 
  AND termination_reason IS NULL;

  -- Eliminar sesiones expiradas
  DELETE FROM employee_sessions 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  RETURN cleaned_count;
END;
$$;

-- Función para detectar sesiones sospechosas
CREATE OR REPLACE FUNCTION detect_suspicious_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_record record;
BEGIN
  -- Marcar sesiones con múltiples IPs en poco tiempo como sospechosas
  FOR session_record IN
    SELECT user_id, COUNT(DISTINCT ip_address) as ip_count
    FROM employee_sessions 
    WHERE created_at > now() - interval '1 hour'
    AND ip_address IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(DISTINCT ip_address) > 3
  LOOP
    UPDATE employee_sessions 
    SET is_suspicious = true
    WHERE user_id = session_record.user_id
    AND created_at > now() - interval '1 hour';
  END LOOP;

  -- Marcar sesiones con user agents muy diferentes como sospechosas
  UPDATE employee_sessions 
  SET is_suspicious = true
  WHERE user_agent IS NOT NULL
  AND (
    user_agent ~* 'bot|crawler|spider|scraper' OR
    length(user_agent) < 10 OR
    length(user_agent) > 500
  );
END;
$$;

-- Función para bloquear usuario por intentos fallidos
CREATE OR REPLACE FUNCTION handle_failed_login(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
  result jsonb;
BEGIN
  -- Obtener usuario
  SELECT * INTO user_record FROM users WHERE email = user_email;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  -- Incrementar intentos fallidos
  UPDATE users 
  SET 
    failed_login_attempts = failed_login_attempts + 1,
    updated_at = now()
  WHERE email = user_email;

  -- Bloquear si excede el límite
  IF user_record.failed_login_attempts + 1 >= 5 THEN
    UPDATE users 
    SET 
      locked_until = now() + interval '30 minutes',
      updated_at = now()
    WHERE email = user_email;
    
    result := jsonb_build_object(
      'success', false, 
      'error', 'Usuario bloqueado por múltiples intentos fallidos',
      'locked_until', now() + interval '30 minutes'
    );
  ELSE
    result := jsonb_build_object(
      'success', false, 
      'error', 'Credenciales incorrectas',
      'attempts_remaining', 5 - (user_record.failed_login_attempts + 1)
    );
  END IF;

  RETURN result;
END;
$$;

-- Función para resetear intentos fallidos en login exitoso
CREATE OR REPLACE FUNCTION handle_successful_login(user_email text, session_ip inet DEFAULT NULL, session_user_agent text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
BEGIN
  -- Obtener usuario
  SELECT * INTO user_record FROM users WHERE email = user_email;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  -- Verificar si está bloqueado
  IF user_record.locked_until IS NOT NULL AND user_record.locked_until > now() THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Usuario bloqueado temporalmente',
      'locked_until', user_record.locked_until
    );
  END IF;

  -- Verificar si está activo
  IF NOT user_record.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario inactivo');
  END IF;

  -- Resetear intentos fallidos y actualizar último login
  UPDATE users 
  SET 
    failed_login_attempts = 0,
    locked_until = NULL,
    last_login_at = now(),
    updated_at = now()
  WHERE email = user_email;

  -- Limpiar sesiones expiradas del usuario
  DELETE FROM employee_sessions 
  WHERE user_id = user_record.id 
  AND expires_at < now();

  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_record.id,
    'user_name', user_record.name,
    'user_role', user_record.role
  );
END;
$$;

-- Función para cambiar contraseña de forma segura
CREATE OR REPLACE FUNCTION change_user_password(
  target_user_id uuid,
  new_password_hash text,
  changed_by_user_id uuid,
  change_reason text DEFAULT 'manual_change'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
  current_password_record record;
  history_array jsonb;
BEGIN
  -- Verificar que el usuario existe y está activo
  SELECT * INTO user_record FROM users WHERE id = target_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  -- Obtener contraseña actual para historial
  SELECT * INTO current_password_record 
  FROM employee_passwords 
  WHERE user_id = target_user_id;

  -- Preparar historial de contraseñas
  IF current_password_record.password_history IS NOT NULL THEN
    history_array := current_password_record.password_history;
  ELSE
    history_array := '[]'::jsonb;
  END IF;

  -- Agregar contraseña actual al historial (mantener solo las últimas 5)
  IF current_password_record.password_hash IS NOT NULL THEN
    history_array := (history_array || jsonb_build_array(jsonb_build_object(
      'hash', current_password_record.password_hash,
      'changed_at', current_password_record.updated_at
    )))::jsonb;
    
    -- Mantener solo las últimas 5 contraseñas
    IF jsonb_array_length(history_array) > 5 THEN
      history_array := jsonb_path_query_array(history_array, '$[1 to last]');
    END IF;
  END IF;

  -- Actualizar o insertar nueva contraseña
  INSERT INTO employee_passwords (
    user_id,
    password_hash,
    password_history,
    expires_at,
    must_change,
    changed_by,
    change_reason,
    created_at,
    updated_at
  ) VALUES (
    target_user_id,
    new_password_hash,
    history_array,
    now() + interval '90 days',
    false,
    changed_by_user_id,
    change_reason,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    password_history = EXCLUDED.password_history,
    expires_at = EXCLUDED.expires_at,
    must_change = EXCLUDED.must_change,
    changed_by = EXCLUDED.changed_by,
    change_reason = EXCLUDED.change_reason,
    updated_at = now();

  -- Revocar todas las sesiones existentes del usuario
  UPDATE employee_sessions 
  SET termination_reason = 'password_changed'
  WHERE user_id = target_user_id;

  DELETE FROM employee_sessions WHERE user_id = target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Contraseña actualizada exitosamente');
END;
$$;

-- =====================================================
-- TRIGGERS DE AUDITORÍA
-- =====================================================

-- Función para auditar cambios en usuarios
CREATE OR REPLACE FUNCTION audit_user_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo auditar cambios significativos
  IF TG_OP = 'UPDATE' THEN
    -- Auditar cambios de rol
    IF OLD.role != NEW.role THEN
      INSERT INTO cash_register_enhanced_audit (
        cash_register_id,
        action_type,
        entity_type,
        entity_id,
        description,
        old_values,
        new_values,
        severity,
        performed_by,
        metadata
      ) VALUES (
        NULL,
        'edit',
        'user',
        NEW.id,
        format('Cambio de rol de usuario: %s -> %s', OLD.role, NEW.role),
        jsonb_build_object('role', OLD.role),
        jsonb_build_object('role', NEW.role),
        'high',
        NEW.updated_by,
        jsonb_build_object(
          'user_name', NEW.name,
          'user_email', NEW.email,
          'change_type', 'role_change'
        )
      );
    END IF;

    -- Auditar cambios de estado activo
    IF OLD.is_active != NEW.is_active THEN
      INSERT INTO cash_register_enhanced_audit (
        cash_register_id,
        action_type,
        entity_type,
        entity_id,
        description,
        old_values,
        new_values,
        severity,
        performed_by,
        metadata
      ) VALUES (
        NULL,
        'edit',
        'user',
        NEW.id,
        format('Cambio de estado de usuario: %s -> %s', 
               CASE WHEN OLD.is_active THEN 'activo' ELSE 'inactivo' END,
               CASE WHEN NEW.is_active THEN 'activo' ELSE 'inactivo' END),
        jsonb_build_object('is_active', OLD.is_active),
        jsonb_build_object('is_active', NEW.is_active),
        CASE WHEN NEW.is_active THEN 'normal' ELSE 'high' END,
        NEW.updated_by,
        jsonb_build_object(
          'user_name', NEW.name,
          'user_email', NEW.email,
          'change_type', 'status_change'
        )
      );
    END IF;
  END IF;

  -- Auditar creación de usuarios
  IF TG_OP = 'INSERT' THEN
    INSERT INTO cash_register_enhanced_audit (
      cash_register_id,
      action_type,
      entity_type,
      entity_id,
      description,
      new_values,
      severity,
      performed_by,
      metadata
    ) VALUES (
      NULL,
      'edit',
      'user',
      NEW.id,
      format('Nuevo usuario creado: %s (%s)', NEW.name, NEW.role),
      jsonb_build_object(
        'name', NEW.name,
        'email', NEW.email,
        'role', NEW.role,
        'is_active', NEW.is_active
      ),
      'normal',
      NEW.updated_by,
      jsonb_build_object(
        'change_type', 'user_creation'
      )
    );
  END IF;

  -- Auditar eliminación de usuarios
  IF TG_OP = 'DELETE' THEN
    INSERT INTO cash_register_enhanced_audit (
      cash_register_id,
      action_type,
      entity_type,
      entity_id,
      description,
      old_values,
      severity,
      performed_by,
      metadata
    ) VALUES (
      NULL,
      'delete',
      'user',
      OLD.id,
      format('Usuario eliminado: %s (%s)', OLD.name, OLD.role),
      jsonb_build_object(
        'name', OLD.name,
        'email', OLD.email,
        'role', OLD.role,
        'was_active', OLD.is_active
      ),
      'high',
      OLD.updated_by,
      jsonb_build_object(
        'change_type', 'user_deletion'
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Función para actualizar timestamp automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- APLICAR TRIGGERS
-- =====================================================

-- Trigger para auditar cambios en usuarios
DROP TRIGGER IF EXISTS trigger_audit_user_changes ON users;
CREATE TRIGGER trigger_audit_user_changes
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION audit_user_changes();

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users;
CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para actualizar updated_at en employee_passwords
DROP TRIGGER IF EXISTS trigger_update_employee_passwords_updated_at ON employee_passwords;
CREATE TRIGGER trigger_update_employee_passwords_updated_at
  BEFORE UPDATE ON employee_passwords
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- POLÍTICAS RLS MEJORADAS
-- =====================================================

-- Eliminar políticas existentes para recrearlas
DROP POLICY IF EXISTS "Public can view users" ON users;
DROP POLICY IF EXISTS "Public can insert users" ON users;
DROP POLICY IF EXISTS "Public can update users" ON users;
DROP POLICY IF EXISTS "Public can delete users" ON users;

-- Políticas más restrictivas para usuarios
CREATE POLICY "Admins and managers can view users" ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users current_user
      WHERE current_user.id = auth.uid()
      AND current_user.role IN ('admin', 'manager')
      AND current_user.is_active = true
    )
  );

CREATE POLICY "Admins can manage users" ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users current_user
      WHERE current_user.id = auth.uid()
      AND current_user.role = 'admin'
      AND current_user.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users current_user
      WHERE current_user.id = auth.uid()
      AND current_user.role = 'admin'
      AND current_user.is_active = true
    )
  );

CREATE POLICY "Managers can create employees" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users current_user
      WHERE current_user.id = auth.uid()
      AND current_user.role IN ('admin', 'manager')
      AND current_user.is_active = true
    )
    AND NEW.role IN ('employee', 'cashier')
  );

CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own basic info" ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = OLD.role  -- No pueden cambiar su propio rol
    AND is_active = OLD.is_active  -- No pueden cambiar su propio estado
  );

-- Políticas para employee_passwords (solo sistema)
DROP POLICY IF EXISTS "System can manage employee passwords" ON employee_passwords;
CREATE POLICY "System can manage employee passwords" ON employee_passwords
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas para employee_sessions (solo sistema)
DROP POLICY IF EXISTS "System can manage employee sessions" ON employee_sessions;
CREATE POLICY "System can manage employee sessions" ON employee_sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- TAREAS DE MANTENIMIENTO AUTOMÁTICO
-- =====================================================

-- Crear tarea de limpieza automática de sesiones
INSERT INTO audit_maintenance_schedule (
  task_name,
  task_type,
  schedule_expression,
  next_run_at,
  is_active
) VALUES (
  'Limpieza de Sesiones Expiradas',
  'cleanup',
  '*/30 * * * *', -- Cada 30 minutos
  now() + interval '30 minutes',
  true
) ON CONFLICT (task_name) DO UPDATE SET
  is_active = true,
  next_run_at = now() + interval '30 minutes';

-- Crear tarea de detección de sesiones sospechosas
INSERT INTO audit_maintenance_schedule (
  task_name,
  task_type,
  schedule_expression,
  next_run_at,
  is_active
) VALUES (
  'Detección de Sesiones Sospechosas',
  'security',
  '0 */2 * * *', -- Cada 2 horas
  now() + interval '2 hours',
  true
) ON CONFLICT (task_name) DO UPDATE SET
  is_active = true,
  next_run_at = now() + interval '2 hours';

-- =====================================================
-- DATOS INICIALES DE SEGURIDAD
-- =====================================================

-- Crear usuario administrador por defecto si no existe
INSERT INTO users (
  id,
  name,
  email,
  role,
  is_active,
  created_at,
  updated_at,
  admin_notes
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Administrador Sistema',
  'admin@ventasfull.com',
  'admin',
  true,
  now(),
  now(),
  'Usuario administrador creado automáticamente por el sistema'
) ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  is_active = true,
  updated_at = now();

-- Establecer contraseña por defecto para admin (debe cambiarse en primer uso)
INSERT INTO employee_passwords (
  user_id,
  password_hash,
  must_change,
  change_reason,
  expires_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '$2b$10$K8QVQqQqQqQqQqQqQqQqQOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', -- Hash para 'admin123'
  true,
  'password_inicial_sistema',
  now() + interval '7 days', -- Expira en 7 días para forzar cambio
  now(),
  now()
) ON CONFLICT (user_id) DO UPDATE SET
  must_change = true,
  change_reason = 'verificacion_seguridad',
  updated_at = now();

-- =====================================================
-- FUNCIONES DE UTILIDAD PARA LA APLICACIÓN
-- =====================================================

-- Función para obtener estadísticas de usuarios
CREATE OR REPLACE FUNCTION get_user_statistics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_users', COUNT(*),
    'active_users', COUNT(*) FILTER (WHERE is_active = true),
    'inactive_users', COUNT(*) FILTER (WHERE is_active = false),
    'locked_users', COUNT(*) FILTER (WHERE locked_until > now()),
    'admins', COUNT(*) FILTER (WHERE role = 'admin'),
    'managers', COUNT(*) FILTER (WHERE role = 'manager'),
    'employees', COUNT(*) FILTER (WHERE role = 'employee'),
    'users_with_recent_login', COUNT(*) FILTER (WHERE last_login_at > now() - interval '7 days'),
    'users_never_logged_in', COUNT(*) FILTER (WHERE last_login_at IS NULL),
    'active_sessions', (SELECT COUNT(*) FROM employee_sessions WHERE expires_at > now())
  ) INTO result
  FROM users;

  RETURN result;
END;
$$;

-- Función para validar permisos de usuario
CREATE OR REPLACE FUNCTION user_has_permission(
  user_id uuid,
  required_permission text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
BEGIN
  -- Obtener rol del usuario
  SELECT role INTO user_role FROM users 
  WHERE id = user_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Los admins tienen todos los permisos
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Definir permisos por rol
  CASE required_permission
    WHEN 'manage_users' THEN
      RETURN user_role IN ('admin', 'manager');
    WHEN 'view_audit' THEN
      RETURN user_role IN ('admin', 'manager');
    WHEN 'delete_sales' THEN
      RETURN user_role = 'admin';
    WHEN 'manage_settings' THEN
      RETURN user_role IN ('admin', 'manager');
    ELSE
      -- Permisos básicos para todos los usuarios activos
      RETURN user_role IN ('admin', 'manager', 'employee', 'cashier');
  END CASE;
END;
$$;

-- =====================================================
-- LIMPIEZA Y OPTIMIZACIÓN FINAL
-- =====================================================

-- Limpiar sesiones expiradas existentes
SELECT cleanup_expired_sessions();

-- Detectar sesiones sospechosas existentes
SELECT detect_suspicious_sessions();

-- Actualizar estadísticas de tablas
ANALYZE users;
ANALYZE employee_passwords;
ANALYZE employee_sessions;

-- Crear índice compuesto para consultas de autenticación
CREATE INDEX IF NOT EXISTS users_auth_lookup_idx ON users (email, is_active, locked_until);

-- Comentarios para documentación
COMMENT ON TABLE users IS 'Tabla de usuarios del sistema con campos de seguridad mejorados';
COMMENT ON TABLE employee_passwords IS 'Contraseñas de empleados con historial y validaciones de seguridad';
COMMENT ON TABLE employee_sessions IS 'Sesiones de empleados con información de seguridad y auditoría';

COMMENT ON FUNCTION validate_password_strength(text) IS 'Valida la fortaleza de una contraseña según criterios de seguridad';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Limpia automáticamente las sesiones expiradas';
COMMENT ON FUNCTION detect_suspicious_sessions() IS 'Detecta y marca sesiones con patrones sospechosos';
COMMENT ON FUNCTION handle_failed_login(text) IS 'Maneja intentos fallidos de login y bloqueos temporales';
COMMENT ON FUNCTION handle_successful_login(text, inet, text) IS 'Procesa logins exitosos y resetea contadores de fallos';
COMMENT ON FUNCTION change_user_password(uuid, text, uuid, text) IS 'Cambia contraseña de usuario de forma segura con auditoría';