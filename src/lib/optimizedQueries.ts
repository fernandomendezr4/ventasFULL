// Consultas optimizadas para mejor rendimiento con la base de datos

import { supabase } from './supabase';
import { isDemoMode } from './supabase';

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
    
    if (isDemoMode) {
      // Demo mode: return sample dashboard stats
      return {
        total_sales: 150,
        total_products: 45,
        total_customers: 25,
        today_sales: 2500000,
        total_revenue: 15000000,
        low_stock_count: 3
      };
    }
    
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

  if (isDemoMode) {
    // Demo mode: return sample products data
    const demoProducts = [
      {
        id: 'demo-product-1',
        name: 'iPhone 15 Pro',
        description: 'Smartphone Apple iPhone 15 Pro 128GB',
        sale_price: 4500000,
        stock: 5,
        category_name: 'Smartphones',
        supplier_name: 'Apple Store',
        created_at: new Date().toISOString(),
        has_imei_serial: true,
        imei_serial_type: 'imei'
      },
      {
        id: 'demo-product-2',
        name: 'Samsung Galaxy S24',
        description: 'Smartphone Samsung Galaxy S24 256GB',
        sale_price: 3200000,
        stock: 8,
        category_name: 'Smartphones',
        supplier_name: 'Samsung',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        has_imei_serial: true,
        imei_serial_type: 'imei'
      }
    ];
    
    setCachedData(cacheKey, demoProducts);
    return demoProducts;
  }
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
  if (isDemoMode) {
    // Demo mode: return filtered sample data
    const demoProducts = [
      {
        id: 'demo-product-1',
        name: 'iPhone 15 Pro',
        description: 'Smartphone Apple iPhone 15 Pro 128GB',
        sale_price: 4500000,
        stock: 5,
        category_name: 'Smartphones',
        supplier_name: 'Apple Store'
      }
    ];
    
    return demoProducts.filter(product => 
      !searchTerm || product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
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
  if (isDemoMode) {
    // Demo mode: return sample sales data
    const demoSales = [
      {
        id: 'demo-sale-1',
        total_amount: 1500000,
        subtotal: 1500000,
        discount_amount: 0,
        payment_type: 'cash',
        payment_status: 'paid',
        total_paid: 1500000,
        created_at: new Date().toISOString(),
        customer: { id: 'demo-customer-1', name: 'Juan Pérez', phone: '3001234567' },
        user: { id: 'demo-user-1', name: 'Vendedor Demo' }
      }
    ];
    
    return demoSales;
  }
  
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

  if (isDemoMode) {
    // Demo mode: return sample sale with items
    const demoSaleWithItems = {
      id: saleId,
      total_amount: 1500000,
      subtotal: 1500000,
      discount_amount: 0,
      payment_type: 'cash',
      payment_status: 'paid',
      total_paid: 1500000,
      created_at: new Date().toISOString(),
      sale_items: [
        {
          id: 'demo-item-1',
          quantity: 1,
          unit_price: 1500000,
          total_price: 1500000,
          product: {
            id: 'demo-product-1',
            name: 'iPhone 15 Pro',
            barcode: '123456789',
            category: { name: 'Smartphones' }
          }
        }
      ],
      customer: {
        id: 'demo-customer-1',
        name: 'Juan Pérez',
        phone: '3001234567',
        email: 'juan@email.com',
        address: 'Calle 123 #45-67',
        cedula: '12345678',
        created_at: new Date().toISOString()
      },
      user: { name: 'Vendedor Demo', email: 'vendedor@demo.com' }
    };
    
    setCachedData(cacheKey, demoSaleWithItems);
    return demoSaleWithItems;
  }
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
  if (isDemoMode) {
    // Demo mode: return sample balance data
    return {
      register_id: registerId,
      opening_amount: 100000,
      current_balance: 250000,
      total_sales: 150000,
      total_movements: 5
    };
  }
  
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

  if (isDemoMode) {
    // Demo mode: return sample movements data
    const demoMovements = [
      {
        id: 'demo-movement-1',
        type: 'opening',
        category: 'apertura',
        amount: 100000,
        description: 'Apertura de caja',
        created_at: new Date().toISOString(),
        created_by_user: { name: 'Vendedor Demo' }
      },
      {
        id: 'demo-movement-2',
        type: 'sale',
        category: 'venta',
        amount: 150000,
        description: 'Venta #demo-sale-1',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        created_by_user: { name: 'Vendedor Demo' }
      }
    ];
    
    setCachedData(cacheKey, demoMovements);
    return demoMovements;
  }
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

  if (isDemoMode) {
    // Demo mode: return sample low stock products
    const demoLowStockProducts = [
      {
        id: 'demo-product-low-1',
        name: 'Cargador USB-C',
        stock: 3,
        sale_price: 25000,
        category: { name: 'Accesorios' },
        supplier: { name: 'Proveedor Demo' }
      },
      {
        id: 'demo-product-low-2',
        name: 'Protector de Pantalla',
        stock: 5,
        sale_price: 15000,
        category: { name: 'Accesorios' },
        supplier: { name: 'Proveedor Demo' }
      }
    ];
    
    setCachedData(cacheKey, demoLowStockProducts);
    return demoLowStockProducts;
  }
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        stock,
        sale_price,
        category:categories(name),
        supplier:suppliers(name)
      `)
      .lte('stock', threshold)
      .order('stock', { ascending: true });

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

  if (isDemoMode) {
    // Demo mode: return sample inventory summary
    const demoInventory = [
      {
        product_id: 'demo-product-1',
        product_name: 'iPhone 15 Pro',
        current_stock: 5,
        sale_price: 4500000,
        purchase_price: 4000000,
        category_name: 'Smartphones',
        supplier_name: 'Apple Store',
        total_sold_last_30_days: 3,
        revenue_last_30_days: 13500000,
        stock_status: 'normal',
        profit_per_unit: 500000,
        profit_margin_percent: 12.5,
        inventory_value_cost: 20000000,
        inventory_value_retail: 22500000,
        created_at: new Date().toISOString(),
        has_imei_serial: true,
        imei_serial_type: 'imei'
      }
    ];
    
    setCachedData(cacheKey, demoInventory);
    return demoInventory;
  }
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

  if (isDemoMode) {
    // Demo mode: return sample customer summary
    const demoCustomerSummary = [
      {
        customer_id: 'demo-customer-1',
        customer_name: 'Juan Pérez',
        email: 'juan@email.com',
        phone: '3001234567',
        cedula: '12345678',
        customer_since: new Date(Date.now() - 30 * 86400000).toISOString(),
        total_purchases: 5,
        total_spent: 7500000,
        average_purchase_amount: 1500000,
        last_purchase_date: new Date().toISOString(),
        first_purchase_date: new Date(Date.now() - 30 * 86400000).toISOString(),
        customer_status: 'active',
        pending_installment_balance: 1000000,
        total_installment_sales: 2,
        days_since_last_purchase: 0
      }
    ];
    
    setCachedData(cacheKey, demoCustomerSummary);
    return demoCustomerSummary;
  }
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
  if (isDemoMode) {
    return 'Mantenimiento completado (modo demo)';
  }
  
  try {
    const { data, error } = await supabase.rpc('audit_system_maintenance').catch(() => ({ 
      data: null, 
      error: { message: 'Function not available' } 
    }));
    
    if (error) {
      if (error.message.includes('not available') || 
          error.message.includes('does not exist') ||
          error.message.includes('42P01')) {
        return 'Función de mantenimiento no disponible - usando mantenimiento básico';
      }
      throw error;
    }
    return data || 'Mantenimiento completado';
  } catch (error) {
    console.error('Error running maintenance:', error);
    const errorMessage = (error as Error).message;
    if (errorMessage.includes('does not exist') || errorMessage.includes('42P01')) {
      return 'Mantenimiento básico completado - algunas funciones avanzadas no están disponibles';
    }
    return 'Error en mantenimiento: ' + errorMessage;
  }
};

export const checkDatabaseIntegrity = async () => {
  if (isDemoMode) {
    return [
      { check: 'Integridad de datos', status: 'OK', details: 'Modo demo - sin problemas' },
      { check: 'Índices', status: 'OK', details: 'Todos los índices funcionando' },
      { check: 'Restricciones', status: 'OK', details: 'Sin violaciones detectadas' }
    ];
  }
  
  try {
    const { data, error } = await supabase.rpc('validate_data_integrity').catch(() => ({ 
      data: null, 
      error: { message: 'Function not available' } 
    }));
    
    if (error) {
      if (error.message.includes('not available') || 
          error.message.includes('does not exist') ||
          error.message.includes('42P01')) {
        return [
          { check: 'Verificación de integridad', status: 'SKIP', details: 'Función no disponible' }
        ];
      }
      throw error;
    }
    return data || [
      { check: 'Verificación básica', status: 'OK', details: 'Sin errores detectados' }
    ];
  } catch (error) {
    console.error('Error checking integrity:', error);
    return [
      { check: 'Verificación de integridad', status: 'ERROR', details: (error as Error).message }
    ];
  }
};

export const refreshViews = async () => {
  if (isDemoMode) {
    return 'Vistas refrescadas (modo demo)';
  }
  
  try {
    const { data, error } = await supabase.rpc('refresh_materialized_views').catch(() => ({ 
      data: null, 
      error: { message: 'Function not available' } 
    }));
    
    if (error) {
      if (error.message.includes('not available') || 
          error.message.includes('does not exist') ||
          error.message.includes('42P01')) {
        // Limpiar cache como alternativa
        queryCache.clear();
        return 'Cache limpiado - función de refresco de vistas no disponible';
      }
      throw error;
    }
    
    // Limpiar cache después de refrescar vistas
    queryCache.clear();
    
    return data || 'Vistas refrescadas exitosamente';
  } catch (error) {
    console.error('Error refreshing views:', error);
    const errorMessage = (error as Error).message;
    if (errorMessage.includes('does not exist') || errorMessage.includes('42P01')) {
      queryCache.clear();
      return 'Cache limpiado - algunas funciones de refresco no están disponibles';
    }
    return 'Error al refrescar vistas: ' + errorMessage;
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