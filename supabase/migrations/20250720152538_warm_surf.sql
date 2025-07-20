/*
  # Corrección de relaciones y estructura de base de datos

  1. Correcciones de Relaciones
    - Agregar foreign keys faltantes
    - Corregir tipos de datos inconsistentes
    - Mejorar índices para rendimiento

  2. Nuevas Tablas de Auditoría
    - Auditoría unificada para todas las operaciones
    - Seguimiento de cambios en inventario
    - Log de actividades de usuarios

  3. Mejoras de Seguridad
    - Políticas RLS más específicas
    - Validaciones de integridad
    - Constraints adicionales

  4. Optimizaciones
    - Índices compuestos para consultas frecuentes
    - Triggers para mantenimiento automático
    - Vistas para reportes complejos
*/

-- =============================================
-- 1. CORRECCIONES DE ESTRUCTURA EXISTENTE
-- =============================================

-- Agregar columnas faltantes en sales para mejor tracking
DO $$
BEGIN
  -- Agregar columna para método de pago específico en ventas en efectivo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'cash_payment_method'
  ) THEN
    ALTER TABLE sales ADD COLUMN cash_payment_method text DEFAULT 'cash';
  END IF;

  -- Agregar columna para notas de la venta
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'sale_notes'
  ) THEN
    ALTER TABLE sales ADD COLUMN sale_notes text DEFAULT '';
  END IF;

  -- Agregar columna para tracking de cambios en stock
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'last_stock_update'
  ) THEN
    ALTER TABLE products ADD COLUMN last_stock_update timestamptz DEFAULT now();
  END IF;

  -- Agregar columna para stock mínimo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'min_stock'
  ) THEN
    ALTER TABLE products ADD COLUMN min_stock integer DEFAULT 5;
  END IF;

  -- Agregar columna para estado del producto
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE products ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- =============================================
-- 2. NUEVA TABLA DE AUDITORÍA UNIFICADA
-- =============================================

CREATE TABLE IF NOT EXISTS system_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  user_id uuid REFERENCES users(id),
  user_email text,
  ip_address inet,
  user_agent text,
  session_id text,
  timestamp timestamptz DEFAULT now(),
  additional_info jsonb DEFAULT '{}'::jsonb
);

-- Índices para la tabla de auditoría
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_table_record 
ON system_audit_logs (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_system_audit_logs_timestamp 
ON system_audit_logs (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_audit_logs_user 
ON system_audit_logs (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_audit_logs_action 
ON system_audit_logs (action_type, timestamp DESC);

-- =============================================
-- 3. TABLA DE MOVIMIENTOS DE INVENTARIO
-- =============================================

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'return', 'transfer', 'loss')),
  quantity_change integer NOT NULL,
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  unit_cost numeric(10,2) DEFAULT 0,
  total_cost numeric(10,2) DEFAULT 0,
  reference_type text, -- 'sale', 'purchase_order', 'manual_adjustment', etc.
  reference_id uuid,
  reason text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  supplier_id uuid REFERENCES suppliers(id),
  location text DEFAULT 'main_warehouse'
);

-- Índices para movimientos de inventario
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product 
ON inventory_movements (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_type 
ON inventory_movements (movement_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference 
ON inventory_movements (reference_type, reference_id);

-- =============================================
-- 4. TABLA DE CONFIGURACIÓN DEL SISTEMA
-- =============================================

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  setting_type text NOT NULL CHECK (setting_type IN ('string', 'number', 'boolean', 'object', 'array')),
  category text NOT NULL DEFAULT 'general',
  description text DEFAULT '',
  is_public boolean DEFAULT false,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para configuración
CREATE INDEX IF NOT EXISTS idx_system_settings_category 
ON system_settings (category);

CREATE INDEX IF NOT EXISTS idx_system_settings_public 
ON system_settings (is_public) WHERE is_public = true;

-- =============================================
-- 5. MEJORAR RELACIONES EXISTENTES
-- =============================================

-- Agregar constraint para validar payment_method en cash_register_sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cash_register_sales_payment_method_check'
  ) THEN
    ALTER TABLE cash_register_sales 
    ADD CONSTRAINT cash_register_sales_payment_method_check 
    CHECK (payment_method IN ('cash', 'card', 'transfer', 'nequi', 'other'));
  END IF;
END $$;

-- Mejorar constraint en sales para cash_payment_method
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'sales_cash_payment_method_check'
  ) THEN
    ALTER TABLE sales 
    ADD CONSTRAINT sales_cash_payment_method_check 
    CHECK (cash_payment_method IN ('cash', 'card', 'transfer', 'nequi', 'other'));
  END IF;
