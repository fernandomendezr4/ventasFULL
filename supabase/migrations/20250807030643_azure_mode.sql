/*
  # Fix sales deletion trigger error

  1. Problem
    - Trigger functions are trying to access 'imported_by' field from sales table
    - This field only exists in products table, causing deletion failures
    - Error: record "old" has no field "imported_by"

  2. Solution
    - Update trigger functions to handle sales table operations correctly
    - Remove references to non-existent fields in sales context
    - Ensure audit functions work properly for all table types

  3. Changes
    - Fix log_enhanced_cash_register_audit function
    - Fix validate_critical_operations function
    - Ensure proper field checking before accessing OLD record fields
*/

-- Fix the enhanced audit function to handle different table contexts
CREATE OR REPLACE FUNCTION log_enhanced_cash_register_audit()
RETURNS TRIGGER AS $$
DECLARE
    register_id uuid;
    action_desc text;
    entity_details jsonb := '{}';
    product_details jsonb := '{}';
    customer_details jsonb := '{}';
    sale_details jsonb := '{}';
    movement_details jsonb := '{}';
    old_vals jsonb := '{}';
    new_vals jsonb := '{}';
    changes_text text := '';
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        action_desc := 'create';
    ELSIF TG_OP = 'UPDATE' THEN
        action_desc := 'edit';
    ELSIF TG_OP = 'DELETE' THEN
        action_desc := 'delete';
    END IF;

    -- Handle different table contexts
    IF TG_TABLE_NAME = 'sales' THEN
        -- For sales table operations
        IF TG_OP = 'DELETE' THEN
            register_id := (
                SELECT cash_register_id 
                FROM cash_register_sales 
                WHERE sale_id = OLD.id 
                LIMIT 1
            );
            
            sale_details := jsonb_build_object(
                'sale_id', OLD.id,
                'total_amount', OLD.total_amount,
                'payment_type', OLD.payment_type,
                'customer_id', OLD.customer_id
            );
            
            old_vals := row_to_json(OLD)::jsonb;
            
        ELSIF TG_OP = 'INSERT' THEN
            register_id := (
                SELECT cash_register_id 
                FROM cash_register_sales 
                WHERE sale_id = NEW.id 
                LIMIT 1
            );
            
            sale_details := jsonb_build_object(
                'sale_id', NEW.id,
                'total_amount', NEW.total_amount,
                'payment_type', NEW.payment_type,
                'customer_id', NEW.customer_id
            );
            
            new_vals := row_to_json(NEW)::jsonb;
            
        ELSIF TG_OP = 'UPDATE' THEN
            register_id := (
                SELECT cash_register_id 
                FROM cash_register_sales 
                WHERE sale_id = NEW.id 
                LIMIT 1
            );
            
            sale_details := jsonb_build_object(
                'sale_id', NEW.id,
                'total_amount', NEW.total_amount,
                'payment_type', NEW.payment_type,
                'customer_id', NEW.customer_id
            );
            
            old_vals := row_to_json(OLD)::jsonb;
            new_vals := row_to_json(NEW)::jsonb;
        END IF;

    ELSIF TG_TABLE_NAME = 'products' THEN
        -- For products table operations (existing logic)
        IF TG_OP = 'DELETE' THEN
            product_details := jsonb_build_object(
                'product_id', OLD.id,
                'name', OLD.name,
                'sale_price', OLD.sale_price,
                'stock', OLD.stock,
                'imported_by', OLD.imported_by
            );
            old_vals := row_to_json(OLD)::jsonb;
            
        ELSIF TG_OP = 'INSERT' THEN
            product_details := jsonb_build_object(
                'product_id', NEW.id,
                'name', NEW.name,
                'sale_price', NEW.sale_price,
                'stock', NEW.stock,
                'imported_by', NEW.imported_by
            );
            new_vals := row_to_json(NEW)::jsonb;
            
        ELSIF TG_OP = 'UPDATE' THEN
            product_details := jsonb_build_object(
                'product_id', NEW.id,
                'name', NEW.name,
                'sale_price', NEW.sale_price,
                'stock', NEW.stock,
                'imported_by', NEW.imported_by
            );
            old_vals := row_to_json(OLD)::jsonb;
            new_vals := row_to_json(NEW)::jsonb;
        END IF;

    ELSIF TG_TABLE_NAME = 'cash_registers' THEN
        -- For cash registers table operations
        IF TG_OP = 'DELETE' THEN
            register_id := OLD.id;
            old_vals := row_to_json(OLD)::jsonb;
        ELSIF TG_OP = 'INSERT' THEN
            register_id := NEW.id;
            new_vals := row_to_json(NEW)::jsonb;
        ELSIF TG_OP = 'UPDATE' THEN
            register_id := NEW.id;
            old_vals := row_to_json(OLD)::jsonb;
            new_vals := row_to_json(NEW)::jsonb;
        END IF;

    ELSIF TG_TABLE_NAME = 'cash_movements' THEN
        -- For cash movements table operations
        IF TG_OP = 'DELETE' THEN
            register_id := OLD.cash_register_id;
            movement_details := jsonb_build_object(
                'movement_id', OLD.id,
                'type', OLD.type,
                'amount', OLD.amount,
                'category', OLD.category
            );
            old_vals := row_to_json(OLD)::jsonb;
        ELSIF TG_OP = 'INSERT' THEN
            register_id := NEW.cash_register_id;
            movement_details := jsonb_build_object(
                'movement_id', NEW.id,
                'type', NEW.type,
                'amount', NEW.amount,
                'category', NEW.category
            );
            new_vals := row_to_json(NEW)::jsonb;
        ELSIF TG_OP = 'UPDATE' THEN
            register_id := NEW.cash_register_id;
            movement_details := jsonb_build_object(
                'movement_id', NEW.id,
                'type', NEW.type,
                'amount', NEW.amount,
                'category', NEW.category
            );
            old_vals := row_to_json(OLD)::jsonb;
            new_vals := row_to_json(NEW)::jsonb;
        END IF;
    END IF;

    -- If we couldn't determine register_id, try to find an open register
    IF register_id IS NULL THEN
        SELECT id INTO register_id 
        FROM cash_registers 
        WHERE status = 'open' 
        ORDER BY opened_at DESC 
        LIMIT 1;
    END IF;

    -- Insert audit record only if we have a register_id
    IF register_id IS NOT NULL THEN
        INSERT INTO cash_register_enhanced_audit (
            cash_register_id,
            action_type,
            entity_type,
            entity_id,
            product_details,
            customer_details,
            sale_details,
            movement_details,
            old_values,
            new_values,
            changes_summary,
            description,
            performed_by,
            performed_at
        ) VALUES (
            register_id,
            action_desc,
            TG_TABLE_NAME,
            COALESCE(
                CASE WHEN TG_OP = 'DELETE' THEN 
                    CASE TG_TABLE_NAME
                        WHEN 'sales' THEN OLD.id
                        WHEN 'products' THEN OLD.id
                        WHEN 'cash_registers' THEN OLD.id
                        WHEN 'cash_movements' THEN OLD.id
                    END
                ELSE 
                    CASE TG_TABLE_NAME
                        WHEN 'sales' THEN NEW.id
                        WHEN 'products' THEN NEW.id
                        WHEN 'cash_registers' THEN NEW.id
                        WHEN 'cash_movements' THEN NEW.id
                    END
                END
            ),
            product_details,
            customer_details,
            sale_details,
            movement_details,
            old_vals,
            new_vals,
            changes_text,
            format('%s %s operation on %s', action_desc, TG_TABLE_NAME, 
                CASE WHEN TG_OP = 'DELETE' THEN 'deleted record' 
                     WHEN TG_OP = 'INSERT' THEN 'new record'
                     ELSE 'existing record' END),
            COALESCE(
                CASE WHEN TG_OP = 'DELETE' THEN 
                    CASE TG_TABLE_NAME
                        WHEN 'sales' THEN OLD.user_id
                        WHEN 'cash_movements' THEN OLD.created_by
                    END
                ELSE 
                    CASE TG_TABLE_NAME
                        WHEN 'sales' THEN NEW.user_id
                        WHEN 'cash_movements' THEN NEW.created_by
                    END
                END
            ),
            NOW()
        );
    END IF;

    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Fix the critical operations validation function
