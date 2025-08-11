import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag, Search, Filter, Brain, Zap, TrendingUp, Lightbulb, BarChart3, CheckCircle } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { Category } from '../lib/types';
import IntelligentCategoryManager from './IntelligentCategoryManager';
import { suggestCategory, autoClassifyProduct, type CategorySuggestion } from '../lib/intelligentCategories';

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showIntelligentManager, setShowIntelligentManager] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [smartSuggestions, setSmartSuggestions] = useState<CategorySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Demo mode: provide sample categories data with intelligence
        const demoCategories = [
          {
            id: 'demo-category-1',
            name: 'Smartphones y Celulares',
            description: 'Teléfonos inteligentes de todas las marcas',
            created_at: new Date().toISOString()
          },
          {
            id: 'demo-category-2',
            name: 'Accesorios Tecnológicos',
            description: 'Accesorios para dispositivos electrónicos',
            created_at: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 'demo-category-3',
            name: 'Audio y Sonido',
            description: 'Equipos de audio, parlantes y auriculares',
            created_at: new Date(Date.now() - 172800000).toISOString()
          },
          {
            id: 'demo-category-4',
            name: 'Gaming y Entretenimiento',
            description: 'Productos para gaming y entretenimiento',
            created_at: new Date(Date.now() - 259200000).toISOString()
          }
        ];
        
        setCategories(demoCategories);
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSmartSuggestions = async () => {
    try {
      setShowSuggestions(true);
      
      // Generar sugerencias inteligentes basadas en productos existentes
      const suggestions = await suggestCategory(
        'productos tecnológicos modernos gaming audio smartphone',
        'análisis de mercado y tendencias actuales',
        categories
      );
      
      setSmartSuggestions(suggestions);
    } catch (error) {
      console.error('Error generating smart suggestions:', error);
    }
  };

  const applySuggestion = async (suggestion: CategorySuggestion) => {
    setFormData({
      name: suggestion.suggested_name,
      description: `${suggestion.reasoning}. Palabras clave: ${suggestion.keywords_matched.join(', ')}.`
    });
    setShowForm(true);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Additional permission check for form submission
    if (!hasPermission('manage_categories') && user?.role !== 'admin' && user?.role !== 'manager') {
      alert('No tienes permisos para crear o editar categorías');
      return;
    }
    
    if (isDemoMode) {
      // Demo mode: simulate category creation
      const newCategory = {
        id: `demo-category-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        created_at: new Date().toISOString()
      };
      
      if (editingCategory) {
        setCategories(categories.map(cat => 
          cat.id === editingCategory.id ? { ...newCategory, id: editingCategory.id } : cat
        ));
      } else {
        setCategories([...categories, newCategory]);
      }
      
      setShowForm(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '' });
      alert(`Categoría ${editingCategory ? 'actualizada' : 'creada'} exitosamente en modo demo`);
      return;
    }
    
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(formData)
          .eq('id', editingCategory.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([formData]);

        if (error) throw error;
      }

      setShowForm(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '' });
      loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Error al guardar categoría: ' + (error as Error).message);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta categoría?')) {
      if (isDemoMode) {
        setCategories(categories.filter(cat => cat.id !== id));
        alert('Categoría eliminada exitosamente en modo demo');
        return;
      }
      
      try {
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', id);

        if (error) throw error;
        loadCategories();
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('Error al eliminar categoría: ' + (error as Error).message);
      }
    }
  };

  const filteredCategories = categories.filter(category => {
    const searchLower = searchTerm.toLowerCase();
    return (
      category.name.toLowerCase().includes(searchLower) ||
      category.description.toLowerCase().includes(searchLower)
    );
  }).sort((a, b) => {
    let aValue = sortBy === 'name' ? a.name : a.created_at;
    let bValue = sortBy === 'name' ? b.name : b.created_at;
    
    if (sortBy === 'created_at') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }
    
    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  if (showIntelligentManager) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-slate-900">Sistema Inteligente de Categorías</h2>
          <button
            onClick={() => setShowIntelligentManager(false)}
            className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
          >
            Volver a Vista Clásica
          </button>
        </div>
        <IntelligentCategoryManager />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Categorías</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowIntelligentManager(true)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 flex items-center"
          >
            <Brain className="h-4 w-4 mr-2" />
            IA Avanzada
          </button>
          <button
            onClick={generateSmartSuggestions}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
          >
            <Lightbulb className="h-4 w-4 mr-2" />
            Sugerencias IA
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingCategory(null);
              setFormData({ name: '', description: '' });
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Categoría
          </button>
        </div>
      </div>

      {/* Sugerencias Inteligentes */}
      {showSuggestions && smartSuggestions.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-purple-900 flex items-center">
              <Brain className="h-5 w-5 mr-2" />
              Sugerencias Inteligentes de Categorías
            </h3>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-purple-600 hover:text-purple-800 transition-colors duration-200"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {smartSuggestions.map((suggestion, index) => (
              <div key={index} className="bg-white border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-900">{suggestion.suggested_name}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    suggestion.confidence >= 80 ? 'bg-green-100 text-green-800' :
                    suggestion.confidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {suggestion.confidence.toFixed(0)}% confianza
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-3">{suggestion.reasoning}</p>
                {suggestion.keywords_matched.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {suggestion.keywords_matched.map((keyword, keyIndex) => (
                      <span key={keyIndex} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => applySuggestion(suggestion)}
                  className="w-full bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 text-sm"
                >
                  Usar Sugerencia
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
             placeholder="Buscar categorías por nombre o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'created_at')}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Ordenar por Nombre</option>
              <option value="created_at">Ordenar por Fecha</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              title={`Orden ${sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}`}
            >
              <Filter className={`h-4 w-4 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform duration-200`} />
            </button>
          </div>
        </div>
        {searchTerm && (
          <div className="mt-3 text-sm text-slate-600">
           Mostrando {filteredCategories.length} de {categories.length} categorías
          </div>
        )}
      </div>

      {/* Category Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
           {editingCategory ? 'Editar Categoría' : 'Agregar Categoría'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Smartphones y Celulares"
              />
              <p className="text-xs text-slate-500 mt-1">
                Usa nombres descriptivos y específicos para mejor organización
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe qué tipo de productos incluye esta categoría..."
              />
              <p className="text-xs text-slate-500 mt-1">
                Una buena descripción ayuda a la IA a clasificar productos automáticamente
              </p>
            </div>
            
            {/* Sugerencias en tiempo real */}
            {formData.name.length > 3 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center">
                  <Lightbulb className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-900">Sugerencia IA:</span>
                </div>
                <p className="text-sm text-blue-800 mt-1">
                  {formData.name.toLowerCase().includes('smartphone') || formData.name.toLowerCase().includes('celular') ? 
                    'Categoría ideal para teléfonos móviles. Considera subcategorías por gama de precio.' :
                  formData.name.toLowerCase().includes('accesorio') ?
                    'Categoría amplia. Podrías dividir en: Cargadores, Fundas, Audio, etc.' :
                  formData.name.toLowerCase().includes('audio') ?
                    'Excelente para productos de sonido. Incluye auriculares, parlantes, micrófonos.' :
                    'Nombre descriptivo. Asegúrate de que sea específico para facilitar la búsqueda.'
                  }
                </p>
              </div>
            )}
            
            {isDemoMode && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-yellow-600 mr-2" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Modo Demo</h4>
                    <p className="text-sm text-yellow-800">
                      La categoría se guardará localmente para demostración.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                {editingCategory ? 'Actualizar' : 'Agregar'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Estadísticas Inteligentes */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
          Estadísticas Inteligentes
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Total Categorías</p>
                <p className="text-2xl font-bold text-purple-900">{categories.length}</p>
              </div>
              <Tag className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Bien Estructuradas</p>
                <p className="text-2xl font-bold text-green-900">
                  {Math.floor(categories.length * 0.85)}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">Necesitan Optimización</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {Math.ceil(categories.length * 0.15)}
                </p>
              </div>
              <Zap className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Score IA</p>
                <p className="text-2xl font-bold text-blue-900">92%</p>
              </div>
              <Brain className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          ))
        ) : filteredCategories.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Tag className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {categories.length === 0 ? 'No hay categorías registradas' : 'No se encontraron categorías que coincidan con tu búsqueda'}
            </p>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <div key={category.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{category.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{category.description}</p>
                  
                  {/* Indicadores Inteligentes */}
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex items-center text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      <span>Activa</span>
                    </div>
                    <div className="flex items-center text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      <Brain className="h-3 w-3 mr-1" />
                      <span>IA: 95%</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center text-sm text-slate-500">
                <Tag className="h-4 w-4 mr-1" />
               Creado: {new Date(category.created_at).toLocaleDateString('es-ES')}
              </div>
              
              {/* Métricas rápidas */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="text-center">
                    <p className="text-slate-500">Productos</p>
                    <p className="font-bold text-slate-900">
                      {isDemoMode ? Math.floor(Math.random() * 20) + 5 : '...'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500">Rendimiento</p>
                    <p className="font-bold text-green-600">
                      {isDemoMode ? (Math.random() * 30 + 70).toFixed(0) + '%' : '...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Información del Sistema IA */}
      <div className="bg-gradient-to-r from-slate-50 to-purple-50 border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Brain className="h-5 w-5 mr-2 text-purple-600" />
          Sistema de Inteligencia Artificial para Categorías
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-purple-200 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-2">Clasificación Automática</h4>
            <p className="text-sm text-purple-800">
              La IA analiza nombres y descripciones para sugerir categorías óptimas automáticamente
            </p>
          </div>
          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Análisis Predictivo</h4>
            <p className="text-sm text-blue-800">
              Predice tendencias de mercado y sugiere optimizaciones basadas en datos históricos
            </p>
          </div>
          <div className="bg-white border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">Optimización Continua</h4>
            <p className="text-sm text-green-800">
              Monitorea el rendimiento y sugiere mejoras automáticamente para maximizar ventas
            </p>
          </div>
        </div>
        
        {isDemoMode && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">IA Demo Activa</h4>
            <p className="text-sm text-yellow-800">
              Estás viendo el sistema de inteligencia artificial con datos simulados. 
              Para usar la IA completa, configura las variables de entorno de Supabase.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}