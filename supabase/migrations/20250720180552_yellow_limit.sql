/*
  # Add missing cash_register_id column to cash_register_discrepancies table

  1. Schema Changes
    - Add `cash_register_id` column to `cash_register_discrepancies` table
    - Set up foreign key constraint to `cash_registers` table
    - Add index for performance

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity with foreign key constraint
*/

-- Add the missing cash_register_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_register_discrepancies' AND column_name = 'cash_register_id'
  ) THEN
    ALTER TABLE cash_register_discrepancies 
    ADD COLUMN cash_register_id uuid NOT NULL;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cash_register_discrepancies_cash_register_id_fkey'
  ) THEN
    ALTER TABLE cash_register_discrepancies
    ADD CONSTRAINT cash_register_discrepancies_cash_register_id_fkey
    FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for performance if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_cash_register_discrepancies_register_id'
  ) THEN
    CREATE INDEX idx_cash_register_discrepancies_register_id 
    ON cash_register_discrepancies(cash_register_id);
  END IF;
END $$;