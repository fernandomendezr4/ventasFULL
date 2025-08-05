// Sistema inteligente de categorías con IA y análisis automático

import { supabase, isDemoMode } from './supabase';
import { Category, Product } from './types';

export interface CategoryIntelligence {
  id: string;
  category_id: string;
  suggested_keywords: string[];
  auto_classification_rules: any;
  performance_metrics: {
    total_products: number;
    total_sales: number;
    average_price: number;
    profit_margin: number;
    growth_rate: number;
    seasonal_trends: any;
  };
  market_insights: {
    demand_level: 'low' | 'medium' | 'high';
    competition_level: 'low' | 'medium' | 'high';
    price_positioning: 'budget' | 'mid-range' | 'premium';
    recommendations: string[];
  };
  created_at: string;
  updated_at: string;
}

export interface CategorySuggestion {
  suggested_name: string;
  confidence: number;
  reasoning: string;
  keywords_matched: string[];
  similar_products: string[];
}

export interface CategoryAnalytics {
  category_id: string;
  category_name: string;
  product_count: number;
  total_revenue: number;
  average_product_price: number;
  best_selling_product: string;
  profit_margin: number;
  growth_trend: 'increasing' | 'stable' | 'decreasing';
  market_share: number;
  recommendations: string[];
}

// Palabras clave predefinidas para clasificación automática
const CATEGORY_KEYWORDS = {
  'smartphones': [
    'iphone', 'samsung', 'galaxy', 'android', 'ios', 'celular', 'móvil', 'smartphone',
    'teléfono', 'huawei', 'xiaomi', 'oppo', 'vivo', 'oneplus', 'pixel'
  ],
  'accesorios': [
    'cargador', 'cable', 'funda', 'protector', 'audífonos', 'auriculares',
    'power bank', 'soporte', 'adaptador', 'bluetooth', 'wireless'
  ],
  'tablets': [
    'tablet', 'ipad', 'galaxy tab', 'surface', 'kindle', 'e-reader'
  ],
  'laptops': [
    'laptop', 'notebook', 'macbook', 'dell', 'hp', 'lenovo', 'asus',
    'computador', 'portátil', 'ultrabook'
  ],
  'gaming': [
    'gaming', 'gamer', 'juego', 'consola', 'playstation', 'xbox', 'nintendo',
    'switch', 'ps5', 'ps4', 'control', 'joystick'
  ],
  'audio': [
    'parlante', 'speaker', 'bose', 'jbl', 'sony', 'beats', 'airpods',
    'música', 'sonido', 'amplificador', 'subwoofer'
  ],
  'hogar': [
    'smart home', 'alexa', 'google home', 'domótica', 'bombillo', 'led',
    'cámara', 'seguridad', 'wifi', 'router'
  ]
};

