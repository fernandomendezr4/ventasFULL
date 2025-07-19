/*
  # Mejoras para Control Detallado de Caja Registradora

  1. Nuevas Tablas
    - `cash_register_sales` - Relación entre ventas y cajas registradoras
    - `cash_register_discrepancies` - Registro de descuadres y sus causas
    - `cash_register_audits` - Auditoría de cambios en movimientos de caja
    - `cash_register_sessions` - Sesiones detalladas de caja con más información

  2. Funciones
    - Función para calcular descuadres automáticamente
    - Función para generar reportes detallados de caja
    - Triggers para auditoría automática

  3. Vistas
    - Vista consolidada de información de caja
    - Vista de análisis de descuadres
*/

-- Tabla para relacionar ventas específicamente con cajas registradoras
CREATE TABLE IF NOT EXISTS cash_register_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method text NOT NULL DEFAULT 'cash',
  amount_received numeric(10,2) NOT NULL DEFAULT 0,
  change_given numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sale_id)
);

-- Tabla para registrar descuadres y sus causas
CREATE TABLE IF NOT EXISTS cash_register_discrepancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  discrepancy_type text NOT NULL CHECK (discrepancy_type IN ('shortage', 'overage', 'error')),
  expected_amount numeric(10,2) NOT NULL,
  actual_amount numeric(10,2) NOT NULL,
  difference_amount numeric(10,2) NOT NULL,
  reason text,
  resolution text,
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Tabla de auditoría para cambios en movimientos de caja
CREATE TABLE IF NOT EXISTS cash_register_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  movement_id uuid REFERENCES cash_movements(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('create', 'update', 'delete')),
  old_values jsonb,
  new_values jsonb,
  reason text,
  performed_by uuid REFERENCES users(id),
  performed_at timestamptz DEFAULT now()
);

