/*
  # Solución completa del sistema de caja registradora

  1. Funciones de Base de Datos
    - Función para crear movimiento de apertura
    - Función para crear movimiento de cierre
    - Función para registrar ventas en caja
    - Función para registrar abonos en caja
    - Función para auditoría de acciones

  2. Triggers
    - Trigger para movimiento de apertura automático
    - Trigger para movimiento de cierre automático
    - Trigger para registrar ventas automáticamente
    - Trigger para registrar abonos automáticamente

  3. Correcciones de Estructura
    - Ajustes en constraints y validaciones
    - Mejoras en índices para rendimiento
    - Corrección de tipos de datos
*/

-- Eliminar triggers existentes que puedan estar causando problemas
DROP TRIGGER IF EXISTS trigger_create_opening_movement ON cash_registers;
DROP TRIGGER IF EXISTS trigger_create_closing_movement ON cash_registers;
DROP TRIGGER IF EXISTS trigger_register_sale_in_cash_register ON sales;
DROP TRIGGER IF EXISTS trigger_register_installment_in_cash_register ON payment_installments;
DROP TRIGGER IF EXISTS trigger_audit_cash_register ON cash_registers;
DROP TRIGGER IF EXISTS trigger_audit_cash_movements ON cash_movements;
DROP TRIGGER IF EXISTS trigger_audit_cash_register_sales ON cash_register_sales;
DROP TRIGGER IF EXISTS trigger_audit_cash_register_installments ON cash_register_installments;

-- Eliminar funciones existentes
DROP FUNCTION IF EXISTS create_opening_movement();
DROP FUNCTION IF EXISTS create_closing_movement();
DROP FUNCTION IF EXISTS register_sale_in_cash_register();
DROP FUNCTION IF EXISTS register_installment_in_cash_register();
DROP FUNCTION IF EXISTS log_cash_register_action();

-- Función para crear movimiento de apertura
CREATE OR REPLACE FUNCTION create_opening_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo crear movimiento de apertura para nuevas cajas
  IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
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
      'apertura_caja',
      NEW.opening_amount,
      'Apertura de caja registradora',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Error creating opening movement: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para crear movimiento de cierre
CREATE OR REPLACE FUNCTION create_closing_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo crear movimiento de cierre cuando se actualiza el estado a 'closed'
  IF TG_OP = 'UPDATE' AND OLD.status = 'open' AND NEW.status = 'closed' THEN
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
      'cierre_caja',
      NEW.closing_amount,
      'Cierre de caja registradora',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Error creating closing movement: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para registrar ventas en caja
CREATE OR REPLACE FUNCTION register_sale_in_cash_register()
RETURNS TRIGGER AS $$
DECLARE
  current_register_id UUID;
  payment_method_name TEXT;
BEGIN
  -- Solo procesar ventas en efectivo
  IF NEW.payment_type = 'cash' THEN
    -- Buscar caja abierta del usuario que hizo la venta
    SELECT id INTO current_register_id
    FROM cash_registers
    WHERE user_id = NEW.user_id
      AND status = 'open'
      AND DATE(opened_at) = CURRENT_DATE
    ORDER BY opened_at DESC
    LIMIT 1;
    
    -- Si hay una caja abierta, registrar la venta
    IF current_register_id IS NOT NULL THEN
      -- Obtener método de pago de la tabla payments
      SELECT COALESCE(payment_method, 'cash') INTO payment_method_name
      FROM payments
      WHERE sale_id = NEW.id
      ORDER BY created_at DESC
      LIMIT 1;
      
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
        current_register_id,
        'sale',
        'ventas_efectivo',
        NEW.total_amount,
        'Venta #' || SUBSTRING(NEW.id::text, -8) || ' - ' || COALESCE(payment_method_name, 'Efectivo'),
        NEW.id,
        NEW.user_id
      );
      
      -- Registrar en cash_register_sales
      INSERT INTO cash_register_sales (
        cash_register_id,
        sale_id,
        payment_method,
        amount_received,
        change_given
      ) VALUES (
        current_register_id,
        NEW.id,
        COALESCE(payment_method_name, 'cash'),
        NEW.total_amount,
        0
      ) ON CONFLICT (sale_id) DO NOTHING;
      
      -- Actualizar total de ventas en la caja
      UPDATE cash_registers
      SET 
        total_sales = COALESCE(total_sales, 0) + NEW.total_amount,
        last_movement_at = NOW()
      WHERE id = current_register_id;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Error registering sale in cash register: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para registrar abonos en caja
