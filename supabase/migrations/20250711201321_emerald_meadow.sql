/*
  # Fix password update ON CONFLICT constraint

  1. Changes
    - Fix the `update_user_password` function to use proper UPSERT logic
    - Remove invalid ON CONFLICT clause that references non-existent constraint
    - Use proper INSERT/UPDATE pattern for employee_passwords table

  2. Security
    - Maintains existing RLS and security definer settings
    - Preserves password hashing with pgcrypto
*/

-- Drop and recreate the update_user_password function with fixed conflict handling
DROP FUNCTION IF EXISTS update_user_password(uuid, text);

CREATE OR REPLACE FUNCTION update_user_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_existing_record uuid;
BEGIN
  -- Validate input
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  IF p_new_password IS NULL OR length(trim(p_new_password)) < 6 THEN
    RETURN json_build_object('success', false, 'error', 'Password must be at least 6 characters long');
  END IF;

  -- Check if pgcrypto extension is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RETURN json_build_object('success', false, 'error', 'Password encryption not available');
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check if password record already exists
  SELECT id INTO v_existing_record 
  FROM employee_passwords 
  WHERE user_id = p_user_id;

  IF v_existing_record IS NOT NULL THEN
    -- Update existing password record
    UPDATE employee_passwords 
    SET 
      password_hash = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    -- Insert new password record
    INSERT INTO employee_passwords (user_id, password_hash, created_at, updated_at)
    VALUES (p_user_id, crypt(p_new_password, gen_salt('bf')), now(), now());
  END IF;

  RETURN json_build_object('success', true, 'message', 'Password updated successfully');

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Failed to update password: ' || SQLERRM);
END;
$$;