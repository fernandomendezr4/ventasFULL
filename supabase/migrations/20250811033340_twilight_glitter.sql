/*
  # Fix cash_register_id constraint in enhanced audit table

  1. Schema Changes
    - Make `cash_register_id` column nullable in `cash_register_enhanced_audit` table
    - This allows audit entries for operations that don't have a direct cash register association
    - Sale deletions and other administrative operations may not always be tied to a specific cash register

  2. Security
    - No changes to RLS policies
    - Maintains existing audit functionality

  3. Notes
    - This resolves the constraint violation when logging sale deletion events
    - Allows for more flexible audit logging across different operation types
*/

-- Make cash_register_id nullable in the enhanced audit table
ALTER TABLE public.cash_register_enhanced_audit 
ALTER COLUMN cash_register_id DROP NOT NULL;

-- Add a comment to document this change
COMMENT ON COLUMN public.cash_register_enhanced_audit.cash_register_id IS 
'Cash register ID - nullable to allow audit entries for operations not tied to a specific register';