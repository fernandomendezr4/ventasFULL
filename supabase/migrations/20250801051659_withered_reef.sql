/*
  # Vistas Optimizadas para Mejor Rendimiento

  1. Vistas Materializadas
    - Dashboard statistics
    - Inventory summary
    - Customer analytics

  2. Vistas Simples
    - Product details
    - Sales summary
    - Cash register status

  3. Índices para Vistas
    - Optimización de consultas frecuentes
*/

-- =====================================================
-- 1. VISTA MATERIALIZADA PARA ESTADÍSTICAS DIARIAS
-- =====================================================

-- Eliminar vista existente si existe
DROP MATERIALIZED VIEW IF EXISTS daily_sales_stats;

-- Crear vista materializada optimizada
CREATE MATERIALIZED VIEW daily_sales_stats AS
SELECT 
  DATE(s.created_at) as sale_date,
  COUNT(*) as total_sales,
  SUM(s.total_amount) as total_revenue,
  COUNT(*) FILTER (WHERE s.payment_type = 'cash') as cash_sales,
  COUNT(*) FILTER (WHERE s.payment_type = 'installment') as installment_sales,
  SUM(s.total_amount) FILTER (WHERE s.payment_type = 'cash') as cash_revenue,
  SUM(s.total_amount) FILTER (WHERE s.payment_type = 'installment') as installment_revenue,
  COUNT(DISTINCT s.customer_id) FILTER (WHERE s.customer_id IS NOT NULL) as unique_customers,
  COUNT(DISTINCT s.user_id) FILTER (WHERE s.user_id IS NOT NULL) as active_sellers,
  AVG(s.total_amount) as average_sale_amount,
  MAX(s.total_amount) as highest_sale,
  MIN(s.total_amount) as lowest_sale
FROM sales s
WHERE s.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(s.created_at)
ORDER BY sale_date DESC;

-- Índice para la vista materializada
CREATE UNIQUE INDEX idx_daily_sales_stats_date ON daily_sales_stats (sale_date);

-- =====================================================
-- 2. VISTA MATERIALIZADA PARA INVENTARIO
-- =====================================================

DROP MATERIALIZED VIEW IF EXISTS inventory_summary;

CREATE MATERIALIZED VIEW inventory_summary AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.stock as current_stock,
  p.sale_price,
  p.purchase_price,
  COALESCE(c.name, 'Sin categoría') as category_name,
  COALESCE(s.name, 'Sin proveedor') as supplier_name,
  
  -- Métricas de ventas
  COALESCE(sales_30d.total_sold, 0) as total_sold_last_30_days,
  COALESCE(sales_30d.revenue, 0) as revenue_last_30_days,
  
  -- Estado del stock
  CASE 
    WHEN p.stock = 0 THEN 'out_of_stock'
    WHEN p.stock <= 5 THEN 'low_stock'
    WHEN p.stock <= 10 THEN 'medium_stock'
    ELSE 'good_stock'
  END as stock_status,
  
  -- Métricas de rentabilidad
  (p.sale_price - p.purchase_price) as profit_per_unit,
  CASE 
    WHEN p.purchase_price > 0 
    THEN ((p.sale_price - p.purchase_price) / p.purchase_price * 100)
    ELSE 0 
  END as profit_margin_percent,
  
  -- Valor del inventario
  (p.stock * p.purchase_price) as inventory_value_cost,
  (p.stock * p.sale_price) as inventory_value_retail,
  
  p.created_at,
  p.has_imei_serial,
  p.imei_serial_type
  
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN (
  SELECT 
    si.product_id,
    SUM(si.quantity) as total_sold,
    SUM(si.total_price) as revenue
  FROM sale_items si
  JOIN sales sa ON si.sale_id = sa.id
  WHERE sa.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY si.product_id
) sales_30d ON p.id = sales_30d.product_id
ORDER BY p.name;

-- Índices para inventory_summary
CREATE UNIQUE INDEX idx_inventory_summary_product_id ON inventory_summary (product_id);
CREATE INDEX idx_inventory_summary_stock_status ON inventory_summary (stock_status);
CREATE INDEX idx_inventory_summary_category ON inventory_summary (category_name);

-- =====================================================
-- 3. VISTA MATERIALIZADA PARA ANÁLISIS DE CLIENTES
-- =====================================================

DROP MATERIALIZED VIEW IF EXISTS customer_summary;

