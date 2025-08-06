import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Zap, BarChart3, Package, DollarSign, Brain, Lightbulb } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { ProductWithCategory } from '../lib/types';

interface InventoryInsight {
  type: 'reorder' | 'overstock' | 'price_optimization' | 'category_suggestion' | 'profit_opportunity';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  action: string;
  products_affected: number;
  estimated_benefit: number;
  confidence: number;
}

interface SmartInventoryInsightsProps {
  products: ProductWithCategory[];
  onApplyInsight: (insight: InventoryInsight) => void;
}

export default function SmartInventoryInsights({ products, onApplyInsight }: SmartInventoryInsightsProps) {
  const [insights, setInsights] = useState<InventoryInsight[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateInsights();
  }, [products]);

  const generateInsights = () => {
    setLoading(true);
    
    const newInsights: InventoryInsight[] = [];

    // Insight 1: Productos para reorden
    const lowStockProducts = products.filter(p => p.stock <= 5 && p.stock > 0);
    if (lowStockProducts.length > 0) {
      const totalValue = lowStockProducts.reduce((sum, p) => sum + (p.sale_price * 10), 0);
      newInsights.push({
        type: 'reorder',
        title: 'Productos Necesitan Reabastecimiento',
        description: `${lowStockProducts.length} productos tienen stock crítico y necesitan reorden urgente`,
        impact: 'high',
        action: 'Reabastecer inventario para evitar pérdida de ventas',
        products_affected: lowStockProducts.length,
        estimated_benefit: totalValue * 0.3, // 30% de ganancia estimada
        confidence: 95
      });
    }

    // Insight 2: Productos con sobrestock
    const overstockProducts = products.filter(p => p.stock > 50);
    if (overstockProducts.length > 0) {
      const tiedCapital = overstockProducts.reduce((sum, p) => sum + ((p.purchase_price || 0) * p.stock), 0);
      newInsights.push({
        type: 'overstock',
        title: 'Capital Inmovilizado en Sobrestock',
        description: `${overstockProducts.length} productos tienen stock excesivo que inmoviliza capital`,
        impact: 'medium',
        action: 'Considerar promociones o descuentos para rotar inventario',
        products_affected: overstockProducts.length,
        estimated_benefit: tiedCapital * 0.15, // 15% de liberación de capital
        confidence: 80
      });
    }

    // Insight 3: Optimización de precios
    const lowMarginProducts = products.filter(p => {
      if (!p.purchase_price) return false;
      const margin = ((p.sale_price - p.purchase_price) / p.purchase_price) * 100;
      return margin < 15 && margin > 0;
    });
    if (lowMarginProducts.length > 0) {
      const potentialIncrease = lowMarginProducts.reduce((sum, p) => sum + (p.sale_price * 0.1 * p.stock), 0);
      newInsights.push({
        type: 'price_optimization',
        title: 'Oportunidad de Optimización de Precios',
        description: `${lowMarginProducts.length} productos tienen margen bajo y podrían optimizarse`,
        impact: 'medium',
        action: 'Revisar y ajustar precios para mejorar rentabilidad',
        products_affected: lowMarginProducts.length,
        estimated_benefit: potentialIncrease,
        confidence: 75
      });
    }

    // Insight 4: Productos sin categoría
    const uncategorizedProducts = products.filter(p => !p.category_id);
    if (uncategorizedProducts.length > 0) {
      newInsights.push({
        type: 'category_suggestion',
        title: 'Productos Sin Categorizar',
        description: `${uncategorizedProducts.length} productos necesitan categorización para mejor organización`,
        impact: 'low',
        action: 'Usar IA para clasificar automáticamente',
        products_affected: uncategorizedProducts.length,
        estimated_benefit: 0,
        confidence: 90
      });
    }

    // Insight 5: Oportunidades de ganancia
    const highMarginProducts = products.filter(p => {
      if (!p.purchase_price) return false;
      const margin = ((p.sale_price - p.purchase_price) / p.purchase_price) * 100;
      return margin > 50 && p.stock > 0;
    });
    if (highMarginProducts.length > 0) {
      const potentialProfit = highMarginProducts.reduce((sum, p) => {
        const profit = p.sale_price - (p.purchase_price || 0);
        return sum + (profit * Math.min(p.stock, 5)); // Estimado para 5 ventas
      }, 0);
      newInsights.push({
        type: 'profit_opportunity',
        title: 'Productos de Alta Rentabilidad',
        description: `${highMarginProducts.length} productos tienen excelente margen y deberían promocionarse`,
        impact: 'high',
        action: 'Enfocar marketing en estos productos de alta rentabilidad',
        products_affected: highMarginProducts.length,
        estimated_benefit: potentialProfit,
        confidence: 85
      });
    }

    setInsights(newInsights);
    setLoading(false);
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case 'low':
        return 'border-blue-200 bg-blue-50 text-blue-800';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-800';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'reorder':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'overstock':
        return <TrendingDown className="h-5 w-5 text-orange-600" />;
      case 'price_optimization':
        return <DollarSign className="h-5 w-5 text-green-600" />;
      case 'category_suggestion':
        return <Target className="h-5 w-5 text-blue-600" />;
      case 'profit_opportunity':
        return <TrendingUp className="h-5 w-5 text-purple-600" />;
      default:
        return <Lightbulb className="h-5 w-5 text-slate-600" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-20 bg-slate-200 rounded"></div>
          <div className="h-20 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6 text-center">
        <Brain className="h-12 w-12 text-green-400 mx-auto mb-4" />
        <h3 className="font-semibold text-green-900 mb-2">¡Inventario Optimizado!</h3>
        <p className="text-green-700">
          La IA no detectó oportunidades de mejora significativas en tu inventario actual.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="p-6 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center">
          <Brain className="h-5 w-5 mr-2 text-purple-600" />
          Insights Inteligentes del Inventario
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Análisis automático con recomendaciones basadas en IA
        </p>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <div key={index} className={`border rounded-lg p-4 ${getImpactColor(insight.impact)}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getInsightIcon(insight.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-bold text-slate-900">{insight.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                        insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        Impacto {insight.impact}
                      </span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-medium">
                        {insight.confidence}% confianza
                      </span>
                    </div>
                    
                    <p className="text-slate-700 mb-2">{insight.description}</p>
                    <p className="text-sm text-slate-600 mb-3">
                      <strong>Acción recomendada:</strong> {insight.action}
                    </p>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-600">
                        Productos afectados: <strong>{insight.products_affected}</strong>
                      </span>
                      {insight.estimated_benefit > 0 && (
                        <span className="text-green-600">
                          Beneficio estimado: <strong>{formatCurrency(insight.estimated_benefit)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => onApplyInsight(insight)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
                >
                  Aplicar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}