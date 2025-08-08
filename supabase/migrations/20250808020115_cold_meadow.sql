/*
  # Corregir eliminación en cascada de ventas

  1. Modificaciones de Esquema
    - Actualizar restricciones de clave foránea para eliminación en cascada
    - Corregir relaciones entre sales, sale_items y product_imei_serials
    - Agregar función para eliminación segura de ventas

  2. Funciones de Base de Datos
    - Función para eliminar venta completa con validaciones
    - Función para restaurar stock e IMEI/Serial al eliminar venta
    - Función para auditar eliminaciones de ventas

  3. Triggers
    - Trigger para auditar eliminaciones
    - Trigger para validar eliminaciones críticas
*/

-- Primero, eliminar restricciones existentes que pueden causar problemas
DO $$
BEGIN
  -- Eliminar restricción de clave foránea problemática si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'product_imei_serials_sale_item_id_fkey'
    AND table_name = 'product_imei_serials'
  ) THEN
    ALTER TABLE product_imei_serials DROP CONSTRAINT product_imei_serials_sale_item_id_fkey;
  END IF;

  -- Eliminar restricción de sale_id si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'product_imei_serials_sale_id_fkey'
    AND table_name = 'product_imei_serials'
  ) THEN
    ALTER TABLE product_imei_serials DROP CONSTRAINT product_imei_serials_sale_id_fkey;
  END IF;
END $$;

-- Recrear restricciones con eliminación en cascada correcta
ALTER TABLE product_imei_serials 
ADD CONSTRAINT product_imei_serials_sale_id_fkey 
FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;

ALTER TABLE product_imei_serials 
ADD CONSTRAINT product_imei_serials_sale_item_id_fkey 
FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE SET NULL;

-- Asegurar que sale_items se elimine en cascada cuando se elimina una venta
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'sale_items_sale_id_fkey'
    AND table_name = 'sale_items'
  ) THEN
    ALTER TABLE sale_items DROP CONSTRAINT sale_items_sale_id_fkey;
  END IF;
END $$;

ALTER TABLE sale_items 
ADD CONSTRAINT sale_items_sale_id_fkey 
FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;

