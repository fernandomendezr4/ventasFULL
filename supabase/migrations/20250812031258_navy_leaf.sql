/*
  # Add missing authentication columns

  1. New Columns
    - `employee_passwords.must_change` (boolean) - Flag for forced password changes
    - `employee_passwords.expires_at` (timestamptz) - Password expiration date
    - `users.failed_login_attempts` (integer) - Track failed login attempts
    - `users.locked_until` (timestamptz) - Account lockout timestamp

  2. Security
    - Add constraints for data integrity
    - Set appropriate default values
*/

-- Add missing columns to employee_passwords table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_passwords' AND column_name = 'must_change'
  ) THEN
    ALTER TABLE public.employee_passwords ADD COLUMN must_change BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_passwords' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.employee_passwords ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add missing columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'failed_login_attempts'
  ) THEN
    ALTER TABLE public.users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'locked_until'
  ) THEN
    ALTER TABLE public.users ADD COLUMN locked_until TIMESTAMPTZ;
  END IF;
END $$;

-- Add constraints for data integrity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'users_failed_login_attempts_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_failed_login_attempts_check CHECK (failed_login_attempts >= 0);
  END IF;
END $$;