// Sugerir categoría basada en nombre y descripción del producto
export const suggestCategory = async (
  productName: string,
  productDescription: string = '',
  existingCategories: Category[] = []
): Promise<CategorySuggestion[]> => {
  try {
    const text = `${productName} ${productDescription}`.toLowerCase();
    const suggestions: CategorySuggestion[] = [];

    // Análisis por palabras clave
    for (const [categoryKey, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      const matchedKeywords = keywords.filter(keyword => 
        text.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        const confidence = Math.min(95, (matchedKeywords.length / keywords.length) * 100 + 20);
        
        // Buscar categoría existente similar
        const existingCategory = existingCategories.find(cat => 
          cat.name.toLowerCase().includes(categoryKey) ||
          keywords.some(keyword => cat.name.toLowerCase().includes(keyword))
        );

        suggestions.push({
          suggested_name: existingCategory?.name || getCategoryDisplayName(categoryKey),
          confidence,
          reasoning: `Detectadas ${matchedKeywords.length} palabras clave relacionadas con ${categoryKey}`,
          keywords_matched: matchedKeywords,
          similar_products: await findSimilarProducts(matchedKeywords)
        });
      }
    }

    // Análisis por productos similares existentes
    if (suggestions.length === 0) {
      const similarProductSuggestion = await suggestByProductSimilarity(
        productName, 
        productDescription, 
        existingCategories
      );
      
      if (similarProductSuggestion) {
        suggestions.push(similarProductSuggestion);
      }
    }

    // Si no hay sugerencias, crear una genérica
    if (suggestions.length === 0) {
      const genericCategory = generateGenericCategorySuggestion(productName);
      suggestions.push(genericCategory);
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  } catch (error) {
    console.error('Error suggesting category:', error);
    return [];
  }
};

// Encontrar productos similares
const findSimilarProducts = async (keywords: string[]): Promise<string[]> => {
  if (isDemoMode) {
    return ['Producto Demo 1', 'Producto Demo 2'];
  }

  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('products')
      .select('name')
      .or(keywords.map(keyword => `name.ilike.%${keyword}%`).join(','))
      .limit(5);

    if (error) return [];
    return (data || []).map(product => product.name);
  } catch (error) {
    return [];
  }
};

// Sugerir por similitud de productos
const suggestByProductSimilarity = async (
  productName: string,
  productDescription: string,
  existingCategories: Category[]
): Promise<CategorySuggestion | null> => {
  if (isDemoMode) {
    return {
      suggested_name: 'Electrónicos',
      confidence: 75,
      reasoning: 'Basado en productos similares en el sistema',
      keywords_matched: ['electrónico'],
      similar_products: ['Producto Demo Similar']
    };
  }

  if (!supabase) return null;

  try {
    // Buscar productos con nombres similares
    const searchTerms = productName.split(' ').filter(term => term.length > 3);
    
    if (searchTerms.length === 0) return null;

    const { data, error } = await supabase
      .from('products')
      .select(`
        name,
        category_id,
        category:categories(name)
      `)
      .or(searchTerms.map(term => `name.ilike.%${term}%`).join(','))
      .not('category_id', 'is', null)
      .limit(10);

    if (error || !data || data.length === 0) return null;

    // Encontrar la categoría más común
    const categoryCount = new Map<string, { name: string; count: number }>();
    
    data.forEach(product => {
      if (product.category) {
        const current = categoryCount.get(product.category_id) || { name: product.category.name, count: 0 };
        categoryCount.set(product.category_id, { ...current, count: current.count + 1 });
      }
    });

    if (categoryCount.size === 0) return null;

    const mostCommon = Array.from(categoryCount.entries())
      .sort((a, b) => b[1].count - a[1].count)[0];

    return {
      suggested_name: mostCommon[1].name,
      confidence: Math.min(90, (mostCommon[1].count / data.length) * 100),
      reasoning: `${mostCommon[1].count} productos similares están en esta categoría`,
      keywords_matched: searchTerms,
      similar_products: data.slice(0, 3).map(p => p.name)
    };
  } catch (error) {
    console.error('Error in similarity analysis:', error);
    return null;
  }
};

// Generar sugerencia genérica
const generateGenericCategorySuggestion = (productName: string): CategorySuggestion => {
  const words = productName.toLowerCase().split(' ');
  const firstWord = words[0];
  
  // Intentar crear una categoría basada en la primera palabra
  const genericName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  
  return {
    suggested_name: `${genericName} y Similares`,
    confidence: 40,
    reasoning: 'Sugerencia genérica basada en el nombre del producto',
    keywords_matched: [firstWord],
    similar_products: []
  };
};

// Obtener nombre de categoría para mostrar
const getCategoryDisplayName = (categoryKey: string): string => {
  const displayNames: Record<string, string> = {
    'smartphones': 'Smartphones y Celulares',
    'accesorios': 'Accesorios Tecnológicos',
    'tablets': 'Tablets y E-readers',
    'laptops': 'Laptops y Computadores',
    'gaming': 'Gaming y Videojuegos',
    'audio': 'Audio y Sonido',
    'hogar': 'Hogar Inteligente'
  };
  
  return displayNames[categoryKey] || categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
};

// Analizar rendimiento de categorías
export const analyzeCategoryPerformance = async (): Promise<CategoryAnalytics[]> => {
  try {
    if (isDemoMode) {
      // Datos demo de análisis
      return [
        {
          category_id: 'demo-category-1',
          category_name: 'Smartphones',
          product_count: 15,
          total_revenue: 45000000,
          average_product_price: 3000000,
          best_selling_product: 'iPhone 15 Pro',
          profit_margin: 12.5,
          growth_trend: 'increasing',
          market_share: 65,
          recommendations: [
            'Ampliar inventario de gama media',
            'Considerar promociones para modelos antiguos',
            'Evaluar nuevos proveedores para mejor margen'
          ]
        },
        {
          category_id: 'demo-category-2',
          category_name: 'Accesorios',
          product_count: 25,
          total_revenue: 8500000,
          average_product_price: 85000,
          best_selling_product: 'Cargador USB-C',
          profit_margin: 45.2,
          growth_trend: 'stable',
          market_share: 25,
          recommendations: [
            'Excelente margen de ganancia',
            'Oportunidad de expansión en accesorios premium',
            'Considerar bundles con smartphones'
          ]
        }
      ];
    }

    if (!supabase) return [];

    // Análisis real usando vistas optimizadas
    const { data, error } = await supabase
      .from('inventory_summary')
      .select('*')
      .not('category_name', 'is', null);

    if (error) throw error;

    // Agrupar por categoría y calcular métricas
    const categoryMap = new Map<string, any>();
    
    (data || []).forEach(product => {
      const categoryName = product.category_name;
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          category_name: categoryName,
          products: [],
          total_revenue: 0,
          total_profit: 0
        });
      }
      
      const category = categoryMap.get(categoryName);
      category.products.push(product);
      category.total_revenue += product.revenue_last_30_days || 0;
      category.total_profit += (product.profit_per_unit || 0) * (product.total_sold_last_30_days || 0);
    });

    // Convertir a formato de análisis
    const analytics: CategoryAnalytics[] = Array.from(categoryMap.values()).map(category => {
      const products = category.products;
      const totalProducts = products.length;
      const avgPrice = products.reduce((sum: number, p: any) => sum + p.sale_price, 0) / totalProducts;
      const bestSelling = products.sort((a: any, b: any) => 
        (b.total_sold_last_30_days || 0) - (a.total_sold_last_30_days || 0)
      )[0];

      const profitMargin = category.total_revenue > 0 
        ? (category.total_profit / category.total_revenue) * 100 
        : 0;

      return {
        category_id: products[0].category_id || '',
        category_name: category.category_name,
        product_count: totalProducts,
        total_revenue: category.total_revenue,
        average_product_price: avgPrice,
        best_selling_product: bestSelling?.product_name || 'N/A',
        profit_margin: profitMargin,
        growth_trend: category.total_revenue > 1000000 ? 'increasing' : 'stable',
        market_share: 0, // Calcular después
        recommendations: generateCategoryRecommendations(category, profitMargin, totalProducts)
      };
    });

    // Calcular market share
    const totalMarketRevenue = analytics.reduce((sum, cat) => sum + cat.total_revenue, 0);
    analytics.forEach(category => {
      category.market_share = totalMarketRevenue > 0 
        ? (category.total_revenue / totalMarketRevenue) * 100 
        : 0;
    });

    return analytics.sort((a, b) => b.total_revenue - a.total_revenue);
  } catch (error) {
    console.error('Error analyzing category performance:', error);
    return [];
  }
};

