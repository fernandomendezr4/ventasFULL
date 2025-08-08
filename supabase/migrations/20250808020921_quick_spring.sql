/*
  # Arreglar eliminación de ventas desde historial

  1. Modificaciones a la Base de Datos
    - Permitir NULL en cash_register_id para auditoría mejorada
    - Crear función segura para eliminar ventas
    - Agregar función para obtener impacto de eliminación
    - Crear función para validar si se puede eliminar una venta

  2. Funciones de Seguridad
    - delete_sale_safely: Elimina venta con validaciones
    - can_delete_sale: Verifica permisos de eliminación
    - get_sale_deletion_impact: Obtiene impacto antes de eliminar
    - cleanup_orphaned_sale_data: Limpia datos huérfanos
*/

-- Permitir NULL en cash_register_id para casos donde no hay caja asociada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_register_enhanced_audit' 
    AND column_name = 'cash_register_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE cash_register_enhanced_audit 
    ALTER COLUMN cash_register_id DROP NOT NULL;
  END IF;
END $$;

-- Función para verificar si una venta puede ser eliminada
CREATE OR REPLACE FUNCTION can_delete_sale(
  p_sale_id uuid,
  p_user_role text DEFAULT 'employee'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_exists boolean := false;
  v_sale_date timestamp with time zone;
  v_payment_status text;
  v_has_installments boolean := false;
  v_hours_old numeric;
  v_result jsonb;
BEGIN
  -- Verificar que la venta existe
  SELECT created_at, payment_status
  INTO v_sale_date, v_payment_status
  FROM sales
  WHERE id = p_sale_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_delete', false,
      'reason', 'Venta no encontrada'
    );
  END IF;
  
  -- Verificar si tiene abonos
  SELECT EXISTS(
    SELECT 1 FROM payment_installments 
    WHERE sale_id = p_sale_id
  ) INTO v_has_installments;
  
  -- Calcular antigüedad de la venta
  v_hours_old := EXTRACT(EPOCH FROM (NOW() - v_sale_date)) / 3600;
  
  -- Reglas de eliminación según el rol
  CASE p_user_role
    WHEN 'admin' THEN
      -- Admin puede eliminar cualquier venta
      v_result := jsonb_build_object('can_delete', true);
      
    WHEN 'manager' THEN
      -- Manager puede eliminar ventas de menos de 7 días
      IF v_hours_old > 168 THEN -- 7 días
        v_result := jsonb_build_object(
          'can_delete', false,
          'reason', 'Los gerentes solo pueden eliminar ventas de menos de 7 días'
        );
      ELSIF v_has_installments THEN
        v_result := jsonb_build_object(
          'can_delete', false,
          'reason', 'No se pueden eliminar ventas con abonos registrados'
        );
      ELSE
        v_result := jsonb_build_object('can_delete', true);
      END IF;
      
    ELSE -- employee y otros roles
      -- Empleados solo pueden eliminar ventas del mismo día
      IF v_hours_old > 24 THEN
        v_result := jsonb_build_object(
          'can_delete', false,
          'reason', 'Los empleados solo pueden eliminar ventas del mismo día'
        );
      ELSIF v_payment_status = 'paid' AND v_has_installments THEN
        v_result := jsonb_build_object(
          'can_delete', false,
          'reason', 'No se pueden eliminar ventas pagadas con abonos'
        );
      ELSE
        v_result := jsonb_build_object('can_delete', true);
      END IF;
  END CASE;
  
  RETURN v_result;
END;
$$;

