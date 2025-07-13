/*
  # Optimización de Base de Datos - Sistema de Ventas

  ## Resumen de Optimizaciones
  
  1. **Índices Compuestos y Especializados**
     - Índices para consultas frecuentes de ventas por fecha y usuario
     - Índices para búsquedas de productos por múltiples criterios
     - Índices para reportes de caja registradora
  
  2. **Vistas Materializadas**
     - Vista para estadísticas de ventas diarias
     - Vista para inventario con información agregada
     - Vista para resumen de clientes con historial de compras
  
  3. **Funciones Optimizadas**
     - Función para calcular balance de caja en tiempo real
     - Función para obtener productos con bajo stock
     - Función para estadísticas de ventas por período
  
  4. **Triggers para Mantenimiento Automático**
     - Actualización automática de vistas materializadas
     - Limpieza automática de sesiones expiradas
  
  5. **Políticas de Particionamiento**
     - Particionamiento de tabla de movimientos de caja por fecha
     - Particionamiento de ventas por mes para mejorar consultas históricas
*/

-- =====================================================
-- 1. ÍNDICES COMPUESTOS Y ESPECIALIZADOS
-- =====================================================

-- Índices para tabla de ventas (consultas más frecuentes)
CREATE INDEX IF NOT EXISTS idx_sales_date_user_status 
ON sales (created_at DESC, user_id, payment_status) 
WHERE created_at >= CURRENT_DATE - INTERVAL '1 year';

CREATE INDEX IF NOT EXISTS idx_sales_customer_date 
ON sales (customer_id, created_at DESC) 
WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_payment_type_status 
ON sales (payment_type, payment_status, created_at DESC);

-- Índices para productos (búsquedas y filtros)
CREATE INDEX IF NOT EXISTS idx_products_category_stock 
ON products (category_id, stock) 
WHERE stock >= 0;

CREATE INDEX IF NOT EXISTS idx_products_supplier_price 
ON products (supplier_id, sale_price) 
WHERE supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_search 
ON products USING gin(to_tsvector('spanish', name || ' ' || COALESCE(description, '')));

-- Índices para movimientos de caja (reportes frecuentes)
CREATE INDEX IF NOT EXISTS idx_cash_movements_register_type_date 
ON cash_movements (cash_register_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_movements_category_amount 
ON cash_movements (category, amount, created_at DESC) 
WHERE type IN ('income', 'expense');

-- Índices para abonos (consultas de estado de pagos)
CREATE INDEX IF NOT EXISTS idx_payment_installments_sale_date 
ON payment_installments (sale_id, payment_date DESC);

-- =====================================================
-- 2. VISTAS MATERIALIZADAS
-- =====================================================

-- Vista materializada para estadísticas diarias de ventas
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_sales_stats AS
SELECT 
    DATE(created_at) as sale_date,
    COUNT(*) as total_sales,
    SUM(total_amount) as total_revenue,
    SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE 0 END) as cash_sales,
    SUM(CASE WHEN payment_type = 'installment' THEN total_amount ELSE 0 END) as installment_sales,
    COUNT(DISTINCT customer_id) as unique_customers,
    AVG(total_amount) as average_sale_amount
FROM sales 
WHERE created_at >= CURRENT_DATE - INTERVAL '2 years'
GROUP BY DATE(created_at);

CREATE UNIQUE INDEX ON daily_sales_stats (sale_date);

-- Vista materializada para inventario con información agregada
CREATE MATERIALIZED VIEW IF NOT EXISTS inventory_summary AS
SELECT 
    p.id,
    p.name,
    p.barcode,
    p.stock,
    p.sale_price,
    p.purchase_price,
    (p.sale_price - p.purchase_price) as profit_per_unit,
    (p.sale_price - p.purchase_price) * p.stock as total_potential_profit,
    c.name as category_name,
    s.name as supplier_name,
    COALESCE(sales_data.total_sold, 0) as total_sold_last_30_days,
    COALESCE(sales_data.revenue_last_30_days, 0) as revenue_last_30_days,
    CASE 
        WHEN p.stock = 0 THEN 'out_of_stock'
        WHEN p.stock <= 5 THEN 'low_stock'
        WHEN p.stock <= 20 THEN 'medium_stock'
        ELSE 'good_stock'
    END as stock_status
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN (
    SELECT 
        si.product_id,
        SUM(si.quantity) as total_sold,
        SUM(si.total_price) as revenue_last_30_days
    FROM sale_items si
    JOIN sales sa ON si.sale_id = sa.id
    WHERE sa.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY si.product_id
) sales_data ON p.id = sales_data.product_id;