// Generar recomendaciones inteligentes para categorías
const generateCategoryRecommendations = (
  category: any,
  profitMargin: number,
  productCount: number
): string[] => {
  const recommendations: string[] = [];

  // Análisis de margen de ganancia
  if (profitMargin < 10) {
    recommendations.push('Margen bajo: Revisar precios o negociar mejores costos con proveedores');
  } else if (profitMargin > 50) {
    recommendations.push('Excelente margen: Oportunidad de expansión en esta categoría');
  }

  // Análisis de diversidad de productos
  if (productCount < 5) {
    recommendations.push('Pocos productos: Considerar ampliar el catálogo en esta categoría');
  } else if (productCount > 50) {
    recommendations.push('Muchos productos: Evaluar cuáles tienen mejor rotación');
  }

  // Análisis de ventas
  if (category.total_revenue < 500000) {
    recommendations.push('Ventas bajas: Implementar estrategias de marketing específicas');
  } else if (category.total_revenue > 5000000) {
    recommendations.push('Categoría estrella: Mantener stock adecuado y considerar productos premium');
  }

  // Recomendaciones por defecto
  if (recommendations.length === 0) {
    recommendations.push('Categoría estable: Continuar monitoreando tendencias');
  }

  return recommendations;
};

// Clasificar producto automáticamente
export const autoClassifyProduct = async (
  productName: string,
  productDescription: string = '',
  productPrice: number = 0,
  existingCategories: Category[] = []
): Promise<{
  suggested_category: Category | null;
  confidence: number;
  alternative_suggestions: CategorySuggestion[];
  should_create_new: boolean;
  new_category_suggestion?: string;
}> => {
  try {
    // Obtener sugerencias
    const suggestions = await suggestCategory(productName, productDescription, existingCategories);
    
    if (suggestions.length === 0) {
      return {
        suggested_category: null,
        confidence: 0,
        alternative_suggestions: [],
        should_create_new: true,
        new_category_suggestion: 'Productos Varios'
      };
    }

    const bestSuggestion = suggestions[0];
    
    // Buscar categoría existente que coincida
    const matchingCategory = existingCategories.find(cat => 
      cat.name.toLowerCase() === bestSuggestion.suggested_name.toLowerCase() ||
      cat.name.toLowerCase().includes(bestSuggestion.suggested_name.toLowerCase()) ||
      bestSuggestion.suggested_name.toLowerCase().includes(cat.name.toLowerCase())
    );

    // Análisis de precio para validar categoría
    if (matchingCategory && productPrice > 0) {
      const priceAnalysis = await analyzePriceCompatibility(
        matchingCategory.id, 
        productPrice
      );
      
      if (!priceAnalysis.is_compatible) {
        return {
          suggested_category: null,
          confidence: bestSuggestion.confidence * 0.7, // Reducir confianza
          alternative_suggestions: suggestions,
          should_create_new: true,
          new_category_suggestion: `${bestSuggestion.suggested_name} ${priceAnalysis.price_tier}`
        };
      }
    }

    return {
      suggested_category: matchingCategory || null,
      confidence: bestSuggestion.confidence,
      alternative_suggestions: suggestions.slice(1),
      should_create_new: !matchingCategory,
      new_category_suggestion: matchingCategory ? undefined : bestSuggestion.suggested_name
    };
  } catch (error) {
    console.error('Error in auto classification:', error);
    return {
      suggested_category: null,
      confidence: 0,
      alternative_suggestions: [],
      should_create_new: true,
      new_category_suggestion: 'Sin Categoría'
    };
  }
};

