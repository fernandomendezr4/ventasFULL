/*
  # Mejora de integración entre Caja, Ventas y Abonos

  1. Nuevas Tablas
    - Mejora de `cash_register_sales` para mejor tracking
    - Nueva tabla `cash_register_installments` para abonos
    - Mejora de triggers para automatización

  2. Funciones
    - Función para registrar ventas en caja automáticamente
    - Función para registrar abonos en caja
    - Función para calcular balance de caja en tiempo real

  3. Triggers
    - Auto-registro de ventas en efectivo
    - Auto-registro de abonos
    - Actualización automática de totales de caja

  4. Vistas
    - Vista consolidada de movimientos de caja
    - Vista de historial completo de caja
*/

-- Mejorar tabla de ventas en caja registradora
ALTER TABLE cash_register_sales 
ADD COLUMN IF NOT EXISTS payment_notes TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS discount_applied NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) DEFAULT 0;

-- Crear tabla para abonos en caja registradora
CREATE TABLE IF NOT EXISTS cash_register_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  installment_id UUID NOT NULL REFERENCES payment_installments(id) ON DELETE CASCADE,
  amount_paid NUMERIC(10,2) NOT NULL CHECK (amount_paid > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  payment_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_cash_register_installments_register_id 
ON cash_register_installments(cash_register_id);

CREATE INDEX IF NOT EXISTS idx_cash_register_installments_sale_id 
ON cash_register_installments(sale_id);

CREATE INDEX IF NOT EXISTS idx_cash_register_installments_created_at 
ON cash_register_installments(created_at DESC);

-- Habilitar RLS
ALTER TABLE cash_register_installments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cash_register_installments
CREATE POLICY "Public can view cash_register_installments"
  ON cash_register_installments
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert cash_register_installments"
  ON cash_register_installments
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update cash_register_installments"
  ON cash_register_installments
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Public can delete cash_register_installments"
  ON cash_register_installments
  FOR DELETE
  TO public
  USING (true);

-- Función para registrar venta en caja automáticamente
CREATE OR REPLACE FUNCTION register_sale_in_cash_register()
RETURNS TRIGGER AS $$
DECLARE
  current_register_id UUID;
  sale_user_id UUID;
BEGIN
  -- Solo procesar ventas en efectivo completamente pagadas
  IF NEW.payment_type = 'cash' AND NEW.payment_status = 'paid' THEN
    -- Obtener el usuario de la venta
    sale_user_id := NEW.user_id;
    
    -- Buscar caja abierta del usuario
    SELECT id INTO current_register_id
    FROM cash_registers
    WHERE user_id = sale_user_id 
      AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;
    
    -- Si hay caja abierta, registrar la venta
    IF current_register_id IS NOT NULL THEN
      -- Insertar en cash_register_sales
      INSERT INTO cash_register_sales (
        cash_register_id,
        sale_id,
        payment_method,
        amount_received,
        change_given,
        payment_notes,
        discount_applied
      ) VALUES (
        current_register_id,
        NEW.id,
        'cash', -- Por defecto, se puede actualizar después
        NEW.total_amount, -- Se puede ajustar si hay cambio
        0, -- Se puede calcular después
        '',
        NEW.discount_amount
      );
      
      -- Crear movimiento de caja para la venta
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
        'Venta #' || SUBSTRING(NEW.id::text, -8) || ' - Efectivo',
        NEW.id,
        NEW.user_id
      );
      
      -- Actualizar total de ventas en la caja
      UPDATE cash_registers
      SET 
        total_sales = COALESCE(total_sales, 0) + NEW.total_amount,
        last_movement_at = now()
      WHERE id = current_register_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para registrar abono en caja
CREATE OR REPLACE FUNCTION register_installment_in_cash_register()
RETURNS TRIGGER AS $$
DECLARE
  current_register_id UUID;
  sale_user_id UUID;
  sale_info RECORD;
