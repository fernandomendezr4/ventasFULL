/*
  # Sistema de gestión de usuarios con contraseñas

  1. Funciones de utilidad
    - Función para generar hash de contraseña
    - Función para verificar contraseña
    - Función para crear usuario con contraseña
    - Función para autenticar usuario empleado
    - Función para validar sesión de empleado
    - Función para cerrar sesión de empleado

  2. Seguridad
    - Hashing seguro de contraseñas usando crypt
    - Gestión de sesiones con tokens únicos
    - Expiración automática de sesiones
*/

-- Función para crear usuario con contraseña
CREATE OR REPLACE FUNCTION create_user_with_password(
  p_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'employee',
  p_is_active BOOLEAN DEFAULT true
) RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_password_hash TEXT;
  v_result JSON;
BEGIN
  -- Validar que el email no exista
  IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'El email ya está registrado'
    );
  END IF;

  -- Validar longitud de contraseña
  IF LENGTH(p_password) < 6 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'La contraseña debe tener al menos 6 caracteres'
    );
  END IF;

  -- Crear el usuario
  INSERT INTO users (name, email, role, is_active)
  VALUES (p_name, p_email, p_role, p_is_active)
  RETURNING id INTO v_user_id;

  -- Generar hash de la contraseña
  v_password_hash := crypt(p_password, gen_salt('bf'));

  -- Guardar la contraseña hasheada
  INSERT INTO employee_passwords (user_id, password_hash)
  VALUES (v_user_id, v_password_hash);

  -- Retornar resultado exitoso
  RETURN json_build_object(
    'success', true,
    'user_id', v_user_id,
    'message', 'Usuario creado exitosamente'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Error al crear usuario: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar contraseña de usuario
CREATE OR REPLACE FUNCTION update_user_password(
  p_user_id UUID,
  p_new_password TEXT
) RETURNS JSON AS $$
DECLARE
  v_password_hash TEXT;
BEGIN
  -- Validar que el usuario existe
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuario no encontrado'
    );
  END IF;

  -- Validar longitud de contraseña
  IF LENGTH(p_new_password) < 6 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'La contraseña debe tener al menos 6 caracteres'
    );
  END IF;

  -- Generar hash de la nueva contraseña
  v_password_hash := crypt(p_new_password, gen_salt('bf'));

  -- Actualizar la contraseña
  UPDATE employee_passwords 
  SET password_hash = v_password_hash, updated_at = now()
  WHERE user_id = p_user_id;

  -- Si no existe registro de contraseña, crearlo
  IF NOT FOUND THEN
    INSERT INTO employee_passwords (user_id, password_hash)
    VALUES (p_user_id, v_password_hash);
  END IF;

  -- Invalidar todas las sesiones existentes del usuario
  UPDATE employee_sessions 
  SET expires_at = now() 
  WHERE user_id = p_user_id AND expires_at > now();

  RETURN json_build_object(
    'success', true,
    'message', 'Contraseña actualizada exitosamente'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Error al actualizar contraseña: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para autenticar empleado
CREATE OR REPLACE FUNCTION authenticate_employee(
  p_email TEXT,
  p_password TEXT
) RETURNS TABLE(
  user_id UUID,
  name TEXT,
  email TEXT,
  role TEXT,
  is_active BOOLEAN,
  session_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_user_record RECORD;
  v_password_hash TEXT;
  v_session_token TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Buscar el usuario
  SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, ep.password_hash
  INTO v_user_record
  FROM users u
  LEFT JOIN employee_passwords ep ON u.id = ep.user_id
  WHERE u.email = p_email;

  -- Verificar que el usuario existe
  IF v_user_record.id IS NULL THEN
    RETURN;
  END IF;

  -- Verificar que el usuario está activo
  IF NOT v_user_record.is_active THEN
    RETURN;
  END IF;

  -- Verificar que tiene contraseña configurada
  IF v_user_record.password_hash IS NULL THEN
    RETURN;
  END IF;

  -- Verificar la contraseña
  IF NOT (v_user_record.password_hash = crypt(p_password, v_user_record.password_hash)) THEN
    RETURN;
  END IF;

  -- Generar token de sesión
  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '24 hours';

  -- Crear sesión
  INSERT INTO employee_sessions (user_id, session_token, expires_at)
  VALUES (v_user_record.id, v_session_token, v_expires_at);

  -- Retornar datos del usuario y sesión
  RETURN QUERY SELECT 
    v_user_record.id,
    v_user_record.name,
    v_user_record.email,
    v_user_record.role,
    v_user_record.is_active,
    v_session_token,
    v_expires_at,
    v_user_record.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para validar sesión de empleado
CREATE OR REPLACE FUNCTION validate_employee_session(
  p_session_token TEXT
) RETURNS TABLE(
  user_id UUID,
  name TEXT,
  email TEXT,
  role TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_session_record RECORD;
BEGIN
  -- Buscar la sesión válida
  SELECT es.user_id, u.name, u.email, u.role, u.is_active, u.created_at
  INTO v_session_record
  FROM employee_sessions es
  JOIN users u ON es.user_id = u.id
  WHERE es.session_token = p_session_token 
    AND es.expires_at > now()
    AND u.is_active = true;

  -- Si la sesión es válida, actualizar último acceso
  IF v_session_record.user_id IS NOT NULL THEN
    UPDATE employee_sessions 
    SET last_accessed = now()
    WHERE session_token = p_session_token;

    -- Retornar datos del usuario
    RETURN QUERY SELECT 
      v_session_record.user_id,
      v_session_record.name,
      v_session_record.email,
      v_session_record.role,
      v_session_record.is_active,
      v_session_record.created_at;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para cerrar sesión de empleado
CREATE OR REPLACE FUNCTION logout_employee(
  p_session_token TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Marcar la sesión como expirada
  UPDATE employee_sessions 
  SET expires_at = now()
  WHERE session_token = p_session_token;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar sesiones expiradas (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM employee_sessions 
  WHERE expires_at < now() - interval '1 day';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;