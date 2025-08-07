/*
  # Fix sales deletion trigger error - created_by field

  1. Problem
    - Trigger functions are trying to access OLD.created_by field during sales deletion
    - The sales table uses user_id field, not created_by
    - This causes deletion operations to fail

  2. Solution
    - Update trigger functions to use correct field names for sales table
    - Ensure all audit functions handle different table schemas properly
    - Fix any references to non-existent created_by field in sales context

  3. Changes
    - Update log_enhanced_cash_register_audit function
    - Update validate_critical_operations function
    - Fix any other trigger functions that reference created_by incorrectly
*/

-- Fix the enhanced audit function to handle sales table correctly
CREATE OR REPLACE FUNCTION log_enhanced_cash_register_audit()
RETURNS TRIGGER AS $$
DECLARE
    register_id uuid;
    action_desc text;
    entity_details jsonb := '{}';
    old_vals jsonb := '{}';
    new_vals jsonb := '{}';
    performed_by_id uuid;
BEGIN
    -- Determine the cash register ID and performed_by based on table
    IF TG_TABLE_NAME = 'cash_registers' THEN
        register_id := COALESCE(NEW.id, OLD.id);
        performed_by_id := COALESCE(NEW.user_id, OLD.user_id);
    ELSIF TG_TABLE_NAME = 'sales' THEN
        -- For sales, we need to find the active cash register
        SELECT cr.id INTO register_id 
        FROM cash_registers cr 
        WHERE cr.status = 'open' 
        AND cr.user_id = COALESCE(NEW.user_id, OLD.user_id)
        ORDER BY cr.opened_at DESC 
        LIMIT 1;
        
        performed_by_id := COALESCE(NEW.user_id, OLD.user_id);
    ELSIF TG_TABLE_NAME = 'cash_movements' THEN
        register_id := COALESCE(NEW.cash_register_id, OLD.cash_register_id);
        performed_by_id := COALESCE(NEW.created_by, OLD.created_by);
    ELSIF TG_TABLE_NAME = 'payment_installments' THEN
        -- Find register through sale
        SELECT cr.id INTO register_id 
        FROM cash_registers cr 
        JOIN sales s ON s.user_id = cr.user_id
        WHERE s.id = COALESCE(NEW.sale_id, OLD.sale_id)
        AND cr.status = 'open'
        ORDER BY cr.opened_at DESC 
        LIMIT 1;
        
        performed_by_id := NULL; -- payment_installments doesn't have created_by
    ELSE
        -- For other tables, try to find an active register
        SELECT cr.id INTO register_id 
        FROM cash_registers cr 
        WHERE cr.status = 'open' 
        ORDER BY cr.opened_at DESC 
        LIMIT 1;
        
        performed_by_id := NULL;
    END IF;

    -- Skip if no register found
    IF register_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Build action description
    action_desc := TG_OP || ' on ' || TG_TABLE_NAME;

    -- Build old and new values based on table
    IF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'sales' THEN
            old_vals := jsonb_build_object(
                'id', OLD.id,
                'total_amount', OLD.total_amount,
                'customer_id', OLD.customer_id,
                'user_id', OLD.user_id,
                'payment_type', OLD.payment_type,
                'payment_status', OLD.payment_status
            );
        ELSIF TG_TABLE_NAME = 'cash_movements' THEN
            old_vals := jsonb_build_object(
                'id', OLD.id,
                'type', OLD.type,
                'amount', OLD.amount,
                'description', OLD.description,
                'created_by', OLD.created_by
            );
        ELSE
            old_vals := to_jsonb(OLD);
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'sales' THEN
            new_vals := jsonb_build_object(
                'id', NEW.id,
                'total_amount', NEW.total_amount,
                'customer_id', NEW.customer_id,
                'user_id', NEW.user_id,
                'payment_type', NEW.payment_type,
                'payment_status', NEW.payment_status
            );
        ELSIF TG_TABLE_NAME = 'cash_movements' THEN
            new_vals := jsonb_build_object(
                'id', NEW.id,
                'type', NEW.type,
                'amount', NEW.amount,
                'description', NEW.description,
                'created_by', NEW.created_by
            );
        ELSE
            new_vals := to_jsonb(NEW);
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'sales' THEN
            old_vals := jsonb_build_object(
                'id', OLD.id,
                'total_amount', OLD.total_amount,
                'customer_id', OLD.customer_id,
                'user_id', OLD.user_id,
                'payment_type', OLD.payment_type,
                'payment_status', OLD.payment_status
            );
            new_vals := jsonb_build_object(
                'id', NEW.id,
                'total_amount', NEW.total_amount,
                'customer_id', NEW.customer_id,
                'user_id', NEW.user_id,
                'payment_type', NEW.payment_type,
                'payment_status', NEW.payment_status
            );
        ELSIF TG_TABLE_NAME = 'cash_movements' THEN
            old_vals := jsonb_build_object(
                'id', OLD.id,
                'type', OLD.type,
                'amount', OLD.amount,
                'description', OLD.description,
                'created_by', OLD.created_by
            );
            new_vals := jsonb_build_object(
                'id', NEW.id,
                'type', NEW.type,
                'amount', NEW.amount,
                'description', NEW.description,
                'created_by', NEW.created_by
            );
        ELSE
            old_vals := to_jsonb(OLD);
            new_vals := to_jsonb(NEW);
        END IF;
    END IF;

    -- Insert audit record
    INSERT INTO cash_register_enhanced_audit (
        cash_register_id,
        action_type,
        entity_type,
        entity_id,
        amount,
        old_values,
        new_values,
        description,
        performed_by,
        severity
    ) VALUES (
        register_id,
        CASE 
            WHEN TG_OP = 'INSERT' THEN 
                CASE TG_TABLE_NAME 
                    WHEN 'sales' THEN 'sale'
                    WHEN 'payment_installments' THEN 'installment'
                    WHEN 'cash_movements' THEN 
                        CASE COALESCE(NEW.type, OLD.type)
                            WHEN 'income' THEN 'income'
                            WHEN 'expense' THEN 'expense'
                            ELSE 'sale'
                        END
                    ELSE 'edit'
                END
            WHEN TG_OP = 'UPDATE' THEN 'edit'
            WHEN TG_OP = 'DELETE' THEN 'delete'
        END,
        CASE TG_TABLE_NAME
            WHEN 'cash_registers' THEN 'cash_register'
            WHEN 'sales' THEN 'sale'
            WHEN 'payment_installments' THEN 'installment'
            WHEN 'cash_movements' THEN 'movement'
            ELSE 'movement'
        END,
        COALESCE(NEW.id, OLD.id),
        CASE 
            WHEN TG_TABLE_NAME = 'sales' THEN COALESCE(NEW.total_amount, OLD.total_amount)
            WHEN TG_TABLE_NAME = 'cash_movements' THEN COALESCE(NEW.amount, OLD.amount)
            WHEN TG_TABLE_NAME = 'payment_installments' THEN COALESCE(NEW.amount_paid, OLD.amount_paid)
            ELSE 0
        END,
        old_vals,
        new_vals,
        action_desc,
        performed_by_id,
        CASE TG_OP 
            WHEN 'DELETE' THEN 'high'
            ELSE 'normal'
        END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Fix the validate_critical_operations function
CREATE OR REPLACE FUNCTION validate_critical_operations()
RETURNS TRIGGER AS $$
DECLARE
    user_role text;
    current_user_id uuid;
BEGIN
    -- Get current user ID based on table context
    IF TG_TABLE_NAME = 'sales' THEN
        current_user_id := COALESCE(NEW.user_id, OLD.user_id);
    ELSIF TG_TABLE_NAME = 'cash_movements' THEN
        current_user_id := COALESCE(NEW.created_by, OLD.created_by);
    ELSIF TG_TABLE_NAME = 'products' THEN
        current_user_id := COALESCE(NEW.imported_by, OLD.imported_by);
    ELSIF TG_TABLE_NAME = 'customers' THEN
        -- customers table doesn't have a created_by field, skip validation
        RETURN COALESCE(NEW, OLD);
    ELSE
        -- For other tables, try to get from context or skip
        current_user_id := NULL;
    END IF;

    -- Skip validation if no user context
    IF current_user_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Get user role
    SELECT role INTO user_role 
    FROM users 
    WHERE id = current_user_id;

    -- Allow operations for admin and manager roles
    IF user_role IN ('admin', 'manager') THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- For critical operations (DELETE), require admin/manager role
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Solo administradores y gerentes pueden eliminar registros críticos';
    END IF;

    -- For UPDATE operations on critical fields, require admin/manager role
    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'sales' THEN
            -- Allow updates to sales for now, but log them
            RETURN NEW;
        ELSIF TG_TABLE_NAME = 'products' THEN
            -- Check if critical fields are being updated
            IF OLD.sale_price != NEW.sale_price OR OLD.stock != NEW.stock THEN
                -- Allow but will be logged by audit triggers
                RETURN NEW;
            END IF;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers to ensure they use the updated functions
DROP TRIGGER IF EXISTS trigger_enhanced_audit_sales ON sales;
CREATE TRIGGER trigger_enhanced_audit_sales
    AFTER INSERT OR UPDATE OR DELETE ON sales
    FOR EACH ROW EXECUTE FUNCTION log_enhanced_cash_register_audit();

DROP TRIGGER IF EXISTS trigger_validate_critical_operations_sales ON sales;
CREATE TRIGGER trigger_validate_critical_operations_sales
    BEFORE UPDATE OR DELETE ON sales
    FOR EACH ROW EXECUTE FUNCTION validate_critical_operations();