// Analizar compatibilidad de precio con categoría existente
const analyzePriceCompatibility = async (
  categoryId: string,
  productPrice: number
): Promise<{
  is_compatible: boolean;
  price_tier: string;
  average_price: number;
  price_range: { min: number; max: number };
}> => {
  try {
    if (isDemoMode) {
      return {
        is_compatible: true,
        price_tier: productPrice > 1000000 ? 'Premium' : productPrice > 500000 ? 'Medio' : 'Económico',
        average_price: 800000,
        price_range: { min: 50000, max: 5000000 }
      };
    }

    if (!supabase) {
      return {
        is_compatible: true,
        price_tier: 'Desconocido',
        average_price: 0,
        price_range: { min: 0, max: 0 }
      };
    }

    const { data, error } = await supabase
      .from('products')
      .select('sale_price')
      .eq('category_id', categoryId);

    if (error || !data || data.length === 0) {
      return {
        is_compatible: true,
        price_tier: 'Nuevo',
        average_price: 0,
        price_range: { min: 0, max: 0 }
      };
    }

    const prices = data.map(p => p.sale_price).sort((a, b) => a - b);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const minPrice = prices[0];
    const maxPrice = prices[prices.length - 1];

    // Determinar si el precio es compatible (dentro de 3 desviaciones estándar)
    const stdDev = Math.sqrt(
      prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length
    );

    const isCompatible = Math.abs(productPrice - avgPrice) <= 3 * stdDev;

    // Determinar tier de precio
    let priceTier = 'Medio';
    if (productPrice < avgPrice * 0.5) {
      priceTier = 'Económico';
    } else if (productPrice > avgPrice * 2) {
      priceTier = 'Premium';
    }

    return {
      is_compatible: isCompatible,
      price_tier: priceTier,
      average_price: avgPrice,
      price_range: { min: minPrice, max: maxPrice }
    };
  } catch (error) {
    console.error('Error analyzing price compatibility:', error);
    return {
      is_compatible: true,
      price_tier: 'Desconocido',
      average_price: 0,
      price_range: { min: 0, max: 0 }
    };
  }
};

