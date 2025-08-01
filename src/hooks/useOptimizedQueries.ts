import { useState, useEffect, useCallback } from 'react';
import { 
  getDashboardStats, 
  getLowStockProducts, 
  getInventorySummary, 
  getCustomerSummary,
  getSalesOptimized 
} from '../lib/optimizedQueries';

// Hook optimizado para el dashboard con cache
export function useOptimizedDashboard() {
  const [dashboardData, setDashboardData] = useState({
    dailyStats: [],
    inventorySummary: [],
    customerSummary: [],
    loading: true,
    error: null,
    lastUpdated: null
  });

  const loadOptimizedData = useCallback(async () => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true }));

      // Cargar datos usando las funciones optimizadas
      const [dashboardStats, inventoryData, customerData] = await Promise.all([
        getDashboardStats(),
        getInventorySummary(),
        getCustomerSummary()
      ]);

      const newData = {
        dailyStats: [dashboardStats], // Convertir a array para compatibilidad
        inventorySummary: inventoryData,
        customerSummary: customerData,
        lastUpdated: Date.now()
      };

      setDashboardData({
        ...newData,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error loading optimized data:', error);
      setDashboardData(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
    }
  }, []);

  useEffect(() => {
    loadOptimizedData();
  }, [loadOptimizedData]);

  return { ...dashboardData, refresh: loadOptimizedData };
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
      
      const salesData = await getSalesOptimized(100, {
        dateFrom: startDate,
        dateTo: endDate
      });

      setStatistics({
        data: salesData,
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
      const data = await getLowStockProducts(threshold);

      setProducts({
        data: data,
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