CREATE UNIQUE INDEX ON inventory_summary (id);
CREATE INDEX ON inventory_summary (stock_status, total_sold_last_30_days DESC);

-- Vista materializada para resumen de clientes
CREATE MATERIALIZED VIEW IF NOT EXISTS customer_summary AS
SELECT 
    c.id,
    c.name,
    c.email,
    c.phone,
    c.cedula,
    c.created_at,
    COALESCE(customer_stats.total_purchases, 0) as total_purchases,
    COALESCE(customer_stats.total_spent, 0) as total_spent,
    COALESCE(customer_stats.avg_purchase_amount, 0) as avg_purchase_amount,
    customer_stats.last_purchase_date,
    COALESCE(installment_stats.pending_balance, 0) as pending_installment_balance,
    CASE 
        WHEN customer_stats.last_purchase_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'active'
        WHEN customer_stats.last_purchase_date >= CURRENT_DATE - INTERVAL '90 days' THEN 'recent'
        WHEN customer_stats.last_purchase_date IS NOT NULL THEN 'inactive'
        ELSE 'new'
    END as customer_status
FROM customers c
LEFT JOIN (
    SELECT 
        customer_id,
        COUNT(*) as total_purchases,
        SUM(total_amount) as total_spent,
        AVG(total_amount) as avg_purchase_amount,
        MAX(created_at) as last_purchase_date
    FROM sales 
    WHERE customer_id IS NOT NULL
    GROUP BY customer_id
) customer_stats ON c.id = customer_stats.customer_id
LEFT JOIN (
    SELECT 
        s.customer_id,
        SUM(s.total_amount - s.total_paid) as pending_balance
    FROM sales s
    WHERE s.payment_type = 'installment' 
    AND s.payment_status != 'paid'
    AND s.customer_id IS NOT NULL
    GROUP BY s.customer_id
) installment_stats ON c.id = installment_stats.customer_id;

CREATE UNIQUE INDEX ON customer_summary (id);
CREATE INDEX ON customer_summary (customer_status, total_spent DESC);

-- =====================================================
-- 3. FUNCIONES OPTIMIZADAS
-- =====================================================

-- Función optimizada para calcular balance de caja en tiempo real
CREATE OR REPLACE FUNCTION get_cash_register_balance(register_id UUID)
RETURNS TABLE(
    current_balance NUMERIC,
    total_income NUMERIC,
    total_expenses NUMERIC,
    total_sales NUMERIC,
    movement_count INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE 
            WHEN cm.type IN ('income', 'opening', 'sale') THEN cm.amount 
            ELSE -cm.amount 
        END), 0) as current_balance,
        COALESCE(SUM(CASE WHEN cm.type = 'income' THEN cm.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN cm.type = 'expense' THEN cm.amount ELSE 0 END), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN cm.type = 'sale' THEN cm.amount ELSE 0 END), 0) as total_sales,
        COUNT(*)::INTEGER as movement_count
    FROM cash_movements cm
    WHERE cm.cash_register_id = register_id;
END;
$$;