CREATE MATERIALIZED VIEW customer_summary AS
SELECT 
  c.id as customer_id,
  c.name as customer_name,
  c.email,
  c.phone,
  c.cedula,
  c.created_at as customer_since,
  
  -- Métricas de compras
  COALESCE(customer_stats.total_purchases, 0) as total_purchases,
  COALESCE(customer_stats.total_spent, 0) as total_spent,
  COALESCE(customer_stats.average_purchase, 0) as average_purchase_amount,
  customer_stats.last_purchase_date,
  customer_stats.first_purchase_date,
  
  -- Análisis de comportamiento
  CASE 
    WHEN customer_stats.last_purchase_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'active'
    WHEN customer_stats.last_purchase_date >= CURRENT_DATE - INTERVAL '90 days' THEN 'inactive'
    WHEN customer_stats.last_purchase_date IS NOT NULL THEN 'dormant'
    ELSE 'new'
  END as customer_status,
  
  -- Métricas de abonos
  COALESCE(installment_stats.pending_balance, 0) as pending_installment_balance,
  COALESCE(installment_stats.total_installment_sales, 0) as total_installment_sales,
  
  -- Días desde última compra
  CASE 
    WHEN customer_stats.last_purchase_date IS NOT NULL 
    THEN EXTRACT(days FROM CURRENT_DATE - customer_stats.last_purchase_date)::integer
    ELSE NULL 
  END as days_since_last_purchase

FROM customers c
LEFT JOIN (
  SELECT 
    s.customer_id,
    COUNT(*) as total_purchases,
    SUM(s.total_amount) as total_spent,
    AVG(s.total_amount) as average_purchase,
    MAX(s.created_at) as last_purchase_date,
    MIN(s.created_at) as first_purchase_date
  FROM sales s
  WHERE s.customer_id IS NOT NULL
  GROUP BY s.customer_id
) customer_stats ON c.id = customer_stats.customer_id
LEFT JOIN (
  SELECT 
    s.customer_id,
    SUM(s.total_amount - COALESCE(s.total_paid, 0)) as pending_balance,
    COUNT(*) as total_installment_sales
  FROM sales s
  WHERE s.payment_type = 'installment' AND s.customer_id IS NOT NULL
  GROUP BY s.customer_id
) installment_stats ON c.id = installment_stats.customer_id
ORDER BY customer_stats.total_spent DESC NULLS LAST;

-- Índices para customer_summary
CREATE UNIQUE INDEX idx_customer_summary_id ON customer_summary (customer_id);
CREATE INDEX idx_customer_summary_status ON customer_summary (customer_status);
CREATE INDEX idx_customer_summary_spent ON customer_summary (total_spent DESC);

-- =====================================================
-- 4. VISTA SIMPLE PARA PRODUCTOS CON DETALLES
-- =====================================================

CREATE OR REPLACE VIEW products_detailed AS
SELECT 
  p.*,
  c.name as category_name,
  s.name as supplier_name,
  s.contact_person as supplier_contact,
  
  -- Conteo de IMEI/Serial si aplica
  CASE 
    WHEN p.has_imei_serial THEN
      (SELECT COUNT(*) FROM product_imei_serials pis WHERE pis.product_id = p.id AND pis.status = 'available')
    ELSE NULL
  END as available_imei_serial_count,
  
  -- Última venta
  (SELECT MAX(sa.created_at) 
   FROM sales sa 
   JOIN sale_items si ON sa.id = si.sale_id 
   WHERE si.product_id = p.id) as last_sale_date,
   
  -- Total vendido
  (SELECT COALESCE(SUM(si.quantity), 0) 
   FROM sale_items si 
   JOIN sales sa ON si.sale_id = sa.id 
   WHERE si.product_id = p.id) as total_sold_all_time

FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id;

-- =====================================================
-- 5. VISTA PARA RESUMEN DE CAJAS REGISTRADORAS
-- =====================================================

