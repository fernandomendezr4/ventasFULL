/*
  # Fix sales deletion trigger error

  1. Problem
    - Trigger functions are trying to access NEW record during DELETE operations
    - NEW record is only available for INSERT and UPDATE operations
    - For DELETE operations, only OLD record is available

  2. Solution
    - Update trigger functions to check TG_OP before accessing NEW record
    - Use OLD record for DELETE operations
    - Ensure all audit and tracking functions handle DELETE properly
*/

-- Fix the enhanced audit trigger function
CREATE OR REPLACE FUNCTION log_enhanced_cash_register_audit()
RETURNS TRIGGER AS $$
DECLARE
    register_id uuid;
    action_description text;
    entity_details jsonb := '{}';
    customer_info jsonb := '{}';
    product_info jsonb := '{}';
    sale_info jsonb := '{}';
    movement_info jsonb := '{}';
    previous_bal numeric := 0;
    new_bal numeric := 0;
BEGIN
    -- Determine the cash register ID and action description based on operation
    IF TG_OP = 'DELETE' THEN
        -- For DELETE operations, use OLD record
        IF TG_TABLE_NAME = 'sales' THEN
            -- Get cash register from cash_register_sales table
            SELECT crs.cash_register_id INTO register_id
            FROM cash_register_sales crs
            WHERE crs.sale_id = OLD.id
            LIMIT 1;
            
            action_description := 'Venta eliminada: #' || substring(OLD.id::text from 1 for 8);
            
            sale_info := jsonb_build_object(
                'sale_id', OLD.id,
                'total_amount', OLD.total_amount,
                'payment_type', OLD.payment_type,
                'payment_status', OLD.payment_status,
                'customer_id', OLD.customer_id,
                'created_at', OLD.created_at
            );
            
            -- Get customer details if exists
            IF OLD.customer_id IS NOT NULL THEN
                SELECT jsonb_build_object(
                    'id', c.id,
                    'name', c.name,
                    'phone', c.phone,
                    'email', c.email
                ) INTO customer_info
                FROM customers c
                WHERE c.id = OLD.customer_id;
            END IF;
            
        ELSIF TG_TABLE_NAME = 'cash_movements' THEN
            register_id := OLD.cash_register_id;
            action_description := 'Movimiento eliminado: ' || OLD.description;
            
            movement_info := jsonb_build_object(
                'movement_id', OLD.id,
                'type', OLD.type,
                'category', OLD.category,
                'amount', OLD.amount,
                'description', OLD.description
            );
            
        ELSIF TG_TABLE_NAME = 'cash_registers' THEN
            register_id := OLD.id;
            action_description := 'Caja registradora eliminada';
        END IF;
        
        -- Insert audit record for DELETE
        INSERT INTO cash_register_enhanced_audit (
            cash_register_id,
            action_type,
            entity_type,
            entity_id,
            amount,
            previous_balance,
            new_balance,
            old_values,
            description,
            performed_by,
            performed_at,
            sale_details,
            customer_details,
            movement_details,
            severity
        ) VALUES (
            register_id,
            'delete',
            CASE 
                WHEN TG_TABLE_NAME = 'sales' THEN 'sale'
                WHEN TG_TABLE_NAME = 'cash_movements' THEN 'movement'
                WHEN TG_TABLE_NAME = 'cash_registers' THEN 'cash_register'
                ELSE TG_TABLE_NAME
            END,
            OLD.id,
            CASE 
                WHEN TG_TABLE_NAME = 'sales' THEN OLD.total_amount
                WHEN TG_TABLE_NAME = 'cash_movements' THEN OLD.amount
                ELSE 0
            END,
            previous_bal,
            new_bal,
            to_jsonb(OLD),
            action_description,
            auth.uid(),
            now(),
            sale_info,
            customer_info,
            movement_info,
            'high'
        );
        
        RETURN OLD;
        
    ELSIF TG_OP = 'INSERT' THEN
        -- For INSERT operations, use NEW record
        IF TG_TABLE_NAME = 'sales' THEN
            -- Get cash register from cash_register_sales table
            SELECT crs.cash_register_id INTO register_id
            FROM cash_register_sales crs
            WHERE crs.sale_id = NEW.id
            LIMIT 1;
            
            action_description := 'Nueva venta registrada: #' || substring(NEW.id::text from 1 for 8);
            
            sale_info := jsonb_build_object(
                'sale_id', NEW.id,
                'total_amount', NEW.total_amount,
                'payment_type', NEW.payment_type,
                'payment_status', NEW.payment_status,
                'customer_id', NEW.customer_id,
                'created_at', NEW.created_at
            );
            
            -- Get customer details if exists
            IF NEW.customer_id IS NOT NULL THEN
                SELECT jsonb_build_object(
                    'id', c.id,
                    'name', c.name,
                    'phone', c.phone,
                    'email', c.email
                ) INTO customer_info
                FROM customers c
                WHERE c.id = NEW.customer_id;
            END IF;
            
        ELSIF TG_TABLE_NAME = 'cash_movements' THEN
            register_id := NEW.cash_register_id;
            action_description := 'Nuevo movimiento: ' || NEW.description;
            
            movement_info := jsonb_build_object(
                'movement_id', NEW.id,
                'type', NEW.type,
                'category', NEW.category,
                'amount', NEW.amount,
                'description', NEW.description
            );
            
        ELSIF TG_TABLE_NAME = 'cash_registers' THEN
            register_id := NEW.id;
            action_description := 'Caja registradora abierta';
        END IF;
        
        -- Insert audit record for INSERT
        INSERT INTO cash_register_enhanced_audit (
            cash_register_id,
            action_type,
            entity_type,
            entity_id,
            amount,
            new_values,
            description,
            performed_by,
            performed_at,
            sale_details,
            customer_details,
            movement_details,
            severity
        ) VALUES (
            register_id,
            CASE 
                WHEN TG_TABLE_NAME = 'sales' THEN 'sale'
                WHEN TG_TABLE_NAME = 'cash_movements' THEN 
                    CASE NEW.type
                        WHEN 'opening' THEN 'open'
                        WHEN 'closing' THEN 'close'
                        WHEN 'income' THEN 'income'
                        WHEN 'expense' THEN 'expense'
                        ELSE 'sale'
                    END
                WHEN TG_TABLE_NAME = 'cash_registers' THEN 'open'
                ELSE 'edit'
            END,
            CASE 
                WHEN TG_TABLE_NAME = 'sales' THEN 'sale'
                WHEN TG_TABLE_NAME = 'cash_movements' THEN 'movement'
                WHEN TG_TABLE_NAME = 'cash_registers' THEN 'cash_register'
                ELSE TG_TABLE_NAME
            END,
            NEW.id,
            CASE 
                WHEN TG_TABLE_NAME = 'sales' THEN NEW.total_amount
                WHEN TG_TABLE_NAME = 'cash_movements' THEN NEW.amount
                ELSE 0
            END,
            to_jsonb(NEW),
            action_description,
            auth.uid(),
            now(),
            sale_info,
            customer_info,
            movement_info,
            'normal'
        );
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- For UPDATE operations, use both OLD and NEW records
        IF TG_TABLE_NAME = 'sales' THEN
            -- Get cash register from cash_register_sales table
            SELECT crs.cash_register_id INTO register_id
            FROM cash_register_sales crs
            WHERE crs.sale_id = NEW.id
            LIMIT 1;
            
            action_description := 'Venta actualizada: #' || substring(NEW.id::text from 1 for 8);
            
            sale_info := jsonb_build_object(
                'sale_id', NEW.id,
                'total_amount', NEW.total_amount,
                'payment_type', NEW.payment_type,
                'payment_status', NEW.payment_status,
                'customer_id', NEW.customer_id,
                'created_at', NEW.created_at
            );
            
        ELSIF TG_TABLE_NAME = 'cash_movements' THEN
            register_id := NEW.cash_register_id;
            action_description := 'Movimiento actualizado: ' || NEW.description;
            
        ELSIF TG_TABLE_NAME = 'cash_registers' THEN
            register_id := NEW.id;
            action_description := 'Caja registradora actualizada';
        END IF;
        
        -- Insert audit record for UPDATE
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
            performed_at,
            sale_details,
            customer_details,
            movement_details,
            severity
        ) VALUES (
            register_id,
            'edit',
            CASE 
                WHEN TG_TABLE_NAME = 'sales' THEN 'sale'
                WHEN TG_TABLE_NAME = 'cash_movements' THEN 'movement'
                WHEN TG_TABLE_NAME = 'cash_registers' THEN 'cash_register'
                ELSE TG_TABLE_NAME
            END,
            NEW.id,
            CASE 
                WHEN TG_TABLE_NAME = 'sales' THEN NEW.total_amount
                WHEN TG_TABLE_NAME = 'cash_movements' THEN NEW.amount
                ELSE 0
            END,
            to_jsonb(OLD),
            to_jsonb(NEW),
            action_description,
            auth.uid(),
            now(),
            sale_info,
            customer_info,
            movement_info,
            'normal'
        );
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the auto refresh views function
CREATE OR REPLACE FUNCTION auto_refresh_views()
RETURNS TRIGGER AS $$
BEGIN
    -- This function can be called for INSERT, UPDATE, or DELETE
    -- We don't need to access NEW or OLD records here, just refresh views
    
    -- Refresh materialized views that depend on sales data
    REFRESH MATERIALIZED VIEW CONCURRENTLY customer_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_summary;
    
    -- Return appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the validate critical operations function