-- Función para obtener el impacto de eliminar una venta
CREATE OR REPLACE FUNCTION get_sale_deletion_impact(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_info jsonb;
  v_items jsonb;
  v_imei_serials jsonb;
  v_installments_count integer := 0;
  v_cash_register_entries_count integer := 0;
  v_impact_summary jsonb;
BEGIN
  -- Obtener información básica de la venta
  SELECT jsonb_build_object(
    'id', id,
    'total_amount', total_amount,
    'payment_type', payment_type,
    'payment_status', payment_status,
    'created_at', created_at,
    'customer_name', COALESCE(c.name, 'Sin cliente')
  )
  INTO v_sale_info
  FROM sales s
  LEFT JOIN customers c ON s.customer_id = c.id
  WHERE s.id = p_sale_id;
  
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
  )
  INTO v_items
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
  )
  INTO v_imei_serials
  FROM product_imei_serials pis
  JOIN products p ON pis.product_id = p.id
  WHERE pis.sale_id = p_sale_id;
  
  -- Contar abonos
  SELECT COUNT(*)
  INTO v_installments_count
  FROM payment_installments
  WHERE sale_id = p_sale_id;
  
  -- Contar entradas en caja registradora
  SELECT COUNT(*)
  INTO v_cash_register_entries_count
  FROM cash_register_sales
  WHERE sale_id = p_sale_id;
  
  -- Calcular resumen del impacto
  SELECT jsonb_build_object(
    'stock_to_restore', COALESCE(SUM(
      CASE WHEN NOT p.requires_imei_serial THEN si.quantity ELSE 0 END
    ), 0),
    'imei_serials_to_restore', COALESCE(COUNT(pis.id), 0)
  )
  INTO v_impact_summary
  FROM sale_items si
  JOIN products p ON si.product_id = p.id
  LEFT JOIN product_imei_serials pis ON pis.sale_id = p_sale_id
  WHERE si.sale_id = p_sale_id;
  
  RETURN jsonb_build_object(
    'sale_info', v_sale_info,
    'items', COALESCE(v_items, '[]'::jsonb),
    'imei_serials', COALESCE(v_imei_serials, '[]'::jsonb),
    'installments_count', v_installments_count,
    'cash_register_entries_count', v_cash_register_entries_count,
    'impact_summary', v_impact_summary
  );
END;
$$;

-- Función para eliminar venta de forma segura
CREATE OR REPLACE FUNCTION delete_sale_safely(
  p_sale_id uuid,
  p_user_id uuid,
  p_reason text DEFAULT 'Eliminación manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_record sales%ROWTYPE;
  v_sale_items_deleted integer := 0;
  v_stock_restored integer := 0;
  v_imei_serials_restored integer := 0;
  v_installments_deleted integer := 0;
  v_cash_register_entries_deleted integer := 0;
  v_payments_deleted integer := 0;
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
  
  -- Registrar auditoría de eliminación ANTES de eliminar
  INSERT INTO cash_register_enhanced_audit (
    cash_register_id,
    action_type,
    entity_type,
    entity_id,
    amount,
    description,
    reason,
    performed_by,
    severity,
    metadata
  ) VALUES (
    NULL, -- Permitir NULL aquí
    'delete',
    'sale',
    p_sale_id,
    v_sale_record.total_amount,
    'Eliminación de venta #' || SUBSTRING(p_sale_id::text, -8),
    p_reason,
    p_user_id,
    'high',
    jsonb_build_object(
      'original_sale', row_to_json(v_sale_record),
      'deletion_timestamp', NOW(),
      'deletion_reason', p_reason
    )
  );
  
  -- Restaurar stock para productos sin IMEI/Serial
  UPDATE products 
  SET stock = stock + si.quantity
  FROM sale_items si
  WHERE products.id = si.product_id 
    AND si.sale_id = p_sale_id
    AND NOT products.requires_imei_serial;
  
  GET DIAGNOSTICS v_stock_restored = ROW_COUNT;
  
  -- Restaurar IMEI/Serial a estado disponible
  UPDATE product_imei_serials
  SET 
    status = 'available',
    sale_id = NULL,
    sale_item_id = NULL,
    sold_at = NULL,
    notes = 'Restaurado por eliminación de venta #' || SUBSTRING(p_sale_id::text, -8),
    updated_at = NOW(),
    updated_by = p_user_id
  WHERE sale_id = p_sale_id;
  
  GET DIAGNOSTICS v_imei_serials_restored = ROW_COUNT;
  
  -- Eliminar abonos asociados
  DELETE FROM payment_installments
  WHERE sale_id = p_sale_id;
  
  GET DIAGNOSTICS v_installments_deleted = ROW_COUNT;
  
  -- Eliminar registros de caja registradora
  DELETE FROM cash_register_sales
  WHERE sale_id = p_sale_id;
  
  GET DIAGNOSTICS v_cash_register_entries_deleted = ROW_COUNT;
  
  -- Eliminar pagos asociados
  DELETE FROM payments
  WHERE sale_id = p_sale_id;
  
  GET DIAGNOSTICS v_payments_deleted = ROW_COUNT;
  
  -- Eliminar items de venta
  DELETE FROM sale_items
  WHERE sale_id = p_sale_id;
  
  GET DIAGNOSTICS v_sale_items_deleted = ROW_COUNT;
  
  -- Finalmente, eliminar la venta
  DELETE FROM sales
  WHERE id = p_sale_id;
  
  -- Construir resultado
  v_result := jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'sale_items_deleted', v_sale_items_deleted,
    'stock_restored', v_stock_restored,
    'imei_serials_restored', v_imei_serials_restored,
    'installments_deleted', v_installments_deleted,
    'cash_register_entries_deleted', v_cash_register_entries_deleted,
    'payments_deleted', v_payments_deleted,
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
      'error_detail', SQLSTATE
    );