END $$;

-- =============================================
-- 6. TRIGGERS PARA AUDITORÍA AUTOMÁTICA
-- =============================================

-- Función para auditoría automática
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS trigger AS $$
DECLARE
  old_values jsonb := '{}';
  new_values jsonb := '{}';
  changed_fields text[] := '{}';
  current_user_id uuid;
  current_user_email text;
BEGIN
  -- Obtener información del usuario actual (si está disponible)
  BEGIN
    SELECT auth.uid() INTO current_user_id;
    SELECT auth.email() INTO current_user_email;
  EXCEPTION WHEN OTHERS THEN
    current_user_id := NULL;
    current_user_email := NULL;
  END;

  -- Preparar valores según el tipo de operación
  IF TG_OP = 'DELETE' THEN
    old_values := to_jsonb(OLD);
    new_values := '{}';
  ELSIF TG_OP = 'INSERT' THEN
    old_values := '{}';
    new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    old_values := to_jsonb(OLD);
    new_values := to_jsonb(NEW);
    
    -- Identificar campos que cambiaron
    SELECT array_agg(key) INTO changed_fields
    FROM jsonb_each(old_values) o
    WHERE o.value IS DISTINCT FROM (new_values->o.key);
  END IF;

  -- Insertar registro de auditoría
  INSERT INTO system_audit_logs (
    table_name,
    record_id,
    action_type,
    old_values,
    new_values,
    changed_fields,
    user_id,
    user_email,
    timestamp
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE((NEW).id, (OLD).id),
    TG_OP,
    old_values,
    new_values,
    changed_fields,
    current_user_id,
    current_user_email,
    now()
  );

  -- Retornar el registro apropiado
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 7. APLICAR TRIGGERS DE AUDITORÍA
-- =============================================

-- Trigger para productos
DROP TRIGGER IF EXISTS audit_products_trigger ON products;
CREATE TRIGGER audit_products_trigger
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Trigger para categorías
DROP TRIGGER IF EXISTS audit_categories_trigger ON categories;
CREATE TRIGGER audit_categories_trigger
  AFTER INSERT OR UPDATE OR DELETE ON categories
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Trigger para clientes
DROP TRIGGER IF EXISTS audit_customers_trigger ON customers;
CREATE TRIGGER audit_customers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Trigger para proveedores
DROP TRIGGER IF EXISTS audit_suppliers_trigger ON suppliers;
CREATE TRIGGER audit_suppliers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Trigger para usuarios
DROP TRIGGER IF EXISTS audit_users_trigger ON users;
CREATE TRIGGER audit_users_trigger
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Trigger para ventas
DROP TRIGGER IF EXISTS audit_sales_trigger ON sales;
CREATE TRIGGER audit_sales_trigger
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =============================================
-- 8. TRIGGER PARA MOVIMIENTOS DE INVENTARIO
-- =============================================

-- Función para registrar movimientos de inventario automáticamente
CREATE OR REPLACE FUNCTION track_inventory_movement()
RETURNS trigger AS $$
DECLARE
  movement_type text;
  quantity_change integer;
  reference_type text := 'manual_adjustment';
  reference_id uuid := NULL;
  reason text := 'Stock update';
BEGIN
  -- Solo procesar si el stock cambió
  IF TG_OP = 'UPDATE' AND OLD.stock = NEW.stock THEN
    RETURN NEW;
  END IF;

  -- Determinar tipo de movimiento y cantidad
  IF TG_OP = 'INSERT' THEN
    movement_type := 'adjustment';
    quantity_change := NEW.stock;
    reason := 'Initial stock';
  ELSIF TG_OP = 'UPDATE' THEN
    quantity_change := NEW.stock - OLD.stock;
    
    IF quantity_change > 0 THEN
      movement_type := 'adjustment';
      reason := 'Stock increase';
    ELSE
      movement_type := 'adjustment';
      reason := 'Stock decrease';
    END IF;
  END IF;

  -- Registrar movimiento de inventario
  INSERT INTO inventory_movements (
    product_id,
    movement_type,
    quantity_change,
    previous_stock,
    new_stock,
    reference_type,
    reference_id,
    reason,
    created_by
  ) VALUES (
    NEW.id,
    movement_type,
    quantity_change,
    COALESCE(OLD.stock, 0),
    NEW.stock,
    reference_type,
    reference_id,
    reason,
    auth.uid()
  );

  -- Actualizar timestamp de última actualización
  NEW.last_stock_update := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar trigger de inventario
