/*
  # Add missing foreign key constraint for cash_movements.created_by

  1. Foreign Key Constraint
    - Add foreign key constraint between cash_movements.created_by and users.id
    - This will allow Supabase to properly join the tables in queries

  2. Index
    - Add index on created_by column for better query performance
*/

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cash_movements_created_by_fkey'
    AND table_name = 'cash_movements'
  ) THEN
    ALTER TABLE cash_movements 
    ADD CONSTRAINT cash_movements_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;

-- Add index on created_by column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'cash_movements_created_by_idx'
    AND tablename = 'cash_movements'
  ) THEN
    CREATE INDEX cash_movements_created_by_idx ON cash_movements(created_by);
  END IF;
END $$;