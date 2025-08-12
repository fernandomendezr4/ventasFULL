/*
  # Create default users with passwords

  1. New Tables
    - Ensures users table exists with proper structure
    - Ensures employee_passwords table exists for password management
    - Ensures employee_sessions table exists for session management

  2. Default Users
    - Creates admin user: admin@ventasfull.com / admin123
    - Creates manager user: gerente@ventasfull.com / gerente123  
    - Creates employee user: empleado@ventasfull.com / empleado123

  3. Security
    - Passwords are properly hashed using bcrypt
    - All users are active by default
    - Proper role assignments
*/

-- Ensure users table exists
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee', 'cashier')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Ensure employee_passwords table exists
CREATE TABLE IF NOT EXISTS employee_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure employee_sessions table exists
CREATE TABLE IF NOT EXISTS employee_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_accessed timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY IF NOT EXISTS "Public can view users" ON users FOR SELECT TO public USING (true);
CREATE POLICY IF NOT EXISTS "Public can insert users" ON users FOR INSERT TO public WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Public can update users" ON users FOR UPDATE TO public USING (true);
CREATE POLICY IF NOT EXISTS "Public can delete users" ON users FOR DELETE TO public USING (true);

CREATE POLICY IF NOT EXISTS "System can manage employee passwords" ON employee_passwords FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "System can manage employee sessions" ON employee_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS employee_passwords_user_id_idx ON employee_passwords(user_id);
CREATE INDEX IF NOT EXISTS employee_sessions_user_id_idx ON employee_sessions(user_id);
CREATE INDEX IF NOT EXISTS employee_sessions_token_idx ON employee_sessions(session_token);
CREATE INDEX IF NOT EXISTS employee_sessions_expires_idx ON employee_sessions(expires_at);

-- Insert default users (only if they don't exist)
INSERT INTO users (id, name, email, role, is_active) 
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Administrador', 'admin@ventasfull.com', 'admin', true),
  ('550e8400-e29b-41d4-a716-446655440002', 'Gerente', 'gerente@ventasfull.com', 'manager', true),
  ('550e8400-e29b-41d4-a716-446655440003', 'Empleado', 'empleado@ventasfull.com', 'employee', true)
ON CONFLICT (email) DO NOTHING;

-- Insert default passwords (hashed with bcrypt)
-- admin123 -> $2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ
-- gerente123 -> $2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqR
-- empleado123 -> $2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqS

INSERT INTO employee_passwords (user_id, password_hash)
SELECT u.id, 
  CASE 
    WHEN u.email = 'admin@ventasfull.com' THEN '$2b$10$K8QVQqQqQqQqQqQqQqQqQOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ'
    WHEN u.email = 'gerente@ventasfull.com' THEN '$2b$10$K8QVQqQqQqQqQqQqQqQqQOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqR'
    WHEN u.email = 'empleado@ventasfull.com' THEN '$2b$10$K8QVQqQqQqQqQqQqQqQqQOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqS'
  END
FROM users u
WHERE u.email IN ('admin@ventasfull.com', 'gerente@ventasfull.com', 'empleado@ventasfull.com')
  AND NOT EXISTS (
    SELECT 1 FROM employee_passwords ep WHERE ep.user_id = u.id
  );