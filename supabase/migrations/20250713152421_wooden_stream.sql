/*
  # Optimización Completa de Base de Datos - Sistema de Ventas

  Esta migración implementa optimizaciones avanzadas para mejorar significativamente
  el rendimiento del sistema de ventas, incluyendo:

  1. Índices Estratégicos
     - Índices compuestos para consultas frecuentes
     - Índices de texto completo para búsquedas
     - Índices parciales para datos activos

  2. Vistas Materializadas
     - Estadísticas diarias pre-calculadas
     - Resumen de inventario con métricas
     - Análisis de clientes optimizado

  3. Funciones Optimizadas
     - Balance de caja registradora
     - Productos con bajo stock
     - Estadísticas de ventas por período

  4. Configuraciones de Rendimiento
     - Autovacuum optimizado
     - Políticas RLS eficientes
*/

-- =====================================================
-- 1. ÍNDICES ESTRATÉGICOS PARA CONSULTAS FRECUENTES
-- =====================================================

-- Índice compuesto para consultas de ventas por fecha, usuario y estado
CREATE INDEX IF NOT EXISTS idx_sales_date_user_status 
ON sales (created_at DESC, user_id, payment_status) 
WHERE created_at >= CURRENT_DATE - INTERVAL '1 year';

-- Índice para búsquedas de ventas por cliente y fecha
CREATE INDEX IF NOT EXISTS idx_sales_customer_date 
ON sales (customer_id, created_at DESC) 
WHERE customer_id IS NOT NULL;

-- Índice de texto completo para búsqueda de productos
CREATE INDEX IF NOT EXISTS idx_products_search 
ON products USING gin(to_tsvector('spanish', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(barcode, '')));

-- Índice para movimientos de caja por registradora, tipo y fecha
CREATE INDEX IF NOT EXISTS idx_cash_movements_register_type_date 
ON cash_movements (cash_register_id, type, created_at DESC);

-- Índice para items de venta por producto (para análisis de ventas)
CREATE INDEX IF NOT EXISTS idx_sale_items_product_date 
ON sale_items (product_id, (SELECT created_at FROM sales WHERE sales.id = sale_items.sale_id));

-- Índice para abonos por venta y fecha
CREATE INDEX IF NOT EXISTS idx_payment_installments_sale_date 
ON payment_installments (sale_id, payment_date DESC);

-- Índice para clientes activos (con ventas recientes)
CREATE INDEX IF NOT EXISTS idx_customers_active 
ON customers (created_at DESC) 
WHERE id IN (SELECT DISTINCT customer_id FROM sales WHERE customer_id IS NOT NULL AND created_at >= CURRENT_DATE - INTERVAL '6 months');

-- =====================================================
-- 2. VISTAS MATERIALIZADAS PARA REPORTES RÁPIDOS
-- =====================================================

-- Vista materializada: Estadísticas diarias de ventas
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_sales_stats AS
SELECT 
    DATE(created_at) as sale_date,
    COUNT(*) as total_sales,
    COUNT(DISTINCT customer_id) as unique_customers,
    SUM(total_amount) as total_revenue,
    SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE 0 END) as cash_revenue,
    SUM(CASE WHEN payment_type = 'installment' THEN total_amount ELSE 0 END) as installment_revenue,
    AVG(total_amount) as avg_sale_amount,
    COUNT(CASE WHEN payment_type = 'cash' THEN 1 END) as cash_sales_count,
    COUNT(CASE WHEN payment_type = 'installment' THEN 1 END) as installment_sales_count
FROM sales 
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;

-- Índice único para la vista materializada
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_sales_stats_date ON daily_sales_stats (sale_date);

-- Vista materializada: Resumen de inventario con métricas de ventas
CREATE MATERIALIZED VIEW IF NOT EXISTS inventory_summary AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sale_price,
    p.purchase_price,
    p.stock as current_stock,
    COALESCE(c.name, 'Sin categoría') as category_name,
    COALESCE(s.name, 'Sin proveedor') as supplier_name,
    
    -- Métricas de ventas últimos 30 días
    COALESCE(sales_30d.total_sold, 0) as total_sold_last_30_days,
    COALESCE(sales_30d.revenue, 0) as revenue_last_30_days,
    COALESCE(sales_30d.profit, 0) as profit_last_30_days,
    
    -- Estado del stock
    CASE 
        WHEN p.stock = 0 THEN 'out_of_stock'
        WHEN p.stock <= 5 THEN 'low_stock'
        WHEN p.stock <= 20 THEN 'medium_stock'
        ELSE 'good_stock'
    END as stock_status,
    
    -- Días desde última venta
    COALESCE(
        EXTRACT(DAY FROM CURRENT_DATE - MAX(sales_data.sale_date)), 
        999
    ) as days_since_last_sale,
    
    -- Sugerencia de reorden basada en ventas promedio
    CASE 
        WHEN COALESCE(sales_30d.total_sold, 0) > 0 
        THEN GREATEST(10, CEIL(COALESCE(sales_30d.total_sold, 0) * 1.5))
        ELSE 10
    END as suggested_reorder_quantity,
    
    -- Ganancia potencial del stock actual
    (p.sale_price - p.purchase_price) * p.stock as potential_profit

FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN (
    SELECT 
        si.product_id,
        SUM(si.quantity) as total_sold,
        SUM(si.total_price) as revenue,
        SUM(si.quantity * (p2.sale_price - p2.purchase_price)) as profit
    FROM sale_items si
    JOIN sales sa ON si.sale_id = sa.id
    JOIN products p2 ON si.product_id = p2.id
    WHERE sa.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY si.product_id
) sales_30d ON p.id = sales_30d.product_id
LEFT JOIN (
    SELECT 
        si.product_id,
        MAX(DATE(sa.created_at)) as sale_date
    FROM sale_items si
    JOIN sales sa ON si.sale_id = sa.id
    GROUP BY si.product_id
) sales_data ON p.id = sales_data.product_id
GROUP BY p.id, p.name, p.sale_price, p.purchase_price, p.stock, c.name, s.name, 
         sales_30d.total_sold, sales_30d.revenue, sales_30d.profit;

-- Índice para la vista de inventario
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_summary_product ON inventory_summary (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_summary_stock_status ON inventory_summary (stock_status);

-- Vista materializada: Resumen de clientes con historial
CREATE MATERIALIZED VIEW IF NOT EXISTS customer_summary AS
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c.email,
    c.phone,
    c.cedula,
    c.created_at as customer_since,
    
    -- Estadísticas de compras
    COUNT(s.id) as total_purchases,
    COALESCE(SUM(s.total_amount), 0) as total_spent,
    COALESCE(AVG(s.total_amount), 0) as avg_purchase_amount,
    MAX(s.created_at) as last_purchase_date,
    
    -- Análisis de pagos
    COUNT(CASE WHEN s.payment_type = 'cash' THEN 1 END) as cash_purchases,
    COUNT(CASE WHEN s.payment_type = 'installment' THEN 1 END) as installment_purchases,
    
    -- Saldos pendientes
    COALESCE(SUM(CASE WHEN s.payment_type = 'installment' THEN s.total_amount - s.total_paid ELSE 0 END), 0) as pending_balance,
    
    -- Estado del cliente
    CASE 
        WHEN MAX(s.created_at) >= CURRENT_DATE - INTERVAL '30 days' THEN 'active'
        WHEN MAX(s.created_at) >= CURRENT_DATE - INTERVAL '90 days' THEN 'recent'
        WHEN MAX(s.created_at) >= CURRENT_DATE - INTERVAL '180 days' THEN 'inactive'
        ELSE 'dormant'
    END as customer_status,
    
    -- Frecuencia de compra (días promedio entre compras)
    CASE 
        WHEN COUNT(s.id) > 1 THEN 
            EXTRACT(DAY FROM (MAX(s.created_at) - MIN(s.created_at))) / NULLIF(COUNT(s.id) - 1, 0)
        ELSE NULL
    END as avg_days_between_purchases

FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id
GROUP BY c.id, c.name, c.email, c.phone, c.cedula, c.created_at;

-- Índice para la vista de clientes
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_summary_id ON customer_summary (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_summary_status ON customer_summary (customer_status);

-- =====================================================
-- 3. FUNCIONES OPTIMIZADAS PARA CONSULTAS COMPLEJAS
-- =====================================================

-- Función: Obtener balance optimizado de caja registradora
CREATE OR REPLACE FUNCTION get_cash_register_balance(register_id UUID)
RETURNS TABLE (
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
            WHEN cm.type IN ('income', 'sale', 'opening') THEN cm.amount 
            ELSE -cm.amount 
        END), 0) as current_balance,
        
        COALESCE(SUM(CASE 
            WHEN cm.type = 'income' THEN cm.amount 
            ELSE 0 
        END), 0) as total_income,
        
        COALESCE(SUM(CASE 
            WHEN cm.type = 'expense' THEN cm.amount 
            ELSE 0 
        END), 0) as total_expenses,
        
        COALESCE(SUM(CASE 
            WHEN cm.type = 'sale' THEN cm.amount 
            ELSE 0 
        END), 0) as total_sales,
        
        COUNT(*)::INTEGER as movement_count
        
    FROM cash_movements cm
    WHERE cm.cash_register_id = register_id;
END;
$$;

-- Función: Obtener productos con bajo stock y sugerencias
CREATE OR REPLACE FUNCTION get_low_stock_products(stock_threshold INTEGER DEFAULT 10)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    current_stock INTEGER,
    category_name TEXT,
    days_since_last_sale INTEGER,
    suggested_reorder_quantity INTEGER,
    sale_price NUMERIC,
    purchase_price NUMERIC
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
        COALESCE(
            EXTRACT(DAY FROM CURRENT_DATE - MAX(s.created_at))::INTEGER, 
            999
        ),
        CASE 
            WHEN recent_sales.avg_monthly_sales > 0 
            THEN GREATEST(stock_threshold, CEIL(recent_sales.avg_monthly_sales * 1.5)::INTEGER)
            ELSE stock_threshold
        END,
        p.sale_price,
        p.purchase_price
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN sale_items si ON p.id = si.product_id
    LEFT JOIN sales s ON si.sale_id = s.id
    LEFT JOIN (
        SELECT 
            si2.product_id,
            AVG(monthly_sales.total_sold) as avg_monthly_sales
        FROM sale_items si2
        JOIN sales s2 ON si2.sale_id = s2.id
        JOIN (
            SELECT 
                si3.product_id,
                DATE_TRUNC('month', s3.created_at) as month,
                SUM(si3.quantity) as total_sold
            FROM sale_items si3
            JOIN sales s3 ON si3.sale_id = s3.id
            WHERE s3.created_at >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY si3.product_id, DATE_TRUNC('month', s3.created_at)
        ) monthly_sales ON si2.product_id = monthly_sales.product_id
        GROUP BY si2.product_id
    ) recent_sales ON p.id = recent_sales.product_id
    WHERE p.stock <= stock_threshold
    GROUP BY p.id, p.name, p.stock, c.name, p.sale_price, p.purchase_price, recent_sales.avg_monthly_sales
    ORDER BY p.stock ASC, recent_sales.avg_monthly_sales DESC NULLS LAST;
END;
$$;

-- Función: Estadísticas de ventas por período
CREATE OR REPLACE FUNCTION get_sales_statistics(start_date DATE, end_date DATE)
RETURNS TABLE (
    total_sales INTEGER,
    total_revenue NUMERIC,
    cash_sales_count INTEGER,
    installment_sales_count INTEGER,
    cash_revenue NUMERIC,
    installment_revenue NUMERIC,
    avg_sale_amount NUMERIC,
    unique_customers INTEGER,
    top_selling_product_name TEXT,
    best_day_revenue NUMERIC,
    best_day_date DATE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH sales_data AS (
        SELECT 
            s.*,
            ROW_NUMBER() OVER (PARTITION BY DATE(s.created_at) ORDER BY s.total_amount DESC) as daily_rank
        FROM sales s
        WHERE DATE(s.created_at) BETWEEN start_date AND end_date
    ),
    daily_totals AS (
        SELECT 
            DATE(created_at) as sale_date,
            SUM(total_amount) as daily_revenue
        FROM sales_data
        GROUP BY DATE(created_at)
    ),
    product_sales AS (
        SELECT 
            p.name,
            SUM(si.quantity) as total_quantity
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.created_at) BETWEEN start_date AND end_date
        GROUP BY p.id, p.name
        ORDER BY total_quantity DESC
        LIMIT 1
    )
    SELECT 
        COUNT(*)::INTEGER,
        COALESCE(SUM(sd.total_amount), 0),
        COUNT(CASE WHEN sd.payment_type = 'cash' THEN 1 END)::INTEGER,
        COUNT(CASE WHEN sd.payment_type = 'installment' THEN 1 END)::INTEGER,
        COALESCE(SUM(CASE WHEN sd.payment_type = 'cash' THEN sd.total_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN sd.payment_type = 'installment' THEN sd.total_amount ELSE 0 END), 0),
        COALESCE(AVG(sd.total_amount), 0),
        COUNT(DISTINCT sd.customer_id)::INTEGER,
        COALESCE((SELECT name FROM product_sales LIMIT 1), 'N/A'),
        COALESCE((SELECT MAX(daily_revenue) FROM daily_totals), 0),
        COALESCE((SELECT sale_date FROM daily_totals ORDER BY daily_revenue DESC LIMIT 1), start_date)
    FROM sales_data sd;
END;
$$;

-- Función: Productos más vendidos por período
CREATE OR REPLACE FUNCTION get_top_selling_products(days_back INTEGER DEFAULT 30, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    category_name TEXT,
    total_quantity_sold INTEGER,
    total_revenue NUMERIC,
    avg_sale_price NUMERIC,
    sale_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        COALESCE(c.name, 'Sin categoría'),
        SUM(si.quantity)::INTEGER,
        SUM(si.total_price),
        AVG(si.unit_price),
        COUNT(DISTINCT si.sale_id)::INTEGER
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.created_at >= CURRENT_DATE - INTERVAL '%s days'
    GROUP BY p.id, p.name, c.name
    ORDER BY SUM(si.quantity) DESC
    LIMIT limit_count;
END;
$$;

-- Función: Análisis de rentabilidad por categoría
CREATE OR REPLACE FUNCTION get_category_profitability(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    category_name TEXT,
    total_products INTEGER,
    total_sales INTEGER,
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
        COALESCE(c.name, 'Sin categoría'),
        COUNT(DISTINCT p.id)::INTEGER,
        SUM(si.quantity)::INTEGER,
        SUM(si.total_price),
        SUM(si.quantity * p.purchase_price),
        SUM(si.quantity * (p.sale_price - p.purchase_price)),
        CASE 
            WHEN SUM(si.quantity * p.purchase_price) > 0 
            THEN (SUM(si.quantity * (p.sale_price - p.purchase_price)) / SUM(si.quantity * p.purchase_price)) * 100
            ELSE 0
        END,
        AVG(si.unit_price)
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.created_at >= CURRENT_DATE - INTERVAL '%s days'
    GROUP BY c.id, c.name
    ORDER BY SUM(si.quantity * (p.sale_price - p.purchase_price)) DESC;
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

-- Trigger para actualizar estadísticas diarias cuando se crea una venta
CREATE OR REPLACE FUNCTION trigger_refresh_daily_stats()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Solo refrescar si la venta es del día actual
    IF DATE(NEW.created_at) = CURRENT_DATE THEN
        PERFORM refresh_materialized_views();
    END IF;
    RETURN NEW;
END;
$$;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS refresh_stats_on_sale ON sales;
CREATE TRIGGER refresh_stats_on_sale
    AFTER INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_daily_stats();

-- =====================================================
-- 5. CONFIGURACIONES DE RENDIMIENTO
-- =====================================================

-- Configurar autovacuum para tablas de alta actividad
ALTER TABLE sales SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE sale_items SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE cash_movements SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- =====================================================
-- 6. LIMPIEZA AUTOMÁTICA DE DATOS OBSOLETOS
-- =====================================================

-- Función para limpiar sesiones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM employee_sessions 
    WHERE expires_at < NOW();
END;
$$;

-- =====================================================
-- 7. POLÍTICAS RLS OPTIMIZADAS
-- =====================================================

-- Optimizar políticas RLS para usar índices eficientemente
-- Las políticas existentes ya están bien configuradas, pero podemos mejorar algunas

-- Política optimizada para ventas (usar índice de fecha)
DROP POLICY IF EXISTS "Public can view sales" ON sales;
CREATE POLICY "Public can view sales" ON sales
    FOR SELECT TO public
    USING (created_at >= CURRENT_DATE - INTERVAL '2 years'); -- Limitar a datos recientes

-- =====================================================
-- 8. ESTADÍSTICAS INICIALES
-- =====================================================

-- Actualizar estadísticas de todas las tablas
ANALYZE;

-- Refrescar vistas materializadas inicialmente
SELECT refresh_materialized_views();

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================

COMMENT ON MATERIALIZED VIEW daily_sales_stats IS 'Estadísticas diarias pre-calculadas para reportes rápidos';
COMMENT ON MATERIALIZED VIEW inventory_summary IS 'Resumen completo de inventario con métricas de ventas y rentabilidad';
COMMENT ON MATERIALIZED VIEW customer_summary IS 'Análisis completo de clientes con historial de compras y comportamiento';

COMMENT ON FUNCTION get_cash_register_balance(UUID) IS 'Calcula el balance actual de una caja registradora de forma optimizada';
COMMENT ON FUNCTION get_low_stock_products(INTEGER) IS 'Obtiene productos con bajo stock y sugerencias de reorden inteligentes';
COMMENT ON FUNCTION get_sales_statistics(DATE, DATE) IS 'Estadísticas completas de ventas para un período específico';