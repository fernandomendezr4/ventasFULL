import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Hook para usar las vistas materializadas optimizadas
export function useOptimizedDashboard() {
  const [stats, setStats] = useState({
    dailyStats: [],
    inventorySummary: [],
    customerSummary: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    loadOptimizedData();
  }, []);

  const loadOptimizedData = async () => {
    try {
      setStats(prev => ({ ...prev, loading: true }));

      // Usar vistas materializadas para datos rápidos
      const [dailyStatsResult, inventoryResult, customerResult] = await Promise.all([
        // Estadísticas diarias de los últimos 30 días
        supabase
          .from('daily_sales_stats')
          .select('*')
          .gte('sale_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('sale_date', { ascending: false }),

        // Resumen de inventario con productos de bajo stock
        supabase
          .from('inventory_summary')
          .select('*')
          .in('stock_status', ['low_stock', 'out_of_stock'])
          .order('total_sold_last_30_days', { ascending: false })
          .limit(20),

        // Clientes más activos
        supabase
          .from('customer_summary')
          .select('*')
          .eq('customer_status', 'active')
          .order('total_spent', { ascending: false })
          .limit(10)
      ]);

      setStats({
        dailyStats: dailyStatsResult.data || [],
        inventorySummary: inventoryResult.data || [],
        customerSummary: customerResult.data || [],
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
  };

  return { ...stats, refresh: loadOptimizedData };
}

// Hook para estadísticas de ventas optimizadas
export function useSalesStatistics(startDate?: string, endDate?: string) {
  const [statistics, setStatistics] = useState({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    loadSalesStatistics();
  }, [startDate, endDate]);

  const loadSalesStatistics = async () => {
    try {
      setStatistics(prev => ({ ...prev, loading: true }));

      const { data, error } = await supabase.rpc('get_sales_statistics', {
        start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: endDate || new Date().toISOString().split('T')[0]
      });

      if (error) throw error;

      setStatistics({
        data: data?.[0] || null,
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
  };

  return { ...statistics, refresh: loadSalesStatistics };
}

// Hook para productos con bajo stock
export function useLowStockProducts(threshold: number = 10) {
  const [products, setProducts] = useState({
    data: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    loadLowStockProducts();
  }, [threshold]);

  const loadLowStockProducts = async () => {
    try {
      setProducts(prev => ({ ...prev, loading: true }));

      const { data, error } = await supabase.rpc('get_low_stock_products', {
        stock_threshold: threshold
      });

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
  };

  return { ...products, refresh: loadLowStockProducts };
}

// Hook para balance de caja optimizado
export function useCashRegisterBalance(registerId?: string) {
  const [balance, setBalance] = useState({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    if (registerId) {
      loadCashBalance();
    }
  }, [registerId]);

  const loadCashBalance = async () => {
    if (!registerId) return;

    try {
      setBalance(prev => ({ ...prev, loading: true }));

      const { data, error } = await supabase.rpc('get_cash_register_balance', {
        register_id: registerId
      });

      if (error) throw error;

      setBalance({
        data: data?.[0] || null,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error loading cash balance:', error);
      setBalance({
        data: null,
        loading: false,
        error: error as Error
      });
    }
  };

  return { ...balance, refresh: loadCashBalance };
}

// Hook para productos más vendidos
export function useTopSellingProducts(daysBack: number = 30, limitCount: number = 10) {
  const [products, setProducts] = useState({
    data: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    loadTopSellingProducts();
  }, [daysBack, limitCount]);

  const loadTopSellingProducts = async () => {
    try {
      setProducts(prev => ({ ...prev, loading: true }));

      const { data, error } = await supabase.rpc('get_top_selling_products', {
        days_back: daysBack,
        limit_count: limitCount
      });

      if (error) throw error;

      setProducts({
        data: data || [],
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error loading top selling products:', error);
      setProducts({
        data: [],
        loading: false,
        error: error as Error
      });
    }
  };

  return { ...products, refresh: loadTopSellingProducts };
}

// Hook para análisis de rentabilidad por categoría
export function useCategoryProfitability(daysBack: number = 30) {
  const [profitability, setProfitability] = useState({
    data: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    loadCategoryProfitability();
  }, [daysBack]);

  const loadCategoryProfitability = async () => {
    try {
      setProfitability(prev => ({ ...prev, loading: true }));

      const { data, error } = await supabase.rpc('get_category_profitability', {
        days_back: daysBack
      });

      if (error) throw error;

      setProfitability({
        data: data || [],
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error loading category profitability:', error);
      setProfitability({
        data: [],
        loading: false,
        error: error as Error
      });
    }
  };

  return { ...profitability, refresh: loadCategoryProfitability };
}