CREATE OR REPLACE VIEW cash_register_summary AS
SELECT 
  cr.*,
  u.name as operator_name,
  u.email as operator_email,
  
  -- Estadísticas de movimientos
  COALESCE(movements.total_movements, 0) as total_movements,
  COALESCE(movements.total_income, 0) as total_income,
  COALESCE(movements.total_expenses, 0) as total_expenses,
  COALESCE(movements.total_sales_amount, 0) as calculated_sales,
  
  -- Balance calculado
  cr.opening_amount + 
  COALESCE(movements.total_income, 0) + 
  COALESCE(movements.total_sales_amount, 0) - 
  COALESCE(movements.total_expenses, 0) as calculated_balance,
  
  -- Duración de sesión
  CASE 
    WHEN cr.status = 'closed' AND cr.closed_at IS NOT NULL 
    THEN EXTRACT(epoch FROM (cr.closed_at - cr.opened_at)) / 3600
    WHEN cr.status = 'open' 
    THEN EXTRACT(epoch FROM (NOW() - cr.opened_at)) / 3600
    ELSE 0
  END as session_duration_hours

FROM cash_registers cr
LEFT JOIN users u ON cr.user_id = u.id
LEFT JOIN (
  SELECT 
    cm.cash_register_id,
    COUNT(*) as total_movements,
    SUM(CASE WHEN cm.type = 'income' THEN cm.amount ELSE 0 END) as total_income,
    SUM(CASE WHEN cm.type = 'expense' THEN cm.amount ELSE 0 END) as total_expenses,
    SUM(CASE WHEN cm.type = 'sale' THEN cm.amount ELSE 0 END) as total_sales_amount
  FROM cash_movements cm
  GROUP BY cm.cash_register_id
) movements ON cr.id = movements.cash_register_id;

-- =====================================================
-- 6. FUNCIÓN PARA REFRESCAR VISTAS MATERIALIZADAS
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_time timestamp;
  end_time timestamp;
  duration interval;
BEGIN
  start_time := clock_timestamp();
  
  -- Refrescar vistas materializadas de forma concurrente cuando sea posible
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY customer_summary;
  
  end_time := clock_timestamp();
  duration := end_time - start_time;
  
  RETURN 'Vistas materializadas actualizadas en ' || duration::text;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Si falla la actualización concurrente, usar actualización normal
    REFRESH MATERIALIZED VIEW daily_sales_stats;
    REFRESH MATERIALIZED VIEW inventory_summary;
    REFRESH MATERIALIZED VIEW customer_summary;
    
    RETURN 'Vistas materializadas actualizadas (modo normal) debido a: ' || SQLERRM;
END;
$$;

-- =====================================================
-- 7. TRIGGER PARA ACTUALIZACIÓN AUTOMÁTICA
-- =====================================================

-- Función para actualizar vistas cuando hay cambios relevantes
CREATE OR REPLACE FUNCTION auto_refresh_views()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo actualizar si es una venta del día actual para evitar sobrecarga
  IF TG_TABLE_NAME = 'sales' AND DATE(COALESCE(NEW.created_at, OLD.created_at)) = CURRENT_DATE THEN
    -- Programar actualización asíncrona (simulada con NOTIFY)
    PERFORM pg_notify('refresh_views', 'sales_updated');
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar trigger solo a ventas para evitar sobrecarga
DROP TRIGGER IF EXISTS trigger_auto_refresh_views ON sales;
CREATE TRIGGER trigger_auto_refresh_views
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION auto_refresh_views();

-- =====================================================
-- 8. PERMISOS PARA VISTAS
-- =====================================================

-- Otorgar permisos de lectura a las vistas
GRANT SELECT ON daily_sales_stats TO authenticated, anon;
GRANT SELECT ON inventory_summary TO authenticated, anon;
GRANT SELECT ON customer_summary TO authenticated, anon;
GRANT SELECT ON products_detailed TO authenticated, anon;
GRANT SELECT ON cash_register_summary TO authenticated, anon;

-- Permisos para funciones de vista
GRANT EXECUTE ON FUNCTION refresh_materialized_views() TO authenticated;

-- =====================================================
-- 9. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON MATERIALIZED VIEW daily_sales_stats IS 'Estadísticas diarias de ventas pre-calculadas para dashboard rápido';
COMMENT ON MATERIALIZED VIEW inventory_summary IS 'Resumen completo de inventario con métricas de ventas y rentabilidad';
COMMENT ON MATERIALIZED VIEW customer_summary IS 'Análisis completo de clientes con comportamiento de compra';
COMMENT ON VIEW products_detailed IS 'Vista detallada de productos con información relacionada';
COMMENT ON VIEW cash_register_summary IS 'Resumen de cajas registradoras con estadísticas calculadas';

-- =====================================================
-- 10. ACTUALIZACIÓN INICIAL
-- =====================================================

-- Refrescar vistas materializadas inicialmente
SELECT refresh_materialized_views();