/*
  # Fix Cash Register Triggers

  1. Problem
    - Triggers are trying to access NEW.cash_register_id which doesn't exist
    - Should be using NEW.id instead (the primary key of cash_registers table)

  2. Solution
    - Update create_opening_movement() function to use NEW.id
    - Update create_closing_movement() function to use NEW.id
    - Update log_cash_register_action() function to use NEW.id
*/

-- Fix create_opening_movement function
CREATE OR REPLACE FUNCTION create_opening_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create opening movement for INSERT operations with status 'open'
  IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
    INSERT INTO cash_movements (
      cash_register_id,
      type,
      category,
      amount,
      description,
      created_by
    ) VALUES (
      NEW.id,  -- Changed from NEW.cash_register_id to NEW.id
      'opening',
      'apertura',
      NEW.opening_amount,
      'Apertura de caja registradora',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix create_closing_movement function
CREATE OR REPLACE FUNCTION create_closing_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create closing movement when status changes from 'open' to 'closed'
  IF TG_OP = 'UPDATE' AND OLD.status = 'open' AND NEW.status = 'closed' THEN
    INSERT INTO cash_movements (
      cash_register_id,
      type,
      category,
      amount,
      description,
      created_by
    ) VALUES (
      NEW.id,  -- Changed from NEW.cash_register_id to NEW.id
      'closing',
      'cierre',
      NEW.closing_amount,
      'Cierre de caja registradora',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix log_cash_register_action function
CREATE OR REPLACE FUNCTION log_cash_register_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type_val text;
  entity_type_val text;
  entity_id_val uuid;
  amount_val numeric(10,2) := 0;
  prev_balance numeric(10,2);
  new_balance numeric(10,2);
  description_val text := '';
BEGIN
  -- Determine action type based on table and operation
  IF TG_TABLE_NAME = 'cash_registers' THEN
    entity_type_val := 'cash_register';
    entity_id_val := NEW.id;  -- Changed from NEW.cash_register_id to NEW.id
    
    IF TG_OP = 'INSERT' THEN
      action_type_val := 'open';
      amount_val := NEW.opening_amount;
      description_val := 'Apertura de caja registradora';
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'open' AND NEW.status = 'closed' THEN
      action_type_val := 'close';
      amount_val := NEW.closing_amount;
      description_val := 'Cierre de caja registradora';
    ELSE
      RETURN NEW; -- Skip logging for other updates
    END IF;
    
  ELSIF TG_TABLE_NAME = 'cash_movements' THEN
    entity_type_val := 'movement';
    entity_id_val := NEW.id;
    amount_val := NEW.amount;
    description_val := NEW.description;
    
    CASE NEW.type
      WHEN 'sale' THEN action_type_val := 'sale';
      WHEN 'income' THEN action_type_val := 'income';
      WHEN 'expense' THEN action_type_val := 'expense';
      ELSE action_type_val := 'adjustment';
    END CASE;
    
  ELSIF TG_TABLE_NAME = 'cash_register_sales' THEN
    entity_type_val := 'sale';
    entity_id_val := NEW.sale_id;
    amount_val := NEW.amount_received;
    description_val := 'Registro de venta en caja';
    action_type_val := 'sale';
    
  ELSIF TG_TABLE_NAME = 'cash_register_installments' THEN
    entity_type_val := 'installment';
    entity_id_val := NEW.installment_id;
    amount_val := NEW.amount_paid;
    description_val := 'Pago de cuota registrado en caja';
    action_type_val := 'installment';
    
  ELSE
    RETURN NEW; -- Unknown table, skip logging
  END IF;

  -- Calculate balances (simplified for now)
  prev_balance := 0;
  new_balance := amount_val;

  -- Insert audit log
  INSERT INTO cash_register_audit_logs (
    cash_register_id,
    action_type,
    entity_type,
    entity_id,
    amount,
    previous_balance,
    new_balance,
    description,
    performed_by,
    performed_at
  ) VALUES (
    COALESCE(NEW.cash_register_id, NEW.id), -- Use cash_register_id if available, otherwise use id
    action_type_val,
    entity_type_val,
    entity_id_val,
    amount_val,
    prev_balance,
    new_balance,
    description_val,
    COALESCE(NEW.created_by, NEW.user_id),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;