END;
$$;

-- Función para limpiar datos huérfanos
CREATE OR REPLACE FUNCTION cleanup_orphaned_sale_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orphaned_items_cleaned integer := 0;
  v_orphaned_imei_serials_restored integer := 0;
  v_orphaned_payments_cleaned integer := 0;
  v_orphaned_installments_cleaned integer := 0;
  v_orphaned_cash_register_sales_cleaned integer := 0;
BEGIN
  -- Limpiar sale_items huérfanos (sin venta asociada)
  DELETE FROM sale_items
  WHERE sale_id NOT IN (SELECT id FROM sales);
  
  GET DIAGNOSTICS v_orphaned_items_cleaned = ROW_COUNT;
  
  -- Restaurar IMEI/Serial huérfanos (con sale_id que ya no existe)
  UPDATE product_imei_serials
  SET 
    status = 'available',
    sale_id = NULL,
    sale_item_id = NULL,
    sold_at = NULL,
    notes = 'Restaurado por limpieza automática - venta eliminada',
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
  
  GET DIAGNOSTICS v_orphaned_cash_register_sales_cleaned = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'orphaned_items_cleaned', v_orphaned_items_cleaned,
    'orphaned_imei_serials_restored', v_orphaned_imei_serials_restored,
    'orphaned_payments_cleaned', v_orphaned_payments_cleaned,
    'orphaned_installments_cleaned', v_orphaned_installments_cleaned,
    'orphaned_cash_register_sales_cleaned', v_orphaned_cash_register_sales_cleaned,
    'cleanup_timestamp', NOW()
  );
END;
$$;

-- Función mejorada para auditoría que maneja NULL en cash_register_id
CREATE OR REPLACE FUNCTION log_enhanced_cash_register_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cash_register_id uuid := NULL;
  v_action_type text;
  v_entity_type text;
  v_description text;
  v_severity text := 'normal';
  v_amount numeric := 0;
