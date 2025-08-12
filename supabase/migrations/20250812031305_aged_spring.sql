/*
  # Create authentication support functions

  1. Functions
    - `handle_failed_login` - Track and manage failed login attempts
    - `validate_password_strength` - Validate password security requirements
    - `cleanup_expired_sessions` - Clean up old session data
    - `get_user_statistics` - Get user statistics for admin dashboard

  2. Security
    - Functions use SECURITY DEFINER for controlled access
    - Proper parameter validation
    - Rate limiting and lockout mechanisms
*/

-- Function to handle failed login attempts
CREATE OR REPLACE FUNCTION public.handle_failed_login(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _user_id UUID;
    _failed_attempts INTEGER;
    _lockout_duration INTERVAL := '15 minutes';
    _max_attempts INTEGER := 5;
BEGIN
    -- Get user info
    SELECT id, COALESCE(failed_login_attempts, 0) 
    INTO _user_id, _failed_attempts
    FROM public.users
    WHERE email = user_email AND is_active = true;

    -- Only process if user exists
    IF _user_id IS NOT NULL THEN
        _failed_attempts := _failed_attempts + 1;

        -- Lock account if max attempts reached
        IF _failed_attempts >= _max_attempts THEN
            UPDATE public.users
            SET 
                failed_login_attempts = _failed_attempts,
                locked_until = NOW() + _lockout_duration
            WHERE id = _user_id;
        ELSE
            UPDATE public.users
            SET failed_login_attempts = _failed_attempts
            WHERE id = _user_id;
        END IF;
    END IF;
END;
$$;

-- Function to validate password strength
CREATE OR REPLACE FUNCTION public.validate_password_strength(password_text TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _score INTEGER := 0;
    _feedback TEXT[] := ARRAY[]::TEXT[];
    _is_valid BOOLEAN := FALSE;
BEGIN
    -- Check length
    IF LENGTH(password_text) >= 8 THEN
        _score := _score + 1;
    ELSE
        _feedback := array_append(_feedback, 'La contraseña debe tener al menos 8 caracteres');
    END IF;

    -- Check for uppercase
    IF password_text ~ '[A-Z]' THEN
        _score := _score + 1;
    ELSE
        _feedback := array_append(_feedback, 'Incluye al menos una letra mayúscula');
    END IF;

    -- Check for lowercase
    IF password_text ~ '[a-z]' THEN
        _score := _score + 1;
    ELSE
        _feedback := array_append(_feedback, 'Incluye al menos una letra minúscula');
    END IF;

    -- Check for numbers
    IF password_text ~ '[0-9]' THEN
        _score := _score + 1;
    ELSE
        _feedback := array_append(_feedback, 'Incluye al menos un número');
    END IF;

    -- Check for special characters
    IF password_text ~ '[!@#$%^&*(),.?":{}|<>]' THEN
        _score := _score + 1;
    ELSE
        _feedback := array_append(_feedback, 'Incluye al menos un carácter especial');
    END IF;

    _is_valid := _score >= 4;

    RETURN json_build_object(
        'is_valid', _is_valid,
        'score', _score,
        'feedback', _feedback
    );
END;
$$;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _deleted_count INTEGER;
BEGIN
    DELETE FROM public.employee_sessions
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS _deleted_count = ROW_COUNT;
    
    RETURN _deleted_count;
END;
$$;

-- Function to get user statistics
CREATE OR REPLACE FUNCTION public.get_user_statistics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _total_users INTEGER;
    _active_users INTEGER;
    _locked_users INTEGER;
    _active_sessions INTEGER;
BEGIN
    -- Count total users
    SELECT COUNT(*) INTO _total_users FROM public.users;
    
    -- Count active users
    SELECT COUNT(*) INTO _active_users FROM public.users WHERE is_active = true;
    
    -- Count locked users
    SELECT COUNT(*) INTO _locked_users FROM public.users WHERE locked_until > NOW();
    
    -- Count active sessions
    SELECT COUNT(*) INTO _active_sessions FROM public.employee_sessions WHERE expires_at > NOW();

    RETURN json_build_object(
        'total_users', _total_users,
        'active_users', _active_users,
        'locked_users', _locked_users,
        'active_sessions', _active_sessions
    );
END;
$$;

-- Function to change user password securely
CREATE OR REPLACE FUNCTION public.change_user_password(
    target_user_id UUID,
    new_password_hash TEXT,
    changed_by_user_id UUID,
    change_reason TEXT DEFAULT 'manual_change'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _target_user RECORD;
    _changing_user RECORD;
BEGIN
    -- Get target user info
    SELECT * INTO _target_user FROM public.users WHERE id = target_user_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Usuario objetivo no encontrado');
    END IF;

    -- Get changing user info
    SELECT * INTO _changing_user FROM public.users WHERE id = changed_by_user_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Usuario que realiza el cambio no encontrado');
    END IF;

    -- Check permissions (only admin can change other users' passwords)
    IF target_user_id != changed_by_user_id AND _changing_user.role != 'admin' THEN
        RETURN json_build_object('success', false, 'error', 'Sin permisos para cambiar contraseña de otro usuario');
    END IF;

    -- Update password
    INSERT INTO public.employee_passwords (user_id, password_hash, must_change, updated_at)
    VALUES (target_user_id, new_password_hash, false, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        password_hash = EXCLUDED.password_hash,
        must_change = false,
        updated_at = NOW();

    -- Reset failed login attempts
    UPDATE public.users 
    SET 
        failed_login_attempts = 0,
        locked_until = NULL
    WHERE id = target_user_id;

    RETURN json_build_object('success', true);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.handle_failed_login(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_password_strength(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_user_password(UUID, TEXT, UUID, TEXT) TO authenticated;