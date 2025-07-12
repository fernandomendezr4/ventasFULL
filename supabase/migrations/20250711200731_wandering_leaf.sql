/*
  # User Management Functions

  1. New Functions
    - `create_user_with_password` - Creates a new user with authentication and profile
    - `update_user_password` - Updates an existing user's password

  2. Security
    - Functions use SECURITY DEFINER to access auth schema
    - Proper error handling and validation
    - Returns structured JSON responses

  3. Features
    - Creates auth user and profile record in single transaction
    - Validates email uniqueness
    - Handles password hashing automatically
    - Updates existing user passwords securely
*/

-- Function to create a user with password
CREATE OR REPLACE FUNCTION public.create_user_with_password(
  p_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'employee',
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  new_user_id UUID;
  auth_user_data JSON;
BEGIN
  -- Validate input parameters
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Name is required');
  END IF;
  
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Email is required');
  END IF;
  
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN json_build_object('success', false, 'error', 'Password must be at least 6 characters');
  END IF;
  
  -- Check if email already exists in users table
  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email) THEN
    RETURN json_build_object('success', false, 'error', 'Email already exists');
  END IF;
  
  -- Check if email already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN json_build_object('success', false, 'error', 'Email already exists in authentication system');
  END IF;

  BEGIN
    -- Generate a new UUID for the user
    new_user_id := gen_random_uuid();
    
    -- Create the auth user
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      email_change_token_new,
      recovery_token
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      p_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      false,
      'authenticated',
      'authenticated',
      '',
      '',
      ''
    );
    
    -- Create the user profile
    INSERT INTO public.users (
      id,
      name,
      email,
      role,
      is_active,
      created_at
    ) VALUES (
      new_user_id,
      p_name,
      p_email,
      p_role,
      p_is_active,
      now()
    );
    
    -- Create employee password record
    INSERT INTO public.employee_passwords (
      user_id,
      password_hash,
      created_at,
      updated_at
    ) VALUES (
      new_user_id,
      crypt(p_password, gen_salt('bf')),
      now(),
      now()
    );
    
    RETURN json_build_object(
      'success', true, 
      'user_id', new_user_id,
      'message', 'User created successfully'
    );
    
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Failed to create user: ' || SQLERRM
    );
  END;
END;
$$;

-- Function to update user password
CREATE OR REPLACE FUNCTION public.update_user_password(
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate input parameters
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RETURN json_build_object('success', false, 'error', 'Password must be at least 6 characters');
  END IF;
  
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  BEGIN
    -- Update auth.users password
    UPDATE auth.users 
    SET 
      encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
    WHERE id = p_user_id;
    
    -- Update or insert employee password record
    INSERT INTO public.employee_passwords (
      user_id,
      password_hash,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      crypt(p_new_password, gen_salt('bf')),
      now(),
      now()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      password_hash = EXCLUDED.password_hash,
      updated_at = EXCLUDED.updated_at;
    
    RETURN json_build_object(
      'success', true,
      'message', 'Password updated successfully'
    );
    
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Failed to update password: ' || SQLERRM
    );
  END;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_user_with_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_with_password TO anon;
GRANT EXECUTE ON FUNCTION public.update_user_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_password TO anon;