// Optimizar estructura de categorías
export const optimizeCategoryStructure = async (): Promise<{
  optimization_suggestions: Array<{
    type: 'merge' | 'split' | 'rename' | 'create';
    current_categories: string[];
    suggested_action: string;
    reasoning: string;
    impact: 'low' | 'medium' | 'high';
  }>;
  performance_impact: string;
}> => {
  try {
    if (isDemoMode) {
      return {
        optimization_suggestions: [
          {
            type: 'merge',
            current_categories: ['Accesorios', 'Cables y Cargadores'],
            suggested_action: 'Fusionar en "Accesorios Tecnológicos"',
            reasoning: 'Categorías muy similares con pocos productos cada una',
            impact: 'medium'
          },
          {
            type: 'split',
            current_categories: ['Electrónicos'],
            suggested_action: 'Dividir en "Smartphones", "Tablets", "Audio"',
            reasoning: 'Categoría muy amplia con productos diversos',
            impact: 'high'
          }
        ],
        performance_impact: 'Mejora estimada del 25% en navegación y búsqueda'
      };
    }

    if (!supabase) {
      return {
        optimization_suggestions: [],
        performance_impact: 'No disponible sin conexión a base de datos'
      };
    }

    const analytics = await analyzeCategoryPerformance();
    const suggestions: any[] = [];

    // Detectar categorías que deberían fusionarse
    for (let i = 0; i < analytics.length; i++) {
      for (let j = i + 1; j < analytics.length; j++) {
        const cat1 = analytics[i];
        const cat2 = analytics[j];
        
        // Si ambas tienen pocos productos y nombres similares
        if (cat1.product_count < 5 && cat2.product_count < 5) {
          const similarity = calculateNameSimilarity(cat1.category_name, cat2.category_name);
          if (similarity > 0.6) {
            suggestions.push({
              type: 'merge',
              current_categories: [cat1.category_name, cat2.category_name],
              suggested_action: `Fusionar en "${cat1.category_name}"`,
              reasoning: 'Categorías similares con pocos productos',
              impact: 'medium'
            });
          }
        }
      }
    }

    // Detectar categorías que deberían dividirse
    analytics.forEach(category => {
      if (category.product_count > 30) {
        suggestions.push({
          type: 'split',
          current_categories: [category.category_name],
          suggested_action: `Dividir "${category.category_name}" en subcategorías`,
          reasoning: 'Categoría muy amplia, dificulta la navegación',
          impact: 'high'
        });
      }
    });

    // Detectar categorías sin productos
    const { data: emptyCategories, error: emptyError } = await supabase
      .from('categories')
      .select(`
        id,
        name,
        products:products(count)
      `)
      .eq('products.count', 0);

    if (!emptyError && emptyCategories && emptyCategories.length > 0) {
      emptyCategories.forEach(category => {
        suggestions.push({
          type: 'create',
          current_categories: [category.name],
          suggested_action: `Eliminar o poblar "${category.name}"`,
          reasoning: 'Categoría sin productos asignados',
          impact: 'low'
        });
      });
    }

    return {
      optimization_suggestions: suggestions,
      performance_impact: suggestions.length > 0 
        ? `Mejora estimada del ${Math.min(50, suggestions.length * 10)}% en organización`
        : 'Estructura de categorías ya optimizada'
    };
  } catch (error) {
    console.error('Error optimizing category structure:', error);
    return {
      optimization_suggestions: [],
      performance_impact: 'Error al analizar estructura'
    };
  }
};

// Calcular similitud entre nombres
const calculateNameSimilarity = (name1: string, name2: string): number => {
  const words1 = name1.toLowerCase().split(' ');
  const words2 = name2.toLowerCase().split(' ');
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = new Set([...words1, ...words2]).size;
  
  return commonWords.length / totalWords;
};

