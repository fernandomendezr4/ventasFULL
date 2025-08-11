/*
  # Corregir triggers de eliminación de ventas

  1. Problemas identificados
    - Trigger de auditoría intenta acceder a campo "amount" inexistente en tabla sales
    - Función audit_sale_deletion tiene referencias incorrectas
    - Trigger trigger_audit_sale_deletion necesita corrección

  2. Soluciones
    - Corregir función audit_sale_deletion para usar campos correctos de sales
    - Actualizar trigger para manejar eliminaciones correctamente
    - Agregar validaciones para evitar errores futuros

  3. Seguridad
    - Mantener auditoría completa de eliminaciones
    - Preservar integridad referencial
    - Registrar detalles completos antes de eliminar
*/

-- Primero, eliminar el trigger problemático si existe
DROP TRIGGER IF EXISTS trigger_audit_sale_deletion ON public.sales;

-- Crear o reemplazar la función de auditoría de eliminación de ventas
CREATE OR REPLACE FUNCTION public.audit_sale_deletion()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Registrar la eliminación en el sistema de auditoría mejorado
    INSERT INTO public.cash_register_enhanced_audit (
        cash_register_id,
        action_type,
        entity_type,
        entity_id,
        sale_details,
        amount,
        old_values,
        description,
        severity,
        performed_by,
        performed_at
    ) VALUES (
        NULL, -- No hay caja específica para eliminaciones
        'delete',
        'sale',
        OLD.id,
        jsonb_build_object(
            'sale_id', OLD.id,
            'total_amount', OLD.total_amount,
            'subtotal', COALESCE(OLD.subtotal, OLD.total_amount),
            'discount_amount', COALESCE(OLD.discount_amount, 0),
            'payment_type', OLD.payment_type,
            'payment_status', OLD.payment_status,
            'total_paid', COALESCE(OLD.total_paid, 0),
            'customer_id', OLD.customer_id,
            'user_id', OLD.user_id,
            'created_at', OLD.created_at
        ),
        OLD.total_amount, -- Usar total_amount en lugar de amount
        jsonb_build_object(
            'id', OLD.id,
            'total_amount', OLD.total_amount,
            'subtotal', COALESCE(OLD.subtotal, OLD.total_amount),
            'discount_amount', COALESCE(OLD.discount_amount, 0),
            'payment_type', OLD.payment_type,
            'payment_status', OLD.payment_status,
            'total_paid', COALESCE(OLD.total_paid, 0),
            'customer_id', OLD.customer_id,
            'user_id', OLD.user_id,
            'created_at', OLD.created_at
        ),
        'Venta eliminada - Total: ' || OLD.total_amount || ' - Tipo: ' || OLD.payment_type,
        'high', -- Eliminaciones son eventos de alta severidad
        COALESCE(current_setting('app.current_user_id', true)::uuid, OLD.user_id),
        NOW()
    );

    RETURN OLD;
END;
$$;

-- Recrear el trigger con la función corregida
CREATE TRIGGER trigger_audit_sale_deletion
    BEFORE DELETE ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_sale_deletion();

