/*
  # Create test accounts for login

  1. Test Accounts
    - Creates admin@ventasfull.com (admin role)
    - Creates juan@empresa.com (employee role) 
    - Creates carlos@empresa.com (manager role)
  
  2. Security
    - Uses proper password hashing with bcrypt
    - Creates both auth.users and public.users entries
    - Sets up employee_passwords for custom auth system
*/

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to create test user with auth and profile
CREATE OR REPLACE FUNCTION create_test_user(
  p_email text,
  p_password text,
  p_name text,
  p_role text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_encrypted_password text;
BEGIN
  -- Generate user ID
  v_user_id := gen_random_uuid();
  
  -- Hash password
  v_encrypted_password := crypt(p_password, gen_salt('bf'));
  
  -- Insert into auth.users (if not exists)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    v_encrypted_password,
    now(),
    now(),
    now(),
    'authenticated',
    'authenticated'
  )
  ON CONFLICT (email) DO NOTHING;
  
  -- Get the actual user ID (in case it already existed)
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  -- Insert into public.users (if not exists)
  INSERT INTO public.users (
    id,
    name,
    email,
    role,
    is_active,
    created_at
  )
  VALUES (
    v_user_id,
    p_name,
    p_email,
    p_role,
    true,
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;
  
  -- Insert into employee_passwords for custom auth
  INSERT INTO public.employee_passwords (
    user_id,
    password_hash,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_encrypted_password,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    updated_at = now();
END;
$$;

-- Create test accounts
SELECT create_test_user('admin@ventasfull.com', 'admin123', 'Administrador', 'admin');
SELECT create_test_user('juan@empresa.com', 'empleado123', 'Juan Pérez', 'employee');
SELECT create_test_user('carlos@empresa.com', 'empleado123', 'Carlos García', 'manager');

-- Clean up the temporary function
DROP FUNCTION create_test_user(text, text, text, text);