// Generar insights de mercado para categorías
export const generateMarketInsights = async (categoryId: string): Promise<{
  demand_forecast: {
    next_month: 'low' | 'medium' | 'high';
    seasonal_pattern: string;
    growth_prediction: number;
  };
  competitive_analysis: {
    market_position: string;
    price_competitiveness: number;
    differentiation_opportunities: string[];
  };
  inventory_recommendations: {
    reorder_suggestions: Array<{
      product_name: string;
      suggested_quantity: number;
      reasoning: string;
    }>;
    new_product_opportunities: string[];
  };
}> => {
  try {
    if (isDemoMode) {
      return {
        demand_forecast: {
          next_month: 'high',
          seasonal_pattern: 'Pico en diciembre y enero por temporada navideña',
          growth_prediction: 15.5
        },
        competitive_analysis: {
          market_position: 'Líder en segmento medio-alto',
          price_competitiveness: 85,
          differentiation_opportunities: [
            'Ampliar garantías extendidas',
            'Servicios de instalación y soporte',
            'Programas de fidelización'
          ]
        },
        inventory_recommendations: {
          reorder_suggestions: [
            {
              product_name: 'iPhone 15 Pro',
              suggested_quantity: 8,
              reasoning: 'Alta demanda y stock bajo actual'
            },
            {
              product_name: 'Samsung Galaxy S24',
              suggested_quantity: 12,
              reasoning: 'Tendencia creciente en ventas'
            }
          ],
          new_product_opportunities: [
            'Smartphones plegables',
            'Accesorios de realidad aumentada',
            'Cargadores inalámbricos rápidos'
          ]
        }
      };
    }

    if (!supabase) {
      return {
        demand_forecast: { next_month: 'medium', seasonal_pattern: 'No disponible', growth_prediction: 0 },
        competitive_analysis: { market_position: 'No disponible', price_competitiveness: 0, differentiation_opportunities: [] },
        inventory_recommendations: { reorder_suggestions: [], new_product_opportunities: [] }
      };
    }

    // Análisis real basado en datos históricos
    const { data: salesData, error } = await supabase
      .from('sales')
      .select(`
        total_amount,
        created_at,
        sale_items (
          quantity,
          product:products (
            id,
            name,
            category_id,
            sale_price,
            stock
          )
        )
      `)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    // Filtrar ventas de la categoría específica
    const categoryProducts = new Set<string>();
    const categorySales = (salesData || []).filter(sale => {
      return sale.sale_items.some(item => {
        if (item.product?.category_id === categoryId) {
          categoryProducts.add(item.product.id);
          return true;
        }
        return false;
      });
    });

    // Calcular tendencias
    const last30Days = categorySales.filter(sale => 
      new Date(sale.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    
    const previous30Days = categorySales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      return saleDate > sixtyDaysAgo && saleDate <= thirtyDaysAgo;
    });

    const currentRevenue = last30Days.reduce((sum, sale) => sum + sale.total_amount, 0);
    const previousRevenue = previous30Days.reduce((sum, sale) => sum + sale.total_amount, 0);
    
    const growthRate = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;

    // Determinar demanda futura
    let demandForecast: 'low' | 'medium' | 'high' = 'medium';
    if (growthRate > 20) demandForecast = 'high';
    else if (growthRate < -10) demandForecast = 'low';

    return {
      demand_forecast: {
        next_month: demandForecast,
        seasonal_pattern: analyzeSeasonalPattern(categorySales),
        growth_prediction: growthRate
      },
      competitive_analysis: {
        market_position: currentRevenue > 2000000 ? 'Fuerte' : 'En desarrollo',
        price_competitiveness: 75, // Placeholder
        differentiation_opportunities: [
          'Servicios post-venta',
          'Garantías extendidas',
          'Programas de lealtad'
        ]
      },
      inventory_recommendations: {
        reorder_suggestions: await generateReorderSuggestions(categoryId),
        new_product_opportunities: [
          'Productos complementarios',
          'Versiones premium de productos exitosos'
        ]
      }
    };
  } catch (error) {
    console.error('Error generating market insights:', error);
    return {
      demand_forecast: { next_month: 'medium', seasonal_pattern: 'No disponible', growth_prediction: 0 },
      competitive_analysis: { market_position: 'No disponible', price_competitiveness: 0, differentiation_opportunities: [] },
      inventory_recommendations: { reorder_suggestions: [], new_product_opportunities: [] }
    };
  }
};

// Analizar patrones estacionales
const analyzeSeasonalPattern = (sales: any[]): string => {
  const monthlyData = new Map<number, number>();
  
  sales.forEach(sale => {
    const month = new Date(sale.created_at).getMonth();
    monthlyData.set(month, (monthlyData.get(month) || 0) + sale.total_amount);
  });

  if (monthlyData.size < 3) {
    return 'Datos insuficientes para análisis estacional';
  }

  const sortedMonths = Array.from(monthlyData.entries())
    .sort((a, b) => b[1] - a[1]);

  const bestMonth = sortedMonths[0][0];
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return `Mejor rendimiento en ${monthNames[bestMonth]}`;
};