BEGIN
  -- Obtener información de la venta
  SELECT s.user_id, s.id, s.total_amount
  INTO sale_info
  FROM sales s
  WHERE s.id = NEW.sale_id;
  
  -- Buscar caja abierta del usuario que hizo la venta original o del usuario actual
  SELECT id INTO current_register_id
  FROM cash_registers
  WHERE status = 'open'
    AND (user_id = sale_info.user_id OR user_id = auth.uid())
  ORDER BY 
    CASE WHEN user_id = sale_info.user_id THEN 1 ELSE 2 END,
    opened_at DESC
  LIMIT 1;
  
  -- Si hay caja abierta, registrar el abono
  IF current_register_id IS NOT NULL THEN
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
      current_register_id,
      NEW.sale_id,
      NEW.id,
      NEW.amount_paid,
      NEW.payment_method,
      NEW.notes,
      auth.uid()
    );
    
    -- Crear movimiento de caja para el abono
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
      'Abono venta #' || SUBSTRING(sale_info.id::text, -8) || ' - ' || 
      CASE NEW.payment_method
        WHEN 'cash' THEN 'Efectivo'
        WHEN 'card' THEN 'Tarjeta'
        WHEN 'transfer' THEN 'Transferencia'
        ELSE 'Otro'
      END,
      NEW.sale_id,
      auth.uid()
    );
    
    -- Actualizar última actividad de la caja
    UPDATE cash_registers
    SET last_movement_at = now()
    WHERE id = current_register_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger para ventas
DROP TRIGGER IF EXISTS trigger_register_sale_in_cash_register ON sales;
CREATE TRIGGER trigger_register_sale_in_cash_register
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION register_sale_in_cash_register();

-- Crear trigger para abonos
DROP TRIGGER IF EXISTS trigger_register_installment_in_cash_register ON payment_installments;
CREATE TRIGGER trigger_register_installment_in_cash_register
  AFTER INSERT ON payment_installments
  FOR EACH ROW
  EXECUTE FUNCTION register_installment_in_cash_register();

-- Vista consolidada de movimientos de caja con detalles
CREATE OR REPLACE VIEW cash_register_movements_detailed AS
SELECT 
  cm.id,
  cm.cash_register_id,
  cm.type,
  cm.category,
  cm.amount,
  cm.description,
  cm.created_at,
  cm.created_by,
  u.name as created_by_name,
  cr.opened_at as register_opened_at,
  cr.status as register_status,
  -- Detalles de venta si aplica
  CASE 
    WHEN cm.type = 'sale' THEN (
      SELECT json_build_object(
        'sale_id', s.id,
        'customer_name', c.name,
        'payment_type', s.payment_type,
        'items_count', (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id)
      )
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = cm.reference_id
    )
    ELSE NULL
  END as sale_details,
  -- Detalles de abono si aplica
  CASE 
    WHEN cm.category = 'abonos_credito' THEN (
      SELECT json_build_object(
        'sale_id', s.id,
        'customer_name', c.name,
        'total_amount', s.total_amount,
        'total_paid', s.total_paid,
        'remaining_balance', s.total_amount - COALESCE(s.total_paid, 0)
      )
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = cm.reference_id
    )
    ELSE NULL
  END as installment_details
FROM cash_movements cm
LEFT JOIN users u ON cm.created_by = u.id
LEFT JOIN cash_registers cr ON cm.cash_register_id = cr.id
ORDER BY cm.created_at DESC;

-- Vista de historial completo de caja con resúmenes
CREATE OR REPLACE VIEW cash_register_history_summary AS
SELECT 
  cr.id,
  cr.user_id,
  u.name as user_name,
  cr.opening_amount,
  cr.closing_amount,
  cr.actual_closing_amount,
  cr.expected_closing_amount,
  cr.discrepancy_amount,
  cr.status,
  cr.opened_at,
  cr.closed_at,
  cr.session_notes,
  -- Resumen de ventas
  COALESCE(sales_summary.total_sales_amount, 0) as total_sales_amount,
  COALESCE(sales_summary.total_sales_count, 0) as total_sales_count,
  COALESCE(sales_summary.cash_sales_amount, 0) as cash_sales_amount,
  COALESCE(sales_summary.cash_sales_count, 0) as cash_sales_count,
  -- Resumen de abonos
  COALESCE(installments_summary.total_installments_amount, 0) as total_installments_amount,
  COALESCE(installments_summary.total_installments_count, 0) as total_installments_count,
  -- Resumen de movimientos
  COALESCE(movements_summary.total_income, 0) as total_income,
  COALESCE(movements_summary.total_expenses, 0) as total_expenses,
  COALESCE(movements_summary.total_movements, 0) as total_movements,
  -- Balance calculado
  cr.opening_amount + 
  COALESCE(sales_summary.cash_sales_amount, 0) + 
  COALESCE(installments_summary.total_installments_amount, 0) + 
  COALESCE(movements_summary.total_income, 0) - 
  COALESCE(movements_summary.total_expenses, 0) as calculated_balance
