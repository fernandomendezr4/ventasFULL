/*
  # Sistema de Auditoría para Caja Registradora

  1. Nuevas Tablas
    - `cash_register_audit_logs` - Log detallado de todas las acciones
    - `cash_register_session_summary` - Resumen de cada sesión de caja
    - `cash_register_daily_reports` - Reportes diarios consolidados

  2. Vistas Optimizadas
    - `cash_register_audit_view` - Vista completa de auditoría
    - `cash_register_session_details` - Detalles de sesión con métricas

  3. Funciones de Auditoría
    - `generate_cash_register_audit_report()` - Genera reporte completo
    - `get_cash_register_session_summary()` - Resumen de sesión específica

  4. Triggers de Auditoría
    - Registra automáticamente todas las acciones en caja
*/

-- Tabla de logs de auditoría detallados
CREATE TABLE IF NOT EXISTS cash_register_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('open', 'close', 'sale', 'installment', 'income', 'expense', 'adjustment')),
  entity_type text NOT NULL CHECK (entity_type IN ('cash_register', 'sale', 'installment', 'movement')),
  entity_id uuid,
  amount numeric(10,2) DEFAULT 0,
  previous_balance numeric(10,2),
  new_balance numeric(10,2),
  description text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}',
  performed_by uuid REFERENCES users(id),
  performed_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text
);

-- Índices para optimizar consultas de auditoría
CREATE INDEX IF NOT EXISTS idx_audit_logs_register_id ON cash_register_audit_logs(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON cash_register_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_at ON cash_register_audit_logs(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON cash_register_audit_logs(entity_type, entity_id);

-- Tabla de resumen de sesiones de caja
CREATE TABLE IF NOT EXISTS cash_register_session_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  opening_amount numeric(10,2) DEFAULT 0,
  closing_amount numeric(10,2) DEFAULT 0,
  expected_closing_amount numeric(10,2) DEFAULT 0,
  total_sales_cash numeric(10,2) DEFAULT 0,
  total_sales_count integer DEFAULT 0,
  total_installments numeric(10,2) DEFAULT 0,
  total_installments_count integer DEFAULT 0,
  total_income numeric(10,2) DEFAULT 0,
  total_expenses numeric(10,2) DEFAULT 0,
  total_movements integer DEFAULT 0,
  discrepancy_amount numeric(10,2) DEFAULT 0,
  session_duration_minutes integer DEFAULT 0,
  opened_by uuid REFERENCES users(id),
  closed_by uuid REFERENCES users(id),
  opened_at timestamptz,
  closed_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para resúmenes de sesión
CREATE INDEX IF NOT EXISTS idx_session_summary_register_date ON cash_register_session_summary(cash_register_id, session_date);
CREATE INDEX IF NOT EXISTS idx_session_summary_date ON cash_register_session_summary(session_date DESC);

-- Tabla de reportes diarios consolidados
CREATE TABLE IF NOT EXISTS cash_register_daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  total_registers_opened integer DEFAULT 0,
  total_sales_amount numeric(10,2) DEFAULT 0,
  total_sales_count integer DEFAULT 0,
  total_installments_amount numeric(10,2) DEFAULT 0,
  total_installments_count integer DEFAULT 0,
  total_cash_collected numeric(10,2) DEFAULT 0,
  total_discrepancies numeric(10,2) DEFAULT 0,
  registers_with_discrepancies integer DEFAULT 0,
  average_session_duration_minutes integer DEFAULT 0,
  top_selling_products jsonb DEFAULT '[]',
  top_customers jsonb DEFAULT '[]',
  summary_data jsonb DEFAULT '{}',
  generated_at timestamptz DEFAULT now(),
  generated_by uuid REFERENCES users(id)
);

-- Índice único para reportes diarios
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_date ON cash_register_daily_reports(report_date);

-- Vista completa de auditoría con detalles
CREATE OR REPLACE VIEW cash_register_audit_view AS
SELECT 
  al.id,
  al.cash_register_id,
  cr.opened_at as register_opened_at,
  cr.closed_at as register_closed_at,
  cr.status as register_status,
  u_opened.name as opened_by_name,
  u_closed.name as closed_by_name,
  al.action_type,
  al.entity_type,
  al.entity_id,
  al.amount,
  al.previous_balance,
  al.new_balance,
  al.description,
  al.metadata,
  al.performed_by,
  performer.name as performed_by_name,
  al.performed_at,
  al.ip_address,
  al.user_agent,
  -- Información adicional según el tipo de entidad
  CASE 
    WHEN al.entity_type = 'sale' THEN (
      SELECT jsonb_build_object(
        'customer_name', c.name,
        'payment_type', s.payment_type,
        'payment_status', s.payment_status,
        'items_count', (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id)
      )
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = al.entity_id::uuid
    )
    WHEN al.entity_type = 'installment' THEN (
      SELECT jsonb_build_object(
        'sale_id', pi.sale_id,
        'payment_method', pi.payment_method,
        'customer_name', c.name
      )
      FROM payment_installments pi
      JOIN sales s ON pi.sale_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE pi.id = al.entity_id::uuid
    )
    ELSE '{}'::jsonb
  END as entity_details
FROM cash_register_audit_logs al
JOIN cash_registers cr ON al.cash_register_id = cr.id
LEFT JOIN users u_opened ON cr.user_id = u_opened.id
LEFT JOIN users u_closed ON cr.user_id = u_closed.id
LEFT JOIN users performer ON al.performed_by = performer.id
ORDER BY al.performed_at DESC;

-- Vista de detalles de sesión con métricas calculadas
CREATE OR REPLACE VIEW cash_register_session_details AS
SELECT 
  cr.id as cash_register_id,
  cr.opened_at,
  cr.closed_at,
  cr.status,
  cr.opening_amount,
  cr.closing_amount,
  cr.expected_closing_amount,
  cr.actual_closing_amount,
  cr.discrepancy_amount,
  cr.session_notes,
  u.name as operator_name,
  u.email as operator_email,
  
  -- Métricas de ventas
  COALESCE(sales_stats.total_sales, 0) as total_sales_count,
  COALESCE(sales_stats.total_sales_amount, 0) as total_sales_amount,
  COALESCE(sales_stats.cash_sales, 0) as cash_sales_count,
  COALESCE(sales_stats.cash_sales_amount, 0) as cash_sales_amount,
  
  -- Métricas de abonos
  COALESCE(installment_stats.total_installments, 0) as total_installments_count,
  COALESCE(installment_stats.total_installments_amount, 0) as total_installments_amount,
  
  -- Métricas de movimientos
  COALESCE(movement_stats.total_income, 0) as total_income,
  COALESCE(movement_stats.total_expenses, 0) as total_expenses,
  COALESCE(movement_stats.total_movements, 0) as total_movements_count,
  
  -- Duración de sesión
  CASE 
    WHEN cr.closed_at IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (cr.closed_at - cr.opened_at)) / 60
    ELSE 
      EXTRACT(EPOCH FROM (NOW() - cr.opened_at)) / 60
  END as session_duration_minutes,
  
  -- Balance calculado
  cr.opening_amount + 
  COALESCE(sales_stats.cash_sales_amount, 0) + 
  COALESCE(installment_stats.total_installments_amount, 0) + 
  COALESCE(movement_stats.total_income, 0) - 
  COALESCE(movement_stats.total_expenses, 0) as calculated_balance

