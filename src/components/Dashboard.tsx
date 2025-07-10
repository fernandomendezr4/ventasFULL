import React, { useState, useEffect } from 'react';
import { TrendingUp, Package, ShoppingCart, DollarSign, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Sale, Product, SaleWithItems } from '../lib/types';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProducts: 0,
    todaySales: 0,
    totalRevenue: 0,
  });
  const [recentSales, setRecentSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Cargar datos en paralelo
      const [
        salesCountResult,
        productsCountResult,
        todaySalesResult,
        allSalesResult,
        recentSalesResult
      ] = await Promise.all([
        supabase.from('sales').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('sales').select('total_amount').gte('created_at', new Date().toISOString().split('T')[0]),
        supabase.from('sales').select('total_amount'),
        supabase.from('sales').select(`
          *,
          sale_items (
            *,
            product:products (*)
          )
        `).order('created_at', { ascending: false }).limit(5)
      ]);

      const todaySalesSum = todaySalesResult.data?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;
      const totalRevenue = allSalesResult.data?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;

      setStats({
        totalSales: salesCountResult.count || 0,
        totalProducts: productsCountResult.count || 0,
        todaySales: todaySalesSum,
        totalRevenue,
      });

      setRecentSales((recentSalesResult.data as SaleWithItems[]) || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Establecer valores por defecto en caso de error
      setStats({
        totalSales: 0,
        totalProducts: 0,
        todaySales: 0,
        totalRevenue: 0,
      });
      setRecentSales([]);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total de Ventas',
      value: stats.totalSales,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Productos',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Ventas Hoy',
      value: `$${stats.todaySales.toFixed(2)}`,
      icon: Calendar,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Ingresos Totales',
      value: `$${stats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
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
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
        <div className="flex items-center text-sm text-slate-600">
          <Calendar className="h-4 w-4 mr-2" />
          {new Date().toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200"
            >
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
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
            Ventas Recientes
          </h3>
        </div>
        <div className="p-6">
          {recentSales.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No hay ventas registradas aún</p>
          ) : (
            <div className="space-y-4">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      Venta #{sale.id.slice(-8)}
                    </p>
                    <p className="text-sm text-slate-600">
                      {sale.sale_items.length} productos • {new Date(sale.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">${sale.total_amount.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}