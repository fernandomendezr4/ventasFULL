import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Package, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProductWithCategory, Category, Supplier } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import LazyLoader from './LazyLoader';

export default function OptimizedProductManager() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Cargar datos básicos en paralelo
      const [productsResult, categoriesResult, suppliersResult] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sale_price, stock, category_id')
          .order('created_at', { ascending: false })
          .range(0, ITEMS_PER_PAGE - 1),
        supabase
          .from('categories')
          .select('id, name')
          .order('name'),
        supabase
          .from('suppliers')
          .select('id, name')
          .order('name')
      ]);

      if (productsResult.error) throw productsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (suppliersResult.error) throw suppliersResult.error;

      setProducts(productsResult.data as ProductWithCategory[]);
      setCategories(categoriesResult.data);
      setSuppliers(suppliersResult.data);
      setHasMore(productsResult.data.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreProducts = async () => {
    if (!hasMore || loading) return;

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sale_price, stock, category_id')
        .order('created_at', { ascending: false })
        .range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);

      if (error) throw error;

      setProducts(prev => [...prev, ...(data as ProductWithCategory[])]);
      setCurrentPage(prev => prev + 1);
      setHasMore(data.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error loading more products:', error);
    }
  };

  // Filtrado optimizado con useMemo
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !selectedCategory || 
        product.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  return (
    <div className="space-y-6 performance-optimized">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Productos</h2>
        <button className="button-primary">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Producto
        </button>
      </div>

      {/* Filtros optimizados */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 fast-transition"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input-field fast-transition"
          >
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid de productos con lazy loading */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="loading-skeleton h-48 rounded-xl"></div>
          ))
        ) : (
          filteredProducts.map((product, index) => (
            <LazyLoader key={product.id}>
              <div className="bg-white rounded-xl shadow-sm p-6 card-hover">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{product.name}</h3>
                    <p className="text-lg font-bold text-green-600 mt-2">
                      {formatCurrency(product.sale_price)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="icon-button text-blue-600 hover:bg-blue-50">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button className="icon-button text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <div className={`text-sm px-2 py-1 rounded-full ${
                    product.stock > 10 
                      ? 'bg-green-100 text-green-800' 
                      : product.stock > 0 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                  }`}>
                    Stock: {product.stock}
                  </div>
                </div>
              </div>
            </LazyLoader>
          ))
        )}
      </div>

      {/* Botón para cargar más */}
      {hasMore && !loading && (
        <div className="text-center">
          <button
            onClick={loadMoreProducts}
            className="button-secondary"
          >
            Cargar Más Productos
          </button>
        </div>
      )}
    </div>
  );
}