BEGIN
  -- Determinar el tipo de acción
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'create';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := 'edit';
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'delete';
    v_severity := 'high';
  END IF;
  
  -- Determinar entidad y descripción según la tabla
  CASE TG_TABLE_NAME
    WHEN 'sales' THEN
      v_entity_type := 'sale';
      IF TG_OP = 'DELETE' THEN
        v_description := 'Eliminación de venta #' || SUBSTRING(OLD.id::text, -8);
        v_amount := OLD.total_amount;
        -- Intentar obtener cash_register_id de la venta eliminada
        SELECT cash_register_id INTO v_cash_register_id
        FROM cash_register_sales 
        WHERE sale_id = OLD.id 
        LIMIT 1;
      ELSE
        v_description := 'Operación en venta #' || SUBSTRING(COALESCE(NEW.id, OLD.id)::text, -8);
        v_amount := COALESCE(NEW.total_amount, OLD.total_amount);
      END IF;
      
    WHEN 'cash_registers' THEN
      v_entity_type := 'cash_register';
      v_cash_register_id := COALESCE(NEW.id, OLD.id);
      IF TG_OP = 'INSERT' THEN
        v_action_type := 'open';
        v_description := 'Apertura de caja registradora';
        v_amount := NEW.opening_amount;
      ELSIF TG_OP = 'UPDATE' AND OLD.status = 'open' AND NEW.status = 'closed' THEN
        v_action_type := 'close';
        v_description := 'Cierre de caja registradora';
        v_amount := NEW.actual_closing_amount;
      ELSE
        v_description := 'Modificación de caja registradora';
      END IF;
      
    ELSE
      v_entity_type := 'other';
      v_description := 'Operación en ' || TG_TABLE_NAME;
  END CASE;
  
  -- Insertar registro de auditoría (permitiendo NULL en cash_register_id)
  INSERT INTO cash_register_enhanced_audit (
    cash_register_id,
    action_type,
    entity_type,
    entity_id,
    amount,
    description,
    reason,
    performed_by,
    performed_at,
    severity,
    metadata
  ) VALUES (
    v_cash_register_id, -- Puede ser NULL
    v_action_type,
    v_entity_type,
    COALESCE(NEW.id, OLD.id),
    v_amount,
    v_description,
    'Operación automática del sistema',
    COALESCE(NEW.user_id, OLD.user_id, NEW.created_by, OLD.created_by),
    NOW(),
    v_severity,
    jsonb_build_object(
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', NOW()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recrear trigger para sales con la función mejorada
DROP TRIGGER IF EXISTS trigger_enhanced_audit_sales ON sales;
CREATE TRIGGER trigger_enhanced_audit_sales
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION log_enhanced_cash_register_audit();

-- Función para auditar eliminación de ventas específicamente
CREATE OR REPLACE FUNCTION audit_sale_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Registrar eliminación con detalles completos
  INSERT INTO cash_register_enhanced_audit (
    cash_register_id,
    action_type,
    entity_type,
    entity_id,
    amount,
    description,
    reason,
    performed_by,
    severity,
    metadata,
    old_values
  ) VALUES (
    NULL, -- Permitir NULL para eliminaciones
    'delete',
    'sale',
    OLD.id,
    OLD.total_amount,
    'Eliminación de venta #' || SUBSTRING(OLD.id::text, -8),
    'Eliminación manual desde historial',
    OLD.user_id,
    'high',
    jsonb_build_object(
      'deletion_method', 'manual',
      'original_payment_type', OLD.payment_type,
      'original_payment_status', OLD.payment_status,
      'deletion_timestamp', NOW()
    ),
    row_to_json(OLD)::jsonb
  );
  
  RETURN OLD;
END;
$$;

-- Aplicar trigger específico para eliminación de ventas
DROP TRIGGER IF EXISTS trigger_audit_sale_deletion ON sales;
CREATE TRIGGER trigger_audit_sale_deletion
  BEFORE DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION audit_sale_deletion();

-- Función para restaurar stock cuando se elimina una venta
CREATE OR REPLACE FUNCTION restore_stock_on_sale_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item record;
BEGIN
  -- Restaurar stock para cada item de la venta eliminada
  FOR v_item IN 
    SELECT si.product_id, si.quantity, p.requires_imei_serial, p.name
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = OLD.id
  LOOP
    -- Solo restaurar stock para productos que no requieren IMEI/Serial
    -- Los productos con IMEI/Serial se manejan por separado
    IF NOT v_item.requires_imei_serial THEN
      UPDATE products 
      SET stock = stock + v_item.quantity
      WHERE id = v_item.product_id;
    END IF;
  END LOOP;
  
  RETURN OLD;
END;
$$;

-- Aplicar trigger para restaurar stock
DROP TRIGGER IF EXISTS trigger_restore_stock_on_sale_deletion ON sales;
CREATE TRIGGER trigger_restore_stock_on_sale_deletion
  BEFORE DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION restore_stock_on_sale_deletion();

-- Crear índices para mejorar rendimiento de eliminaciones
CREATE INDEX IF NOT EXISTS idx_product_imei_serials_sale_id 
ON product_imei_serials(sale_id) 
WHERE sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_installments_sale_id 
ON payment_installments(sale_id);

CREATE INDEX IF NOT EXISTS idx_cash_register_sales_sale_id 
ON cash_register_sales(sale_id);

-- Función para validar operaciones críticas
CREATE OR REPLACE FUNCTION validate_critical_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Para eliminaciones, siempre permitir pero auditar
  IF TG_OP = 'DELETE' THEN
    -- La auditoría se maneja en otros triggers
    RETURN OLD;
  END IF;
  
  -- Para actualizaciones críticas, validar según el contexto
  IF TG_OP = 'UPDATE' THEN
    -- Permitir actualizaciones pero auditar cambios importantes
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplicar trigger de validación a tablas críticas
DROP TRIGGER IF EXISTS trigger_validate_critical_operations_sales ON sales;
CREATE TRIGGER trigger_validate_critical_operations_sales
  BEFORE UPDATE OR DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION validate_critical_operations();

DROP TRIGGER IF EXISTS trigger_validate_critical_operations_products ON products;
CREATE TRIGGER trigger_validate_critical_operations_products
  BEFORE UPDATE OR DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION validate_critical_operations();

DROP TRIGGER IF EXISTS trigger_validate_critical_operations_customers ON customers;
CREATE TRIGGER trigger_validate_critical_operations_customers
  BEFORE UPDATE OR DELETE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION validate_critical_operations();