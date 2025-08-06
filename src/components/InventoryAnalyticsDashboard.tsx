import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Package, DollarSign, AlertTriangle, Target, Zap, Brain, Eye, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { ProductWithCategory } from '../lib/types';

interface InventoryMetrics {
  total_value_retail: number;
  total_value_cost: number;
  total_products: number;
  total_stock_units: number;
  average_margin: number;
  top_categories: Array<{
    name: string;
    product_count: number;
    total_value: number;
    avg_margin: number;
  }>;
  stock_distribution: {
    in_stock: number;
    low_stock: number;
    out_of_stock: number;
    overstock: number;
  };
  profitability_analysis: {
    high_margin_products: number;
    medium_margin_products: number;
    low_margin_products: number;
    no_margin_data: number;
  };
  reorder_suggestions: Array<{
    product_name: string;
    current_stock: number;
    suggested_quantity: number;
    priority: 'high' | 'medium' | 'low';
  }>;
}

interface InventoryAnalyticsDashboardProps {
  products: ProductWithCategory[];
  onProductAction: (productId: string, action: string) => void;
}

export default function InventoryAnalyticsDashboard({ products, onProductAction }: InventoryAnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    calculateMetrics();
  }, [products, selectedTimeframe]);

  const calculateMetrics = () => {
    setLoading(true);
    
    try {
      // Calcular valor total del inventario
      const totalValueRetail = products.reduce((sum, p) => sum + (p.sale_price * p.stock), 0);
      const totalValueCost = products.reduce((sum, p) => sum + ((p.purchase_price || 0) * p.stock), 0);
      
      // Calcular margen promedio
      const productsWithMargin = products.filter(p => p.purchase_price && p.purchase_price > 0);
      const averageMargin = productsWithMargin.length > 0 
        ? productsWithMargin.reduce((sum, p) => {
            const margin = ((p.sale_price - (p.purchase_price || 0)) / (p.purchase_price || 1)) * 100;
            return sum + margin;
          }, 0) / productsWithMargin.length
        : 0;

      // Análisis por categorías
      const categoryMap = new Map<string, any>();
      products.forEach(product => {
        const categoryName = product.category?.name || 'Sin Categoría';
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, {
            name: categoryName,
            product_count: 0,
            total_value: 0,
            total_margin: 0,
            products_with_margin: 0
          });
        }
        
        const category = categoryMap.get(categoryName);
        category.product_count++;
        category.total_value += p.sale_price * p.stock;
        
        if (product.purchase_price) {
          const margin = ((product.sale_price - product.purchase_price) / product.purchase_price) * 100;
          category.total_margin += margin;
          category.products_with_margin++;
        }
      });

      const topCategories = Array.from(categoryMap.values())
        .map(cat => ({
          ...cat,
          avg_margin: cat.products_with_margin > 0 ? cat.total_margin / cat.products_with_margin : 0
        }))
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, 5);

      // Distribución de stock
      const stockDistribution = {
        in_stock: products.filter(p => p.stock > 10).length,
        low_stock: products.filter(p => p.stock > 0 && p.stock <= 10).length,
        out_of_stock: products.filter(p => p.stock === 0).length,
        overstock: products.filter(p => p.stock > 50).length
      };

      // Análisis de rentabilidad
      const profitabilityAnalysis = {
        high_margin_products: products.filter(p => {
          if (!p.purchase_price) return false;
          const margin = ((p.sale_price - p.purchase_price) / p.purchase_price) * 100;
          return margin > 30;
        }).length,
        medium_margin_products: products.filter(p => {
          if (!p.purchase_price) return false;
          const margin = ((p.sale_price - p.purchase_price) / p.purchase_price) * 100;
          return margin >= 15 && margin <= 30;
        }).length,
        low_margin_products: products.filter(p => {
          if (!p.purchase_price) return false;
          const margin = ((p.sale_price - p.purchase_price) / p.purchase_price) * 100;
          return margin < 15 && margin > 0;
        }).length,
        no_margin_data: products.filter(p => !p.purchase_price || p.purchase_price === 0).length
      };

      // Sugerencias de reorden inteligentes
      const reorderSuggestions = products
        .filter(p => p.stock <= 5)
        .map(p => {
          // Calcular cantidad sugerida basada en precio y rotación estimada
          const baseQuantity = p.sale_price > 1000000 ? 5 : p.sale_price > 500000 ? 10 : 20;
          const adjustedQuantity = Math.max(5, Math.min(baseQuantity, 50));
          
          return {
            product_name: p.name,
            current_stock: p.stock,
            suggested_quantity: adjustedQuantity,
            priority: (p.stock === 0 ? 'high' : p.stock <= 2 ? 'medium' : 'low') as 'high' | 'medium' | 'low'
          };
        })
        .sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        })
        .slice(0, 10);

      const calculatedMetrics: InventoryMetrics = {
        total_value_retail: totalValueRetail,
        total_value_cost: totalValueCost,
        total_products: products.length,
        total_stock_units: products.reduce((sum, p) => sum + p.stock, 0),
        average_margin: averageMargin,
        top_categories: topCategories,
        stock_distribution: stockDistribution,
        profitability_analysis: profitabilityAnalysis,
        reorder_suggestions: reorderSuggestions
      };

      setMetrics(calculatedMetrics);
    } catch (error) {
      console.error('Error calculating metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas Principales */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
              Análisis Inteligente de Inventario
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value as any)}
                className="px-3 py-1 border border-slate-300 rounded text-sm"
              >
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 90 días</option>
              </select>
              <button
                onClick={calculateMetrics}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Valor Total (Venta)</p>
                  <p className="text-xl font-bold text-green-900">
                    {formatCurrency(metrics.total_value_retail)}
                  </p>
                  <p className="text-xs text-green-700">
                    {metrics.total_stock_units.toLocaleString()} unidades
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Inversión Total</p>
                  <p className="text-xl font-bold text-blue-900">
                    {formatCurrency(metrics.total_value_cost)}
                  </p>
                  <p className="text-xs text-blue-700">
                    Ganancia potencial: {formatCurrency(metrics.total_value_retail - metrics.total_value_cost)}
                  </p>
                </div>
                <Package className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Margen Promedio</p>
                  <p className="text-xl font-bold text-purple-900">
                    {metrics.average_margin.toFixed(1)}%
                  </p>
                  <p className="text-xs text-purple-700">
                    {metrics.profitability_analysis.high_margin_products} productos alto margen
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Productos Críticos</p>
                  <p className="text-xl font-bold text-orange-900">
                    {metrics.stock_distribution.low_stock + metrics.stock_distribution.out_of_stock}
                  </p>
                  <p className="text-xs text-orange-700">
                    {metrics.stock_distribution.out_of_stock} sin stock
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Distribución de Stock */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <h4 className="font-semibold text-slate-900">Distribución de Stock</h4>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-2xl font-bold text-green-900">{metrics.stock_distribution.in_stock}</p>
              <p className="text-sm text-green-700">Stock Normal (>10)</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-2xl font-bold text-yellow-900">{metrics.stock_distribution.low_stock}</p>
              <p className="text-sm text-yellow-700">Stock Bajo (1-10)</p>
            </div>
            <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-2xl font-bold text-red-900">{metrics.stock_distribution.out_of_stock}</p>
              <p className="text-sm text-red-700">Sin Stock (0)</p>
            </div>
            <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-2xl font-bold text-blue-900">{metrics.stock_distribution.overstock}</p>
              <p className="text-sm text-blue-700">Sobrestock (>50)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Categorías */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <h4 className="font-semibold text-slate-900">Categorías de Mayor Rendimiento</h4>
        </div>
        <div className="p-6">
          {metrics.top_categories.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No hay datos de categorías disponibles</p>
            </div>
          ) : (
            <div className="space-y-4">
              {metrics.top_categories.map((category, index) => (
                <div key={category.name} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <h5 className="font-medium text-slate-900">{category.name}</h5>
                      <p className="text-sm text-slate-600">
                        {category.product_count} productos • Margen promedio: {category.avg_margin.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{formatCurrency(category.total_value)}</p>
                    <p className="text-xs text-slate-500">Valor total</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Análisis de Rentabilidad */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <h4 className="font-semibold text-slate-900">Análisis de Rentabilidad</h4>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
              <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-xl font-bold text-green-900">{metrics.profitability_analysis.high_margin_products}</p>
              <p className="text-sm text-green-700">Alto Margen (>30%)</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <BarChart3 className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-xl font-bold text-yellow-900">{metrics.profitability_analysis.medium_margin_products}</p>
              <p className="text-sm text-yellow-700">Margen Medio (15-30%)</p>
            </div>
            <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
              <TrendingDown className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <p className="text-xl font-bold text-red-900">{metrics.profitability_analysis.low_margin_products}</p>
              <p className="text-sm text-red-700">Bajo Margen (<15%)</p>
            </div>
            <div className="text-center p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <AlertTriangle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xl font-bold text-slate-900">{metrics.profitability_analysis.no_margin_data}</p>
              <p className="text-sm text-slate-700">Sin Datos de Costo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sugerencias de Reorden */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <h4 className="font-semibold text-slate-900 flex items-center">
            <Brain className="h-5 w-5 mr-2 text-purple-600" />
            Sugerencias Inteligentes de Reorden
          </h4>
        </div>
        <div className="p-6">
          {metrics.reorder_suggestions.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <p className="text-green-600 font-medium">¡Inventario bien abastecido!</p>
              <p className="text-sm text-slate-600 mt-1">No hay productos que requieran reorden urgente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.reorder_suggestions.map((suggestion, index) => (
                <div key={index} className={`flex items-center justify-between p-4 rounded-lg border ${
                  suggestion.priority === 'high' ? 'bg-red-50 border-red-200' :
                  suggestion.priority === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      suggestion.priority === 'high' ? 'bg-red-600' :
                      suggestion.priority === 'medium' ? 'bg-yellow-600' :
                      'bg-blue-600'
                    }`}>
                      {suggestion.priority === 'high' ? '!' : 
                       suggestion.priority === 'medium' ? '⚠' : 'i'}
                    </div>
                    <div>
                      <h5 className="font-medium text-slate-900">{suggestion.product_name}</h5>
                      <p className="text-sm text-slate-600">
                        Stock actual: {suggestion.current_stock} • Sugerido: {suggestion.suggested_quantity}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onProductAction(suggestion.product_name, 'view')}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors duration-200"
                      title="Ver producto"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onProductAction(suggestion.product_name, 'reorder')}
                      className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-xs"
                    >
                      Reabastecer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Insights Adicionales */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
        <h4 className="font-bold text-purple-900 mb-4 flex items-center">
          <Lightbulb className="h-5 w-5 mr-2" />
          Insights Inteligentes
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-purple-200 rounded-lg p-4">
            <h5 className="font-medium text-purple-900 mb-2">Oportunidades de Crecimiento</h5>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• {metrics.profitability_analysis.high_margin_products} productos con excelente margen para promocionar</li>
              <li>• {metrics.stock_distribution.overstock} productos con sobrestock para ofertas especiales</li>
              <li>• Potencial de ganancia: {formatCurrency(metrics.total_value_retail - metrics.total_value_cost)}</li>
            </ul>
          </div>
          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <h5 className="font-medium text-blue-900 mb-2">Alertas y Recomendaciones</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• {metrics.reorder_suggestions.filter(s => s.priority === 'high').length} productos requieren reorden urgente</li>
              <li>• {metrics.profitability_analysis.low_margin_products} productos necesitan revisión de precios</li>
              <li>• {metrics.profitability_analysis.no_margin_data} productos sin datos de costo</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}