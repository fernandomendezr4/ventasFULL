/*
  # Add cedula column to customers table

  1. Changes
    - Add `cedula` column to `customers` table
    - Column type: text (to handle various ID formats)
    - Column is nullable to allow existing records
    - Add index for better search performance

  2. Notes
    - This column will store customer identification numbers
    - Existing customers will have null cedula values initially
    - New customers can optionally provide cedula information
*/

-- Add cedula column to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'cedula'
  ) THEN
    ALTER TABLE customers ADD COLUMN cedula text DEFAULT '';
  END IF;
END $$;

-- Add index for cedula column to improve search performance
CREATE INDEX IF NOT EXISTS customers_cedula_idx ON customers (cedula);