CREATE OR REPLACE FUNCTION validate_critical_operations()
RETURNS TRIGGER AS $$
DECLARE
    open_register_exists boolean := false;
    related_sales_count integer := 0;
BEGIN
    -- Check if there's an open cash register
    SELECT EXISTS(
        SELECT 1 FROM cash_registers WHERE status = 'open'
    ) INTO open_register_exists;

    -- Handle different table contexts
    IF TG_TABLE_NAME = 'sales' THEN
        -- For sales operations, check if there are related records
        IF TG_OP = 'DELETE' THEN
            -- Check if sale has related installments
            SELECT COUNT(*) INTO related_sales_count
            FROM payment_installments
            WHERE sale_id = OLD.id;
            
            IF related_sales_count > 0 THEN
                RAISE EXCEPTION 'Cannot delete sale with existing installment payments. Please delete installments first.';
            END IF;
        END IF;

    ELSIF TG_TABLE_NAME = 'products' THEN
        -- For products operations
        IF TG_OP = 'DELETE' THEN
            -- Check if product has been sold
            SELECT COUNT(*) INTO related_sales_count
            FROM sale_items
            WHERE product_id = OLD.id;
            
            IF related_sales_count > 0 THEN
                RAISE EXCEPTION 'Cannot delete product that has been sold. Product has % sale records.', related_sales_count;
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            -- Validate critical product updates only if imported_by field exists
            IF OLD.sale_price != NEW.sale_price AND NOT open_register_exists THEN
                RAISE EXCEPTION 'Cannot modify product prices when no cash register is open.';
            END IF;
        END IF;

    ELSIF TG_TABLE_NAME = 'customers' THEN
        -- For customers operations
        IF TG_OP = 'DELETE' THEN
            -- Check if customer has sales
            SELECT COUNT(*) INTO related_sales_count
            FROM sales
            WHERE customer_id = OLD.id;
            
            IF related_sales_count > 0 THEN
                RAISE EXCEPTION 'Cannot delete customer with existing sales. Customer has % sale records.', related_sales_count;
            END IF;
        END IF;
    END IF;

    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Ensure the audit function handles all table contexts properly
