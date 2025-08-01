/*
  # Función optimizada para estadísticas del dashboard

  1. Nueva función
    - `get_dashboard_stats(target_date)` - Estadísticas rápidas del dashboard
  
  2. Optimizaciones
    - Una sola consulta para múltiples estadísticas
    - Uso de índices existentes
    - Cálculos eficientes
*/

-- Función para obtener estadísticas del dashboard de forma optimizada
CREATE OR REPLACE FUNCTION get_dashboard_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_sales BIGINT,
  total_products BIGINT,
  total_customers BIGINT,
  today_sales NUMERIC,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      (SELECT COUNT(*) FROM sales) as total_sales_count,
      (SELECT COUNT(*) FROM products) as total_products_count,
      (SELECT COUNT(*) FROM customers) as total_customers_count,
      (SELECT COALESCE(SUM(total_amount), 0) 
       FROM sales 
       WHERE DATE(created_at) = target_date) as today_sales_amount,
      (SELECT COALESCE(SUM(total_amount), 0) 
       FROM sales) as total_revenue_amount
  )
  SELECT 
    stats.total_sales_count,
    stats.total_products_count,
    stats.total_customers_count,
    stats.today_sales_amount,
    stats.total_revenue_amount
  FROM stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;