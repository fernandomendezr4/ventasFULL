import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, Filter, X, Download, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, Category, Supplier } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';
import { ProductDetailsModal } from './ProductDetailsModal';
import { ProductQuickActions } from './ProductQuickActions';
import { BulkProductImport } from './BulkProductImport';
import { ImeiSerialManager } from './ImeiSerialManager';
import { FormattedNumberInput } from './FormattedNumberInput';
import { ProductFormValidation } from './ProductFormValidation';
import { useProductForm } from '../hooks/useProductForm';
import { useOptimizedQueries } from '../hooks/useOptimizedQueries';

interface ProductWithDetails extends Product {
  category_name?: string;
  supplier_name?: string;
  available_imei_serial_count?: number;
  total_sold_all_time?: number;
  last_sale_date?: string;
}

export function ProductManager() {
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithDetails | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showImeiManager, setShowImeiManager] = useState(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price' | 'sales'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { showNotification } = useNotification();
  const { showConfirmation } = useConfirmation();
  const { optimizedQueries } = useOptimizedQueries();

  const {
    formData,
    errors,
    isSubmitting,
    handleInputChange,
    handleSubmit,
    resetForm,
    setFormData
  } = useProductForm({
    onSuccess: (product) => {
      if (editingProduct) {
        setProducts(prev => prev.map(p => p.id === product.id ? { ...product, category_name: categories.find(c => c.id === product.category_id)?.name, supplier_name: suppliers.find(s => s.id === product.supplier_id)?.name } : p));
        showNotification('Producto actualizado exitosamente', 'success');
      } else {
        setProducts(prev => [...prev, { ...product, category_name: categories.find(c => c.id === product.category_id)?.name, supplier_name: suppliers.find(s => s.id === product.supplier_id)?.name }]);
        showNotification('Producto creado exitosamente', 'success');
      }
      setShowForm(false);
      setEditingProduct(null);
      resetForm();
    },
    onError: (error) => {
      showNotification(error, 'error');
    }
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Use optimized query for products with details
      const { data: productsData, error: productsError } = await optimizedQueries.getProductsWithDetails();
      
      if (productsError) throw productsError;

      const [categoriesResult, suppliersResult] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name')
      ]);

      if (categoriesResult.error) throw categoriesResult.error;
      if (suppliersResult.error) throw suppliersResult.error;

      setProducts(productsData || []);
      setCategories(categoriesResult.data || []);
      setSuppliers(suppliersResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Error al cargar los datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
      const matchesSupplier = !selectedSupplier || product.supplier_id === selectedSupplier;
      
      let matchesStock = true;
      if (stockFilter === 'low') {
        matchesStock = product.stock <= 5 && product.stock > 0;
      } else if (stockFilter === 'out') {
        matchesStock = product.stock === 0;
      }

      return matchesSearch && matchesCategory && matchesSupplier && matchesStock;
    });

    // Sort products
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'stock':
          aValue = a.stock;
          bValue = b.stock;
          break;
        case 'price':
          aValue = a.sale_price;
          bValue = b.sale_price;
          break;
        case 'sales':
          aValue = a.total_sold_all_time || 0;
          bValue = b.total_sold_all_time || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [products, searchTerm, selectedCategory, selectedSupplier, stockFilter, sortBy, sortOrder]);

  const handleEdit = (product: ProductWithDetails) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      sale_price: product.sale_price.toString(),
      purchase_price: product.purchase_price?.toString() || '',
      stock: product.stock.toString(),
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      barcode: product.barcode || '',
      has_imei_serial: product.has_imei_serial || false,
      imei_serial_type: product.imei_serial_type || 'serial',
      requires_imei_serial: product.requires_imei_serial || false
    });
    setShowForm(true);
  };

  const handleDelete = async (product: ProductWithDetails) => {
    const confirmed = await showConfirmation(
      'Confirmar eliminación',
      `¿Estás seguro de que quieres eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== product.id));
      showNotification('Producto eliminado exitosamente', 'success');
    } catch (error) {
      console.error('Error deleting product:', error);
      showNotification('Error al eliminar el producto', 'error');
    }
  };

  const handleViewDetails = (product: ProductWithDetails) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const handleManageImeiSerial = (product: ProductWithDetails) => {
    setSelectedProduct(product);
    setShowImeiManager(true);
  };

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) return 'text-red-600 bg-red-50';
    if (stock <= 5) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getStockStatusText = (stock: number) => {
    if (stock === 0) return 'Sin stock';
    if (stock <= 5) return 'Stock bajo';
    return 'En stock';
  };

  const exportProducts = async () => {
    try {
      const csvContent = [
        ['Nombre', 'Descripción', 'Precio Venta', 'Precio Compra', 'Stock', 'Categoría', 'Proveedor', 'Código de Barras'].join(','),
        ...filteredProducts.map(product => [
          `"${product.name}"`,
          `"${product.description || ''}"`,
          product.sale_price,
          product.purchase_price || 0,
          product.stock,
          `"${product.category_name || ''}"`,
          `"${product.supplier_name || ''}"`,
          `"${product.barcode || ''}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `productos_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showNotification('Productos exportados exitosamente', 'success');
    } catch (error) {
      console.error('Error exporting products:', error);
      showNotification('Error al exportar productos', 'error');
    }
  };

  const lowStockCount = products.filter(p => p.stock <= 5 && p.stock > 0).length;
  const outOfStockCount = products.filter(p => p.stock === 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6" />
            Gestión de Productos
          </h1>
          <p className="text-gray-600 mt-1">
            {products.length} productos totales
            {lowStockCount > 0 && (
              <span className="ml-2 text-yellow-600">
                • {lowStockCount} con stock bajo
              </span>
            )}
            {outOfStockCount > 0 && (
              <span className="ml-2 text-red-600">
                • {outOfStockCount} sin stock
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportProducts}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Importar
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todas las categorías</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as 'all' | 'low' | 'out')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todo el stock</option>
              <option value="low">Stock bajo (≤5)</option>
              <option value="out">Sin stock</option>
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as any);
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name-asc">Nombre A-Z</option>
              <option value="name-desc">Nombre Z-A</option>
              <option value="stock-asc">Stock menor</option>
              <option value="stock-desc">Stock mayor</option>
              <option value="price-asc">Precio menor</option>
              <option value="price-desc">Precio mayor</option>
              <option value="sales-desc">Más vendidos</option>
              <option value="sales-asc">Menos vendidos</option>
            </select>
          </div>
        </div>

        {(searchTerm || selectedCategory || selectedSupplier || stockFilter !== 'all') && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>Mostrando {filteredProducts.length} de {products.length} productos</span>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                setSelectedSupplier('');
                setStockFilter('all');
              }}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-gray-900 line-clamp-2">{product.name}</h3>
                <ProductQuickActions
                  product={product}
                  onEdit={() => handleEdit(product)}
                  onDelete={() => handleDelete(product)}
                  onViewDetails={() => handleViewDetails(product)}
                  onManageImeiSerial={product.has_imei_serial ? () => handleManageImeiSerial(product) : undefined}
                />
              </div>

              {product.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Precio:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(product.sale_price)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Stock:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStockStatusColor(product.stock)}`}>
                    {product.stock} - {getStockStatusText(product.stock)}
                  </span>
                </div>

                {product.category_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Categoría:</span>
                    <span className="text-sm text-gray-700">{product.category_name}</span>
                  </div>
                )}

                {product.has_imei_serial && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">IMEI/Serial:</span>
                    <span className="text-sm text-blue-600">
                      {product.available_imei_serial_count || 0} disponibles
                    </span>
                  </div>
                )}

                {product.total_sold_all_time !== undefined && product.total_sold_all_time > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Vendidos:</span>
                    <span className="text-sm text-gray-700">{product.total_sold_all_time}</span>
                  </div>
                )}

                {product.barcode && (
                  <div className="text-xs text-gray-500 font-mono bg-gray-50 p-1 rounded">
                    {product.barcode}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron productos</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedCategory || selectedSupplier || stockFilter !== 'all'
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Comienza agregando tu primer producto'
            }
          </p>
          {!searchTerm && !selectedCategory && !selectedSupplier && stockFilter === 'all' && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar Producto
            </button>
          )}
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingProduct(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <ProductFormValidation errors={errors} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código de Barras
                    </label>
                    <input
                      type="text"
                      name="barcode"
                      value={formData.barcode}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Precio de Venta *
                    </label>
                    <FormattedNumberInput
                      name="sale_price"
                      value={formData.sale_price}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Precio de Compra
                    </label>
                    <FormattedNumberInput
                      name="purchase_price"
                      value={formData.purchase_price}
                      onChange={handleInputChange}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stock *
                    </label>
                    <input
                      type="number"
                      name="stock"
                      value={formData.stock}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría
                    </label>
                    <select
                      name="category_id"
                      value={formData.category_id}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seleccionar categoría</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Proveedor
                    </label>
                    <select
                      name="supplier_id"
                      value={formData.supplier_id}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seleccionar proveedor</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* IMEI/Serial Configuration */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="has_imei_serial"
                      name="has_imei_serial"
                      checked={formData.has_imei_serial}
                      onChange={handleInputChange}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="has_imei_serial" className="text-sm font-medium text-gray-700">
                      Este producto tiene IMEI/Serial
                    </label>
                  </div>

                  {formData.has_imei_serial && (
                    <div className="space-y-3 ml-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo de identificador
                        </label>
                        <select
                          name="imei_serial_type"
                          value={formData.imei_serial_type}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="serial">Número de Serie</option>
                          <option value="imei">IMEI</option>
                          <option value="both">Ambos (IMEI y Serial)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="requires_imei_serial"
                          name="requires_imei_serial"
                          checked={formData.requires_imei_serial}
                          onChange={handleInputChange}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="requires_imei_serial" className="text-sm text-gray-700">
                          Requerir IMEI/Serial para vender
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingProduct(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? 'Guardando...' : editingProduct ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {showDetailsModal && selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedProduct(null);
          }}
          onEdit={() => {
            setShowDetailsModal(false);
            handleEdit(selectedProduct);
          }}
          onDelete={() => {
            setShowDetailsModal(false);
            handleDelete(selectedProduct);
          }}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkProductImport
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => {
            setShowBulkImport(false);
            loadData();
          }}
          categories={categories}
          suppliers={suppliers}
        />
      )}

      {/* IMEI/Serial Manager Modal */}
      {showImeiManager && selectedProduct && (
        <ImeiSerialManager
          product={selectedProduct}
          onClose={() => {
            setShowImeiManager(false);
            setSelectedProduct(null);
          }}
          onUpdate={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}