FROM cash_registers cr
LEFT JOIN users u ON cr.user_id = u.id

-- Estadísticas de ventas
LEFT JOIN (
  SELECT 
    crs.cash_register_id,
    COUNT(*) as total_sales,
    SUM(s.total_amount) as total_sales_amount,
    COUNT(*) FILTER (WHERE s.payment_type = 'cash') as cash_sales,
    SUM(s.total_amount) FILTER (WHERE s.payment_type = 'cash') as cash_sales_amount
  FROM cash_register_sales crs
  JOIN sales s ON crs.sale_id = s.id
  GROUP BY crs.cash_register_id
) sales_stats ON cr.id = sales_stats.cash_register_id

-- Estadísticas de abonos
LEFT JOIN (
  SELECT 
    cri.cash_register_id,
    COUNT(*) as total_installments,
    SUM(cri.amount_paid) as total_installments_amount
  FROM cash_register_installments cri
  GROUP BY cri.cash_register_id
) installment_stats ON cr.id = installment_stats.cash_register_id

-- Estadísticas de movimientos
LEFT JOIN (
  SELECT 
    cm.cash_register_id,
    SUM(cm.amount) FILTER (WHERE cm.type = 'income') as total_income,
    SUM(cm.amount) FILTER (WHERE cm.type = 'expense') as total_expenses,
    COUNT(*) FILTER (WHERE cm.type IN ('income', 'expense')) as total_movements
  FROM cash_movements cm
  WHERE cm.type IN ('income', 'expense')
  GROUP BY cm.cash_register_id
) movement_stats ON cr.id = movement_stats.cash_register_id;