// Generar sugerencias de reorden
const generateReorderSuggestions = async (categoryId: string) => {
  try {
    if (isDemoMode) {
      return [
        {
          product_name: 'Producto Demo 1',
          suggested_quantity: 10,
          reasoning: 'Stock bajo y alta demanda'
        }
      ];
    }

    if (!supabase) return [];

    const { data, error } = await supabase
      .from('inventory_summary')
      .select('*')
      .eq('category_id', categoryId)
      .eq('stock_status', 'low_stock')
      .order('total_sold_last_30_days', { ascending: false });

    if (error) return [];

    return (data || []).slice(0, 5).map(product => ({
      product_name: product.product_name,
      suggested_quantity: Math.max(5, Math.ceil((product.total_sold_last_30_days || 0) * 1.5)),
      reasoning: `Vendidos ${product.total_sold_last_30_days || 0} en 30 días, stock actual: ${product.current_stock}`
    }));
  } catch (error) {
    console.error('Error generating reorder suggestions:', error);
    return [];
  }
};

// Crear categoría inteligente automáticamente
export const createIntelligentCategory = async (
  suggestion: CategorySuggestion,
  userId: string
): Promise<{ success: boolean; category?: Category; error?: string }> => {
  try {
    if (isDemoMode) {
      const demoCategory: Category = {
        id: `demo-category-${Date.now()}`,
        name: suggestion.suggested_name,
        description: `Categoría creada automáticamente: ${suggestion.reasoning}`,
        created_at: new Date().toISOString()
      };
      
      return { success: true, category: demoCategory };
    }

    if (!supabase) {
      return { success: false, error: 'Sistema de base de datos no disponible' };
    }

    // Crear categoría con descripción inteligente
    const categoryData = {
      name: suggestion.suggested_name,
      description: `Categoría creada automáticamente. ${suggestion.reasoning}. Palabras clave: ${suggestion.keywords_matched.join(', ')}.`,
      created_by: userId,
      auto_generated: true,
      keywords: suggestion.keywords_matched,
      confidence_score: suggestion.confidence
    };

    const { data, error } = await supabase
      .from('categories')
      .insert([categoryData])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, category: data };
  } catch (error) {
    console.error('Error creating intelligent category:', error);
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
};

// Validar y limpiar categorías automáticamente
export const validateAndCleanCategories = async (): Promise<{
  validation_results: Array<{
    category_name: string;
    issues: string[];
    suggestions: string[];
    action_required: boolean;
  }>;
  cleanup_actions: Array<{
    action: string;
    category_name: string;
    reasoning: string;
  }>;
}> => {
  try {
    if (isDemoMode) {
      return {
        validation_results: [
          {
            category_name: 'Smartphones',
            issues: [],
            suggestions: ['Categoría bien estructurada'],
            action_required: false
          },
          {
            category_name: 'Sin Categoría',
            issues: ['Nombre genérico', 'Productos diversos'],
            suggestions: ['Reclasificar productos', 'Crear categorías específicas'],
            action_required: true
          }
        ],
        cleanup_actions: [
          {
            action: 'Reclasificar productos',
            category_name: 'Sin Categoría',
            reasoning: 'Categoría genérica con productos diversos'
          }
        ]
      };
    }

    if (!supabase) {
      return { validation_results: [], cleanup_actions: [] };
    }

    const analytics = await analyzeCategoryPerformance();
    const validationResults: any[] = [];
    const cleanupActions: any[] = [];

    for (const category of analytics) {
      const issues: string[] = [];
      const suggestions: string[] = [];

      // Validar nombre de categoría
      if (category.category_name.toLowerCase().includes('sin categoría') || 
          category.category_name.toLowerCase().includes('otros')) {
        issues.push('Nombre genérico poco descriptivo');
        suggestions.push('Renombrar con nombre más específico');
      }

      // Validar número de productos
      if (category.product_count === 0) {
        issues.push('Categoría vacía');
        suggestions.push('Eliminar o asignar productos');
        cleanupActions.push({
          action: 'Eliminar categoría vacía',
          category_name: category.category_name,
          reasoning: 'No tiene productos asignados'
        });
      } else if (category.product_count === 1) {
        issues.push('Solo un producto');
        suggestions.push('Agregar más productos o fusionar con otra categoría');
      }

      // Validar rendimiento
      if (category.total_revenue === 0) {
        issues.push('Sin ventas registradas');
        suggestions.push('Revisar estrategia de marketing o precios');
      }

      // Validar margen de ganancia
      if (category.profit_margin < 5) {
        issues.push('Margen de ganancia muy bajo');
        suggestions.push('Revisar precios o costos de productos');
      }

      validationResults.push({
        category_name: category.category_name,
        issues,
        suggestions,
        action_required: issues.length > 0
      });
    }

    return {
      validation_results: validationResults,
      cleanup_actions: cleanupActions
    };
  } catch (error) {
    console.error('Error validating categories:', error);
    return { validation_results: [], cleanup_actions: [] };
  }
};