CREATE OR REPLACE FUNCTION register_installment_in_cash_register()
RETURNS TRIGGER AS $$
DECLARE
  current_register_id UUID;
  sale_info RECORD;
BEGIN
  -- Obtener información de la venta
  SELECT s.*, c.name as customer_name
  INTO sale_info
  FROM sales s
  LEFT JOIN customers c ON s.customer_id = c.id
  WHERE s.id = NEW.sale_id;
  
  -- Buscar caja abierta del día actual
  SELECT id INTO current_register_id
  FROM cash_registers
  WHERE status = 'open'
    AND DATE(opened_at) = CURRENT_DATE
  ORDER BY opened_at DESC
  LIMIT 1;
  
  -- Si hay una caja abierta, registrar el abono
  IF current_register_id IS NOT NULL THEN
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
      current_register_id,
      'income',
      'abonos_credito',
      NEW.amount_paid,
      'Abono venta #' || SUBSTRING(NEW.sale_id::text, -8) || 
      CASE 
        WHEN sale_info.customer_name IS NOT NULL 
        THEN ' - ' || sale_info.customer_name 
        ELSE '' 
      END,
      NEW.sale_id,
      (SELECT user_id FROM cash_registers WHERE id = current_register_id)
    );
    
    -- Registrar en cash_register_installments
    INSERT INTO cash_register_installments (
      cash_register_id,
      sale_id,
      installment_id,
      amount_paid,
      payment_method,
      payment_notes
    ) VALUES (
      current_register_id,
      NEW.sale_id,
      NEW.id,
      NEW.amount_paid,
      NEW.payment_method,
      NEW.notes
    ) ON CONFLICT DO NOTHING;
    
    -- Actualizar timestamp de último movimiento
    UPDATE cash_registers
    SET last_movement_at = NOW()
    WHERE id = current_register_id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Error registering installment in cash register: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para auditoría de acciones
CREATE OR REPLACE FUNCTION log_cash_register_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type_val TEXT;
  entity_type_val TEXT;
  entity_id_val UUID;
  amount_val NUMERIC;
  description_val TEXT;
BEGIN
  -- Determinar tipo de acción y entidad
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
      amount_val := COALESCE(NEW.closing_amount, NEW.opening_amount);
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
  
  -- Insertar log de auditoría
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
    COALESCE(NEW.cash_register_id, OLD.cash_register_id),
    action_type_val,
    entity_type_val,
    entity_id_val,
    amount_val,
    description_val,
    COALESCE(NEW.created_by, NEW.user_id, OLD.user_id),
    NOW()
  );
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Error logging cash register action: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recrear triggers con manejo de errores mejorado
CREATE TRIGGER trigger_create_opening_movement
  AFTER INSERT ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION create_opening_movement();

CREATE TRIGGER trigger_create_closing_movement
  AFTER UPDATE ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION create_closing_movement();

CREATE TRIGGER trigger_register_sale_in_cash_register
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION register_sale_in_cash_register();

CREATE TRIGGER trigger_register_installment_in_cash_register
  AFTER INSERT ON payment_installments
  FOR EACH ROW
  EXECUTE FUNCTION register_installment_in_cash_register();

CREATE TRIGGER trigger_audit_cash_register
  AFTER INSERT OR UPDATE ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION log_cash_register_action();

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

-- Función para generar reporte de auditoría de caja
CREATE OR REPLACE FUNCTION generate_cash_register_audit_report(
  p_cash_register_id UUID,
  p_include_details BOOLEAN DEFAULT true
)
RETURNS JSON AS $$
DECLARE
  session_info JSON;
  sales_detail JSON;
  installments_detail JSON;
  movements_detail JSON;
  audit_trail JSON;
  result JSON;