CREATE OR REPLACE FUNCTION validate_critical_operations()
RETURNS TRIGGER AS $$
DECLARE
    current_user_role text;
    operation_record record;
BEGIN
    -- Get the record to validate based on operation type
    IF TG_OP = 'DELETE' THEN
        operation_record := OLD;
    ELSE
        operation_record := NEW;
    END IF;
    
    -- Get current user role
    SELECT role INTO current_user_role
    FROM users
    WHERE id = auth.uid()
    LIMIT 1;
    
    -- Only allow admin and manager to delete critical records
    IF TG_OP = 'DELETE' AND current_user_role NOT IN ('admin', 'manager') THEN
        RAISE EXCEPTION 'No tienes permisos para eliminar este registro. Solo administradores y gerentes pueden realizar esta acción.';
    END IF;
    
    -- Additional validations for updates
    IF TG_OP = 'UPDATE' THEN
        -- Add specific update validations here if needed
        NULL;
    END IF;
    
    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure all triggers are properly configured
-- Drop and recreate triggers to ensure they use the updated functions

-- Enhanced audit triggers
DROP TRIGGER IF EXISTS trigger_enhanced_audit_sales ON sales;
CREATE TRIGGER trigger_enhanced_audit_sales
    AFTER INSERT OR UPDATE OR DELETE ON sales
    FOR EACH ROW EXECUTE FUNCTION log_enhanced_cash_register_audit();