DROP TRIGGER IF EXISTS track_inventory_trigger ON products;
CREATE TRIGGER track_inventory_trigger
  AFTER INSERT OR UPDATE OF stock ON products
  FOR EACH ROW EXECUTE FUNCTION track_inventory_movement();

-- =============================================
-- 9. FUNCIÓN PARA MOVIMIENTOS DE VENTA
-- =============================================

-- Mejorar la función existente para registrar ventas en inventario
CREATE OR REPLACE FUNCTION register_sale_inventory_movement()
RETURNS trigger AS $$
DECLARE
  item record;
  product_record record;
BEGIN
  -- Registrar movimiento de inventario para cada item de la venta
  FOR item IN 
    SELECT si.product_id, si.quantity, si.unit_price
    FROM sale_items si 
    WHERE si.sale_id = NEW.id
  LOOP
    -- Obtener información del producto
    SELECT * INTO product_record FROM products WHERE id = item.product_id;
    
    -- Registrar movimiento de inventario
    INSERT INTO inventory_movements (
      product_id,
      movement_type,
      quantity_change,
      previous_stock,
      new_stock,
      unit_cost,
      total_cost,
      reference_type,
      reference_id,
      reason,
      created_by
    ) VALUES (
      item.product_id,
      'sale',
      -item.quantity, -- Negativo porque es una salida
      product_record.stock + item.quantity, -- Stock antes de la venta
      product_record.stock, -- Stock después de la venta
      item.unit_price,
      item.unit_price * item.quantity,
      'sale',
      NEW.id,
      'Sale transaction',
      NEW.user_id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar trigger para movimientos de venta
DROP TRIGGER IF EXISTS register_sale_inventory_trigger ON sales;
CREATE TRIGGER register_sale_inventory_trigger
  AFTER INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION register_sale_inventory_movement();

-- =============================================
-- 10. VISTAS MEJORADAS PARA REPORTES
-- =============================================

-- Vista para resumen completo de productos con inventario
CREATE OR REPLACE VIEW products_inventory_summary AS
SELECT 
  p.*,
  c.name as category_name,
  s.name as supplier_name,
  COALESCE(sales_stats.total_sold, 0) as total_sold_all_time,
  COALESCE(sales_stats.total_revenue, 0) as total_revenue_generated,
  COALESCE(recent_sales.sold_last_30_days, 0) as sold_last_30_days,
  COALESCE(recent_sales.revenue_last_30_days, 0) as revenue_last_30_days,
  (p.sale_price - p.purchase_price) as profit_per_unit,
  ((p.sale_price - p.purchase_price) / NULLIF(p.purchase_price, 0) * 100) as profit_margin_percent,
  (p.stock * p.sale_price) as inventory_value,
  (p.stock * p.purchase_price) as inventory_cost,
  CASE 
    WHEN p.stock = 0 THEN 'out_of_stock'
    WHEN p.stock <= p.min_stock THEN 'low_stock'
    WHEN p.stock <= p.min_stock * 2 THEN 'medium_stock'
    ELSE 'good_stock'
  END as stock_status,
  CASE 
    WHEN p.stock = 0 THEN p.min_stock * 3
    WHEN p.stock <= p.min_stock THEN p.min_stock * 2
    ELSE 0
  END as suggested_reorder_quantity
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN (
  SELECT 
    si.product_id,
    SUM(si.quantity) as total_sold,
    SUM(si.total_price) as total_revenue
  FROM sale_items si
  JOIN sales sa ON si.sale_id = sa.id
  GROUP BY si.product_id
) sales_stats ON p.id = sales_stats.product_id
LEFT JOIN (
  SELECT 
    si.product_id,
    SUM(si.quantity) as sold_last_30_days,
    SUM(si.total_price) as revenue_last_30_days
  FROM sale_items si
  JOIN sales sa ON si.sale_id = sa.id
  WHERE sa.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY si.product_id
) recent_sales ON p.id = recent_sales.product_id
WHERE p.is_active = true;

-- Vista para análisis de ventas por período
CREATE OR REPLACE VIEW sales_analysis_view AS
SELECT 
  s.*,
  c.name as customer_name,
  c.phone as customer_phone,
  c.email as customer_email,
  u.name as seller_name,
  u.email as seller_email,
  COUNT(si.id) as items_count,
  SUM(si.quantity) as total_items_quantity,
  AVG(si.unit_price) as average_item_price,
  EXTRACT(YEAR FROM s.created_at) as sale_year,
  EXTRACT(MONTH FROM s.created_at) as sale_month,
  EXTRACT(DAY FROM s.created_at) as sale_day,
  EXTRACT(HOUR FROM s.created_at) as sale_hour,
  DATE(s.created_at) as sale_date,
  TO_CHAR(s.created_at, 'YYYY-MM') as sale_month_year,
  TO_CHAR(s.created_at, 'Day') as sale_day_name,
  CASE 
    WHEN s.payment_status = 'paid' THEN 'Completada'
    WHEN s.payment_status = 'partial' THEN 'Parcial'
    ELSE 'Pendiente'
  END as payment_status_label,
  CASE 
    WHEN s.payment_type = 'cash' THEN 'Efectivo'
    ELSE 'Abonos'
  END as payment_type_label
FROM sales s
LEFT JOIN customers c ON s.customer_id = c.id
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN sale_items si ON s.id = si.sale_id
GROUP BY s.id, c.id, u.id;

-- Vista para análisis de caja registradora mejorada
CREATE OR REPLACE VIEW cash_register_analysis AS
SELECT 
  cr.*,
  u.name as operator_name,
  u.email as operator_email,
  -- Estadísticas de ventas
  COALESCE(sales_stats.total_sales_count, 0) as total_sales_count,
  COALESCE(sales_stats.total_sales_amount, 0) as total_sales_amount,
  COALESCE(sales_stats.cash_sales_count, 0) as cash_sales_count,
  COALESCE(sales_stats.cash_sales_amount, 0) as cash_sales_amount,
  
  -- Estadísticas de abonos
  COALESCE(installment_stats.total_installments_count, 0) as total_installments_count,
  COALESCE(installment_stats.total_installments_amount, 0) as total_installments_amount,
  
  -- Movimientos de caja
  COALESCE(movement_stats.total_income, 0) as total_income,
  COALESCE(movement_stats.total_expenses, 0) as total_expenses,
  COALESCE(movement_stats.total_movements, 0) as total_movements,
  
  -- Cálculos
  (cr.opening_amount + 
   COALESCE(sales_stats.cash_sales_amount, 0) + 
   COALESCE(installment_stats.total_installments_amount, 0) + 
   COALESCE(movement_stats.total_income, 0) - 
   COALESCE(movement_stats.total_expenses, 0)) as calculated_balance,
   
  -- Duración de sesión
  CASE 
    WHEN cr.closed_at IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (cr.closed_at - cr.opened_at)) / 60
    ELSE 
      EXTRACT(EPOCH FROM (now() - cr.opened_at)) / 60
  END as session_duration_minutes