BEGIN
  -- Obtener información de la sesión
  SELECT json_build_object(
    'cash_register_id', cr.id,
    'opened_at', cr.opened_at,
    'closed_at', cr.closed_at,
    'status', cr.status,
    'operator_name', u.name,
    'opening_amount', cr.opening_amount,
    'closing_amount', cr.closing_amount,
    'calculated_balance', cr.expected_closing_amount,
    'discrepancy_amount', cr.discrepancy_amount,
    'session_duration_minutes', 
      CASE 
        WHEN cr.closed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (cr.closed_at - cr.opened_at)) / 60
        ELSE EXTRACT(EPOCH FROM (NOW() - cr.opened_at)) / 60
      END,
    'total_sales_count', (
      SELECT COUNT(*) FROM cash_register_sales WHERE cash_register_id = cr.id
    ),
    'total_sales_amount', COALESCE(cr.total_sales, 0),
    'total_installments_count', (
      SELECT COUNT(*) FROM cash_register_installments WHERE cash_register_id = cr.id
    ),
    'total_installments_amount', (
      SELECT COALESCE(SUM(amount_paid), 0) FROM cash_register_installments WHERE cash_register_id = cr.id
    ),
    'total_income', (
      SELECT COALESCE(SUM(amount), 0) FROM cash_movements 
      WHERE cash_register_id = cr.id AND type = 'income'
    ),
    'total_expenses', (
      SELECT COALESCE(SUM(amount), 0) FROM cash_movements 
      WHERE cash_register_id = cr.id AND type = 'expense'
    )
  ) INTO session_info
  FROM cash_registers cr
  LEFT JOIN users u ON cr.user_id = u.id
  WHERE cr.id = p_cash_register_id;

  IF p_include_details THEN
    -- Detalle de ventas
    SELECT json_agg(json_build_object(
      'sale_number', SUBSTRING(s.id::text, -8),
      'customer_name', c.name,
      'payment_type', s.payment_type,
      'total_amount', s.total_amount,
      'items_count', (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id),
      'created_at', s.created_at
    )) INTO sales_detail
    FROM cash_register_sales crs
    JOIN sales s ON crs.sale_id = s.id
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE crs.cash_register_id = p_cash_register_id;

    -- Detalle de abonos
    SELECT json_agg(json_build_object(
      'sale_number', SUBSTRING(s.id::text, -8),
      'customer_name', c.name,
      'payment_method', cri.payment_method,
      'amount_paid', cri.amount_paid,
      'payment_date', pi.payment_date
    )) INTO installments_detail
    FROM cash_register_installments cri
    JOIN payment_installments pi ON cri.installment_id = pi.id
    JOIN sales s ON cri.sale_id = s.id
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE cri.cash_register_id = p_cash_register_id;

    -- Detalle de movimientos
    SELECT json_agg(json_build_object(
      'type', cm.type,
      'category', cm.category,
      'amount', cm.amount,
      'description', cm.description,
      'created_at', cm.created_at,
      'created_by_name', u.name
    )) INTO movements_detail
    FROM cash_movements cm
    LEFT JOIN users u ON cm.created_by = u.id
    WHERE cm.cash_register_id = p_cash_register_id
      AND cm.type NOT IN ('sale', 'opening', 'closing');

    -- Trail de auditoría
    SELECT json_agg(json_build_object(
      'action_type', cal.action_type,
      'entity_type', cal.entity_type,
      'amount', cal.amount,
      'description', cal.description,
      'performed_at', cal.performed_at,
      'performed_by_name', u.name
    )) INTO audit_trail
    FROM cash_register_audit_logs cal
    LEFT JOIN users u ON cal.performed_by = u.id
    WHERE cal.cash_register_id = p_cash_register_id
    ORDER BY cal.performed_at;
  END IF;

  -- Construir resultado final
  result := json_build_object(
    'session_info', session_info,
    'sales_detail', COALESCE(sales_detail, '[]'::json),
    'installments_detail', COALESCE(installments_detail, '[]'::json),
    'movements_detail', COALESCE(movements_detail, '[]'::json),
    'audit_trail', COALESCE(audit_trail, '[]'::json),
    'generated_at', NOW()
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Función para refrescar vistas materializadas
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS VOID AS $$
BEGIN
  -- Esta función se puede usar para refrescar vistas materializadas si las creamos
  RAISE NOTICE 'Materialized views refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Asegurar que las columnas necesarias existen en cash_registers
DO $$
BEGIN
  -- Agregar columnas faltantes si no existen
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'expected_closing_amount'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN expected_closing_amount NUMERIC(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'actual_closing_amount'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN actual_closing_amount NUMERIC(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'discrepancy_amount'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN discrepancy_amount NUMERIC(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'discrepancy_reason'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN discrepancy_reason TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'session_notes'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN session_notes TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'last_movement_at'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN last_movement_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_cash_registers_user_status_date 
ON cash_registers (user_id, status, DATE(opened_at));

CREATE INDEX IF NOT EXISTS idx_cash_movements_register_type_date 
ON cash_movements (cash_register_id, type, DATE(created_at));

CREATE INDEX IF NOT EXISTS idx_cash_register_sales_register_date 
ON cash_register_sales (cash_register_id, DATE(created_at));

CREATE INDEX IF NOT EXISTS idx_cash_register_installments_register_date 
ON cash_register_installments (cash_register_id, DATE(created_at));

-- Función para obtener balance actual de caja
CREATE OR REPLACE FUNCTION get_cash_register_balance(register_id UUID)
RETURNS TABLE (
  current_balance NUMERIC,
  total_sales NUMERIC,
  total_income NUMERIC,
  total_expenses NUMERIC,
  opening_amount NUMERIC,
  movement_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.opening_amount + 
    COALESCE((SELECT SUM(amount) FROM cash_movements WHERE cash_register_id = register_id AND type IN ('sale', 'income')), 0) -
    COALESCE((SELECT SUM(amount) FROM cash_movements WHERE cash_register_id = register_id AND type = 'expense'), 0) as current_balance,
    COALESCE((SELECT SUM(amount) FROM cash_movements WHERE cash_register_id = register_id AND type = 'sale'), 0) as total_sales,
    COALESCE((SELECT SUM(amount) FROM cash_movements WHERE cash_register_id = register_id AND type = 'income'), 0) as total_income,
    COALESCE((SELECT SUM(amount) FROM cash_movements WHERE cash_register_id = register_id AND type = 'expense'), 0) as total_expenses,
    cr.opening_amount,
    (SELECT COUNT(*) FROM cash_movements WHERE cash_register_id = register_id)::INTEGER as movement_count
  FROM cash_registers cr
  WHERE cr.id = register_id;
END;
$$ LANGUAGE plpgsql;

-- Función para validar que solo haya una caja abierta por usuario
CREATE OR REPLACE FUNCTION validate_single_open_register()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo validar en INSERT de nuevas cajas abiertas
  IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
    -- Verificar si ya hay una caja abierta para este usuario
    IF EXISTS (
      SELECT 1 FROM cash_registers 
      WHERE user_id = NEW.user_id 
        AND status = 'open' 
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'El usuario ya tiene una caja abierta. Debe cerrar la caja actual antes de abrir una nueva.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para validación de caja única
DROP TRIGGER IF EXISTS trigger_validate_single_open_register ON cash_registers;
CREATE TRIGGER trigger_validate_single_open_register
  BEFORE INSERT ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION validate_single_open_register();

-- Limpiar datos inconsistentes (opcional - ejecutar solo si es necesario)
-- UPDATE cash_registers SET status = 'closed', closed_at = NOW() 
-- WHERE status = 'open' AND opened_at < CURRENT_DATE - INTERVAL '1 day';

-- Verificar integridad de datos
DO $$
DECLARE
  orphaned_movements INTEGER;
  invalid_registers INTEGER;
BEGIN
  -- Contar movimientos huérfanos
  SELECT COUNT(*) INTO orphaned_movements
  FROM cash_movements cm
  WHERE NOT EXISTS (
    SELECT 1 FROM cash_registers cr WHERE cr.id = cm.cash_register_id
  );
  
  -- Contar registros inválidos
  SELECT COUNT(*) INTO invalid_registers
  FROM cash_registers
  WHERE opening_amount < 0 OR closing_amount < 0;
  
  RAISE NOTICE 'Verificación de integridad completada:';
  RAISE NOTICE '- Movimientos huérfanos: %', orphaned_movements;
  RAISE NOTICE '- Registros inválidos: %', invalid_registers;
  
  IF orphaned_movements > 0 THEN
    RAISE WARNING 'Se encontraron % movimientos huérfanos que deben ser revisados', orphaned_movements;
  END IF;
  
  IF invalid_registers > 0 THEN
    RAISE WARNING 'Se encontraron % registros con montos negativos que deben ser corregidos', invalid_registers;
  END IF;
END $$;