FROM cash_registers cr
LEFT JOIN users u ON cr.user_id = u.id
LEFT JOIN (
  SELECT 
    crs.cash_register_id,
    SUM(s.total_amount) as total_sales_amount,
    COUNT(*) as total_sales_count,
    SUM(CASE WHEN s.payment_type = 'cash' THEN s.total_amount ELSE 0 END) as cash_sales_amount,
    COUNT(CASE WHEN s.payment_type = 'cash' THEN 1 END) as cash_sales_count
  FROM cash_register_sales crs
  JOIN sales s ON crs.sale_id = s.id
  GROUP BY crs.cash_register_id
) sales_summary ON cr.id = sales_summary.cash_register_id
LEFT JOIN (
  SELECT 
    cri.cash_register_id,
    SUM(cri.amount_paid) as total_installments_amount,
    COUNT(*) as total_installments_count
  FROM cash_register_installments cri
  GROUP BY cri.cash_register_id
) installments_summary ON cr.id = installments_summary.cash_register_id
LEFT JOIN (
  SELECT 
    cm.cash_register_id,
    SUM(CASE WHEN cm.type = 'income' THEN cm.amount ELSE 0 END) as total_income,
    SUM(CASE WHEN cm.type = 'expense' THEN cm.amount ELSE 0 END) as total_expenses,
    COUNT(*) as total_movements
  FROM cash_movements cm
  WHERE cm.type IN ('income', 'expense')
  GROUP BY cm.cash_register_id
) movements_summary ON cr.id = movements_summary.cash_register_id
ORDER BY cr.opened_at DESC;

-- Función para obtener balance actual de caja
CREATE OR REPLACE FUNCTION get_current_cash_register_balance(register_id UUID)
RETURNS TABLE (
  opening_amount NUMERIC,
  total_sales NUMERIC,
  total_installments NUMERIC,
  total_income NUMERIC,
  total_expenses NUMERIC,
  calculated_balance NUMERIC,
  last_movement_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.opening_amount,
    COALESCE(SUM(CASE WHEN cm.type = 'sale' THEN cm.amount ELSE 0 END), 0) as total_sales,
    COALESCE(SUM(CASE WHEN cm.category = 'abonos_credito' THEN cm.amount ELSE 0 END), 0) as total_installments,
    COALESCE(SUM(CASE WHEN cm.type = 'income' AND cm.category != 'abonos_credito' THEN cm.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN cm.type = 'expense' THEN cm.amount ELSE 0 END), 0) as total_expenses,
    cr.opening_amount + 
    COALESCE(SUM(CASE WHEN cm.type IN ('sale', 'income') THEN cm.amount ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN cm.type = 'expense' THEN cm.amount ELSE 0 END), 0) as calculated_balance,
    cr.last_movement_at
  FROM cash_registers cr
  LEFT JOIN cash_movements cm ON cr.id = cm.cash_register_id
  WHERE cr.id = register_id
  GROUP BY cr.id, cr.opening_amount, cr.last_movement_at;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener resumen de ventas de una caja
CREATE OR REPLACE FUNCTION get_cash_register_sales_summary(register_id UUID)
RETURNS TABLE (
  total_sales_count BIGINT,
  total_sales_amount NUMERIC,
  cash_sales_count BIGINT,
  cash_sales_amount NUMERIC,
  installment_sales_count BIGINT,
  installment_sales_amount NUMERIC,
  total_installments_received NUMERIC,
  unique_customers_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT crs.sale_id) as total_sales_count,
    COALESCE(SUM(s.total_amount), 0) as total_sales_amount,
    COUNT(DISTINCT CASE WHEN s.payment_type = 'cash' THEN crs.sale_id END) as cash_sales_count,
    COALESCE(SUM(CASE WHEN s.payment_type = 'cash' THEN s.total_amount ELSE 0 END), 0) as cash_sales_amount,
    COUNT(DISTINCT CASE WHEN s.payment_type = 'installment' THEN crs.sale_id END) as installment_sales_count,
    COALESCE(SUM(CASE WHEN s.payment_type = 'installment' THEN s.total_amount ELSE 0 END), 0) as installment_sales_amount,
    COALESCE((
      SELECT SUM(cri.amount_paid)
      FROM cash_register_installments cri
      WHERE cri.cash_register_id = register_id
    ), 0) as total_installments_received,
    COUNT(DISTINCT s.customer_id) as unique_customers_count
  FROM cash_register_sales crs
  JOIN sales s ON crs.sale_id = s.id
  WHERE crs.cash_register_id = register_id;
END;
$$ LANGUAGE plpgsql;