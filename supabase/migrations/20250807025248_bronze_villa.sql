/*
  # Fix validate_critical_operations function

  1. Problem
    - The validate_critical_operations() function references OLD.name which doesn't exist in the sales table
    - This causes DELETE operations on sales to fail with "record 'old' has no field 'name'" error

  2. Solution
    - Update the function to handle different table schemas properly
    - For sales table, use customer name or user name instead of non-existent OLD.name
    - Add proper conditional logic to handle different table types

  3. Changes
    - Modify validate_critical_operations() function to check table name and use appropriate fields
    - For sales: use customer name via join or user name
    - For other tables: maintain existing logic
*/

CREATE OR REPLACE FUNCTION validate_critical_operations()
RETURNS TRIGGER AS $$
DECLARE
  entity_name TEXT;
  table_name TEXT;
BEGIN
  -- Get the table name from the trigger
  table_name := TG_TABLE_NAME;
  
  -- Handle different table schemas
  CASE table_name
    WHEN 'sales' THEN
      -- For sales table, try to get customer name or use sale ID
      IF OLD.customer_id IS NOT NULL THEN
        SELECT name INTO entity_name FROM customers WHERE id = OLD.customer_id;
        entity_name := COALESCE(entity_name, 'Sale #' || LEFT(OLD.id::text, 8));
      ELSE
        entity_name := 'Sale #' || LEFT(OLD.id::text, 8);
      END IF;
      
    WHEN 'customers' THEN
      entity_name := OLD.name;
      
    WHEN 'products' THEN
      entity_name := OLD.name;
      
    WHEN 'users' THEN
      entity_name := OLD.name;
      
    ELSE
      -- For other tables, try to use name field if it exists
      -- If not, use the ID
      BEGIN
        EXECUTE format('SELECT ($1).%I', 'name') USING OLD INTO entity_name;
      EXCEPTION
        WHEN undefined_column THEN
          entity_name := 'Record #' || LEFT(OLD.id::text, 8);
      END;
  END CASE;
  
  -- Log the critical operation (you can customize this logic)
  INSERT INTO cash_register_enhanced_audit (
    cash_register_id,
    action_type,
    entity_type,
    entity_id,
    description,
    severity,
    performed_by,
    performed_at,
    metadata
  ) VALUES (
    CASE 
      WHEN table_name = 'sales' AND OLD.user_id IS NOT NULL THEN
        (SELECT id FROM cash_registers WHERE user_id = OLD.user_id AND status = 'open' LIMIT 1)
      ELSE NULL
    END,
    CASE TG_OP
      WHEN 'DELETE' THEN 'delete'
      WHEN 'UPDATE' THEN 'edit'
      ELSE 'unknown'
    END,
    table_name,
    OLD.id,
    format('Critical operation on %s: %s (%s)', table_name, entity_name, TG_OP),
    'high',
    COALESCE(
      CASE 
        WHEN table_name = 'sales' THEN OLD.user_id
        WHEN table_name = 'customers' THEN NULL
        WHEN table_name = 'products' THEN OLD.imported_by
        ELSE NULL
      END,
      auth.uid()
    ),
    NOW(),
    jsonb_build_object(
      'operation', TG_OP,
      'table', table_name,
      'entity_name', entity_name,
      'old_record', to_jsonb(OLD)
    )
  );
  
  -- Allow the operation to proceed
  RETURN CASE TG_OP
    WHEN 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;