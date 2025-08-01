// Consultas optimizadas para mejor rendimiento con la base de datos

import { supabase } from './supabase';

// Cache simple en memoria para consultas frecuentes
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Función helper para cache
const getCachedData = <T>(key: string, ttl: number = 5 * 60 * 1000): T | null => {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data as T;
  }
  return null;
};

const setCachedData = <T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void => {
  queryCache.set(key, { data, timestamp: Date.now(), ttl });
};

// Limpiar cache periódicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > value.ttl) {
      queryCache.delete(key);
    }
  }
}, 60000); // Limpiar cada minuto

// =====================================================
// CONSULTAS OPTIMIZADAS PARA DASHBOARD
// =====================================================

export const getDashboardStats = async (targetDate?: string) => {
  try {
    const today = targetDate || new Date().toISOString().split('T')[0];
    
    // Consultas básicas sin RPC
    const [salesCount, productsCount, customersCount, todaySales, totalRevenue] = await Promise.all([
      supabase.from('sales').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase
        .from('sales')
        .select('total_amount')
        .gte('created_at', today)
        .lt('created_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      supabase.from('sales').select('total_amount')
    ]);

    const todayTotal = todaySales.data?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
    const revenueTotal = totalRevenue.data?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;

    return {
      total_sales: salesCount.count || 0,
      total_products: productsCount.count || 0,
      total_customers: customersCount.count || 0,
      today_sales: todayTotal,
      total_revenue: revenueTotal,
      low_stock_count: 0
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return {
      total_sales: 0,
      total_products: 0,
      total_customers: 0,
      today_sales: 0,
      total_revenue: 0,
      low_stock_count: 0
    };
  }
};

// =====================================================
// CONSULTAS PARA PRODUCTOS
// =====================================================

export const getProductsOptimized = async (limit: number = 50, offset: number = 0) => {
  const cacheKey = `products_${limit}_${offset}`;
  const cached = getCachedData(cacheKey, 5 * 60 * 1000); // 5 minutos
  
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('products_detailed')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    setCachedData(cacheKey, data || []);
    return data || [];
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
};

export const searchProducts = async (searchTerm: string, categoryId?: string) => {
  try {
    let query = supabase
      .from('products_detailed')
      .select('*');

    if (searchTerm) {
      // Usar búsqueda de texto completo optimizada
      query = query.textSearch('name', searchTerm, {
        type: 'websearch',
        config: 'spanish'
      });
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query
      .order('name')
      .limit(100);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
};

// =====================================================
// CONSULTAS PARA VENTAS
// =====================================================

export const getSalesOptimized = async (
  limit: number = 50, 
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    paymentType?: string;
    customerId?: string;
  }
) => {
  try {
    let query = supabase
      .from('sales')
      .select(`
        id,
        total_amount,
        subtotal,
        discount_amount,
        payment_type,
        payment_status,
        total_paid,
        created_at,
        customer:customers(id, name, phone),
        user:users(id, name)
      `);

    // Aplicar filtros
    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }
    if (filters?.paymentType && filters.paymentType !== 'all') {
      query = query.eq('payment_type', filters.paymentType);
    }
    if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting sales:', error);
    return [];
  }
};

export const getSaleWithItems = async (saleId: string) => {
  const cacheKey = `sale_items_${saleId}`;
  const cached = getCachedData(cacheKey, 10 * 60 * 1000); // 10 minutos
  
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items (
          id,
          quantity,
          unit_price,
          total_price,
          product:products (
            id,
            name,
            barcode,
            category:categories(name)
          )
        ),
        customer:customers(*),
        user:users(name, email)
      `)
      .eq('id', saleId)
      .single();

    if (error) throw error;

    setCachedData(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error getting sale with items:', error);
    return null;
  }
};

// =====================================================
// CONSULTAS PARA CAJA REGISTRADORA
// =====================================================

export const getCashRegisterBalance = async (registerId: string) => {
  try {
    const { data, error } = await supabase.rpc('get_cash_register_balance', {
      register_id: registerId
    });

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error getting cash register balance:', error);
    return null;
  }
};

export const getCashRegisterMovements = async (registerId: string) => {
  const cacheKey = `cash_movements_${registerId}`;
  const cached = getCachedData(cacheKey, 1 * 60 * 1000); // 1 minuto
  
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('cash_movements')
      .select(`
        *,
        created_by_user:users(name)
      `)
      .eq('cash_register_id', registerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    setCachedData(cacheKey, data || []);
    return data || [];
  } catch (error) {
    console.error('Error getting cash movements:', error);
    return [];
  }
};

// =====================================================
// CONSULTAS PARA INVENTARIO
// =====================================================

export const getLowStockProducts = async (threshold: number = 10) => {
  const cacheKey = `low_stock_${threshold}`;
  const cached = getCachedData(cacheKey, 10 * 60 * 1000); // 10 minutos
  
  if (cached) return cached;

  try {
    const { data, error } = await supabase.rpc('get_low_stock_products', {
      threshold
    });

    if (error) throw error;

    setCachedData(cacheKey, data || []);
    return data || [];
  } catch (error) {
    console.error('Error getting low stock products:', error);
    return [];
  }
};

export const getInventorySummary = async () => {
  const cacheKey = 'inventory_summary';
  const cached = getCachedData(cacheKey, 15 * 60 * 1000); // 15 minutos
  
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('inventory_summary')
      .select('*')
      .order('product_name');

    if (error) throw error;

    setCachedData(cacheKey, data || []);
    return data || [];
  } catch (error) {
    console.error('Error getting inventory summary:', error);
    return [];
  }
};

// =====================================================
// CONSULTAS PARA CLIENTES
// =====================================================

export const getCustomerSummary = async () => {
  const cacheKey = 'customer_summary';
  const cached = getCachedData(cacheKey, 15 * 60 * 1000); // 15 minutos
  
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('customer_summary')
      .select('*')
      .order('total_spent', { ascending: false, nullsFirst: false });

    if (error) throw error;

    setCachedData(cacheKey, data || []);
    return data || [];
  } catch (error) {
    console.error('Error getting customer summary:', error);
    return [];
  }
};

// =====================================================
// FUNCIONES DE MANTENIMIENTO
// =====================================================

export const runDatabaseMaintenance = async () => {
  try {
    const { data, error } = await supabase.rpc('auto_maintenance');
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error running maintenance:', error);
    return 'Error en mantenimiento: ' + (error as Error).message;
  }
};

export const checkDatabaseIntegrity = async () => {
  try {
    const { data, error } = await supabase.rpc('check_database_integrity');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error checking integrity:', error);
    return [];
  }
};

export const refreshViews = async () => {
  try {
    const { data, error } = await supabase.rpc('refresh_materialized_views');
    
    if (error) throw error;
    
    // Limpiar cache después de refrescar vistas
    queryCache.clear();
    
    return data;
  } catch (error) {
    console.error('Error refreshing views:', error);
    return 'Error al refrescar vistas: ' + (error as Error).message;
  }
};

// =====================================================
// UTILIDADES DE CACHE
// =====================================================

export const clearQueryCache = () => {
  queryCache.clear();
};

export const invalidateCache = (pattern: string) => {
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key);
    }
  }
};

// Función para pre-cargar datos críticos
export const preloadCriticalData = async () => {
  try {
    // Pre-cargar datos del dashboard
    await getDashboardStats();
    
    // Pre-cargar productos con bajo stock
    await getLowStockProducts();
    
    console.log('Datos críticos pre-cargados exitosamente');
  } catch (error) {
    console.error('Error pre-loading critical data:', error);
  }
};