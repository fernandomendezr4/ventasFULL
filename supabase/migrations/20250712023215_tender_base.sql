/*
  # Employee Authentication System Functions

  This migration creates the necessary database functions for employee authentication:

  1. New Tables
    - `employee_sessions` - Stores active employee login sessions
    - `employee_passwords` - Stores hashed passwords for employees

  2. Functions
    - `authenticate_employee` - Validates employee credentials and creates session
    - `validate_employee_session` - Validates existing session tokens
    - `get_employee_permissions` - Retrieves employee permissions based on role
    - `logout_employee` - Invalidates employee session

  3. Security
    - Enable RLS on new tables
    - Add appropriate policies for session management
*/

-- Create employee_passwords table to store hashed passwords
CREATE TABLE IF NOT EXISTS employee_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create employee_sessions table to manage login sessions
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

-- RLS Policies for employee_passwords
CREATE POLICY "System can manage employee passwords"
  ON employee_passwords
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for employee_sessions
CREATE POLICY "System can manage employee sessions"
  ON employee_sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS employee_passwords_user_id_idx ON employee_passwords(user_id);
CREATE INDEX IF NOT EXISTS employee_sessions_user_id_idx ON employee_sessions(user_id);
CREATE INDEX IF NOT EXISTS employee_sessions_token_idx ON employee_sessions(session_token);
CREATE INDEX IF NOT EXISTS employee_sessions_expires_idx ON employee_sessions(expires_at);

-- Function to authenticate employee
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
  session_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record RECORD;
  v_password_record RECORD;
  v_session_token text;
  v_expires_at timestamptz;
BEGIN
  -- Find user by email
  SELECT u.id, u.name, u.email, u.role, u.is_active
  INTO v_user_record
  FROM users u
  WHERE u.email = p_email AND u.is_active = true;

  -- Check if user exists
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Get password hash
  SELECT password_hash
  INTO v_password_record
  FROM employee_passwords ep
  WHERE ep.user_id = v_user_record.id;

  -- For demo purposes, we'll use a simple password check
  -- In production, you should use proper password hashing
  IF NOT FOUND OR v_password_record.password_hash != p_password THEN
    RETURN;
  END IF;

  -- Generate session token
  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '24 hours';

  -- Clean up old sessions for this user
  DELETE FROM employee_sessions WHERE user_id = v_user_record.id;

  -- Create new session
  INSERT INTO employee_sessions (user_id, session_token, expires_at)
  VALUES (v_user_record.id, v_session_token, v_expires_at);

  -- Return user data with session token
  RETURN QUERY SELECT 
    v_user_record.id,
    v_user_record.name,
    v_user_record.email,
    v_user_record.role,
    v_user_record.is_active,
    v_session_token;
END;
$$;

-- Function to validate employee session
CREATE OR REPLACE FUNCTION validate_employee_session(
  p_session_token text
)
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
  v_session_record RECORD;
  v_user_record RECORD;
BEGIN
  -- Find valid session
  SELECT es.user_id
  INTO v_session_record
  FROM employee_sessions es
  WHERE es.session_token = p_session_token 
    AND es.expires_at > now();

  -- Check if session exists and is valid
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Update last accessed time
  UPDATE employee_sessions 
  SET last_accessed = now()
  WHERE session_token = p_session_token;

  -- Get user data
  SELECT u.id, u.name, u.email, u.role, u.is_active
  INTO v_user_record
  FROM users u
  WHERE u.id = v_session_record.user_id AND u.is_active = true;

  -- Return user data if found
  IF FOUND THEN
    RETURN QUERY SELECT 
      v_user_record.id,
      v_user_record.name,
      v_user_record.email,
      v_user_record.role,
      v_user_record.is_active;
  END IF;
END;
$$;

-- Function to get employee permissions
CREATE OR REPLACE FUNCTION get_employee_permissions(
  p_user_id uuid
)
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
    p.name as permission_name,
    p.description as permission_description,
    p.module
  FROM users u
  JOIN profiles pr ON pr.id = u.id
  JOIN role_permissions rp ON rp.role_id = pr.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE u.id = p_user_id AND u.is_active = true;
END;
$$;

-- Function to logout employee
CREATE OR REPLACE FUNCTION logout_employee(
  p_session_token text
)
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

-- Insert demo passwords for existing users (for testing purposes)
-- In production, these should be properly hashed
INSERT INTO employee_passwords (user_id, password_hash)
SELECT id, 'empleado123'
FROM users
WHERE email IN ('juan@empresa.com', 'maria@empresa.com', 'carlos@empresa.com')
ON CONFLICT DO NOTHING;

-- Clean up expired sessions periodically (you might want to set up a cron job for this)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM employee_sessions WHERE expires_at < now();
END;
$$;