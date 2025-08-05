import React, { useState, useEffect } from 'react';
import { Brain, Zap, TrendingUp, Target, Lightbulb, BarChart3, Package, AlertTriangle, CheckCircle, RefreshCw, Wand2, Search, Filter, Eye, Plus, Settings } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { Category, Product } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import {
  suggestCategory,
  autoClassifyProduct,
  analyzeCategoryPerformance,
  optimizeCategoryStructure,
  generateMarketInsights,
  findAndClassifyUncategorizedProducts,
  applyBulkAutoClassification,
  createIntelligentCategory,
  type CategorySuggestion,
  type CategoryAnalytics
} from '../lib/intelligentCategories';

export default function IntelligentCategoryManager() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [analytics, setAnalytics] = useState<CategoryAnalytics[]>([]);
  const [uncategorizedProducts, setUncategorizedProducts] = useState<any[]>([]);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'analytics' | 'optimization' | 'classification' | 'insights'>('analytics');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [marketInsights, setMarketInsights] = useState<any>(null);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [autoClassificationResults, setAutoClassificationResults] = useState<any>(null);

  useEffect(() => {
    loadIntelligentData();
  }, []);

  const loadIntelligentData = async () => {
    try {
      setLoading(true);
      
      // Cargar datos básicos
      await Promise.all([
        loadCategories(),
        loadCategoryAnalytics(),
        loadUncategorizedProducts(),
        loadOptimizationSuggestions()
      ]);
    } catch (error) {
      console.error('Error loading intelligent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      if (isDemoMode) {
        const demoCategories = [
          { id: 'demo-cat-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
          { id: 'demo-cat-2', name: 'Accesorios', description: 'Accesorios tecnológicos', created_at: new Date().toISOString() },
          { id: 'demo-cat-3', name: 'Audio', description: 'Equipos de audio', created_at: new Date().toISOString() }
        ];
        setCategories(demoCategories);
        return;
      }

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadCategoryAnalytics = async () => {
    try {
      const analyticsData = await analyzeCategoryPerformance();
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const loadUncategorizedProducts = async () => {
    try {
      const uncategorized = await findAndClassifyUncategorizedProducts();
      setUncategorizedProducts(uncategorized);
    } catch (error) {
      console.error('Error loading uncategorized products:', error);
    }
  };

  const loadOptimizationSuggestions = async () => {
    try {
      const optimization = await optimizeCategoryStructure();
      setOptimizationSuggestions(optimization);
    } catch (error) {
      console.error('Error loading optimization suggestions:', error);
    }
  };

  const loadMarketInsights = async (categoryId: string) => {
    try {
      setRunningAnalysis(true);
      const insights = await generateMarketInsights(categoryId);
      setMarketInsights(insights);
    } catch (error) {
      console.error('Error loading market insights:', error);
    } finally {
      setRunningAnalysis(false);
    }
  };

  const runAutoClassification = async () => {
    try {
      setRunningAnalysis(true);
      
      if (uncategorizedProducts.length === 0) {
        alert('No hay productos sin categoría para clasificar');
        return;
      }

      const classifications = uncategorizedProducts
        .filter(item => item.auto_classification.confidence >= 70)
        .map(item => ({
          product_id: item.product.id,
          category_id: item.auto_classification.category_id,
          confidence: item.auto_classification.confidence
        }));

      if (classifications.length === 0) {
        alert('No hay productos con suficiente confianza para clasificación automática');
        return;
      }

      const result = await applyBulkAutoClassification(classifications, 70);
      setAutoClassificationResults(result);

      if (result.success) {
        alert(`Clasificación automática completada: ${result.processed} productos procesados`);
        await loadUncategorizedProducts();
      } else {
        alert(`Clasificación parcial: ${result.processed} procesados, ${result.errors.length} errores`);
      }
    } catch (error) {
      console.error('Error in auto classification:', error);
      alert('Error en clasificación automática: ' + (error as Error).message);
    } finally {
      setRunningAnalysis(false);
    }
  };

  const createCategoryFromSuggestion = async (suggestion: CategorySuggestion) => {
    try {
      const result = await createIntelligentCategory(suggestion, user?.id || '');
      
      if (result.success) {
        alert(`Categoría "${suggestion.suggested_name}" creada exitosamente`);
        await loadCategories();
      } else {
        alert('Error al crear categoría: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Error al crear categoría: ' + (error as Error).message);
    }
  };

  const getPerformanceColor = (value: number, type: 'revenue' | 'margin' | 'growth') => {
    switch (type) {
      case 'revenue':
        if (value > 5000000) return 'text-green-600';
        if (value > 1000000) return 'text-yellow-600';
        return 'text-red-600';
      case 'margin':
        if (value > 30) return 'text-green-600';
        if (value > 15) return 'text-yellow-600';
        return 'text-red-600';
      case 'growth':
        if (value > 10) return 'text-green-600';
        if (value > 0) return 'text-yellow-600';
        return 'text-red-600';
      default:
        return 'text-slate-600';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const tabs = [
    { id: 'analytics', label: 'Análisis Inteligente', icon: BarChart3, description: 'Métricas y rendimiento' },
    { id: 'classification', label: 'Clasificación IA', icon: Brain, description: 'Clasificación automática' },
    { id: 'optimization', label: 'Optimización', icon: Zap, description: 'Sugerencias de mejora' },
    { id: 'insights', label: 'Insights de Mercado', icon: Target, description: 'Análisis de mercado' }
  ];

  return (
    <div className="space-y-6">
      {/* Header Inteligente */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-sm text-white p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center">
              <Brain className="h-8 w-8 mr-3" />
              Sistema Inteligente de Categorías
              {isDemoMode && (
                <span className="ml-3 text-sm bg-yellow-500 text-yellow-900 px-3 py-1 rounded-full">
                  IA DEMO
                </span>
              )}
            </h1>
            <p className="text-purple-100 text-lg">
              Clasificación automática, análisis predictivo y optimización inteligente
            </p>
            <div className="flex items-center gap-6 mt-4 text-sm">
              <div className="flex items-center">
                <Zap className="h-4 w-4 mr-2" />
                <span>Clasificación automática</span>
              </div>
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                <span>Análisis predictivo</span>
              </div>
              <div className="flex items-center">
                <Target className="h-4 w-4 mr-2" />
                <span>Insights de mercado</span>
              </div>
              <div className="flex items-center">
                <Lightbulb className="h-4 w-4 mr-2" />
                <span>Recomendaciones inteligentes</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-purple-100 text-sm">Productos sin categoría:</p>
              <p className="text-2xl font-bold">{uncategorizedProducts.length}</p>
              <p className="text-purple-200 text-xs">Listos para clasificación IA</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación por Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex flex-col items-center px-6 py-4 text-sm font-medium transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-5 w-5 mb-1" />
                  <span>{tab.label}</span>
                  <span className="text-xs text-slate-500 mt-1 text-center">
                    {tab.description}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Tab: Análisis Inteligente */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Análisis de Rendimiento por Categoría</h3>
                <button
                  onClick={loadCategoryAnalytics}
                  disabled={loading}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar Análisis
                </button>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse border">
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
                      <div className="h-8 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : analytics.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">No hay datos de análisis disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {analytics.map((category) => (
                    <div key={category.category_id} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-slate-900">{category.category_name}</h4>
                        <button
                          onClick={() => {
                            setSelectedCategory(category.category_id);
                            loadMarketInsights(category.category_id);
                          }}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                          title="Ver insights detallados"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Productos:</span>
                          <span className="font-bold text-slate-900">{category.product_count}</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Ingresos:</span>
                          <span className={`font-bold ${getPerformanceColor(category.total_revenue, 'revenue')}`}>
                            {formatCurrency(category.total_revenue)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Margen:</span>
                          <span className={`font-bold ${getPerformanceColor(category.profit_margin, 'margin')}`}>
                            {category.profit_margin.toFixed(1)}%
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">Participación:</span>
                          <span className="font-bold text-purple-600">
                            {category.market_share.toFixed(1)}%
                          </span>
                        </div>

                        <div className="pt-3 border-t border-slate-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Tendencia:</span>
                            <div className="flex items-center">
                              {category.growth_trend === 'increasing' ? (
                                <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                              ) : category.growth_trend === 'decreasing' ? (
                                <TrendingUp className="h-4 w-4 text-red-600 mr-1 rotate-180" />
                              ) : (
                                <div className="h-4 w-4 bg-yellow-500 rounded-full mr-1"></div>
                              )}
                              <span className={`text-sm font-medium ${
                                category.growth_trend === 'increasing' ? 'text-green-600' :
                                category.growth_trend === 'decreasing' ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {category.growth_trend === 'increasing' ? 'Creciendo' :
                                 category.growth_trend === 'decreasing' ? 'Decreciendo' : 'Estable'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Recomendaciones principales */}
                        {category.recommendations.length > 0 && (
                          <div className="pt-3 border-t border-slate-200">
                            <p className="text-xs text-slate-500 mb-2">Recomendación principal:</p>
                            <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                              {category.recommendations[0]}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Clasificación IA */}
          {activeTab === 'classification' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Clasificación Automática con IA</h3>
                <div className="flex gap-2">
                  <button
                    onClick={loadUncategorizedProducts}
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                  </button>
                  <button
                    onClick={runAutoClassification}
                    disabled={runningAnalysis || uncategorizedProducts.length === 0}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                  >
                    {runningAnalysis ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Clasificando...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Clasificar Automáticamente
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Resultados de Clasificación Automática */}
              {autoClassificationResults && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                  <h4 className="font-bold text-green-900 mb-3">Resultados de Clasificación Automática</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-900">{autoClassificationResults.processed}</p>
                      <p className="text-sm text-green-700">Productos Clasificados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-900">{autoClassificationResults.skipped}</p>
                      <p className="text-sm text-yellow-700">Omitidos (baja confianza)</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-900">{autoClassificationResults.errors.length}</p>
                      <p className="text-sm text-red-700">Errores</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Productos Sin Categoría */}
              <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-6 border-b border-slate-200">
                  <h4 className="text-lg font-semibold text-slate-900">
                    Productos Sin Categoría ({uncategorizedProducts.length})
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    La IA analizará estos productos y sugerirá categorías automáticamente
                  </p>
                </div>
                <div className="p-6">
                  {uncategorizedProducts.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                      <p className="text-green-600 font-medium">¡Todos los productos están categorizados!</p>
                      <p className="text-sm text-slate-600 mt-1">El sistema IA ha clasificado exitosamente todos los productos</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {uncategorizedProducts.slice(0, 10).map((item) => (
                        <div key={item.product.id} className="border border-slate-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-semibold text-slate-900">{item.product.name}</h5>
                              <p className="text-sm text-slate-600 mt-1">{item.product.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                <span className="text-green-600 font-medium">
                                  {formatCurrency(item.product.sale_price)}
                                </span>
                                <span className="text-slate-600">Stock: {item.product.stock}</span>
                              </div>
                            </div>
                            
                            <div className="ml-4 text-right">
                              {item.suggestions.length > 0 && (
                                <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(item.suggestions[0].confidence)}`}>
                                  IA: {item.suggestions[0].confidence.toFixed(0)}% confianza
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Sugerencias de IA */}
                          {item.suggestions.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-slate-900">
                                    Sugerencia IA: <span className="text-purple-600">{item.suggestions[0].suggested_name}</span>
                                  </p>
                                  <p className="text-xs text-slate-600 mt-1">{item.suggestions[0].reasoning}</p>
                                  {item.suggestions[0].keywords_matched.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {item.suggestions[0].keywords_matched.map((keyword, index) => (
                                        <span key={index} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                          {keyword}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex gap-2 ml-4">
                                  <button
                                    onClick={() => createCategoryFromSuggestion(item.suggestions[0])}
                                    className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 text-xs"
                                  >
                                    Crear Categoría
                                  </button>
                                  {item.auto_classification.category_id && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          if (isDemoMode) {
                                            alert('Clasificación aplicada en modo demo');
                                            return;
                                          }

                                          const { error } = await supabase
                                            .from('products')
                                            .update({ category_id: item.auto_classification.category_id })
                                            .eq('id', item.product.id);

                                          if (error) throw error;
                                          
                                          alert('Producto clasificado exitosamente');
                                          loadUncategorizedProducts();
                                        } catch (error) {
                                          alert('Error al clasificar: ' + (error as Error).message);
                                        }
                                      }}
                                      className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-xs"
                                    >
                                      Aplicar
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {uncategorizedProducts.length > 10 && (
                        <div className="text-center pt-4 border-t border-slate-200">
                          <p className="text-sm text-slate-600">
                            Mostrando 10 de {uncategorizedProducts.length} productos sin categoría
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Optimización */}
          {activeTab === 'optimization' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Optimización de Estructura</h3>
                <button
                  onClick={loadOptimizationSuggestions}
                  disabled={loading}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Analizar Optimizaciones
                </button>
              </div>

              {optimizationSuggestions ? (
                <div className="space-y-6">
                  {/* Impacto de Rendimiento */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h4 className="font-bold text-blue-900 mb-2">Impacto de Rendimiento</h4>
                    <p className="text-blue-800">{optimizationSuggestions.performance_impact}</p>
                  </div>

                  {/* Sugerencias de Optimización */}
                  {optimizationSuggestions.optimization_suggestions.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                      <p className="text-green-600 font-medium">¡Estructura de categorías optimizada!</p>
                      <p className="text-sm text-slate-600 mt-1">No se encontraron mejoras necesarias</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {optimizationSuggestions.optimization_suggestions.map((suggestion: any, index: number) => (
                        <div key={index} className={`border rounded-lg p-6 ${
                          suggestion.impact === 'high' ? 'border-red-200 bg-red-50' :
                          suggestion.impact === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                          'border-blue-200 bg-blue-50'
                        }`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h5 className="font-bold text-slate-900 capitalize">{suggestion.type}</h5>
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                  suggestion.impact === 'high' ? 'bg-red-100 text-red-800' :
                                  suggestion.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  Impacto {suggestion.impact}
                                </span>
                              </div>
                              
                              <p className="text-slate-700 mb-2">{suggestion.suggested_action}</p>
                              <p className="text-sm text-slate-600">{suggestion.reasoning}</p>
                              
                              <div className="mt-3">
                                <p className="text-xs text-slate-500 mb-1">Categorías afectadas:</p>
                                <div className="flex flex-wrap gap-1">
                                  {suggestion.current_categories.map((catName: string, catIndex: number) => (
                                    <span key={catIndex} className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">
                                      {catName}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => {
                                if (isDemoMode) {
                                  alert('Optimización aplicada en modo demo');
                                  return;
                                }
                                alert('Funcionalidad de aplicación automática en desarrollo');
                              }}
                              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm"
                            >
                              Aplicar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Zap className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">Haz clic en "Analizar Optimizaciones" para comenzar</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Insights de Mercado */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Insights de Mercado</h3>
                <div className="flex gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      if (e.target.value) {
                        loadMarketInsights(e.target.value);
                      }
                    }}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!selectedCategory ? (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">Selecciona una categoría para ver insights detallados</p>
                </div>
              ) : runningAnalysis ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Generando insights de mercado...</p>
                </div>
              ) : marketInsights ? (
                <div className="space-y-6">
                  {/* Pronóstico de Demanda */}
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h4 className="font-bold text-slate-900 mb-4 flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                      Pronóstico de Demanda
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-600 mb-1">Próximo Mes</p>
                        <p className={`text-xl font-bold ${
                          marketInsights.demand_forecast.next_month === 'high' ? 'text-green-900' :
                          marketInsights.demand_forecast.next_month === 'medium' ? 'text-yellow-900' : 'text-red-900'
                        }`}>
                          {marketInsights.demand_forecast.next_month === 'high' ? 'Alta' :
                           marketInsights.demand_forecast.next_month === 'medium' ? 'Media' : 'Baja'}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-600 mb-1">Crecimiento Predicho</p>
                        <p className="text-xl font-bold text-blue-900">
                          {marketInsights.demand_forecast.growth_prediction.toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm text-purple-600 mb-1">Patrón Estacional</p>
                        <p className="text-sm text-purple-900 font-medium">
                          {marketInsights.demand_forecast.seasonal_pattern}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Análisis Competitivo */}
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h4 className="font-bold text-slate-900 mb-4 flex items-center">
                      <Target className="h-5 w-5 mr-2 text-blue-600" />
                      Análisis Competitivo
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="font-medium text-slate-900 mb-3">Posición en el Mercado</h5>
                        <p className="text-slate-700 mb-2">{marketInsights.competitive_analysis.market_position}</p>
                        <div className="flex items-center">
                          <span className="text-sm text-slate-600 mr-2">Competitividad de Precios:</span>
                          <span className="font-bold text-blue-600">
                            {marketInsights.competitive_analysis.price_competitiveness}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <h5 className="font-medium text-slate-900 mb-3">Oportunidades de Diferenciación</h5>
                        <ul className="space-y-1">
                          {marketInsights.competitive_analysis.differentiation_opportunities.map((opportunity: string, index: number) => (
                            <li key={index} className="text-sm text-slate-700 flex items-center">
                              <Lightbulb className="h-3 w-3 text-yellow-500 mr-2" />
                              {opportunity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Recomendaciones de Inventario */}
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h4 className="font-bold text-slate-900 mb-4 flex items-center">
                      <Package className="h-5 w-5 mr-2 text-orange-600" />
                      Recomendaciones de Inventario
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="font-medium text-slate-900 mb-3">Sugerencias de Reorden</h5>
                        {marketInsights.inventory_recommendations.reorder_suggestions.length === 0 ? (
                          <p className="text-sm text-slate-600">No hay sugerencias de reorden</p>
                        ) : (
                          <div className="space-y-2">
                            {marketInsights.inventory_recommendations.reorder_suggestions.map((suggestion: any, index: number) => (
                              <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-orange-900">{suggestion.product_name}</p>
                                    <p className="text-sm text-orange-700">{suggestion.reasoning}</p>
                                  </div>
                                  <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded text-xs font-bold">
                                    {suggestion.suggested_quantity} unidades
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <h5 className="font-medium text-slate-900 mb-3">Oportunidades de Nuevos Productos</h5>
                        <ul className="space-y-2">
                          {marketInsights.inventory_recommendations.new_product_opportunities.map((opportunity: string, index: number) => (
                            <li key={index} className="text-sm text-slate-700 flex items-center bg-green-50 border border-green-200 rounded-lg p-2">
                              <Plus className="h-3 w-3 text-green-600 mr-2" />
                              {opportunity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">Selecciona una categoría para generar insights</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Información del Sistema IA */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Brain className="h-5 w-5 mr-2 text-purple-600" />
          Sistema de Inteligencia Artificial
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Clasificación IA</p>
                <p className="font-bold text-purple-900">Activa</p>
              </div>
              <Brain className="h-6 w-6 text-purple-600" />
            </div>
          </div>

          <div className="bg-white border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Análisis Predictivo</p>
                <p className="font-bold text-green-900">Tiempo Real</p>
              </div>
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>

          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Optimización</p>
                <p className="font-bold text-blue-900">Automática</p>
              </div>
              <Zap className="h-6 w-6 text-blue-600" />
            </div>
          </div>

          <div className="bg-white border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600">Insights</p>
                <p className="font-bold text-orange-900">Avanzados</p>
              </div>
              <Target className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="font-medium text-purple-900 mb-2">Características del Sistema IA</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-purple-800">
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Clasificación automática por palabras clave</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Análisis de similitud de productos</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Optimización de estructura automática</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Pronósticos de demanda basados en datos</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Análisis competitivo inteligente</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Recomendaciones de inventario predictivas</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Detección de patrones estacionales</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Validación automática de coherencia</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Sugerencias de precios inteligentes</span>
            </div>
          </div>
        </div>

        {isDemoMode && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">Modo Demo IA Activo</h4>
            <p className="text-sm text-yellow-800">
              Estás viendo el sistema de inteligencia artificial con datos simulados. 
              Para usar la IA completa con datos reales, configura las variables de entorno de Supabase.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}