-- Mejorar tabla de cash_registers con más campos de control
ALTER TABLE cash_registers 
ADD COLUMN IF NOT EXISTS expected_closing_amount numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_closing_amount numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discrepancy_amount numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discrepancy_reason text DEFAULT '',
ADD COLUMN IF NOT EXISTS session_notes text DEFAULT '',
ADD COLUMN IF NOT EXISTS last_movement_at timestamptz DEFAULT now();

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_cash_register_sales_register_id ON cash_register_sales(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_register_sales_created_at ON cash_register_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_register_discrepancies_register_id ON cash_register_discrepancies(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_register_audits_register_id ON cash_register_audits(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_register_audits_performed_at ON cash_register_audits(performed_at DESC);

-- Habilitar RLS en las nuevas tablas
ALTER TABLE cash_register_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_audits ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cash_register_sales
CREATE POLICY "Public can view cash_register_sales"
  ON cash_register_sales
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert cash_register_sales"
  ON cash_register_sales
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update cash_register_sales"
  ON cash_register_sales
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Public can delete cash_register_sales"
  ON cash_register_sales
  FOR DELETE
  TO public
  USING (true);

-- Políticas RLS para cash_register_discrepancies
CREATE POLICY "Public can view cash_register_discrepancies"
  ON cash_register_discrepancies
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert cash_register_discrepancies"
  ON cash_register_discrepancies
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update cash_register_discrepancies"
  ON cash_register_discrepancies
  FOR UPDATE
  TO public
  USING (true);

-- Políticas RLS para cash_register_audits
CREATE POLICY "Public can view cash_register_audits"
  ON cash_register_audits
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert cash_register_audits"
  ON cash_register_audits
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Función para registrar ventas en caja automáticamente
CREATE OR REPLACE FUNCTION register_sale_in_cash_register()
RETURNS TRIGGER AS $$
DECLARE
  current_register_id uuid;
  payment_method_name text;
BEGIN
  -- Solo procesar ventas en efectivo
  IF NEW.payment_type = 'cash' THEN
    -- Buscar caja abierta del usuario
    SELECT id INTO current_register_id
    FROM cash_registers
    WHERE user_id = NEW.user_id
      AND status = 'open'
      AND DATE(opened_at) = CURRENT_DATE
    ORDER BY opened_at DESC
    LIMIT 1;

    IF current_register_id IS NOT NULL THEN
      -- Obtener método de pago de la tabla payments
      SELECT payment_method INTO payment_method_name
      FROM payments
      WHERE sale_id = NEW.id
      LIMIT 1;

      -- Registrar la venta en cash_register_sales
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
        NEW.total_paid,
        GREATEST(0, NEW.total_paid - NEW.total_amount)
      );

      -- Actualizar última actividad de la caja
      UPDATE cash_registers
      SET last_movement_at = now()
      WHERE id = current_register_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para registrar ventas automáticamente
DROP TRIGGER IF EXISTS trigger_register_sale_in_cash_register ON sales;
CREATE TRIGGER trigger_register_sale_in_cash_register
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION register_sale_in_cash_register();

-- Función para auditar cambios en movimientos de caja
CREATE OR REPLACE FUNCTION audit_cash_movement_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO cash_register_audits (
      cash_register_id,
      movement_id,
      action_type,
      old_values,
      performed_by
    ) VALUES (
      OLD.cash_register_id,
      OLD.id,
      'delete',
      to_jsonb(OLD),
      COALESCE(current_setting('app.current_user_id', true)::uuid, OLD.created_by)
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO cash_register_audits (
      cash_register_id,
      movement_id,
      action_type,
      old_values,
      new_values,
      performed_by
    ) VALUES (
      NEW.cash_register_id,
      NEW.id,
      'update',
      to_jsonb(OLD),
      to_jsonb(NEW),
      COALESCE(current_setting('app.current_user_id', true)::uuid, NEW.created_by)
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO cash_register_audits (
      cash_register_id,
      movement_id,
      action_type,
      new_values,
      performed_by
    ) VALUES (
      NEW.cash_register_id,
      NEW.id,
      'create',
      to_jsonb(NEW),
      COALESCE(current_setting('app.current_user_id', true)::uuid, NEW.created_by)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auditoría de movimientos
DROP TRIGGER IF EXISTS trigger_audit_cash_movements ON cash_movements;
CREATE TRIGGER trigger_audit_cash_movements
  AFTER INSERT OR UPDATE OR DELETE ON cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION audit_cash_movement_changes();

-- Función para calcular descuadres automáticamente
CREATE OR REPLACE FUNCTION calculate_cash_register_discrepancy(register_id uuid)
RETURNS TABLE (
  expected_amount numeric,
  calculated_amount numeric,
  discrepancy_amount numeric,
  discrepancy_type text,
  total_sales numeric,
  total_income numeric,
  total_expenses numeric,
  opening_amount numeric
) AS $$
DECLARE
  reg_record cash_registers%ROWTYPE;
  calc_amount numeric := 0;
  exp_amount numeric := 0;
  disc_amount numeric := 0;
  disc_type text := 'none';
  sales_total numeric := 0;
  income_total numeric := 0;
  expense_total numeric := 0;
BEGIN
  -- Obtener información de la caja
  SELECT * INTO reg_record FROM cash_registers WHERE id = register_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cash register not found';
  END IF;

  -- Calcular totales de movimientos
  SELECT 
    COALESCE(SUM(CASE WHEN type IN ('income', 'sale') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END), 0)
  INTO income_total, expense_total, sales_total
  FROM cash_movements
  WHERE cash_register_id = register_id;

  -- Calcular monto esperado
  exp_amount := reg_record.opening_amount + income_total - expense_total;
  
  -- Monto calculado (actual si está cerrada, esperado si está abierta)
  calc_amount := COALESCE(reg_record.actual_closing_amount, exp_amount);
  
  -- Calcular descuadre
  disc_amount := calc_amount - exp_amount;
  
  -- Determinar tipo de descuadre
  IF disc_amount > 0 THEN
    disc_type := 'overage';
  ELSIF disc_amount < 0 THEN
    disc_type := 'shortage';
  ELSE
    disc_type := 'balanced';
  END IF;

  RETURN QUERY SELECT 
    exp_amount,
    calc_amount,
    disc_amount,
    disc_type,
    sales_total,
    income_total,
    expense_total,
    reg_record.opening_amount;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener reporte detallado de caja
CREATE OR REPLACE FUNCTION get_detailed_cash_register_report(register_id uuid)
RETURNS TABLE (
  register_info jsonb,
  movements_summary jsonb,
  sales_detail jsonb,
  discrepancy_analysis jsonb,
  audit_trail jsonb
) AS $$
DECLARE
  reg_info jsonb;
  movements_info jsonb;
  sales_info jsonb;
  discrepancy_info jsonb;
  audit_info jsonb;
BEGIN
  -- Información básica de la caja
  SELECT to_jsonb(cr.*) INTO reg_info
  FROM cash_registers cr
  WHERE cr.id = register_id;

  -- Resumen de movimientos
  SELECT jsonb_build_object(
    'total_movements', COUNT(*),
    'by_type', jsonb_object_agg(type, type_data)
  ) INTO movements_info
  FROM (
    SELECT 
      type,
      jsonb_build_object(
        'count', COUNT(*),
        'total_amount', SUM(amount),
        'movements', jsonb_agg(jsonb_build_object(
          'id', id,
          'amount', amount,
          'description', description,
          'created_at', created_at
        ) ORDER BY created_at)
      ) as type_data
    FROM cash_movements
    WHERE cash_register_id = register_id
    GROUP BY type
  ) grouped_movements;

  -- Detalle de ventas
  SELECT jsonb_build_object(
    'total_sales', COUNT(crs.*),
    'total_amount', COALESCE(SUM(s.total_amount), 0),
    'by_payment_method', jsonb_object_agg(crs.payment_method, method_data),
    'sales_list', jsonb_agg(jsonb_build_object(
      'sale_id', s.id,
      'total_amount', s.total_amount,
      'payment_method', crs.payment_method,
      'amount_received', crs.amount_received,
      'change_given', crs.change_given,
      'customer_name', c.name,
      'created_at', s.created_at,
      'items', (
        SELECT jsonb_agg(jsonb_build_object(
          'product_name', p.name,
          'quantity', si.quantity,
          'unit_price', si.unit_price,
          'total_price', si.total_price
        ))
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = s.id
      )
    ) ORDER BY s.created_at)
  ) INTO sales_info
  FROM cash_register_sales crs
  JOIN sales s ON crs.sale_id = s.id
  LEFT JOIN customers c ON s.customer_id = c.id
  WHERE crs.cash_register_id = register_id
  GROUP BY ROLLUP(crs.payment_method);

  -- Análisis de descuadres
  SELECT jsonb_build_object(
    'calculation', to_jsonb(calc.*),
    'discrepancies', COALESCE(
      (SELECT jsonb_agg(to_jsonb(d.*))
       FROM cash_register_discrepancies d
       WHERE d.cash_register_id = register_id), '[]'::jsonb)
  ) INTO discrepancy_info
  FROM calculate_cash_register_discrepancy(register_id) calc;

  -- Historial de auditoría
  SELECT jsonb_build_object(
    'total_actions', COUNT(*),
    'actions', jsonb_agg(jsonb_build_object(
      'action_type', action_type,
      'old_values', old_values,
      'new_values', new_values,
      'reason', reason,
      'performed_at', performed_at,
      'performed_by', u.name
    ) ORDER BY performed_at DESC)
  ) INTO audit_info
  FROM cash_register_audits cra
  LEFT JOIN users u ON cra.performed_by = u.id
  WHERE cra.cash_register_id = register_id;

  RETURN QUERY SELECT reg_info, movements_info, sales_info, discrepancy_info, audit_info;
END;
$$ LANGUAGE plpgsql;

-- Vista consolidada para información de caja
CREATE OR REPLACE VIEW cash_register_detailed_view AS
SELECT 
  cr.*,
  u.name as operator_name,
  u.email as operator_email,
  (
    SELECT COUNT(*)
    FROM cash_register_sales crs
    WHERE crs.cash_register_id = cr.id
  ) as total_sales_count,
  (
    SELECT COALESCE(SUM(s.total_amount), 0)
    FROM cash_register_sales crs
    JOIN sales s ON crs.sale_id = s.id
    WHERE crs.cash_register_id = cr.id
  ) as total_sales_amount,
  (
    SELECT COUNT(*)
    FROM cash_movements cm
    WHERE cm.cash_register_id = cr.id
  ) as total_movements_count,
  (
    SELECT COALESCE(SUM(amount), 0)
    FROM cash_movements cm
    WHERE cm.cash_register_id = cr.id AND cm.type IN ('income', 'sale')
  ) as total_income,
  (
    SELECT COALESCE(SUM(amount), 0)
    FROM cash_movements cm
    WHERE cm.cash_register_id = cr.id AND cm.type = 'expense'
  ) as total_expenses,
  CASE 
    WHEN cr.status = 'open' THEN 
      EXTRACT(EPOCH FROM (now() - cr.opened_at)) / 3600
    ELSE 
      EXTRACT(EPOCH FROM (cr.closed_at - cr.opened_at)) / 3600
  END as session_duration_hours
FROM cash_registers cr
LEFT JOIN users u ON cr.user_id = u.id;