// Buscar productos sin categoría y sugerir clasificación
export const findAndClassifyUncategorizedProducts = async (): Promise<Array<{
  product: Product;
  suggestions: CategorySuggestion[];
  auto_classification: {
    category_id: string | null;
    confidence: number;
  };
}>> => {
  try {
    if (isDemoMode) {
      return [
        {
          product: {
            id: 'demo-uncategorized-1',
            name: 'Auriculares Bluetooth Premium',
            description: 'Auriculares inalámbricos con cancelación de ruido',
            sale_price: 250000,
            purchase_price: 180000,
            stock: 15,
            barcode: '789123456789',
            category_id: null,
            supplier_id: null,
            has_imei_serial: false,
            imei_serial_type: 'serial',
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date().toISOString()
          },
          suggestions: [
            {
              suggested_name: 'Audio y Sonido',
              confidence: 92,
              reasoning: 'Producto de audio con características premium',
              keywords_matched: ['auriculares', 'bluetooth', 'audio'],
              similar_products: ['Parlante JBL', 'Audífonos Sony']
            }
          ],
          auto_classification: {
            category_id: 'demo-category-audio',
            confidence: 92
          }
        }
      ];
    }

    if (!supabase) return [];

    // Obtener productos sin categoría
    const { data: uncategorizedProducts, error } = await supabase
      .from('products')
      .select('*')
      .is('category_id', null)
      .limit(20);

    if (error) throw error;

    // Obtener categorías existentes
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*');

    if (categoriesError) throw categoriesError;

    const results = [];

    for (const product of uncategorizedProducts || []) {
      const suggestions = await suggestCategory(
        product.name,
        product.description,
        categories || []
      );

      const classification = await autoClassifyProduct(
        product.name,
        product.description,
        product.sale_price,
        categories || []
      );

      results.push({
        product,
        suggestions,
        auto_classification: {
          category_id: classification.suggested_category?.id || null,
          confidence: classification.confidence
        }
      });
    }

    return results;
  } catch (error) {
    console.error('Error finding uncategorized products:', error);
    return [];
  }
};

// Aplicar clasificación automática masiva
export const applyBulkAutoClassification = async (
  classifications: Array<{
    product_id: string;
    category_id: string;
    confidence: number;
  }>,
  minConfidence: number = 70
): Promise<{
  success: boolean;
  processed: number;
  skipped: number;
  errors: Array<{ product_id: string; error: string }>;
}> => {
  try {
    if (isDemoMode) {
      return {
        success: true,
        processed: classifications.length,
        skipped: 0,
        errors: []
      };
    }

    if (!supabase) {
      return {
        success: false,
        processed: 0,
        skipped: classifications.length,
        errors: [{ product_id: 'all', error: 'Sistema de base de datos no disponible' }]
      };
    }

    let processed = 0;
    let skipped = 0;
    const errors: Array<{ product_id: string; error: string }> = [];

    for (const classification of classifications) {
      try {
        // Solo aplicar si la confianza es suficiente
        if (classification.confidence < minConfidence) {
          skipped++;
          continue;
        }

        const { error } = await supabase
          .from('products')
          .update({ 
            category_id: classification.category_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', classification.product_id);

        if (error) {
          errors.push({
            product_id: classification.product_id,
            error: error.message
          });
        } else {
          processed++;
        }
      } catch (error) {
        errors.push({
          product_id: classification.product_id,
          error: (error as Error).message
        });
      }
    }

    return {
      success: errors.length === 0,
      processed,
      skipped,
      errors
    };
  } catch (error) {
    console.error('Error in bulk auto classification:', error);
    return {
      success: false,
      processed: 0,
      skipped: classifications.length,
      errors: [{ product_id: 'all', error: (error as Error).message }]
    };
  }
};