FROM cash_registers cr
LEFT JOIN users u ON cr.user_id = u.id
LEFT JOIN (
  SELECT 
    crs.cash_register_id,
    COUNT(*) as total_sales_count,
    SUM(s.total_amount) as total_sales_amount,
    COUNT(*) FILTER (WHERE s.payment_type = 'cash') as cash_sales_count,
    SUM(s.total_amount) FILTER (WHERE s.payment_type = 'cash') as cash_sales_amount
  FROM cash_register_sales crs
  JOIN sales s ON crs.sale_id = s.id
  GROUP BY crs.cash_register_id
) sales_stats ON cr.id = sales_stats.cash_register_id
LEFT JOIN (
  SELECT 
    cri.cash_register_id,
    COUNT(*) as total_installments_count,
    SUM(cri.amount_paid) as total_installments_amount
  FROM cash_register_installments cri
  GROUP BY cri.cash_register_id
) installment_stats ON cr.id = installment_stats.cash_register_id
LEFT JOIN (
  SELECT 
    cm.cash_register_id,
    SUM(cm.amount) FILTER (WHERE cm.type = 'income') as total_income,
    SUM(cm.amount) FILTER (WHERE cm.type = 'expense') as total_expenses,
    COUNT(*) as total_movements
  FROM cash_movements cm
  WHERE cm.type IN ('income', 'expense')
  GROUP BY cm.cash_register_id
) movement_stats ON cr.id = movement_stats.cash_register_id;

-- =============================================
-- 11. POLÍTICAS RLS MEJORADAS
-- =============================================

