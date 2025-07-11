/*
  # Create Test Admin User with Confirmed Email

  1. New Test User
    - Creates a confirmed admin user in auth.users
    - Email: admin@test.com
    - Password: admin123
    - Status: confirmed (bypasses email confirmation)
  
  2. Profile Creation
    - Creates corresponding profile in profiles table
    - Assigns admin role
    - Sets as active user
  
  3. Security
    - User is immediately usable without email confirmation
    - Proper role assignment for full system access
*/

-- Insert confirmed user directly into auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  aud,
  role
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@test.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '',
  '',
  '',
  'authenticated',
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

-- Get the admin role ID
DO $$
DECLARE
  admin_role_id uuid;
  test_user_id uuid;
BEGIN
  -- Get admin role ID
  SELECT id INTO admin_role_id FROM roles WHERE name = 'Administrador' LIMIT 1;
  
  -- If admin role doesn't exist, create it
  IF admin_role_id IS NULL THEN
    INSERT INTO roles (name, description) 
    VALUES ('Administrador', 'Acceso completo al sistema')
    RETURNING id INTO admin_role_id;
  END IF;
  
  -- Get the test user ID
  SELECT id INTO test_user_id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1;
  
  -- Create profile for test user if it doesn't exist
  IF test_user_id IS NOT NULL THEN
    INSERT INTO profiles (id, email, name, role_id, is_active)
    VALUES (test_user_id, 'admin@test.com', 'Administrador de Prueba', admin_role_id, true)
    ON CONFLICT (id) DO UPDATE SET
      role_id = admin_role_id,
      is_active = true;
  END IF;
END $$;