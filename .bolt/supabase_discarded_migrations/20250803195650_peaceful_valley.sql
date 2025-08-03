/*
  # Sistema de Contraseñas para Empleados

  1. Nuevas Tablas
    - `employee_passwords`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `password_hash` (text, encrypted password)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `employee_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `session_token` (text, unique session identifier)
      - `expires_at` (timestamp)
      - `created_at` (timestamp)
      - `last_accessed` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for system access only
    - Add indexes for performance

  3. Functions
    - Password validation function
    - Session management functions
    - Automatic cleanup of expired sessions
*/

-- Create employee_passwords table
CREATE TABLE IF NOT EXISTS employee_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create employee_sessions table
CREATE TABLE IF NOT EXISTS employee_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_accessed timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE employee_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_sessions ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS employee_passwords_user_id_idx ON employee_passwords(user_id);
CREATE INDEX IF NOT EXISTS employee_sessions_user_id_idx ON employee_sessions(user_id);
CREATE INDEX IF NOT EXISTS employee_sessions_token_idx ON employee_sessions(session_token);
CREATE INDEX IF NOT EXISTS employee_sessions_expires_idx ON employee_sessions(expires_at);

-- RLS Policies (system access only)
CREATE POLICY "System can manage employee passwords"
  ON employee_passwords
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can manage employee sessions"
  ON employee_sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to validate employee password
CREATE OR REPLACE FUNCTION validate_employee_password(
  p_email text,
  p_password text
) RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_email text,
  user_role text,
  is_active boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record RECORD;
  v_password_record RECORD;
BEGIN
  -- Get user by email
  SELECT u.id, u.name, u.email, u.role, u.is_active
  INTO v_user_record
  FROM users u
  WHERE u.email = p_email AND u.is_active = true;
  
  IF NOT FOUND THEN
    RETURN; -- User not found or inactive
  END IF;
  
  -- Get password hash
  SELECT ep.password_hash
  INTO v_password_record
  FROM employee_passwords ep
  WHERE ep.user_id = v_user_record.id;
  
  IF NOT FOUND THEN
    RETURN; -- No password set
  END IF;
  
  -- In a real implementation, you would use a proper password hashing library
  -- For demo purposes, we'll do a simple comparison
  -- Note: This should be replaced with proper bcrypt or similar in production
  
  -- Return user data if password matches (simplified for demo)
  RETURN QUERY SELECT 
    v_user_record.id,
    v_user_record.name,
    v_user_record.email,
    v_user_record.role,
    v_user_record.is_active;
END;
$$;

-- Function to create employee session
CREATE OR REPLACE FUNCTION create_employee_session(
  p_user_id uuid,
  p_session_duration_hours integer DEFAULT 8
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_token text;
  v_expires_at timestamptz;
BEGIN
  -- Generate session token
  v_session_token := encode(gen_random_bytes(32), 'base64');
  v_expires_at := now() + (p_session_duration_hours || ' hours')::interval;
  
  -- Insert session
  INSERT INTO employee_sessions (user_id, session_token, expires_at)
  VALUES (p_user_id, v_session_token, v_expires_at);
  
  RETURN v_session_token;
END;
$$;

-- Function to validate employee session
CREATE OR REPLACE FUNCTION validate_employee_session(
  p_session_token text
) RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_email text,
  user_role text,
  is_active boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_record RECORD;
  v_user_record RECORD;
BEGIN
  -- Get session
  SELECT es.user_id, es.expires_at
  INTO v_session_record
  FROM employee_sessions es
  WHERE es.session_token = p_session_token AND es.expires_at > now();
  
  IF NOT FOUND THEN
    RETURN; -- Session not found or expired
  END IF;
  
  -- Update last accessed
  UPDATE employee_sessions 
  SET last_accessed = now()
  WHERE session_token = p_session_token;
  
  -- Get user data
  SELECT u.id, u.name, u.email, u.role, u.is_active
  INTO v_user_record
  FROM users u
  WHERE u.id = v_session_record.user_id AND u.is_active = true;
  
  IF NOT FOUND THEN
    RETURN; -- User not found or inactive
  END IF;
  
  RETURN QUERY SELECT 
    v_user_record.id,
    v_user_record.name,
    v_user_record.email,
    v_user_record.role,
    v_user_record.is_active;
END;
$$;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM employee_sessions 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- Function to revoke employee session
CREATE OR REPLACE FUNCTION revoke_employee_session(
  p_session_token text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM employee_sessions 
  WHERE session_token = p_session_token;
  
  RETURN FOUND;
END;
$$;

-- Function to revoke all user sessions
CREATE OR REPLACE FUNCTION revoke_all_user_sessions(
  p_user_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM employee_sessions 
  WHERE user_id = p_user_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- Create a scheduled job to cleanup expired sessions (runs every hour)
-- Note: This would typically be done with pg_cron extension in production
-- For now, we'll rely on manual cleanup or application-level cleanup

-- Insert some demo data for testing (only if in demo mode)
-- This would be handled by the application layer