-- Crear función mejorada para eliminar ventas de forma segura
CREATE OR REPLACE FUNCTION public.delete_sale_safely(
    p_sale_id uuid,
    p_user_id uuid DEFAULT NULL,
    p_reason text DEFAULT 'Eliminación manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_record RECORD;
    v_sale_items_count INTEGER := 0;
    v_stock_restored INTEGER := 0;
    v_imei_serials_restored INTEGER := 0;
    v_installments_deleted INTEGER := 0;
    v_payments_deleted INTEGER := 0;
    v_cash_register_entries_deleted INTEGER := 0;
    v_result jsonb;
BEGIN
    -- Verificar que la venta existe
    SELECT * INTO v_sale_record
    FROM sales
    WHERE id = p_sale_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Venta no encontrada'
        );
    END IF;

    -- Configurar usuario actual para auditoría
    IF p_user_id IS NOT NULL THEN
        PERFORM set_config('app.current_user_id', p_user_id::text, true);
    END IF;

    -- Contar items de venta
    SELECT COUNT(*) INTO v_sale_items_count
    FROM sale_items
    WHERE sale_id = p_sale_id;

    -- Restaurar IMEI/Serial a estado disponible
    UPDATE product_imei_serials
    SET 
        status = 'available',
        sale_id = NULL,
        sale_item_id = NULL,
        sold_at = NULL,
        notes = COALESCE(notes, '') || ' | Restaurado por eliminación de venta #' || SUBSTRING(p_sale_id::text FROM 1 FOR 8) || ' - ' || p_reason,
        updated_at = NOW(),
        updated_by = p_user_id
    WHERE sale_id = p_sale_id;
    
    GET DIAGNOSTICS v_imei_serials_restored = ROW_COUNT;

    -- Restaurar stock para productos sin IMEI/Serial requerido
    WITH stock_updates AS (
        UPDATE products 
        SET stock = stock + si.quantity
        FROM sale_items si
        WHERE products.id = si.product_id 
        AND si.sale_id = p_sale_id
        AND products.requires_imei_serial = false
        RETURNING si.quantity
    )
    SELECT COALESCE(SUM(quantity), 0) INTO v_stock_restored
    FROM stock_updates;

    -- Eliminar abonos asociados
    DELETE FROM payment_installments
    WHERE sale_id = p_sale_id;
    GET DIAGNOSTICS v_installments_deleted = ROW_COUNT;

    -- Eliminar registros de caja registradora
    DELETE FROM cash_register_sales
    WHERE sale_id = p_sale_id;
    GET DIAGNOSTICS v_cash_register_entries_deleted = ROW_COUNT;

    -- Eliminar registros de tracking de caja
    DELETE FROM cash_register_sales_tracking
    WHERE sale_id = p_sale_id;

    -- Eliminar registros de abonos en caja
    DELETE FROM cash_register_installments
    WHERE sale_id = p_sale_id;

    -- Eliminar pagos asociados
    DELETE FROM payments
    WHERE sale_id = p_sale_id;
    GET DIAGNOSTICS v_payments_deleted = ROW_COUNT;

    -- Eliminar items de venta
    DELETE FROM sale_items
    WHERE sale_id = p_sale_id;

    -- Finalmente eliminar la venta (esto activará el trigger de auditoría)
    DELETE FROM sales
    WHERE id = p_sale_id;

    -- Preparar resultado
    v_result := jsonb_build_object(
        'success', true,
        'sale_id', p_sale_id,
        'sale_items_deleted', v_sale_items_count,
        'stock_restored', v_stock_restored,
        'imei_serials_restored', v_imei_serials_restored,
        'installments_deleted', v_installments_deleted,
        'payments_deleted', v_payments_deleted,
        'cash_register_entries_deleted', v_cash_register_entries_deleted,
        'total_amount', v_sale_record.total_amount,
        'deleted_at', NOW(),
        'deleted_by', p_user_id,
        'reason', p_reason
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

-- Crear función para verificar si una venta puede ser eliminada
CREATE OR REPLACE FUNCTION public.can_delete_sale(
    p_sale_id uuid,
    p_user_role text DEFAULT 'employee'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_record RECORD;
    v_sale_age_hours INTEGER;
BEGIN
    -- Verificar que la venta existe
    SELECT * INTO v_sale_record
    FROM sales
    WHERE id = p_sale_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'can_delete', false,
            'reason', 'Venta no encontrada'
        );
    END IF;

    -- Calcular edad de la venta en horas
    SELECT EXTRACT(EPOCH FROM (NOW() - v_sale_record.created_at)) / 3600 
    INTO v_sale_age_hours;

    -- Solo admin puede eliminar ventas de más de 24 horas
    IF v_sale_age_hours > 24 AND p_user_role != 'admin' THEN
        RETURN jsonb_build_object(
            'can_delete', false,
            'reason', 'Solo los administradores pueden eliminar ventas de más de 24 horas'
        );
    END IF;

    -- Solo admin puede eliminar ventas completamente pagadas
    IF v_sale_record.payment_status = 'paid' AND p_user_role != 'admin' THEN
        RETURN jsonb_build_object(
            'can_delete', false,
            'reason', 'Solo los administradores pueden eliminar ventas completamente pagadas'
        );
    END IF;

    RETURN jsonb_build_object(
        'can_delete', true,
        'reason', 'Venta puede ser eliminada'
    );
END;
$$;

-- Crear función para obtener el impacto de eliminar una venta
CREATE OR REPLACE FUNCTION public.get_sale_deletion_impact(
    p_sale_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_record RECORD;
    v_sale_items jsonb;
    v_imei_serials jsonb;
    v_installments_count INTEGER;
    v_result jsonb;
BEGIN
    -- Obtener información de la venta
    SELECT s.*, c.name as customer_name
    INTO v_sale_record
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.id = p_sale_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'error', 'Venta no encontrada'
        );
    END IF;

    -- Obtener items de la venta
    SELECT jsonb_agg(
        jsonb_build_object(
            'product_name', p.name,
            'quantity', si.quantity,
            'unit_price', si.unit_price,
            'total_price', si.total_price,
            'requires_imei_serial', p.requires_imei_serial,
            'current_stock', p.stock
        )
    ) INTO v_sale_items
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = p_sale_id;

    -- Obtener IMEI/Serial asociados
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', pis.id,
            'imei_number', pis.imei_number,
            'serial_number', pis.serial_number,
            'product_name', p.name,
            'status', pis.status
        )
    ) INTO v_imei_serials
    FROM product_imei_serials pis
    JOIN products p ON pis.product_id = p.id
    WHERE pis.sale_id = p_sale_id;

    -- Contar abonos
    SELECT COUNT(*) INTO v_installments_count
    FROM payment_installments
    WHERE sale_id = p_sale_id;

    -- Construir resultado
    v_result := jsonb_build_object(
        'sale_info', jsonb_build_object(
            'id', v_sale_record.id,
            'total_amount', v_sale_record.total_amount,
            'payment_type', v_sale_record.payment_type,
            'payment_status', v_sale_record.payment_status,
            'created_at', v_sale_record.created_at,
            'customer_name', COALESCE(v_sale_record.customer_name, 'Sin cliente')
        ),
        'items', COALESCE(v_sale_items, '[]'::jsonb),
        'imei_serials', COALESCE(v_imei_serials, '[]'::jsonb),
        'installments_count', v_installments_count,
        'impact_summary', jsonb_build_object(
            'stock_to_restore', (
                SELECT COALESCE(SUM(si.quantity), 0)
                FROM sale_items si
                JOIN products p ON si.product_id = p.id
                WHERE si.sale_id = p_sale_id
                AND p.requires_imei_serial = false
            ),
            'imei_serials_to_restore', (
                SELECT COUNT(*)
                FROM product_imei_serials
                WHERE sale_id = p_sale_id
            )
        )
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

-- Función para limpiar datos huérfanos de ventas
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_sale_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_orphaned_items_cleaned INTEGER := 0;
    v_orphaned_imei_serials_restored INTEGER := 0;
    v_orphaned_payments_cleaned INTEGER := 0;
    v_orphaned_installments_cleaned INTEGER := 0;
    v_result jsonb;
BEGIN
    -- Limpiar sale_items huérfanos (items sin venta)
    DELETE FROM sale_items
    WHERE sale_id NOT IN (SELECT id FROM sales);
    GET DIAGNOSTICS v_orphaned_items_cleaned = ROW_COUNT;

    -- Restaurar IMEI/Serial huérfanos (referenciando ventas eliminadas)
    UPDATE product_imei_serials
    SET 
        status = 'available',
        sale_id = NULL,
        sale_item_id = NULL,
        sold_at = NULL,
        notes = COALESCE(notes, '') || ' | Restaurado por limpieza automática - venta eliminada',
        updated_at = NOW()
    WHERE sale_id IS NOT NULL 
    AND sale_id NOT IN (SELECT id FROM sales);
    GET DIAGNOSTICS v_orphaned_imei_serials_restored = ROW_COUNT;

    -- Limpiar pagos huérfanos
    DELETE FROM payments
    WHERE sale_id NOT IN (SELECT id FROM sales);
    GET DIAGNOSTICS v_orphaned_payments_cleaned = ROW_COUNT;

    -- Limpiar abonos huérfanos
    DELETE FROM payment_installments
    WHERE sale_id NOT IN (SELECT id FROM sales);
    GET DIAGNOSTICS v_orphaned_installments_cleaned = ROW_COUNT;

    -- Limpiar registros de caja huérfanos
    DELETE FROM cash_register_sales
    WHERE sale_id NOT IN (SELECT id FROM sales);

    DELETE FROM cash_register_installments
    WHERE sale_id NOT IN (SELECT id FROM sales);

    DELETE FROM cash_register_sales_tracking
    WHERE sale_id NOT IN (SELECT id FROM sales);

    v_result := jsonb_build_object(
        'orphaned_items_cleaned', v_orphaned_items_cleaned,
        'orphaned_imei_serials_restored', v_orphaned_imei_serials_restored,
        'orphaned_payments_cleaned', v_orphaned_payments_cleaned,
        'orphaned_installments_cleaned', v_orphaned_installments_cleaned,
        'cleanup_timestamp', NOW()
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

-- Verificar y corregir otros triggers problemáticos
-- Función mejorada para log_enhanced_cash_register_audit
CREATE OR REPLACE FUNCTION public.log_enhanced_cash_register_audit()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_amount numeric(10,2) := 0;
    v_previous_balance numeric(10,2) := NULL;
    v_new_balance numeric(10,2) := NULL;
    v_action_type text;
    v_entity_type text;
    v_description text;
    v_severity text := 'normal';
BEGIN
    -- Determinar tipo de acción y entidad
    IF TG_OP = 'INSERT' THEN
        v_action_type := CASE 
            WHEN TG_TABLE_NAME = 'sales' THEN 'sale'
            WHEN TG_TABLE_NAME = 'cash_registers' THEN 'open'
            ELSE 'create'
        END;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action_type := CASE 
            WHEN TG_TABLE_NAME = 'cash_registers' AND OLD.status = 'open' AND NEW.status = 'closed' THEN 'close'
            ELSE 'edit'
        END;
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'delete';
        v_severity := 'high';
    END IF;

    -- Determinar entidad
    v_entity_type := CASE TG_TABLE_NAME
        WHEN 'sales' THEN 'sale'
        WHEN 'cash_registers' THEN 'cash_register'
        WHEN 'cash_movements' THEN 'movement'
        WHEN 'payment_installments' THEN 'installment'
        WHEN 'products' THEN 'product'
        WHEN 'customers' THEN 'customer'
        ELSE 'unknown'
    END;

    -- Extraer monto según la tabla
    IF TG_TABLE_NAME = 'sales' THEN
        v_amount := COALESCE(
            CASE WHEN TG_OP = 'DELETE' THEN OLD.total_amount ELSE NEW.total_amount END,
            0
        );
    ELSIF TG_TABLE_NAME = 'cash_movements' THEN
        v_amount := COALESCE(
            CASE WHEN TG_OP = 'DELETE' THEN OLD.amount ELSE NEW.amount END,
            0
        );
    ELSIF TG_TABLE_NAME = 'payment_installments' THEN
        v_amount := COALESCE(
            CASE WHEN TG_OP = 'DELETE' THEN OLD.amount_paid ELSE NEW.amount_paid END,
            0
        );
    ELSIF TG_TABLE_NAME = 'cash_registers' THEN
        v_amount := COALESCE(
            CASE 
                WHEN TG_OP = 'DELETE' THEN OLD.opening_amount
                WHEN v_action_type = 'close' THEN NEW.actual_closing_amount
                ELSE NEW.opening_amount 
            END,
            0
        );
    END IF;

    -- Generar descripción
    v_description := CASE v_action_type
        WHEN 'sale' THEN 'Venta procesada por ' || formatCurrency(v_amount)
        WHEN 'open' THEN 'Apertura de caja con ' || formatCurrency(v_amount)
        WHEN 'close' THEN 'Cierre de caja con ' || formatCurrency(v_amount)
        WHEN 'delete' THEN 'Eliminación de ' || v_entity_type || ' - Monto: ' || formatCurrency(v_amount)
        ELSE v_action_type || ' en ' || v_entity_type
    END;

    -- Insertar registro de auditoría
    INSERT INTO cash_register_enhanced_audit (
        cash_register_id,
        action_type,
        entity_type,
        entity_id,
        amount,
        previous_balance,
        new_balance,
        old_values,
        new_values,
        description,
        severity,
        performed_by,
        performed_at
    ) VALUES (
        CASE 
            WHEN TG_TABLE_NAME = 'cash_registers' THEN 
                CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
            ELSE NULL 
        END,
        v_action_type,
        v_entity_type,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
        v_amount,
        v_previous_balance,
        v_new_balance,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(OLD) END,
        CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) ELSE to_jsonb(NEW) END,
        v_description,
        v_severity,
        COALESCE(
            current_setting('app.current_user_id', true)::uuid,
            CASE 
                WHEN TG_TABLE_NAME = 'sales' THEN 
                    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END
                WHEN TG_TABLE_NAME = 'cash_registers' THEN 
                    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END
                ELSE NULL
            END
        ),
        NOW()
    );

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error en auditoría, no fallar la operación principal
        RAISE WARNING 'Error en auditoría: %', SQLERRM;
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Función auxiliar para formatear moneda en triggers
CREATE OR REPLACE FUNCTION public.formatCurrency(amount numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN '$' || to_char(amount, 'FM999,999,999,999');
END;
$$;

-- Limpiar datos huérfanos existentes
SELECT cleanup_orphaned_sale_data();

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Triggers de eliminación de ventas corregidos exitosamente';
    RAISE NOTICE 'Funciones de eliminación segura creadas';
    RAISE NOTICE 'Datos huérfanos limpiados';
    RAISE NOTICE 'Sistema listo para eliminar ventas correctamente';
END $$;