import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, Search, Filter, Eye, Hash, Brain, Zap, Upload, Download, BarChart3, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { ProductWithCategory, Category, Supplier } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import ImeiSerialManager from './ImeiSerialManager';
import BulkProductImport from './BulkProductImport';
import SmartInventoryInsights from './SmartInventoryInsights';
import InventoryAnalyticsDashboard from './InventoryAnalyticsDashboard';
import { ProductDetailsModal } from './ProductDetailsModal';
import ProductQuickActions from './ProductQuickActions';
import { suggestCategory, autoClassifyProduct } from '../lib/intelligentCategories';

export default function EnhancedProductManager() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImeiManager, setShowImeiManager] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'sale_price' | 'stock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sale_price: '',
    purchase_price: '',
    stock: '',
    barcode: '',
    category_id: '',
    supplier_id: '',
    has_imei_serial: false,
    imei_serial_type: 'serial' as 'imei' | 'serial' | 'both',
    requires_imei_serial: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Datos demo mejorados
        const demoProducts = [
          {
            id: 'demo-product-1',
            name: 'iPhone 15 Pro 128GB',
            description: 'Smartphone Apple iPhone 15 Pro 128GB Titanio Natural',
            sale_price: 4500000,
            purchase_price: 4000000,
            stock: 5,
            barcode: '123456789012',
            category_id: 'demo-category-1',
            supplier_id: 'demo-supplier-1',
            has_imei_serial: true,
            imei_serial_type: 'imei' as const,
            requires_imei_serial: true,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date().toISOString(),
            category: { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Distribuidora Tech', contact_person: 'Juan Pérez', email: 'contacto@tech.com', phone: '3001234567', address: 'Calle 123 #45-67', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-2',
            name: 'Samsung Galaxy S24 256GB',
            description: 'Smartphone Samsung Galaxy S24 256GB Negro',
            sale_price: 3200000,
            purchase_price: 2800000,
            stock: 8,
            barcode: '987654321098',
            category_id: 'demo-category-1',
            supplier_id: 'demo-supplier-2',
            has_imei_serial: true,
            imei_serial_type: 'imei' as const,
            requires_imei_serial: true,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            category: { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-2', name: 'Importadora Global', contact_person: 'María García', email: 'ventas@global.com', phone: '3009876543', address: 'Carrera 45 #12-34', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-3',
            name: 'Cargador USB-C 20W',
            description: 'Cargador rápido USB-C 20W universal',
            sale_price: 45000,
            purchase_price: 25000,
            stock: 50,
            barcode: '456789123456',
            category_id: 'demo-category-2',
            supplier_id: 'demo-supplier-1',
            has_imei_serial: false,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date(Date.now() - 172800000).toISOString(),
            category: { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios para dispositivos', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Distribuidora Tech', contact_person: 'Juan Pérez', email: 'contacto@tech.com', phone: '3001234567', address: 'Calle 123 #45-67', created_at: new Date().toISOString() }
          }
        ];
        
        const demoCategories = [
          { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
          { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios para dispositivos', created_at: new Date().toISOString() }
        ];
        
        const demoSuppliers = [
          { id: 'demo-supplier-1', name: 'Distribuidora Tech', contact_person: 'Juan Pérez', email: 'contacto@tech.com', phone: '3001234567', address: 'Calle 123 #45-67', created_at: new Date().toISOString() },
          { id: 'demo-supplier-2', name: 'Importadora Global', contact_person: 'María García', email: 'ventas@global.com', phone: '3009876543', address: 'Carrera 45 #12-34', created_at: new Date().toISOString() }
        ];
        
        setProducts(demoProducts);
        setCategories(demoCategories);
        setSuppliers(demoSuppliers);
        setLoading(false);
        return;
      }
      
      // Cargar datos reales
      const [productsResult, categoriesResult, suppliersResult] = await Promise.all([
        supabase
          .from('products')
          .select(`
            *,
            category:categories(id, name, description),
            supplier:suppliers(id, name, contact_person, email, phone, address)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name')
      ]);

      if (productsResult.error) throw productsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (suppliersResult.error) throw suppliersResult.error;

      setProducts(productsResult.data || []);
      setCategories(categoriesResult.data || []);
      setSuppliers(suppliersResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setProducts([]);
      setCategories([]);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isDemoMode) {
      // Simular creación en modo demo
      const newProduct = {
        id: `demo-product-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        sale_price: parseFloat(formData.sale_price) || 0,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        stock: parseInt(formData.stock) || 0,
        barcode: formData.barcode,
        category_id: formData.category_id,
        supplier_id: formData.supplier_id,
        has_imei_serial: formData.has_imei_serial,
        imei_serial_type: formData.imei_serial_type,
        requires_imei_serial: formData.requires_imei_serial,
        bulk_import_batch: '',
        import_notes: '',
        imported_at: null,
        imported_by: null,
        created_at: new Date().toISOString(),
        category: categories.find(c => c.id === formData.category_id) || null,
        supplier: suppliers.find(s => s.id === formData.supplier_id) || null
      };
      
      if (editingProduct) {
        setProducts(products.map(p => 
          p.id === editingProduct.id ? { ...newProduct, id: editingProduct.id } : p
        ));
      } else {
        setProducts([newProduct, ...products]);
      }
      
      setShowForm(false);
      setEditingProduct(null);
      resetForm();
      alert(`Producto ${editingProduct ? 'actualizado' : 'creado'} exitosamente en modo demo`);
      return;
    }
    
    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        sale_price: parseFloat(formData.sale_price) || 0,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        stock: parseInt(formData.stock) || 0,
        barcode: formData.barcode,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        has_imei_serial: formData.has_imei_serial,
        imei_serial_type: formData.imei_serial_type,
        requires_imei_serial: formData.requires_imei_serial,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
      }

      setShowForm(false);
      setEditingProduct(null);
      resetForm();
      loadData();
      alert(`Producto ${editingProduct ? 'actualizado' : 'creado'} exitosamente`);
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar producto: ' + (error as Error).message);
    }
  };

  const handleEdit = (product: ProductWithCategory) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      sale_price: product.sale_price.toString(),
      purchase_price: (product.purchase_price || 0).toString(),
      stock: product.stock.toString(),
      barcode: product.barcode,
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      has_imei_serial: product.has_imei_serial,
      imei_serial_type: product.imei_serial_type,
      requires_imei_serial: product.requires_imei_serial,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      if (isDemoMode) {
        setProducts(products.filter(p => p.id !== id));
        alert('Producto eliminado exitosamente en modo demo');
        return;
      }
      
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id);

        if (error) throw error;
        loadData();
        alert('Producto eliminado exitosamente');
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error al eliminar producto: ' + (error as Error).message);
      }
    }
  };

  const handleQuickEdit = async (product: ProductWithCategory, field: string, value: any) => {
    if (isDemoMode) {
      setProducts(products.map(p => 
        p.id === product.id ? { ...p, [field]: value } : p
      ));
      alert(`${field} actualizado en modo demo`);
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ [field]: value })
        .eq('id', product.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Error al actualizar: ' + (error as Error).message);
    }
  };

  const handleDuplicate = (product: ProductWithCategory) => {
    setFormData({
      name: `${product.name} (Copia)`,
      description: product.description,
      sale_price: product.sale_price.toString(),
      purchase_price: (product.purchase_price || 0).toString(),
      stock: '0',
      barcode: '',
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      has_imei_serial: product.has_imei_serial,
      imei_serial_type: product.imei_serial_type,
      requires_imei_serial: product.requires_imei_serial,
    });
    setEditingProduct(null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      sale_price: '',
      purchase_price: '',
      stock: '',
      barcode: '',
      category_id: '',
      supplier_id: '',
      has_imei_serial: false,
      imei_serial_type: 'serial',
      requires_imei_serial: false,
    });
  };

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) return 'bg-red-100 text-red-800';
    if (stock <= 5) return 'bg-yellow-100 text-yellow-800';
    if (stock <= 10) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode.includes(searchTerm);
    
    const matchesCategory = !categoryFilter || product.category_id === categoryFilter;
    
    const matchesStock = stockFilter === 'all' ||
      (stockFilter === 'in_stock' && product.stock > 10) ||
      (stockFilter === 'low_stock' && product.stock > 0 && product.stock <= 10) ||
      (stockFilter === 'out_of_stock' && product.stock === 0);
    
    return matchesSearch && matchesCategory && matchesStock;
  }).sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    switch (sortBy) {
      case 'sale_price':
        aValue = a.sale_price;
        bValue = b.sale_price;
        break;
      case 'stock':
        aValue = a.stock;
        bValue = b.stock;
        break;
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case 'name':
      default:
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
    }
    
    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Gestión de Productos</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showAnalytics ? 'Ocultar' : 'Ver'} Analytics
          </button>
          <button
            onClick={() => setShowBulkImport(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingProduct(null);
              resetForm();
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Producto
          </button>
        </div>
      </div>

      {/* Analytics Dashboard */}
      {showAnalytics && (
        <div className="space-y-6">
          <InventoryAnalyticsDashboard 
            products={products} 
            onProductAction={(productId, action) => {
              const product = products.find(p => p.id === productId || p.name === productId);
              if (product) {
                if (action === 'view') {
                  setSelectedProduct(product);
                  setShowProductDetails(true);
                } else if (action === 'reorder') {
                  handleEdit(product);
                }
              }
            }}
          />
          <SmartInventoryInsights 
            products={products}
            onApplyInsight={(insight) => {
              alert(`Aplicando insight: ${insight.title}`);
            }}
          />
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar productos por nombre, descripción o código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todo el stock</option>
              <option value="in_stock">En stock (>10)</option>
              <option value="low_stock">Stock bajo (1-10)</option>
              <option value="out_of_stock">Sin stock (0)</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Ordenar por Nombre</option>
              <option value="created_at">Ordenar por Fecha</option>
              <option value="sale_price">Ordenar por Precio</option>
              <option value="stock">Ordenar por Stock</option>
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
        {(searchTerm || categoryFilter || stockFilter !== 'all') && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredProducts.length} de {products.length} productos
          </div>
        )}
      </div>

      {/* Product Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {editingProduct ? 'Editar Producto' : 'Agregar Producto'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Precio de Venta *
                </label>
                <FormattedNumberInput
                  value={formData.sale_price}
                  onChange={(value) => setFormData({ ...formData, sale_price: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Precio de Compra
                </label>
                <FormattedNumberInput
                  value={formData.purchase_price}
                  onChange={(value) => setFormData({ ...formData, purchase_price: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Stock *
                </label>
                <FormattedNumberInput
                  value={formData.stock}
                  onChange={(value) => setFormData({ ...formData, stock: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Proveedor
                </label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sin proveedor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
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
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Código de Barras
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* IMEI/Serial Configuration */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-medium text-slate-900 mb-3">Configuración IMEI/Serial</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="has_imei_serial"
                    checked={formData.has_imei_serial}
                    onChange={(e) => setFormData({ ...formData, has_imei_serial: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor="has_imei_serial" className="ml-2 text-sm text-slate-700">
                    Este producto maneja IMEI/Serial
                  </label>
                </div>
                
                {formData.has_imei_serial && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Tipo de Identificador
                      </label>
                      <select
                        value={formData.imei_serial_type}
                        onChange={(e) => setFormData({ ...formData, imei_serial_type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="serial">Número de Serie</option>
                        <option value="imei">IMEI</option>
                        <option value="both">Ambos</option>
                      </select>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="requires_imei_serial"
                        checked={formData.requires_imei_serial}
                        onChange={(e) => setFormData({ ...formData, requires_imei_serial: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                      />
                      <label htmlFor="requires_imei_serial" className="ml-2 text-sm text-slate-700">
                        IMEI/Serial obligatorio para venta
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                {editingProduct ? 'Actualizar' : 'Agregar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingProduct(null);
                  resetForm();
                }}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3"></div>
            </div>
          ))
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {products.length === 0 ? 'No hay productos registrados' : 'No se encontraron productos que coincidan con los filtros'}
            </p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200 group relative">
              <ProductQuickActions
                product={product}
                onDuplicate={handleDuplicate}
                onViewDetails={(p) => {
                  setSelectedProduct(p);
                  setShowProductDetails(true);
                }}
                onQuickEdit={handleQuickEdit}
              />
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{product.name}</h3>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{product.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(product.sale_price)}
                    </span>
                    {product.purchase_price && product.purchase_price > 0 && (
                      <span className="text-xs text-slate-500">
                        Margen: {(((product.sale_price - product.purchase_price) / product.purchase_price) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(product)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${getStockStatusColor(product.stock)}`}>
                    Stock: {product.stock}
                  </span>
                  {product.has_imei_serial && (
                    <button
                      onClick={() => {
                        setSelectedProduct(product);
                        setShowImeiManager(true);
                      }}
                      className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded hover:bg-purple-200 transition-colors duration-200 flex items-center"
                    >
                      <Hash className="h-3 w-3 mr-1" />
                      {product.imei_serial_type === 'imei' ? 'IMEI' : 
                       product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI/Serial'}
                    </button>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>{product.category?.name || 'Sin categoría'}</span>
                  {product.barcode && (
                    <span className="font-mono text-xs">{product.barcode}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <ImeiSerialManager
        isOpen={showImeiManager}
        onClose={() => {
          setShowImeiManager(false);
          setSelectedProduct(null);
        }}
        onUpdate={loadData}
        product={selectedProduct!}
      />

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

      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          isOpen={showProductDetails}
          onClose={() => {
            setShowProductDetails(false);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
}