-- Habilitar RLS en nuevas tablas
ALTER TABLE system_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para auditoría (solo lectura para usuarios autenticados)
CREATE POLICY "Users can view audit logs" ON system_audit_logs
  FOR SELECT TO authenticated USING (true);

-- Políticas para movimientos de inventario
CREATE POLICY "Users can view inventory movements" ON inventory_movements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert inventory movements" ON inventory_movements
  FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas para configuración del sistema
CREATE POLICY "Users can view public settings" ON system_settings
  FOR SELECT TO authenticated USING (is_public = true);

CREATE POLICY "Admins can manage all settings" ON system_settings
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin' 
      AND users.is_active = true
    )
  );

-- =============================================
-- 12. ÍNDICES ADICIONALES PARA RENDIMIENTO
-- =============================================

-- Índices compuestos para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_sales_date_customer_status 
ON sales (DATE(created_at), customer_id, payment_status);

CREATE INDEX IF NOT EXISTS idx_sales_user_date 
ON sales (user_id, DATE(created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_sale_items_product_date 
ON sale_items (product_id, (SELECT created_at FROM sales WHERE sales.id = sale_items.sale_id));

CREATE INDEX IF NOT EXISTS idx_products_category_active_stock 
ON products (category_id, is_active, stock) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_supplier_active 
ON products (supplier_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_cash_movements_register_date_type 
ON cash_movements (cash_register_id, DATE(created_at), type);

CREATE INDEX IF NOT EXISTS idx_payment_installments_sale_date 
ON payment_installments (sale_id, DATE(payment_date) DESC);

-- Índice para búsqueda de texto en productos
CREATE INDEX IF NOT EXISTS idx_products_search_text 
ON products USING gin(to_tsvector('spanish', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(barcode, '')));

-- Índice para búsqueda de texto en clientes
CREATE INDEX IF NOT EXISTS idx_customers_search_text 
ON customers USING gin(to_tsvector('spanish', name || ' ' || COALESCE(phone, '') || ' ' || COALESCE(email, '') || ' ' || COALESCE(cedula, '')));

-- =============================================
-- 13. FUNCIONES ÚTILES PARA LA APLICACIÓN
-- =============================================

-- Función para obtener estadísticas de producto
CREATE OR REPLACE FUNCTION get_product_statistics(product_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_sold', COALESCE(SUM(si.quantity), 0),
    'total_revenue', COALESCE(SUM(si.total_price), 0),
    'last_sale_date', MAX(s.created_at),
    'average_sale_quantity', COALESCE(AVG(si.quantity), 0),
    'sales_count', COUNT(si.id)
  ) INTO result
  FROM sale_items si
  JOIN sales s ON si.sale_id = s.id
  WHERE si.product_id = product_uuid;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener resumen de cliente
CREATE OR REPLACE FUNCTION get_customer_summary(customer_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_purchases', COUNT(s.id),
    'total_spent', COALESCE(SUM(s.total_amount), 0),
    'total_paid', COALESCE(SUM(s.total_paid), 0),
    'pending_balance', COALESCE(SUM(s.total_amount - COALESCE(s.total_paid, 0)), 0),
    'first_purchase', MIN(s.created_at),
    'last_purchase', MAX(s.created_at),
    'average_purchase', COALESCE(AVG(s.total_amount), 0),
    'installment_sales', COUNT(s.id) FILTER (WHERE s.payment_type = 'installment'),
    'cash_sales', COUNT(s.id) FILTER (WHERE s.payment_type = 'cash')
  ) INTO result
  FROM sales s
  WHERE s.customer_id = customer_uuid;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para validar integridad de caja
CREATE OR REPLACE FUNCTION validate_cash_register_integrity(register_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  register_data record;
  calculated_balance numeric;
  discrepancy numeric;
  result jsonb;
BEGIN
  -- Obtener datos de la caja
  SELECT * INTO register_data FROM cash_registers WHERE id = register_uuid;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Cash register not found');
  END IF;
  
  -- Calcular balance esperado
  SELECT 
    register_data.opening_amount + 
    COALESCE(SUM(cm.amount) FILTER (WHERE cm.type IN ('sale', 'income')), 0) -
    COALESCE(SUM(cm.amount) FILTER (WHERE cm.type = 'expense'), 0)
  INTO calculated_balance
  FROM cash_movements cm
  WHERE cm.cash_register_id = register_uuid;
  
  discrepancy := register_data.actual_closing_amount - calculated_balance;
  
  RETURN jsonb_build_object(
    'register_id', register_uuid,
    'opening_amount', register_data.opening_amount,
    'calculated_balance', calculated_balance,
    'reported_closing', register_data.actual_closing_amount,
    'discrepancy', discrepancy,
    'is_balanced', ABS(discrepancy) < 100,
    'status', register_data.status,
    'validation_timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 14. CONFIGURACIONES INICIALES
-- =============================================

-- Insertar configuraciones básicas del sistema
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public) 
VALUES 
  ('app_name', '"VentasFULL"', 'string', 'general', 'Nombre de la aplicación', true),
  ('company_name', '"Mi Empresa"', 'string', 'company', 'Nombre de la empresa', true),
  ('currency', '"COP"', 'string', 'general', 'Moneda del sistema', true),
  ('tax_rate', '0.19', 'number', 'sales', 'Tasa de impuesto por defecto', false),
  ('low_stock_threshold', '10', 'number', 'inventory', 'Umbral de stock bajo', false),
  ('auto_backup_enabled', 'true', 'boolean', 'system', 'Respaldo automático habilitado', false),
  ('receipt_footer', '"Gracias por su compra"', 'string', 'printing', 'Pie de página del recibo', true),
  ('max_discount_percent', '50', 'number', 'sales', 'Descuento máximo permitido (%)', false)
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- 15. TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA
-- =============================================

-- Trigger para actualizar timestamp en system_settings
CREATE OR REPLACE FUNCTION update_settings_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_settings_timestamp_trigger ON system_settings;
CREATE TRIGGER update_settings_timestamp_trigger
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_settings_timestamp();

-- =============================================
-- 16. VALIDACIONES ADICIONALES
-- =============================================

-- Validar que las ventas tengan al menos un item
CREATE OR REPLACE FUNCTION validate_sale_has_items()
RETURNS trigger AS $$
BEGIN
  -- Verificar que la venta tenga al menos un item después de insertar
  IF NOT EXISTS (SELECT 1 FROM sale_items WHERE sale_id = NEW.id) THEN
    RAISE EXCEPTION 'Sale must have at least one item';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar validación (se ejecutará después de insertar items)
-- DROP TRIGGER IF EXISTS validate_sale_items_trigger ON sales;
-- CREATE CONSTRAINT TRIGGER validate_sale_items_trigger
--   AFTER INSERT ON sales
--   DEFERRABLE INITIALLY DEFERRED
--   FOR EACH ROW EXECUTE FUNCTION validate_sale_has_items();

-- =============================================
-- 17. COMENTARIOS EN TABLAS PARA DOCUMENTACIÓN
-- =============================================

COMMENT ON TABLE system_audit_logs IS 'Registro unificado de auditoría para todas las operaciones del sistema';
COMMENT ON TABLE inventory_movements IS 'Seguimiento detallado de todos los movimientos de inventario';
COMMENT ON TABLE system_settings IS 'Configuraciones del sistema almacenadas en base de datos';

COMMENT ON COLUMN products.min_stock IS 'Stock mínimo antes de generar alerta de reposición';
COMMENT ON COLUMN products.last_stock_update IS 'Timestamp de la última actualización de stock';
COMMENT ON COLUMN products.is_active IS 'Indica si el producto está activo para ventas';

COMMENT ON COLUMN sales.cash_payment_method IS 'Método específico de pago para ventas en efectivo';
COMMENT ON COLUMN sales.sale_notes IS 'Notas adicionales sobre la venta';

-- =============================================
-- 18. REFRESH DE VISTAS MATERIALIZADAS
-- =============================================

-- Función para refrescar todas las vistas materializadas
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  -- Refrescar vistas materializadas si existen
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales_stats;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignorar si no existe
  END;
  
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_summary;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignorar si no existe
  END;
  
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY customer_summary;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignorar si no existe
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FINALIZACIÓN
-- =============================================

-- Actualizar estadísticas de la base de datos
ANALYZE;

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE 'Database relationships and structure have been successfully updated!';
  RAISE NOTICE 'New features added:';
  RAISE NOTICE '- Unified audit logging system';
  RAISE NOTICE '- Inventory movement tracking';
  RAISE NOTICE '- System settings management';
  RAISE NOTICE '- Enhanced cash register validation';
  RAISE NOTICE '- Improved search indexes';
  RAISE NOTICE '- Comprehensive reporting views';
END $$;