DROP TRIGGER IF EXISTS trigger_enhanced_audit_cash_registers ON cash_registers;
CREATE TRIGGER trigger_enhanced_audit_cash_registers
    AFTER INSERT OR UPDATE OR DELETE ON cash_registers
    FOR EACH ROW EXECUTE FUNCTION log_enhanced_cash_register_audit();

-- Auto refresh views trigger
DROP TRIGGER IF EXISTS trigger_auto_refresh_views ON sales;
CREATE TRIGGER trigger_auto_refresh_views
    AFTER INSERT OR UPDATE OR DELETE ON sales
    FOR EACH ROW EXECUTE FUNCTION auto_refresh_views();

-- Critical operations validation triggers
DROP TRIGGER IF EXISTS trigger_validate_critical_operations_sales ON sales;
CREATE TRIGGER trigger_validate_critical_operations_sales
    BEFORE UPDATE OR DELETE ON sales
    FOR EACH ROW EXECUTE FUNCTION validate_critical_operations();

DROP TRIGGER IF EXISTS trigger_validate_critical_operations_customers ON customers;
CREATE TRIGGER trigger_validate_critical_operations_customers
    BEFORE UPDATE OR DELETE ON customers
    FOR EACH ROW EXECUTE FUNCTION validate_critical_operations();

DROP TRIGGER IF EXISTS trigger_validate_critical_operations_products ON products;
CREATE TRIGGER trigger_validate_critical_operations_products
    BEFORE UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION validate_critical_operations();