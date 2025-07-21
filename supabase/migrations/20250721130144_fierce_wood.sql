/*
  # Fix Cash Register Trigger Error

  1. Problem
    - Triggers are trying to access NEW.cash_register_id which doesn't exist
    - Should be using NEW.id (the primary key of cash_registers table)

  2. Solution
    - Drop and recreate all problematic triggers and functions
    - Use correct field names in trigger functions
    - Add proper error handling
*/

-- Drop existing triggers first
DROP TRIGGER IF EXISTS trigger_create_opening_movement ON cash_registers;
DROP TRIGGER IF EXISTS trigger_create_closing_movement ON cash_registers;
DROP TRIGGER IF EXISTS trigger_audit_cash_register ON cash_registers;

-- Drop existing functions
DROP FUNCTION IF EXISTS create_opening_movement();
DROP FUNCTION IF EXISTS create_closing_movement();
DROP FUNCTION IF EXISTS log_cash_register_action();

-- Recreate the opening movement function with correct field names
CREATE OR REPLACE FUNCTION create_opening_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create opening movement for new cash registers
  IF TG_OP = 'INSERT' THEN
    INSERT INTO cash_movements (
      cash_register_id,
      type,
      category,
      amount,
      description,
      created_by
    ) VALUES (
      NEW.id,  -- Use NEW.id, not NEW.cash_register_id
      'opening',
      'apertura_caja',
      NEW.opening_amount,
      'Apertura de caja registradora',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the main operation
    RAISE WARNING 'Error creating opening movement: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the closing movement function with correct field names
CREATE OR REPLACE FUNCTION create_closing_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create closing movement when status changes to 'closed'
  IF TG_OP = 'UPDATE' AND OLD.status = 'open' AND NEW.status = 'closed' THEN
    INSERT INTO cash_movements (
      cash_register_id,
      type,
      category,
      amount,
      description,
      created_by
    ) VALUES (
      NEW.id,  -- Use NEW.id, not NEW.cash_register_id
      'closing',
      'cierre_caja',
      COALESCE(NEW.closing_amount, 0),
      'Cierre de caja registradora',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the main operation
    RAISE WARNING 'Error creating closing movement: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the audit function with correct field names
CREATE OR REPLACE FUNCTION log_cash_register_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type_val text;
  entity_type_val text := 'cash_register';
  entity_id_val uuid;
  amount_val numeric := 0;
  description_val text;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type_val := 'open';
    entity_id_val := NEW.id;
    amount_val := NEW.opening_amount;
    description_val := 'Apertura de caja registradora';
  ELSIF TG_OP = 'UPDATE' THEN
    entity_id_val := NEW.id;
    IF OLD.status = 'open' AND NEW.status = 'closed' THEN
      action_type_val := 'close';
      amount_val := COALESCE(NEW.closing_amount, 0);
      description_val := 'Cierre de caja registradora';
    ELSE
      action_type_val := 'adjustment';
      amount_val := COALESCE(NEW.closing_amount, NEW.opening_amount, 0);
      description_val := 'Ajuste en caja registradora';
    END IF;
  ELSE
    RETURN NULL;
  END IF;

  -- Insert audit log
  INSERT INTO cash_register_audit_logs (
    cash_register_id,
    action_type,
    entity_type,
    entity_id,
    amount,
    description,
    performed_by,
    performed_at
  ) VALUES (
    entity_id_val,  -- Use the correct entity_id_val
    action_type_val,
    entity_type_val,
    entity_id_val,
    amount_val,
    description_val,
    COALESCE(NEW.user_id, OLD.user_id),
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the main operation
    RAISE WARNING 'Error logging cash register action: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER trigger_create_opening_movement
  AFTER INSERT ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION create_opening_movement();

CREATE TRIGGER trigger_create_closing_movement
  AFTER UPDATE ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION create_closing_movement();

CREATE TRIGGER trigger_audit_cash_register
  AFTER INSERT OR UPDATE ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION log_cash_register_action();