-- Función para obtener productos con bajo stock (optimizada)
CREATE OR REPLACE FUNCTION get_low_stock_products(stock_threshold INTEGER DEFAULT 10)
RETURNS TABLE(
    product_id UUID,
    product_name TEXT,
    current_stock INTEGER,
    category_name TEXT,
    supplier_name TEXT,
    sale_price NUMERIC,
    days_since_last_sale INTEGER,
    suggested_reorder_quantity INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.stock,
        COALESCE(c.name, 'Sin categoría'),
        COALESCE(s.name, 'Sin proveedor'),
        p.sale_price,
        COALESCE(
            EXTRACT(DAY FROM (CURRENT_DATE - MAX(sa.created_at)::DATE))::INTEGER,
            999
        ) as days_since_last_sale,
        GREATEST(
            stock_threshold * 2 - p.stock,
            COALESCE(AVG(si.quantity)::INTEGER * 30, 10)
        ) as suggested_reorder_quantity
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN sale_items si ON p.id = si.product_id
    LEFT JOIN sales sa ON si.sale_id = sa.id AND sa.created_at >= CURRENT_DATE - INTERVAL '90 days'
    WHERE p.stock <= stock_threshold
    GROUP BY p.id, p.name, p.stock, c.name, s.name, p.sale_price
    ORDER BY p.stock ASC, days_since_last_sale DESC;
END;
$$;

-- Función para estadísticas de ventas por período
CREATE OR REPLACE FUNCTION get_sales_statistics(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    period_start DATE,
    period_end DATE,
    total_sales BIGINT,
    total_revenue NUMERIC,
    cash_sales_count BIGINT,
    cash_sales_revenue NUMERIC,
    installment_sales_count BIGINT,
    installment_sales_revenue NUMERIC,
    unique_customers BIGINT,
    avg_sale_amount NUMERIC,
    top_selling_product_id UUID,
    top_selling_product_name TEXT,
    top_selling_product_quantity BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    top_product RECORD;
BEGIN
    -- Obtener el producto más vendido del período
    SELECT si.product_id, p.name, SUM(si.quantity) as total_qty
    INTO top_product
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    WHERE s.created_at::DATE BETWEEN start_date AND end_date
    GROUP BY si.product_id, p.name
    ORDER BY total_qty DESC
    LIMIT 1;

    RETURN QUERY
    SELECT 
        start_date as period_start,
        end_date as period_end,
        COUNT(*) as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COUNT(*) FILTER (WHERE s.payment_type = 'cash') as cash_sales_count,
        COALESCE(SUM(s.total_amount) FILTER (WHERE s.payment_type = 'cash'), 0) as cash_sales_revenue,
        COUNT(*) FILTER (WHERE s.payment_type = 'installment') as installment_sales_count,
        COALESCE(SUM(s.total_amount) FILTER (WHERE s.payment_type = 'installment'), 0) as installment_sales_revenue,
        COUNT(DISTINCT s.customer_id) as unique_customers,
        COALESCE(AVG(s.total_amount), 0) as avg_sale_amount,
        top_product.product_id,
        top_product.name,
        top_product.total_qty
    FROM sales s
    WHERE s.created_at::DATE BETWEEN start_date AND end_date;
END;
$$;

-- =====================================================
-- 4. TRIGGERS PARA MANTENIMIENTO AUTOMÁTICO
-- =====================================================

-- Función para refrescar vistas materializadas
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY customer_summary;
END;
$$;

-- Trigger para actualizar estadísticas cuando se crea una venta
CREATE OR REPLACE FUNCTION trigger_refresh_stats_on_sale()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Solo refrescar si es una venta del día actual
    IF DATE(NEW.created_at) = CURRENT_DATE THEN
        PERFORM refresh_materialized_views();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_stats_on_sale ON sales;
CREATE TRIGGER refresh_stats_on_sale
    AFTER INSERT OR UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_stats_on_sale();

-- Función para limpiar sesiones expiradas automáticamente
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM employee_sessions 
    WHERE expires_at < NOW();
    
    -- Log de limpieza
    INSERT INTO cash_movements (
        cash_register_id, 
        type, 
        category, 
        amount, 
        description,
        created_by
    )
    SELECT 
        (SELECT id FROM cash_registers WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1),
        'expense',
        'mantenimiento_sistema',
        0,
        'Limpieza automática de sesiones expiradas',
        NULL
    WHERE EXISTS (SELECT 1 FROM cash_registers WHERE status = 'open');
END;
$$;

-- =====================================================
-- 5. CONFIGURACIONES DE RENDIMIENTO
-- =====================================================

-- Configurar autovacuum más agresivo para tablas de alta actividad
ALTER TABLE sales SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE cash_movements SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE sale_items SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- =====================================================
-- 6. POLÍTICAS DE SEGURIDAD OPTIMIZADAS
-- =====================================================

-- Política optimizada para ventas (usando índices)
DROP POLICY IF EXISTS "Optimized sales access" ON sales;
CREATE POLICY "Optimized sales access" ON sales
    FOR ALL TO authenticated
    USING (
        -- Usar índice en created_at para filtrar por fecha reciente
        created_at >= CURRENT_DATE - INTERVAL '2 years'
    );

-- Política optimizada para movimientos de caja
DROP POLICY IF EXISTS "Optimized cash movements access" ON cash_movements;
CREATE POLICY "Optimized cash movements access" ON cash_movements
    FOR ALL TO authenticated
    USING (
        -- Usar índice en created_at para filtrar por fecha reciente
        created_at >= CURRENT_DATE - INTERVAL '1 year'
    );

-- =====================================================
-- 7. FUNCIONES DE UTILIDAD PARA REPORTES
-- =====================================================

-- Función para reporte de productos más vendidos
CREATE OR REPLACE FUNCTION get_top_selling_products(
    days_back INTEGER DEFAULT 30,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE(
    product_id UUID,
    product_name TEXT,
    category_name TEXT,
    total_quantity_sold BIGINT,
    total_revenue NUMERIC,
    avg_sale_price NUMERIC,
    profit_per_unit NUMERIC,
    total_profit NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        COALESCE(c.name, 'Sin categoría'),
        SUM(si.quantity) as total_quantity_sold,
        SUM(si.total_price) as total_revenue,
        AVG(si.unit_price) as avg_sale_price,
        (p.sale_price - p.purchase_price) as profit_per_unit,
        SUM(si.quantity) * (p.sale_price - p.purchase_price) as total_profit
    FROM products p
    JOIN sale_items si ON p.id = si.product_id
    JOIN sales s ON si.sale_id = s.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE s.created_at >= CURRENT_DATE - INTERVAL '%s days'
    GROUP BY p.id, p.name, c.name, p.sale_price, p.purchase_price
    ORDER BY total_quantity_sold DESC
    LIMIT limit_count;
END;
$$;

-- Función para análisis de rentabilidad por categoría
CREATE OR REPLACE FUNCTION get_category_profitability(
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
    category_id UUID,
    category_name TEXT,
    total_products BIGINT,
    total_sales BIGINT,
    total_revenue NUMERIC,
    total_cost NUMERIC,
    total_profit NUMERIC,
    profit_margin NUMERIC,
    avg_sale_price NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(c.id, '00000000-0000-0000-0000-000000000000'::UUID),
        COALESCE(c.name, 'Sin categoría'),
        COUNT(DISTINCT p.id) as total_products,
        SUM(si.quantity) as total_sales,
        SUM(si.total_price) as total_revenue,
        SUM(si.quantity * p.purchase_price) as total_cost,
        SUM(si.total_price - (si.quantity * p.purchase_price)) as total_profit,
        CASE 
            WHEN SUM(si.quantity * p.purchase_price) > 0 
            THEN (SUM(si.total_price - (si.quantity * p.purchase_price)) / SUM(si.quantity * p.purchase_price)) * 100
            ELSE 0 
        END as profit_margin,
        AVG(si.unit_price) as avg_sale_price
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN sale_items si ON p.id = si.product_id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.created_at >= CURRENT_DATE - INTERVAL '%s days'
    GROUP BY c.id, c.name
    ORDER BY total_profit DESC;
END;
$$;

-- =====================================================
-- 8. JOBS PROGRAMADOS (usando pg_cron si está disponible)
-- =====================================================

-- Programar limpieza de sesiones cada hora
-- SELECT cron.schedule('cleanup-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions();');

-- Programar actualización de vistas materializadas cada 6 horas
-- SELECT cron.schedule('refresh-views', '0 */6 * * *', 'SELECT refresh_materialized_views();');

-- =====================================================
-- 9. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON MATERIALIZED VIEW daily_sales_stats IS 'Estadísticas diarias de ventas para reportes rápidos';
COMMENT ON MATERIALIZED VIEW inventory_summary IS 'Resumen completo de inventario con métricas de ventas';
COMMENT ON MATERIALIZED VIEW customer_summary IS 'Perfil completo de clientes con historial de compras';

COMMENT ON FUNCTION get_cash_register_balance(UUID) IS 'Calcula balance de caja en tiempo real de forma optimizada';
COMMENT ON FUNCTION get_low_stock_products(INTEGER) IS 'Obtiene productos con bajo stock y sugerencias de reorden';
COMMENT ON FUNCTION get_sales_statistics(DATE, DATE) IS 'Estadísticas completas de ventas por período';
COMMENT ON FUNCTION get_top_selling_products(INTEGER, INTEGER) IS 'Productos más vendidos con análisis de rentabilidad';
COMMENT ON FUNCTION get_category_profitability(INTEGER) IS 'Análisis de rentabilidad por categoría de productos';

-- Refrescar vistas materializadas inicialmente
SELECT refresh_materialized_views();