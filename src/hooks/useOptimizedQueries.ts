import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Hook optimizado para el dashboard con cache
export function useOptimizedDashboard() {
  const [stats, setStats] = useState({
    dailyStats: [],
    inventorySummary: [],
    customerSummary: [],
    loading: true,
    error: null,
    lastUpdated: null
  });

  const loadOptimizedData = useCallback(async () => {
    try {
      setStats(prev => ({ ...prev, loading: true }));

      // Verificar cache (5 minutos)
      const cacheKey = 'dashboard_cache';
      const cached = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(cacheKey + '_time');
      
      if (cached && cacheTime) {
        const age = Date.now() - parseInt(cacheTime);
        if (age < 5 * 60 * 1000) { // 5 minutos
          const cachedData = JSON.parse(cached);
          setStats({
            ...cachedData,
            loading: false,
            error: null
          });
          return;
        }
      }

      // Cargar datos frescos de forma más eficiente
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [dashboardStatsResult] = await Promise.all([
        supabase.rpc('get_dashboard_stats', { target_date: today })
      ]);

      const newStats = {
        dailyStats: dashboardStatsResult.data || [],
        inventorySummary: [],
        customerSummary: [],
        lastUpdated: Date.now()
      };

      // Guardar en cache
      localStorage.setItem(cacheKey, JSON.stringify(newStats));
      localStorage.setItem(cacheKey + '_time', Date.now().toString());

      setStats({
        ...newStats,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error loading optimized data:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
    }
  }, []);

  useEffect(() => {
    loadOptimizedData();
  }, [loadOptimizedData]);

  return { ...stats, refresh: loadOptimizedData };
}

// Hook simplificado para estadísticas de ventas
export function useSalesStatistics(startDate?: string, endDate?: string) {
  const [statistics, setStatistics] = useState({
    data: null,
    loading: true,
    error: null
  });

  const loadSalesStatistics = useCallback(async () => {
    try {
      setStatistics(prev => ({ ...prev, loading: true }));

      // Usar consulta simple en lugar de función RPC
      const { data, error } = await supabase
        .from('sales')
        .select('total_amount, payment_type, created_at')
        .gte('created_at', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', endDate || new Date().toISOString());

      if (error) throw error;

      // Calcular estadísticas en el cliente
      const totalSales = data?.length || 0;
      const totalRevenue = data?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;
      const cashSales = data?.filter(sale => sale.payment_type === 'cash').length || 0;

      setStatistics({
        data: {
          total_sales: totalSales,
          total_revenue: totalRevenue,
          cash_sales_count: cashSales,
          installment_sales_count: totalSales - cashSales
        },
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error loading sales statistics:', error);
      setStatistics({
        data: null,
        loading: false,
        error: error as Error
      });
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadSalesStatistics();
  }, [loadSalesStatistics]);

  return { ...statistics, refresh: loadSalesStatistics };
}

// Hook optimizado para productos con bajo stock
export function useLowStockProducts(threshold: number = 10) {
  const [products, setProducts] = useState({
    data: [],
    loading: true,
    error: null
  });

  const loadLowStockProducts = useCallback(async () => {
    try {
      setProducts(prev => ({ ...prev, loading: true }));

      // Consulta simple y rápida
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock, sale_price')
        .lte('stock', threshold)
        .order('stock', { ascending: true })
        .limit(10);

      if (error) throw error;

      setProducts({
        data: data || [],
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error loading low stock products:', error);
      setProducts({
        data: [],
        loading: false,
        error: error as Error
      });
    }
  }, [threshold]);

  useEffect(() => {
    loadLowStockProducts();
  }, [loadLowStockProducts]);

  return { ...products, refresh: loadLowStockProducts };
}