-- Función para eliminar venta de forma segura
CREATE OR REPLACE FUNCTION delete_sale_safely(
  p_sale_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'Eliminación manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_record sales%ROWTYPE;
  v_sale_items_count integer;
  v_imei_serials_count integer;
  v_result jsonb;
  v_restored_stock integer := 0;
  v_restored_imei_serials integer := 0;
BEGIN
  -- Verificar que la venta existe
  SELECT * INTO v_sale_record FROM sales WHERE id = p_sale_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Venta no encontrada'
    );
  END IF;

  -- Contar elementos relacionados antes de eliminar
  SELECT COUNT(*) INTO v_sale_items_count 
  FROM sale_items WHERE sale_id = p_sale_id;

  SELECT COUNT(*) INTO v_imei_serials_count 
  FROM product_imei_serials WHERE sale_id = p_sale_id;

  -- Restaurar stock para productos sin IMEI/Serial
  UPDATE products 
  SET stock = stock + si.quantity
  FROM sale_items si
  WHERE products.id = si.product_id 
    AND si.sale_id = p_sale_id
    AND NOT products.requires_imei_serial;

  GET DIAGNOSTICS v_restored_stock = ROW_COUNT;

  -- Restaurar IMEI/Serial a estado disponible
  UPDATE product_imei_serials 
  SET 
    status = 'available',
    sale_id = NULL,
    sale_item_id = NULL,
    sold_at = NULL,
    notes = COALESCE(notes, '') || ' | Restaurado por eliminación de venta ' || p_sale_id::text,
    updated_at = NOW()
  WHERE sale_id = p_sale_id;

  GET DIAGNOSTICS v_restored_imei_serials = ROW_COUNT;

  -- Registrar en auditoría antes de eliminar
  INSERT INTO cash_register_enhanced_audit (
    cash_register_id,
    action_type,
    entity_type,
    entity_id,
    description,
    severity,
    performed_by,
    metadata
  ) VALUES (
    NULL, -- No hay caja específica para eliminaciones
    'delete',
    'sale',
    p_sale_id,
    'Eliminación de venta: ' || p_reason,
    'high',
    p_user_id,
    jsonb_build_object(
      'sale_total', v_sale_record.total_amount,
      'sale_items_count', v_sale_items_count,
      'imei_serials_count', v_imei_serials_count,
      'restored_stock', v_restored_stock,
      'restored_imei_serials', v_restored_imei_serials,
      'payment_type', v_sale_record.payment_type,
      'customer_id', v_sale_record.customer_id,
      'original_created_at', v_sale_record.created_at
    )
  );

  -- Eliminar registros de caja registradora relacionados
  DELETE FROM cash_register_sales WHERE sale_id = p_sale_id;
  DELETE FROM cash_register_installments WHERE sale_id = p_sale_id;

  -- Eliminar abonos relacionados
  DELETE FROM payment_installments WHERE sale_id = p_sale_id;

  -- Eliminar pagos relacionados
  DELETE FROM payments WHERE sale_id = p_sale_id;

  -- Finalmente, eliminar la venta (esto eliminará sale_items en cascada)
  DELETE FROM sales WHERE id = p_sale_id;

  -- Preparar resultado
  v_result := jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'sale_items_deleted', v_sale_items_count,
    'stock_restored', v_restored_stock,
    'imei_serials_restored', v_restored_imei_serials,
    'total_amount', v_sale_record.total_amount,
    'deleted_at', NOW()
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, registrar en auditoría
    INSERT INTO cash_register_enhanced_audit (
      cash_register_id,
      action_type,
      entity_type,
      entity_id,
      description,
      severity,
      performed_by,
      metadata
    ) VALUES (
      NULL,
      'delete',
      'sale',
      p_sale_id,
      'Error al eliminar venta: ' || SQLERRM,
      'critical',
      p_user_id,
      jsonb_build_object(
        'error', SQLERRM,
        'error_state', SQLSTATE,
        'reason', p_reason
      )
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

-- Función para validar si una venta puede ser eliminada
CREATE OR REPLACE FUNCTION can_delete_sale(
  p_sale_id uuid,
  p_user_role text DEFAULT 'employee'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_record sales%ROWTYPE;
  v_hours_since_creation numeric;
  v_has_installments boolean;
  v_is_in_cash_register boolean;
BEGIN
  -- Verificar que la venta existe
  SELECT * INTO v_sale_record FROM sales WHERE id = p_sale_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_delete', false,
      'reason', 'Venta no encontrada'
    );
  END IF;

  -- Calcular horas desde la creación
  v_hours_since_creation := EXTRACT(EPOCH FROM (NOW() - v_sale_record.created_at)) / 3600;

  -- Verificar si tiene abonos
  SELECT EXISTS(
    SELECT 1 FROM payment_installments WHERE sale_id = p_sale_id
  ) INTO v_has_installments;

  -- Verificar si está registrada en una caja
  SELECT EXISTS(
    SELECT 1 FROM cash_register_sales WHERE sale_id = p_sale_id
  ) INTO v_is_in_cash_register;

  -- Reglas de validación según el rol
  CASE p_user_role
    WHEN 'admin' THEN
      -- Los admin pueden eliminar cualquier venta
      RETURN jsonb_build_object(
        'can_delete', true,
        'reason', 'Administrador tiene permisos completos'
      );
    
    WHEN 'manager' THEN
      -- Los gerentes pueden eliminar ventas de menos de 24 horas
      IF v_hours_since_creation > 24 THEN
        RETURN jsonb_build_object(
          'can_delete', false,
          'reason', 'Solo se pueden eliminar ventas de menos de 24 horas'
        );
      END IF;
      
      -- No pueden eliminar ventas con abonos
      IF v_has_installments THEN
        RETURN jsonb_build_object(
          'can_delete', false,
          'reason', 'No se pueden eliminar ventas que tienen abonos registrados'
        );
      END IF;
    
    ELSE -- employee y otros roles
      -- Los empleados solo pueden eliminar ventas muy recientes (1 hora)
      IF v_hours_since_creation > 1 THEN
        RETURN jsonb_build_object(
          'can_delete', false,
          'reason', 'Solo se pueden eliminar ventas de menos de 1 hora'
        );
      END IF;
      
      -- No pueden eliminar ventas con abonos
      IF v_has_installments THEN
        RETURN jsonb_build_object(
          'can_delete', false,
          'reason', 'No se pueden eliminar ventas que tienen abonos'
        );
      END IF;
      
      -- No pueden eliminar ventas registradas en caja cerrada
      IF v_is_in_cash_register THEN
        -- Verificar si la caja está cerrada
        IF EXISTS(
          SELECT 1 FROM cash_register_sales crs
          JOIN cash_registers cr ON crs.cash_register_id = cr.id
          WHERE crs.sale_id = p_sale_id AND cr.status = 'closed'
        ) THEN
          RETURN jsonb_build_object(
            'can_delete', false,
            'reason', 'No se pueden eliminar ventas de cajas ya cerradas'
          );
        END IF;
      END IF;
  END CASE;

  RETURN jsonb_build_object(
    'can_delete', true,
    'reason', 'Venta puede ser eliminada',
    'warnings', jsonb_build_array(
      CASE WHEN v_is_in_cash_register THEN 'La venta está registrada en una caja' ELSE NULL END,
      CASE WHEN v_sale_record.payment_type = 'installment' THEN 'Es una venta a crédito' ELSE NULL END
    ) - NULL
  );
END;
$$;

-- Trigger para auditar eliminaciones críticas
CREATE OR REPLACE FUNCTION audit_sale_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Registrar eliminación en auditoría
  INSERT INTO cash_register_enhanced_audit (
    cash_register_id,
    action_type,
    entity_type,
    entity_id,
    description,
    severity,
    old_values,
    metadata
  ) VALUES (
    NULL,
    'delete',
    'sale',
    OLD.id,
    'Venta eliminada del sistema',
    'high',
    jsonb_build_object(
      'id', OLD.id,
      'total_amount', OLD.total_amount,
      'payment_type', OLD.payment_type,
      'payment_status', OLD.payment_status,
      'customer_id', OLD.customer_id,
      'user_id', OLD.user_id,
      'created_at', OLD.created_at
    ),
    jsonb_build_object(
      'deletion_timestamp', NOW(),
      'deletion_method', 'direct_delete'
    )
  );

  RETURN OLD;
END;
$$;

-- Crear trigger para auditar eliminaciones
DROP TRIGGER IF EXISTS trigger_audit_sale_deletion ON sales;
CREATE TRIGGER trigger_audit_sale_deletion
  BEFORE DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION audit_sale_deletion();

-- Función para limpiar datos huérfanos
CREATE OR REPLACE FUNCTION cleanup_orphaned_sale_data()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_orphaned_items integer;
  v_orphaned_imei_serials integer;
  v_orphaned_payments integer;
  v_orphaned_installments integer;
BEGIN
  -- Limpiar sale_items huérfanos
  DELETE FROM sale_items 
  WHERE sale_id NOT IN (SELECT id FROM sales);
  GET DIAGNOSTICS v_orphaned_items = ROW_COUNT;

  -- Limpiar product_imei_serials huérfanos
  UPDATE product_imei_serials 
  SET 
    status = 'available',
    sale_id = NULL,
    sale_item_id = NULL,
    sold_at = NULL,
    notes = COALESCE(notes, '') || ' | Restaurado por limpieza de datos huérfanos'
  WHERE sale_id IS NOT NULL 
    AND sale_id NOT IN (SELECT id FROM sales);
  GET DIAGNOSTICS v_orphaned_imei_serials = ROW_COUNT;

  -- Limpiar payments huérfanos
  DELETE FROM payments 
  WHERE sale_id NOT IN (SELECT id FROM sales);
  GET DIAGNOSTICS v_orphaned_payments = ROW_COUNT;

  -- Limpiar payment_installments huérfanos
  DELETE FROM payment_installments 
  WHERE sale_id NOT IN (SELECT id FROM sales);
  GET DIAGNOSTICS v_orphaned_installments = ROW_COUNT;

  -- Limpiar registros de caja huérfanos
  DELETE FROM cash_register_sales 
  WHERE sale_id NOT IN (SELECT id FROM sales);

  DELETE FROM cash_register_installments 
  WHERE sale_id NOT IN (SELECT id FROM sales);

  RETURN jsonb_build_object(
    'success', true,
    'orphaned_items_cleaned', v_orphaned_items,
    'orphaned_imei_serials_restored', v_orphaned_imei_serials,
    'orphaned_payments_cleaned', v_orphaned_payments,
    'orphaned_installments_cleaned', v_orphaned_installments,
    'cleaned_at', NOW()
  );
END;
$$;

-- Función para restaurar stock al eliminar venta
CREATE OR REPLACE FUNCTION restore_stock_on_sale_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_record RECORD;
  v_product_record RECORD;
BEGIN
  -- Restaurar stock para cada item de la venta
  FOR v_item_record IN 
    SELECT si.product_id, si.quantity, p.requires_imei_serial, p.name
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = OLD.id
  LOOP
    -- Solo restaurar stock para productos que no requieren IMEI/Serial
    IF NOT v_item_record.requires_imei_serial THEN
      UPDATE products 
      SET stock = stock + v_item_record.quantity
      WHERE id = v_item_record.product_id;
      
      -- Registrar restauración de stock en auditoría
      INSERT INTO cash_register_enhanced_audit (
        cash_register_id,
        action_type,
        entity_type,
        entity_id,
        description,
        severity,
        amount,
        metadata
      ) VALUES (
        NULL,
        'edit',
        'product',
        v_item_record.product_id,
        'Stock restaurado por eliminación de venta',
        'normal',
        v_item_record.quantity,
        jsonb_build_object(
          'product_name', v_item_record.name,
          'quantity_restored', v_item_record.quantity,
          'deleted_sale_id', OLD.id,
          'restoration_reason', 'sale_deletion'
        )
      );
    END IF;
  END LOOP;

  -- Restaurar IMEI/Serial a estado disponible
  UPDATE product_imei_serials 
  SET 
    status = 'available',
    sale_id = NULL,
    sale_item_id = NULL,
    sold_at = NULL,
    notes = COALESCE(notes, '') || ' | Restaurado por eliminación de venta ' || OLD.id::text,
    updated_at = NOW()
  WHERE sale_id = OLD.id;

  RETURN OLD;
END;
$$;

-- Crear trigger para restaurar stock automáticamente
DROP TRIGGER IF EXISTS trigger_restore_stock_on_sale_deletion ON sales;
CREATE TRIGGER trigger_restore_stock_on_sale_deletion
  BEFORE DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION restore_stock_on_sale_deletion();

-- Función para obtener información detallada de una venta antes de eliminar
CREATE OR REPLACE FUNCTION get_sale_deletion_impact(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_sale_record sales%ROWTYPE;
  v_items jsonb;
  v_imei_serials jsonb;
  v_cash_register_info jsonb;
  v_installments_count integer;
BEGIN
  -- Obtener información de la venta
  SELECT * INTO v_sale_record FROM sales WHERE id = p_sale_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Venta no encontrada');
  END IF;

  -- Obtener items de la venta
  SELECT jsonb_agg(
    jsonb_build_object(
      'product_id', si.product_id,
      'product_name', p.name,
      'quantity', si.quantity,
      'unit_price', si.unit_price,
      'total_price', si.total_price,
      'requires_imei_serial', p.requires_imei_serial,
      'current_stock', p.stock
    )
  ) INTO v_items
  FROM sale_items si
  JOIN products p ON si.product_id = p.id
  WHERE si.sale_id = p_sale_id;

  -- Obtener IMEI/Serial relacionados
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

  -- Obtener información de caja registradora
  SELECT jsonb_build_object(
    'cash_register_id', cr.id,
    'register_status', cr.status,
    'opened_at', cr.opened_at,
    'closed_at', cr.closed_at
  ) INTO v_cash_register_info
  FROM cash_register_sales crs
  JOIN cash_registers cr ON crs.cash_register_id = cr.id
  WHERE crs.sale_id = p_sale_id;

  -- Contar abonos
  SELECT COUNT(*) INTO v_installments_count
  FROM payment_installments
  WHERE sale_id = p_sale_id;

  RETURN jsonb_build_object(
    'sale_info', jsonb_build_object(
      'id', v_sale_record.id,
      'total_amount', v_sale_record.total_amount,
      'payment_type', v_sale_record.payment_type,
      'payment_status', v_sale_record.payment_status,
      'created_at', v_sale_record.created_at,
      'customer_id', v_sale_record.customer_id
    ),
    'items', COALESCE(v_items, '[]'::jsonb),
    'imei_serials', COALESCE(v_imei_serials, '[]'::jsonb),
    'cash_register_info', v_cash_register_info,
    'installments_count', v_installments_count,
    'can_be_deleted', true,
    'impact_summary', jsonb_build_object(
      'stock_to_restore', (
        SELECT COALESCE(SUM(si.quantity), 0)
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = p_sale_id AND NOT p.requires_imei_serial
      ),
      'imei_serials_to_restore', (
        SELECT COUNT(*)
        FROM product_imei_serials
        WHERE sale_id = p_sale_id
      )
    )
  );
END;
$$;

-- Ejecutar limpieza inicial de datos huérfanos
SELECT cleanup_orphaned_sale_data();