CREATE OR REPLACE FUNCTION audit_cash_movement_changes()
RETURNS TRIGGER AS $$
DECLARE
    register_id uuid;
    change_description text;
BEGIN
    -- Get the cash register ID
    IF TG_TABLE_NAME = 'cash_movements' THEN
        IF TG_OP = 'DELETE' THEN
            register_id := OLD.cash_register_id;
        ELSE
            register_id := NEW.cash_register_id;
        END IF;
    END IF;

    -- Create change description
    IF TG_OP = 'INSERT' THEN
        change_description := format('New %s movement: %s', NEW.type, NEW.description);
    ELSIF TG_OP = 'UPDATE' THEN
        change_description := format('Updated %s movement: %s', NEW.type, NEW.description);
    ELSIF TG_OP = 'DELETE' THEN
        change_description := format('Deleted %s movement: %s', OLD.type, OLD.description);
    END IF;

    -- Log the audit entry only for cash_movements table
    IF TG_TABLE_NAME = 'cash_movements' AND register_id IS NOT NULL THEN
        INSERT INTO cash_register_enhanced_audit (
            cash_register_id,
            action_type,
            entity_type,
            entity_id,
            movement_details,
            old_values,
            new_values,
            changes_summary,
            description,
            performed_by,
            performed_at
        ) VALUES (
            register_id,
            CASE TG_OP 
                WHEN 'INSERT' THEN 'income'
                WHEN 'UPDATE' THEN 'edit'
                WHEN 'DELETE' THEN 'delete'
            END,
            'movement',
            CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
            CASE WHEN TG_OP = 'DELETE' THEN 
                jsonb_build_object(
                    'type', OLD.type,
                    'amount', OLD.amount,
                    'category', OLD.category,
                    'description', OLD.description
                )
            ELSE 
                jsonb_build_object(
                    'type', NEW.type,
                    'amount', NEW.amount,
                    'category', NEW.category,
                    'description', NEW.description
                )
            END,
            CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD)::jsonb ELSE '{}' END,
            CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW)::jsonb ELSE '{}' END,
            change_description,
            change_description,
            CASE WHEN TG_OP = 'DELETE' THEN OLD.created_by ELSE NEW.created_by END,
            NOW()
        );
    END IF;

    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;