-- Función para generar reporte completo de auditoría
CREATE OR REPLACE FUNCTION generate_cash_register_audit_report(
  p_cash_register_id uuid,
  p_include_details boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_session_info jsonb;
  v_sales_detail jsonb;
  v_installments_detail jsonb;
  v_movements_detail jsonb;
  v_audit_trail jsonb;
BEGIN
  -- Información básica de la sesión
  SELECT jsonb_build_object(
    'cash_register_id', cash_register_id,
    'opened_at', opened_at,
    'closed_at', closed_at,
    'status', status,
    'operator_name', operator_name,
    'opening_amount', opening_amount,
    'closing_amount', closing_amount,
    'expected_closing_amount', expected_closing_amount,
    'actual_closing_amount', actual_closing_amount,
    'discrepancy_amount', discrepancy_amount,
    'session_duration_minutes', session_duration_minutes,
    'calculated_balance', calculated_balance,
    'total_sales_count', total_sales_count,
    'total_sales_amount', total_sales_amount,
    'cash_sales_count', cash_sales_count,
    'cash_sales_amount', cash_sales_amount,
    'total_installments_count', total_installments_count,
    'total_installments_amount', total_installments_amount,
    'total_income', total_income,
    'total_expenses', total_expenses,
    'total_movements_count', total_movements_count
  ) INTO v_session_info
  FROM cash_register_session_details
  WHERE cash_register_id = p_cash_register_id;

  IF p_include_details THEN
    -- Detalle de ventas
    SELECT jsonb_agg(
      jsonb_build_object(
        'sale_id', s.id,
        'sale_number', RIGHT(s.id::text, 8),
        'total_amount', s.total_amount,
        'payment_type', s.payment_type,
        'payment_status', s.payment_status,
        'customer_name', c.name,
        'items_count', (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id),
        'created_at', s.created_at
      )
    ) INTO v_sales_detail
    FROM cash_register_sales crs
    JOIN sales s ON crs.sale_id = s.id
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE crs.cash_register_id = p_cash_register_id;

    -- Detalle de abonos
    SELECT jsonb_agg(
      jsonb_build_object(
        'installment_id', pi.id,
        'sale_id', pi.sale_id,
        'sale_number', RIGHT(pi.sale_id::text, 8),
        'amount_paid', cri.amount_paid,
        'payment_method', cri.payment_method,
        'customer_name', c.name,
        'payment_date', cri.created_at
      )
    ) INTO v_installments_detail
    FROM cash_register_installments cri
    JOIN payment_installments pi ON cri.installment_id = pi.id
    JOIN sales s ON pi.sale_id = s.id
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE cri.cash_register_id = p_cash_register_id;

    -- Detalle de movimientos
    SELECT jsonb_agg(
      jsonb_build_object(
        'movement_id', cm.id,
        'type', cm.type,
        'category', cm.category,
        'amount', cm.amount,
        'description', cm.description,
        'created_at', cm.created_at,
        'created_by_name', u.name
      )
    ) INTO v_movements_detail
    FROM cash_movements cm
    LEFT JOIN users u ON cm.created_by = u.id
    WHERE cm.cash_register_id = p_cash_register_id
    AND cm.type IN ('income', 'expense');

    -- Trail de auditoría
    SELECT jsonb_agg(
      jsonb_build_object(
        'action_type', action_type,
        'entity_type', entity_type,
        'amount', amount,
        'description', description,
        'performed_by_name', performed_by_name,
        'performed_at', performed_at,
        'entity_details', entity_details
      )
    ) INTO v_audit_trail
    FROM cash_register_audit_view
    WHERE cash_register_id = p_cash_register_id;
  END IF;

  -- Construir resultado final
  v_result := jsonb_build_object(
    'session_info', v_session_info,
    'generated_at', NOW(),
    'include_details', p_include_details
  );

  IF p_include_details THEN
    v_result := v_result || jsonb_build_object(
      'sales_detail', COALESCE(v_sales_detail, '[]'::jsonb),
      'installments_detail', COALESCE(v_installments_detail, '[]'::jsonb),
      'movements_detail', COALESCE(v_movements_detail, '[]'::jsonb),
      'audit_trail', COALESCE(v_audit_trail, '[]'::jsonb)
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Función para obtener resumen de sesión específica
CREATE OR REPLACE FUNCTION get_cash_register_session_summary(p_cash_register_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'cash_register_id', cash_register_id,
    'opened_at', opened_at,
    'closed_at', closed_at,
    'status', status,
    'operator_name', operator_name,
    'session_duration_minutes', session_duration_minutes,
    'opening_amount', opening_amount,
    'closing_amount', closing_amount,
    'calculated_balance', calculated_balance,
    'discrepancy_amount', discrepancy_amount,
    'summary', jsonb_build_object(
      'total_transactions', total_sales_count + total_installments_count + total_movements_count,
      'total_cash_in', cash_sales_amount + total_installments_amount + total_income,
      'total_cash_out', total_expenses,
      'net_cash_flow', (cash_sales_amount + total_installments_amount + total_income) - total_expenses
    )
  ) INTO v_result
  FROM cash_register_session_details
  WHERE cash_register_id = p_cash_register_id;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- Trigger para registrar acciones de auditoría automáticamente
CREATE OR REPLACE FUNCTION log_cash_register_action()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_action_type text;
  v_description text;
  v_amount numeric(10,2) := 0;
  v_previous_balance numeric(10,2);
  v_new_balance numeric(10,2);
  v_metadata jsonb := '{}';
BEGIN
  -- Determinar tipo de acción
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'cash_registers' THEN
      v_action_type := 'open';
      v_description := 'Caja registradora abierta';
      v_amount := NEW.opening_amount;
    ELSIF TG_TABLE_NAME = 'cash_register_sales' THEN
      v_action_type := 'sale';
      v_description := 'Venta registrada en caja';
      SELECT total_amount INTO v_amount FROM sales WHERE id = NEW.sale_id;
    ELSIF TG_TABLE_NAME = 'cash_register_installments' THEN
      v_action_type := 'installment';
      v_description := 'Abono registrado en caja';
      v_amount := NEW.amount_paid;
    ELSIF TG_TABLE_NAME = 'cash_movements' THEN
      v_action_type := NEW.type;
      v_description := COALESCE(NEW.description, 'Movimiento de caja');
      v_amount := NEW.amount;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'cash_registers' AND OLD.status = 'open' AND NEW.status = 'closed' THEN
      v_action_type := 'close';
      v_description := 'Caja registradora cerrada';
      v_amount := NEW.closing_amount;
    END IF;
  END IF;

  -- Solo registrar si hay una acción válida
  IF v_action_type IS NOT NULL THEN
    -- Calcular balances (simplificado para el ejemplo)
    v_previous_balance := COALESCE(
      (SELECT calculated_balance FROM cash_register_session_details 
       WHERE cash_register_id = COALESCE(NEW.cash_register_id, NEW.id)), 
      0
    );
    
    v_new_balance := v_previous_balance + 
      CASE 
        WHEN v_action_type IN ('sale', 'installment', 'income', 'open') THEN v_amount
        WHEN v_action_type IN ('expense') THEN -v_amount
        ELSE 0
      END;

    -- Insertar log de auditoría
    INSERT INTO cash_register_audit_logs (
      cash_register_id,
      action_type,
      entity_type,
      entity_id,
      amount,
      previous_balance,
      new_balance,
      description,
      metadata,
      performed_by
    ) VALUES (
      COALESCE(NEW.cash_register_id, NEW.id),
      v_action_type,
      CASE 
        WHEN TG_TABLE_NAME = 'cash_registers' THEN 'cash_register'
        WHEN TG_TABLE_NAME = 'cash_register_sales' THEN 'sale'
        WHEN TG_TABLE_NAME = 'cash_register_installments' THEN 'installment'
        WHEN TG_TABLE_NAME = 'cash_movements' THEN 'movement'
      END,
      CASE 
        WHEN TG_TABLE_NAME = 'cash_registers' THEN NEW.id
        WHEN TG_TABLE_NAME = 'cash_register_sales' THEN NEW.sale_id
        WHEN TG_TABLE_NAME = 'cash_register_installments' THEN NEW.installment_id
        WHEN TG_TABLE_NAME = 'cash_movements' THEN NEW.id
      END,
      v_amount,
      v_previous_balance,
      v_new_balance,
      v_description,
      v_metadata,
      COALESCE(NEW.created_by, NEW.user_id)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Crear triggers para auditoría automática
DROP TRIGGER IF EXISTS trigger_audit_cash_register ON cash_registers;
CREATE TRIGGER trigger_audit_cash_register
  AFTER INSERT OR UPDATE ON cash_registers
  FOR EACH ROW EXECUTE FUNCTION log_cash_register_action();

DROP TRIGGER IF EXISTS trigger_audit_cash_register_sales ON cash_register_sales;
CREATE TRIGGER trigger_audit_cash_register_sales
  AFTER INSERT ON cash_register_sales
  FOR EACH ROW EXECUTE FUNCTION log_cash_register_action();

DROP TRIGGER IF EXISTS trigger_audit_cash_register_installments ON cash_register_installments;
CREATE TRIGGER trigger_audit_cash_register_installments
  AFTER INSERT ON cash_register_installments
  FOR EACH ROW EXECUTE FUNCTION log_cash_register_action();

DROP TRIGGER IF EXISTS trigger_audit_cash_movements ON cash_movements;
CREATE TRIGGER trigger_audit_cash_movements
  AFTER INSERT ON cash_movements
  FOR EACH ROW EXECUTE FUNCTION log_cash_register_action();

-- Habilitar RLS en las nuevas tablas
ALTER TABLE cash_register_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_session_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_daily_reports ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para auditoría
CREATE POLICY "Public can view audit logs" ON cash_register_audit_logs FOR SELECT TO public USING (true);
CREATE POLICY "Public can view session summaries" ON cash_register_session_summary FOR SELECT TO public USING (true);
CREATE POLICY "Public can view daily reports" ON cash_register_daily_reports FOR SELECT TO public USING (true);

-- Función para generar reporte diario automático
CREATE OR REPLACE FUNCTION generate_daily_cash_register_report(p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_report_data jsonb;
BEGIN
  -- Generar datos del reporte diario
  WITH daily_stats AS (
    SELECT 
      COUNT(DISTINCT cr.id) as total_registers_opened,
      COALESCE(SUM(csd.total_sales_amount), 0) as total_sales_amount,
      COALESCE(SUM(csd.total_sales_count), 0) as total_sales_count,
      COALESCE(SUM(csd.total_installments_amount), 0) as total_installments_amount,
      COALESCE(SUM(csd.total_installments_count), 0) as total_installments_count,
      COALESCE(SUM(csd.cash_sales_amount + csd.total_installments_amount), 0) as total_cash_collected,
      COALESCE(SUM(ABS(csd.discrepancy_amount)), 0) as total_discrepancies,
      COUNT(*) FILTER (WHERE csd.discrepancy_amount != 0) as registers_with_discrepancies,
      COALESCE(AVG(csd.session_duration_minutes), 0) as average_session_duration_minutes
    FROM cash_registers cr
    JOIN cash_register_session_details csd ON cr.id = csd.cash_register_id
    WHERE DATE(cr.opened_at) = p_date
  )
  SELECT jsonb_build_object(
    'report_date', p_date,
    'total_registers_opened', total_registers_opened,
    'total_sales_amount', total_sales_amount,
    'total_sales_count', total_sales_count,
    'total_installments_amount', total_installments_amount,
    'total_installments_count', total_installments_count,
    'total_cash_collected', total_cash_collected,
    'total_discrepancies', total_discrepancies,
    'registers_with_discrepancies', registers_with_discrepancies,
    'average_session_duration_minutes', average_session_duration_minutes
  ) INTO v_report_data
  FROM daily_stats;

  -- Insertar o actualizar reporte diario
  INSERT INTO cash_register_daily_reports (
    report_date,
    total_registers_opened,
    total_sales_amount,
    total_sales_count,
    total_installments_amount,
    total_installments_count,
    total_cash_collected,
    total_discrepancies,
    registers_with_discrepancies,
    average_session_duration_minutes,
    summary_data
  )
  SELECT 
    p_date,
    (v_report_data->>'total_registers_opened')::integer,
    (v_report_data->>'total_sales_amount')::numeric,
    (v_report_data->>'total_sales_count')::integer,
    (v_report_data->>'total_installments_amount')::numeric,
    (v_report_data->>'total_installments_count')::integer,
    (v_report_data->>'total_cash_collected')::numeric,
    (v_report_data->>'total_discrepancies')::numeric,
    (v_report_data->>'registers_with_discrepancies')::integer,
    (v_report_data->>'average_session_duration_minutes')::integer,
    v_report_data
  ON CONFLICT (report_date) 
  DO UPDATE SET
    total_registers_opened = EXCLUDED.total_registers_opened,
    total_sales_amount = EXCLUDED.total_sales_amount,
    total_sales_count = EXCLUDED.total_sales_count,
    total_installments_amount = EXCLUDED.total_installments_amount,
    total_installments_count = EXCLUDED.total_installments_count,
    total_cash_collected = EXCLUDED.total_cash_collected,
    total_discrepancies = EXCLUDED.total_discrepancies,
    registers_with_discrepancies = EXCLUDED.registers_with_discrepancies,
    average_session_duration_minutes = EXCLUDED.average_session_duration_minutes,
    summary_data = EXCLUDED.summary_data,
    generated_at = NOW();

  RETURN v_report_data;
END;
$$;