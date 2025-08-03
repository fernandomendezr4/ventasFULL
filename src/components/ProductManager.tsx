import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, Filter, X, Download, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, Category, Supplier } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';
import FormattedNumberInput from './FormattedNumberInput';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';
import ImeiSerialManager from './ImeiSerialManager';
import BulkProductImport from './BulkProductImport';

// Datos demo para cuando no hay conexión a Supabase
const demoProducts: Product[] = [
  {
    id: 'demo-product-1',
    name: 'iPhone 15 Pro',
    description: 'Smartphone Apple último modelo',
    sale_price: 4500000,
    purchase_price: 3800000,
    stock: 5,
    barcode: '123456789',
    category_id: null,
    supplier_id: null,
    created_at: new Date().toISOString(),
    has_imei_serial: true,
    imei_serial_type: 'imei',
    requires_imei_serial: true,
    bulk_import_batch: '',
    import_notes: '',
    imported_at: null,
    imported_by: null
  },
  {
    id: 'demo-product-2',
    name: 'Samsung Galaxy S24',
    description: 'Smartphone Samsung premium',
    sale_price: 3200000,
    purchase_price: 2600000,
    stock: 8,
    barcode: '987654321',
    category_id: null,
    supplier_id: null,
    created_at: new Date().toISOString(),
    has_imei_serial: true,
    imei_serial_type: 'imei',
    requires_imei_serial: true,
    bulk_import_batch: '',
    import_notes: '',
    imported_at: null,
    imported_by: null
  }
];

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showImeiManager, setShowImeiManager] = useState(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price' | 'sales'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { showNotification } = useNotification();
  const { showConfirmation } = useConfirmation();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sale_price: '',
    purchase_price: '',
    stock: '',
    category_id: '',
    supplier_id: '',
    barcode: '',
    has_imei_serial: false,
    imei_serial_type: 'serial' as 'imei' | 'serial' | 'both',
    requires_imei_serial: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!supabase) {
      // Modo demo
      setProducts(demoProducts);
      setCategories([
        { id: 'demo-cat-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
        { id: 'demo-cat-2', name: 'Accesorios', description: 'Accesorios tecnológicos', created_at: new Date().toISOString() }
      ]);
      setSuppliers([
        { id: 'demo-sup-1', name: 'Proveedor Demo', contact_person: 'Juan Pérez', email: 'juan@proveedor.com', phone: '123456789', address: 'Calle 123', created_at: new Date().toISOString() }
      ]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(name),
          supplier:suppliers(name)
        `)
        .order('created_at', { ascending: false });
      
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
      showError('Error al cargar datos', 'No se pudieron cargar los productos. Verifica tu conexión.');
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
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [products, searchTerm, selectedCategory, selectedSupplier, stockFilter, sortBy, sortOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.sale_price) {
      showError('Campos requeridos', 'El nombre y precio de venta son obligatorios');
      return;
    }

    try {
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        sale_price: parseFloat(formData.sale_price) || 0,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        stock: parseInt(formData.stock) || 0,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        barcode: formData.barcode.trim(),
        has_imei_serial: formData.has_imei_serial,
        imei_serial_type: formData.imei_serial_type,
        requires_imei_serial: formData.requires_imei_serial
      };

      if (!supabase) {
        // Modo demo
        const newProduct = {
          id: `demo-product-${Date.now()}`,
          ...productData,
          created_at: new Date().toISOString()
        };
        
        if (editingProduct) {
          setProducts(prev => prev.map(p => p.id === editingProduct.id ? newProduct : p));
          showSuccess('Producto actualizado', 'El producto se actualizó correctamente en modo demo');
        } else {
          setProducts(prev => [...prev, newProduct]);
          showSuccess('Producto creado', 'El producto se creó correctamente en modo demo');
        }
      } else {
        if (editingProduct) {
          const { error } = await supabase
            .from('products')
            .update(productData)
            .eq('id', editingProduct.id);

          if (error) throw error;
          showSuccess('Producto actualizado', 'El producto se actualizó correctamente');
        } else {
          const { error } = await supabase
            .from('products')
            .insert([productData]);

          if (error) throw error;
          showSuccess('Producto creado', 'El producto se creó correctamente');
        }
        
        await loadData();
      }

      setShowForm(false);
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        sale_price: '',
        purchase_price: '',
        stock: '',
        category_id: '',
        supplier_id: '',
        barcode: '',
        has_imei_serial: false,
        imei_serial_type: 'serial',
        requires_imei_serial: false
      });
    } catch (error) {
      console.error('Error saving product:', error);
      showError('Error al guardar', 'No se pudo guardar el producto: ' + (error as Error).message);
    }
  };

  const handleEdit = (product: Product) => {
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

  const handleDelete = async (product: Product) => {
    showConfirmation(
      'Confirmar eliminación',
      `¿Estás seguro de que quieres eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          if (!supabase) {
            // Modo demo
            setProducts(prev => prev.filter(p => p.id !== product.id));
            showSuccess('Producto eliminado', 'El producto se eliminó correctamente en modo demo');
            return;
          }

          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', product.id);

          if (error) throw error;

          setProducts(prev => prev.filter(p => p.id !== product.id));
          showSuccess('Producto eliminado', 'El producto se eliminó correctamente');
        } catch (error) {
          console.error('Error deleting product:', error);
          showError('Error al eliminar', 'No se pudo eliminar el producto: ' + (error as Error).message);
        }
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      }
    );
  };

  const handleViewDetails = (product: Product) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const handleManageImeiSerial = (product: Product) => {
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
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(product)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                    title="Editar producto"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                    title="Eliminar producto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
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

                {categories.find(c => c.id === product.category_id)?.name && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Categoría:</span>
                    <span className="text-sm text-gray-700">{categories.find(c => c.id === product.category_id)?.name}</span>
                  </div>
                )}

                {product.has_imei_serial && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">IMEI/Serial:</span>
                    <button
                      onClick={() => handleManageImeiSerial(product)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Gestionar
                    </button>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                      value={formData.sale_price}
                      onChange={(value) => setFormData({ ...formData, sale_price: value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Precio de Compra
                    </label>
                    <FormattedNumberInput
                      value={formData.purchase_price}
                      onChange={(value) => setFormData({ ...formData, purchase_price: value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                      min="0"
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
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, has_imei_serial: e.target.checked })}
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
                          onChange={(e) => setFormData({ ...formData, imei_serial_type: e.target.value as 'imei' | 'serial' | 'both' })}
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
                          onChange={(e) => setFormData({ ...formData, requires_imei_serial: e.target.checked })}
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
                      setFormData({
                        name: '',
                        description: '',
                        sale_price: '',
                        purchase_price: '',
                        stock: '',
                        category_id: '',
                        supplier_id: '',
                        barcode: '',
                        has_imei_serial: false,
                        imei_serial_type: 'serial',
                        requires_imei_serial: false
                      });
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingProduct ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {showDetailsModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  Detalles del Producto
                </h3>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedProduct(null);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900 text-lg">{selectedProduct.name}</h4>
                  {selectedProduct.description && (
                    <p className="text-slate-600 mt-1">{selectedProduct.description}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-slate-600">Precio de Venta:</span>
                    <p className="font-bold text-green-600">{formatCurrency(selectedProduct.sale_price)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-600">Stock:</span>
                    <p className="font-bold text-slate-900">{selectedProduct.stock} unidades</p>
                  </div>
                  {selectedProduct.purchase_price && selectedProduct.purchase_price > 0 && (
                    <div>
                      <span className="text-sm text-slate-600">Precio de Compra:</span>
                      <p className="font-bold text-slate-900">{formatCurrency(selectedProduct.purchase_price)}</p>
                    </div>
                  )}
                  {selectedProduct.barcode && (
                    <div>
                      <span className="text-sm text-slate-600">Código de Barras:</span>
                      <p className="font-mono text-slate-900">{selectedProduct.barcode}</p>
                    </div>
                  )}
                </div>
                
                <div className="pt-4 border-t border-slate-200">
                  <span className="text-sm text-slate-600">Fecha de Creación:</span>
                  <p className="text-slate-900">
                    {new Date(selectedProduct.created_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkProductImport
          isOpen={showBulkImport}
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
          isOpen={showImeiManager}
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

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={hideNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        onClose={hideConfirmation}
        onConfirm={handleConfirm}
        title={confirmation.title}
        message={confirmation.message}
        confirmText={confirmation.confirmText}
        cancelText={confirmation.cancelText}
        type={confirmation.type}
        loading={confirmation.loading}
      />
    </div>
  );
}