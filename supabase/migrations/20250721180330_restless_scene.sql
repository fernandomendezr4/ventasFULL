/*
  # Solución Completa del Sistema de Caja Registradora

  1. Funciones de Triggers
    - Recrear todas las funciones con manejo de errores robusto
    - Validaciones para evitar múltiples cajas abiertas
    - Sistema de auditoría mejorado

  2. Estructura de Tablas
    - Verificar y corregir todas las columnas necesarias
    - Índices optimizados para rendimiento

  3. Políticas de Seguridad
    - RLS configurado correctamente para todas las operaciones
*/

-- Eliminar funciones existentes que pueden estar causando problemas
DROP FUNCTION IF EXISTS create_opening_movement() CASCADE;
DROP FUNCTION IF EXISTS create_closing_movement() CASCADE;
DROP FUNCTION IF EXISTS register_sale_in_cash_register() CASCADE;
DROP FUNCTION IF EXISTS register_installment_in_cash_register() CASCADE;
DROP FUNCTION IF EXISTS log_cash_register_action() CASCADE;
DROP FUNCTION IF EXISTS validate_single_open_register() CASCADE;
DROP FUNCTION IF EXISTS get_cash_register_balance(uuid) CASCADE;

-- Función para validar que un usuario no tenga múltiples cajas abiertas
CREATE OR REPLACE FUNCTION validate_single_open_register()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo validar en INSERT y cuando el status es 'open'
  IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
    -- Verificar si ya existe una caja abierta para este usuario
    IF EXISTS (
      SELECT 1 FROM cash_registers 
      WHERE user_id = NEW.user_id 
      AND status = 'open' 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND opened_at >= CURRENT_DATE - INTERVAL '7 days'
    ) THEN
      RAISE EXCEPTION 'El usuario ya tiene una caja abierta. Debe cerrarla antes de abrir una nueva.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para crear movimiento de apertura
