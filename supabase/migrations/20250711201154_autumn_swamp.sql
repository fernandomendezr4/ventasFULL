/*
  # Enable pgcrypto extension and fix user management functions

  1. Extensions
    - Enable `pgcrypto` extension for password hashing functions
  
  2. Updated Functions
    - Fix `create_user_with_password` to use proper password hashing
    - Fix `update_user_password` to use proper password hashing
    - Add proper error handling for missing extension
  
  3. Security
    - Functions use SECURITY DEFINER to access auth schema
    - Password hashing uses bcrypt via pgcrypto
*/

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing functions to recreate them with proper pgcrypto usage
DROP FUNCTION IF EXISTS public.create_user_with_password(text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.update_user_password(uuid, text);

-- Create user with password function using pgcrypto
CREATE OR REPLACE FUNCTION public.create_user_with_password(
  p_name text,
  p_email text,
  p_password text,
  p_role text DEFAULT 'employee',
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_hashed_password text;
BEGIN
  -- Validate inputs
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Name is required');
  END IF;
  
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email is required');
  END IF;
  
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters');
  END IF;

  -- Check if pgcrypto extension is enabled
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RETURN jsonb_build_object('success', false, 'error', 'pgcrypto extension is not enabled');
  END IF;

  -- Check if email already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email already exists in authentication system');
  END IF;
  
  -- Check if email already exists in public.users
  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email already exists in users table');
  END IF;

  -- Hash the password using pgcrypto
  v_hashed_password := crypt(p_password, gen_salt('bf'));

  -- Create user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  -- Create user in public.users
  INSERT INTO public.users (
    id,
    name,
    email,
    role,
    is_active,
    created_at
  ) VALUES (
    v_user_id,
    p_name,
    p_email,
    p_role,
    p_is_active,
    now()
  );

  -- Store password hash in employee_passwords table
  INSERT INTO public.employee_passwords (
    user_id,
    password_hash,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_hashed_password,
    now(),
    now()
  );

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email already exists');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to create user: ' || SQLERRM);
END;
$$;

-- Update user password function using pgcrypto
CREATE OR REPLACE FUNCTION public.update_user_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hashed_password text;
  v_user_email text;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters');
  END IF;

  -- Check if pgcrypto extension is enabled
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RETURN jsonb_build_object('success', false, 'error', 'pgcrypto extension is not enabled');
  END IF;

  -- Check if user exists
  SELECT email INTO v_user_email FROM public.users WHERE id = p_user_id;
  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Hash the new password using pgcrypto
  v_hashed_password := crypt(p_new_password, gen_salt('bf'));

  -- Update password in auth.users
  UPDATE auth.users 
  SET 
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  WHERE email = v_user_email;

  -- Update or insert password hash in employee_passwords table
  INSERT INTO public.employee_passwords (
    user_id,
    password_hash,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_hashed_password,
    now(),
    now()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to update password: ' || SQLERRM);
END;
$$;