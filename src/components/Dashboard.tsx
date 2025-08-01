import React, { useState, useEffect } from 'react';
import { TrendingUp, Package, ShoppingCart, DollarSign, Calendar, Users, AlertTriangle, CheckCircle, Plus, Calculator } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Sale, Product, SaleWithItems } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import { ListTransition } from './ViewTransition';

interface DashboardProps {
  onTabChange?: (tab: string) => void;
}

export default function Dashboard({ onTabChange }: DashboardProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProducts: 0,
    todaySales: 0,
    totalRevenue: 0,
    lowStockProducts: 0,
    totalCustomers: 0,
  });
  const [recentSales, setRecentSales] = useState<SaleWithItems[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Timeout para evitar carga infinita
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout loading dashboard data')), 10000);
      });
      
      // Cargar datos en paralelo
      const [
        salesCountResult,
        productsCountResult,
        customersCountResult,
        todaySalesResult,
        allSalesResult,
        recentSalesResult,
        lowStockResult
      ] = await Promise.all([
        supabase.from('sales').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('sales').select('total_amount').gte('created_at', new Date().toISOString().split('T')[0]),
        supabase.from('sales').select('total_amount'),
        supabase.from('sales').select(`
          *,
          sale_items (
            *,
            product:products (*)
          ),
          customer:customers (name)
        `).order('created_at', { ascending: false }).limit(5),
        supabase.from('products').select('*').lte('stock', 10).order('stock', { ascending: true }).limit(5)
      ]);

      const todaySalesSum = todaySalesResult.data?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;
      const totalRevenue = allSalesResult.data?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;

      setStats({
        totalSales: salesCountResult.count || 0,
        totalProducts: productsCountResult.count || 0,
        totalCustomers: customersCountResult.count || 0,
        todaySales: todaySalesSum,
        totalRevenue,
        lowStockProducts: lowStockResult.data?.length || 0,
      });

      setRecentSales((recentSalesResult.data as SaleWithItems[]) || []);
      setLowStockProducts(lowStockResult.data || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      
      // En caso de error, mostrar datos por defecto en lugar de quedarse cargando
      setStats({
        totalSales: 0,
        totalProducts: 0,
        totalCustomers: 0,
        todaySales: 0,
        totalRevenue: 0,
        lowStockProducts: 0,
      });
      setRecentSales([]);
      setLowStockProducts([]);
      
      // Mostrar mensaje de error al usuario
      if (error.message?.includes('Timeout')) {
        alert('La carga de datos está tomando mucho tiempo. Verifica tu conexión a internet.');
      }
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Ventas Hoy',
      value: formatCurrency(stats.todaySales),
      icon: Calendar,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
    },
    {
      title: 'Total Ventas',
      value: stats.totalSales,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    {
      title: 'Productos',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
    },
    {
      title: 'Clientes',
      value: stats.totalCustomers,
      icon: Users,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse border">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-slate-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-sm p-6 text-white smooth-appear">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-shadow">¡Bienvenido a VentasFULL!</h1>
            <p className="text-blue-100">
              Gestiona tu negocio de manera eficiente y organizada
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-shadow-lg animate-bounce-in">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-blue-100">Ingresos Totales</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <ListTransition staggerDelay={150}>
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className={`stat-card ${card.border}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">{card.title}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-full ${card.bg}`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </ListTransition>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="bg-white rounded-xl shadow-sm border content-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
              Ventas Recientes
            </h3>
          </div>
          <div className="p-6">
            {recentSales.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">No hay ventas registradas aún</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg card-hover">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <ShoppingCart className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            Venta #{sale.id.slice(-8)}
                          </p>
                          <p className="text-sm text-slate-600">
                            {sale.sale_items.length} productos • {new Date(sale.created_at).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                     <p className="font-bold text-slate-900">{formatCurrency(sale.total_amount)}</p>
                      <div className="flex items-center text-xs text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completada
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl shadow-sm border content-slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
              Productos con Poco Stock
            </h3>
          </div>
          <div className="p-6">
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">Todos los productos tienen stock suficiente</p>
              </div>
            ) : (
              <div className="space-y-4">
                {lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200 card-hover">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Package className="h-4 w-4 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{product.name}</p>
                          <p className="text-sm text-slate-600">{formatCurrency(product.sale_price)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${
                        product.stock === 0 
                          ? 'text-red-600' 
                          : product.stock <= 5 
                            ? 'text-orange-600' 
                            : 'text-yellow-600'
                      }`}>
                        {product.stock} unidades
                      </p>
                      <p className="text-xs text-slate-500">
                        {product.stock === 0 ? 'Sin stock' : 'Stock bajo'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {user?.role === 'admin' && onTabChange && (
        <div className="bg-white rounded-xl shadow-sm border p-6 content-slide-up" style={{ animationDelay: '0.5s' }}>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Acciones Rápidas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => onTabChange('new-sale')}
              className="flex items-center justify-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-all duration-200 ease-bounce group card-hover transform hover:scale-105"
            >
              <Plus className="h-5 w-5 text-green-600 mr-2 group-hover:scale-110 transition-all duration-200 ease-bounce" />
              <span className="font-medium text-green-700">Nueva Venta</span>
            </button>
            <button
              onClick={() => onTabChange('products')}
              className="flex items-center justify-center p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-all duration-200 ease-bounce group card-hover transform hover:scale-105"
            >
              <Package className="h-5 w-5 text-purple-600 mr-2 group-hover:scale-110 transition-all duration-200 ease-bounce" />
              <span className="font-medium text-purple-700">Gestionar Productos</span>
            </button>
            <button
              onClick={() => onTabChange('cash-register')}
              className="flex items-center justify-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all duration-200 ease-bounce group card-hover transform hover:scale-105"
            >
              <Calculator className="h-5 w-5 text-blue-600 mr-2 group-hover:scale-110 transition-all duration-200 ease-bounce" />
              <span className="font-medium text-blue-700">Abrir Caja</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}