CREATE OR REPLACE FUNCTION create_opening_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo crear movimiento de apertura en INSERT cuando status es 'open'
  IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
    BEGIN
      INSERT INTO cash_movements (
        cash_register_id,
        type,
        category,
        amount,
        description,
        created_by
      ) VALUES (
        NEW.id,
        'opening',
        'apertura',
        NEW.opening_amount,
        'Apertura de caja registradora',
        NEW.user_id
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Error creating opening movement: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para crear movimiento de cierre
CREATE OR REPLACE FUNCTION create_closing_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo crear movimiento de cierre cuando se actualiza de 'open' a 'closed'
  IF TG_OP = 'UPDATE' AND OLD.status = 'open' AND NEW.status = 'closed' THEN
    BEGIN
      INSERT INTO cash_movements (
        cash_register_id,
        type,
        category,
        amount,
        description,
        created_by
      ) VALUES (
        NEW.id,
        'closing',
        'cierre',
        NEW.closing_amount,
        CASE 
          WHEN NEW.discrepancy_amount != 0 THEN 
            'Cierre de caja - Discrepancia: ' || NEW.discrepancy_amount::text
          ELSE 
            'Cierre de caja registradora'
        END,
        NEW.user_id
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Error creating closing movement: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para registrar ventas en caja (simplificada)
CREATE OR REPLACE FUNCTION register_sale_in_cash_register()
RETURNS TRIGGER AS $$
DECLARE
  open_register_id uuid;
  sale_user_id uuid;
BEGIN
  -- Solo procesar ventas en efectivo
  IF NEW.payment_type != 'cash' THEN
    RETURN NEW;
  END IF;

  -- Obtener el user_id de la venta
  sale_user_id := NEW.user_id;
  
  -- Si no hay user_id en la venta, no procesar
  IF sale_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- Buscar caja abierta del usuario
    SELECT id INTO open_register_id
    FROM cash_registers
    WHERE user_id = sale_user_id
    AND status = 'open'
    AND opened_at >= CURRENT_DATE
    ORDER BY opened_at DESC
    LIMIT 1;

    -- Si hay caja abierta, registrar la venta
    IF open_register_id IS NOT NULL THEN
      -- Insertar en cash_register_sales
      INSERT INTO cash_register_sales (
        cash_register_id,
        sale_id,
        payment_method,
        amount_received,
        change_given
      ) VALUES (
        open_register_id,
        NEW.id,
        'cash',
        NEW.total_amount,
        0
      );

      -- Crear movimiento de venta
      INSERT INTO cash_movements (
        cash_register_id,
        type,
        category,
        amount,
        description,
        reference_id,
        created_by
      ) VALUES (
        open_register_id,
        'sale',
        'ventas',
        NEW.total_amount,
        'Venta #' || SUBSTRING(NEW.id::text, -8),
        NEW.id,
        sale_user_id
      );

      -- Actualizar totales de la caja
      UPDATE cash_registers
      SET 
        total_sales = total_sales + NEW.total_amount,
        last_movement_at = NOW()
      WHERE id = open_register_id;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the sale
    RAISE WARNING 'Error registering sale in cash register: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para registrar abonos en caja
CREATE OR REPLACE FUNCTION register_installment_in_cash_register()
RETURNS TRIGGER AS $$
DECLARE
  open_register_id uuid;
  sale_user_id uuid;
BEGIN
  BEGIN
    -- Obtener el user_id de la venta relacionada
    SELECT s.user_id INTO sale_user_id
    FROM sales s
    WHERE s.id = NEW.sale_id;
    
    -- Si no hay user_id, no procesar
    IF sale_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Buscar caja abierta del usuario
    SELECT id INTO open_register_id
    FROM cash_registers
    WHERE user_id = sale_user_id
    AND status = 'open'
    AND opened_at >= CURRENT_DATE
    ORDER BY opened_at DESC
    LIMIT 1;

    -- Si hay caja abierta, registrar el abono
    IF open_register_id IS NOT NULL THEN
      -- Insertar en cash_register_installments
      INSERT INTO cash_register_installments (
        cash_register_id,
        sale_id,
        installment_id,
        amount_paid,
        payment_method,
        payment_notes,
        created_by
      ) VALUES (
        open_register_id,
        NEW.sale_id,
        NEW.id,
        NEW.amount_paid,
        NEW.payment_method,
        NEW.notes,
        sale_user_id
      );

      -- Crear movimiento de abono
      INSERT INTO cash_movements (
        cash_register_id,
        type,
        category,
        amount,
        description,
        reference_id,
        created_by
      ) VALUES (
        open_register_id,
        'income',
        'abonos',
        NEW.amount_paid,
        'Abono venta #' || SUBSTRING(NEW.sale_id::text, -8),
        NEW.sale_id,
        sale_user_id
      );

      -- Actualizar last_movement_at
      UPDATE cash_registers
      SET last_movement_at = NOW()
      WHERE id = open_register_id;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the installment
    RAISE WARNING 'Error registering installment in cash register: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para logging de auditoría
CREATE OR REPLACE FUNCTION log_cash_register_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type_val text;
  entity_type_val text;
  entity_id_val uuid;
  amount_val numeric(10,2) := 0;
  description_val text;
BEGIN
  -- Determinar el tipo de acción y entidad
  IF TG_TABLE_NAME = 'cash_registers' THEN
    entity_type_val := 'cash_register';
    entity_id_val := COALESCE(NEW.id, OLD.id);
    
    IF TG_OP = 'INSERT' THEN
      action_type_val := 'open';
      amount_val := NEW.opening_amount;
      description_val := 'Apertura de caja registradora';
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'open' AND NEW.status = 'closed' THEN
      action_type_val := 'close';
      amount_val := NEW.closing_amount;
      description_val := 'Cierre de caja registradora';
    ELSE
      action_type_val := 'adjustment';
      description_val := 'Ajuste en caja registradora';
    END IF;
    
  ELSIF TG_TABLE_NAME = 'cash_movements' THEN
    entity_type_val := 'movement';
    entity_id_val := NEW.id;
    action_type_val := NEW.type;
    amount_val := NEW.amount;
    description_val := NEW.description;
    
  ELSIF TG_TABLE_NAME = 'cash_register_sales' THEN
    entity_type_val := 'sale';
    entity_id_val := NEW.sale_id;
    action_type_val := 'sale';
    amount_val := NEW.amount_received;
    description_val := 'Registro de venta en caja';
    
  ELSIF TG_TABLE_NAME = 'cash_register_installments' THEN
    entity_type_val := 'installment';
    entity_id_val := NEW.installment_id;
    action_type_val := 'installment';
    amount_val := NEW.amount_paid;
    description_val := 'Registro de abono en caja';
  END IF;

  BEGIN
    -- Insertar en audit log
    INSERT INTO cash_register_audit_logs (
      cash_register_id,
      action_type,
      entity_type,
      entity_id,
      amount,
      description,
      performed_by,
      metadata
    ) VALUES (
      CASE 
        WHEN TG_TABLE_NAME = 'cash_registers' THEN entity_id_val
        ELSE NEW.cash_register_id
      END,
      action_type_val,
      entity_type_val,
      entity_id_val,
      amount_val,
      description_val,
      COALESCE(NEW.created_by, NEW.user_id),
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', NOW()
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the main transaction
    RAISE WARNING 'Error in audit logging: %', SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Función para obtener balance de caja
CREATE OR REPLACE FUNCTION get_cash_register_balance(register_id uuid)
RETURNS TABLE (
  current_balance numeric(10,2),
  total_sales numeric(10,2),
  total_income numeric(10,2),
  total_expenses numeric(10,2),
  opening_amount numeric(10,2),
  movement_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(cr.opening_amount, 0) + 
    COALESCE(SUM(CASE WHEN cm.type IN ('sale', 'income') THEN cm.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN cm.type = 'expense' THEN cm.amount ELSE 0 END), 0) as current_balance,
    
    COALESCE(SUM(CASE WHEN cm.type = 'sale' THEN cm.amount ELSE 0 END), 0) as total_sales,
    COALESCE(SUM(CASE WHEN cm.type = 'income' THEN cm.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN cm.type = 'expense' THEN cm.amount ELSE 0 END), 0) as total_expenses,
    COALESCE(cr.opening_amount, 0) as opening_amount,
    COALESCE(COUNT(cm.id)::integer, 0) as movement_count
  FROM cash_registers cr
  LEFT JOIN cash_movements cm ON cm.cash_register_id = cr.id
  WHERE cr.id = register_id
  GROUP BY cr.id, cr.opening_amount;
END;
$$ LANGUAGE plpgsql;

-- Recrear triggers en el orden correcto
DROP TRIGGER IF EXISTS trigger_validate_single_open_register ON cash_registers;
DROP TRIGGER IF EXISTS trigger_create_opening_movement ON cash_registers;
DROP TRIGGER IF EXISTS trigger_create_closing_movement ON cash_registers;
DROP TRIGGER IF EXISTS trigger_audit_cash_register ON cash_registers;
DROP TRIGGER IF EXISTS trigger_register_sale_in_cash_register ON sales;
DROP TRIGGER IF EXISTS trigger_register_installment_in_cash_register ON payment_installments;
DROP TRIGGER IF EXISTS trigger_audit_cash_movements ON cash_movements;
DROP TRIGGER IF EXISTS trigger_audit_cash_register_sales ON cash_register_sales;
DROP TRIGGER IF EXISTS trigger_audit_cash_register_installments ON cash_register_installments;

-- Triggers para cash_registers (orden importante)
CREATE TRIGGER trigger_validate_single_open_register
  BEFORE INSERT ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION validate_single_open_register();

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

-- Triggers para sales
CREATE TRIGGER trigger_register_sale_in_cash_register
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION register_sale_in_cash_register();

-- Triggers para payment_installments
CREATE TRIGGER trigger_register_installment_in_cash_register
  AFTER INSERT ON payment_installments
  FOR EACH ROW
  EXECUTE FUNCTION register_installment_in_cash_register();

-- Triggers para auditoría
CREATE TRIGGER trigger_audit_cash_movements
  AFTER INSERT ON cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION log_cash_register_action();

CREATE TRIGGER trigger_audit_cash_register_sales
  AFTER INSERT ON cash_register_sales
  FOR EACH ROW
  EXECUTE FUNCTION log_cash_register_action();

CREATE TRIGGER trigger_audit_cash_register_installments
  AFTER INSERT ON cash_register_installments
  FOR EACH ROW
  EXECUTE FUNCTION log_cash_register_action();

-- Verificar que todas las columnas necesarias existan
DO $$
BEGIN
  -- Verificar columnas en cash_registers
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'expected_closing_amount'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN expected_closing_amount numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'actual_closing_amount'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN actual_closing_amount numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'discrepancy_amount'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN discrepancy_amount numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'discrepancy_reason'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN discrepancy_reason text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'session_notes'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN session_notes text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'last_movement_at'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN last_movement_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Limpiar datos inconsistentes
UPDATE cash_registers 
SET 
  expected_closing_amount = COALESCE(expected_closing_amount, 0),
  actual_closing_amount = COALESCE(actual_closing_amount, 0),
  discrepancy_amount = COALESCE(discrepancy_amount, 0),
  discrepancy_reason = COALESCE(discrepancy_reason, ''),
  session_notes = COALESCE(session_notes, ''),
  last_movement_at = COALESCE(last_movement_at, created_at)
WHERE 
  expected_closing_amount IS NULL OR
  actual_closing_amount IS NULL OR
  discrepancy_amount IS NULL OR
  discrepancy_reason IS NULL OR
  session_notes IS NULL OR
  last_movement_at IS NULL;

-- Cerrar cajas que puedan estar en estado inconsistente (más de 24 horas abiertas)
UPDATE cash_registers 
SET 
  status = 'closed',
  closed_at = opened_at + INTERVAL '24 hours',
  closing_amount = opening_amount,
  actual_closing_amount = opening_amount,
  expected_closing_amount = opening_amount,
  discrepancy_amount = 0,
  session_notes = 'Cerrada automáticamente por mantenimiento del sistema'
WHERE 
  status = 'open' 
  AND opened_at < NOW() - INTERVAL '24 hours';

-- Función para generar reporte de auditoría
CREATE OR REPLACE FUNCTION generate_cash_register_audit_report(
  p_cash_register_id uuid,
  p_include_details boolean DEFAULT true
)
RETURNS jsonb AS $$
DECLARE
  register_info jsonb;
  movements_detail jsonb;
  sales_detail jsonb;
  installments_detail jsonb;
  audit_trail jsonb;
  result jsonb;
BEGIN
  -- Información básica del registro
  SELECT to_jsonb(cr.*) INTO register_info
  FROM cash_register_session_details cr
  WHERE cr.cash_register_id = p_cash_register_id;

  IF p_include_details THEN
    -- Detalle de movimientos
    SELECT jsonb_agg(to_jsonb(cm.*)) INTO movements_detail
    FROM cash_register_movements_detailed cm
    WHERE cm.cash_register_id = p_cash_register_id
    AND cm.type NOT IN ('opening', 'closing', 'sale');

    -- Detalle de ventas
    SELECT jsonb_agg(
      jsonb_build_object(
        'sale_id', s.id,
        'sale_number', SUBSTRING(s.id::text, -8),
        'total_amount', s.total_amount,
        'customer_name', c.name,
        'items_count', (
          SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id
        ),
        'created_at', s.created_at
      )
    ) INTO sales_detail
    FROM cash_register_sales crs
    JOIN sales s ON s.id = crs.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE crs.cash_register_id = p_cash_register_id;

    -- Detalle de abonos
    SELECT jsonb_agg(
      jsonb_build_object(
        'installment_id', pi.id,
        'sale_id', pi.sale_id,
        'sale_number', SUBSTRING(pi.sale_id::text, -8),
        'amount_paid', pi.amount_paid,
        'payment_method', pi.payment_method,
        'customer_name', c.name,
        'payment_date', pi.payment_date
      )
    ) INTO installments_detail
    FROM cash_register_installments cri
    JOIN payment_installments pi ON pi.id = cri.installment_id
    JOIN sales s ON s.id = pi.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE cri.cash_register_id = p_cash_register_id;

    -- Trail de auditoría
    SELECT jsonb_agg(to_jsonb(cal.*)) INTO audit_trail
    FROM cash_register_audit_logs cal
    WHERE cal.cash_register_id = p_cash_register_id
    ORDER BY cal.performed_at DESC;
  END IF;

  -- Construir resultado
  result := jsonb_build_object(
    'session_info', register_info,
    'movements_detail', COALESCE(movements_detail, '[]'::jsonb),
    'sales_detail', COALESCE(sales_detail, '[]'::jsonb),
    'installments_detail', COALESCE(installments_detail, '[]'::jsonb),
    'audit_trail', COALESCE(audit_trail, '[]'::jsonb),
    'generated_at', NOW()
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_cash_registers_user_status_date 
ON cash_registers (user_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_movements_register_type_date 
ON cash_movements (cash_register_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_register_sales_register_date 
ON cash_register_sales (cash_register_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_register_installments_register_date 
ON cash_register_installments (cash_register_id, created_at DESC);

-- Función para limpiar datos huérfanos
CREATE OR REPLACE FUNCTION cleanup_orphaned_cash_data()
RETURNS void AS $$
BEGIN
  -- Limpiar movimientos huérfanos
  DELETE FROM cash_movements 
  WHERE cash_register_id NOT IN (SELECT id FROM cash_registers);
  
  -- Limpiar ventas huérfanas
  DELETE FROM cash_register_sales 
  WHERE cash_register_id NOT IN (SELECT id FROM cash_registers);
  
  -- Limpiar abonos huérfanos
  DELETE FROM cash_register_installments 
  WHERE cash_register_id NOT IN (SELECT id FROM cash_registers);
  
  -- Limpiar logs huérfanos
  DELETE FROM cash_register_audit_logs 
  WHERE cash_register_id NOT IN (SELECT id FROM cash_registers);
END;
$$ LANGUAGE plpgsql;

-- Ejecutar limpieza
SELECT cleanup_orphaned_cash_data();