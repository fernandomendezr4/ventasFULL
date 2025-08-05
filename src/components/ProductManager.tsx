import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit2, Trash2, Package, Search, Filter, Eye, Copy, Hash, Zap, TrendingUp, AlertTriangle, CheckCircle, Upload, Download, Star, BarChart3 } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { ProductWithCategory, Category, Supplier } from '../lib/types';
import { formatCurrency, calculateProfit, calculateProfitMargin } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import ImeiSerialManager from './ImeiSerialManager';
import BulkProductImport from './BulkProductImport';
import ProductDetailsModal from './ProductDetailsModal';
import ProductFormValidation from './ProductFormValidation';
import ProductQuickActions from './ProductQuickActions';

export default function ProductManager() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [showImeiManager, setShowImeiManager] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Estados para búsqueda y filtros inteligentes
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'normal'>('all');
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'created_at' | 'profit'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Estados para análisis inteligente
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [productAnalytics, setProductAnalytics] = useState<any>(null);
  
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

  const [duplicateCheck, setDuplicateCheck] = useState({
    name: false,
    barcode: false
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadSuppliers();
  }, []);

  // Efecto para análisis de productos
  useEffect(() => {
    if (products.length > 0) {
      generateProductAnalytics();
    }
  }, [products]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
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
            created_at: new Date().toISOString(),
            has_imei_serial: true,
            imei_serial_type: 'imei' as const,
            requires_imei_serial: true,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            category: { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Apple Store', contact_person: 'Contacto Apple', email: 'apple@store.com', phone: '3001234567', address: 'Dirección Apple', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-2',
            name: 'Samsung Galaxy S24 256GB',
            description: 'Smartphone Samsung Galaxy S24 256GB Negro Fantasma',
            sale_price: 3200000,
            purchase_price: 2800000,
            stock: 8,
            barcode: '987654321098',
            category_id: 'demo-category-1',
            supplier_id: 'demo-supplier-2',
            created_at: new Date(Date.now() - 86400000).toISOString(),
            has_imei_serial: true,
            imei_serial_type: 'imei' as const,
            requires_imei_serial: true,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            category: { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-2', name: 'Samsung', contact_person: 'Contacto Samsung', email: 'samsung@store.com', phone: '3009876543', address: 'Dirección Samsung', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-3',
            name: 'Audífonos Bluetooth Premium',
            description: 'Audífonos inalámbricos con cancelación de ruido activa',
            sale_price: 450000,
            purchase_price: 320000,
            stock: 15,
            barcode: '456789123456',
            category_id: 'demo-category-2',
            supplier_id: 'demo-supplier-3',
            created_at: new Date(Date.now() - 172800000).toISOString(),
            has_imei_serial: false,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            category: { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios electrónicos', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-3', name: 'Accesorios Plus', contact_person: 'Contacto Accesorios', email: 'accesorios@plus.com', phone: '3005555555', address: 'Dirección Accesorios', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-4',
            name: 'Cargador Inalámbrico 15W',
            description: 'Cargador inalámbrico rápido compatible con iPhone y Android',
            sale_price: 120000,
            purchase_price: 80000,
            stock: 25,
            barcode: '789123456789',
            category_id: 'demo-category-2',
            supplier_id: 'demo-supplier-3',
            created_at: new Date(Date.now() - 259200000).toISOString(),
            has_imei_serial: false,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            category: { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios electrónicos', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-3', name: 'Accesorios Plus', contact_person: 'Contacto Accesorios', email: 'accesorios@plus.com', phone: '3005555555', address: 'Dirección Accesorios', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-5',
            name: 'Protector de Pantalla Vidrio Templado',
            description: 'Protector de pantalla de vidrio templado 9H ultra resistente',
            sale_price: 35000,
            purchase_price: 18000,
            stock: 2, // Stock bajo para demostrar alertas
            barcode: '321654987321',
            category_id: 'demo-category-2',
            supplier_id: 'demo-supplier-3',
            created_at: new Date(Date.now() - 345600000).toISOString(),
            has_imei_serial: false,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            category: { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios electrónicos', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-3', name: 'Accesorios Plus', contact_person: 'Contacto Accesorios', email: 'accesorios@plus.com', phone: '3005555555', address: 'Dirección Accesorios', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-6',
            name: 'Funda Silicona Premium',
            description: 'Funda de silicona premium con protección anti-caídas',
            sale_price: 65000,
            purchase_price: 35000,
            stock: 0, // Sin stock para demostrar productos agotados
            barcode: '654321987654',
            category_id: 'demo-category-2',
            supplier_id: 'demo-supplier-3',
            created_at: new Date(Date.now() - 432000000).toISOString(),
            has_imei_serial: false,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            category: { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios electrónicos', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-3', name: 'Accesorios Plus', contact_person: 'Contacto Accesorios', email: 'accesorios@plus.com', phone: '3005555555', address: 'Dirección Accesorios', created_at: new Date().toISOString() }
          }
        ];
        
        setProducts(demoProducts);
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          supplier:suppliers(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      if (isDemoMode) {
        const demoCategories = [
          { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
          { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios electrónicos', created_at: new Date().toISOString() },
          { id: 'demo-category-3', name: 'Tablets', description: 'Tabletas y dispositivos portátiles', created_at: new Date().toISOString() }
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
      setCategories([]);
    }
  };

  const loadSuppliers = async () => {
    try {
      if (isDemoMode) {
        const demoSuppliers = [
          { id: 'demo-supplier-1', name: 'Apple Store', contact_person: 'Contacto Apple', email: 'apple@store.com', phone: '3001234567', address: 'Dirección Apple', created_at: new Date().toISOString() },
          { id: 'demo-supplier-2', name: 'Samsung', contact_person: 'Contacto Samsung', email: 'samsung@store.com', phone: '3009876543', address: 'Dirección Samsung', created_at: new Date().toISOString() },
          { id: 'demo-supplier-3', name: 'Accesorios Plus', contact_person: 'Contacto Accesorios', email: 'accesorios@plus.com', phone: '3005555555', address: 'Dirección Accesorios', created_at: new Date().toISOString() }
        ];
        setSuppliers(demoSuppliers);
        return;
      }
      
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      setSuppliers([]);
    }
  };

  // Generar análisis inteligente de productos
  const generateProductAnalytics = useCallback(() => {
    if (products.length === 0) return;

    const analytics = {
      totalProducts: products.length,
      totalValue: products.reduce((sum, p) => sum + (p.sale_price * p.stock), 0),
      totalCost: products.reduce((sum, p) => sum + ((p.purchase_price || 0) * p.stock), 0),
      lowStockProducts: products.filter(p => p.stock <= 5 && p.stock > 0).length,
      outOfStockProducts: products.filter(p => p.stock === 0).length,
      highMarginProducts: products.filter(p => {
        if (!p.purchase_price) return false;
        const margin = calculateProfitMargin(p.sale_price, p.purchase_price);
        return margin > 50;
      }).length,
      averagePrice: products.reduce((sum, p) => sum + p.sale_price, 0) / products.length,
      categoriesCount: new Set(products.map(p => p.category_id)).size,
      suppliersCount: new Set(products.map(p => p.supplier_id)).size,
      imeiProducts: products.filter(p => p.has_imei_serial).length
    };

    setProductAnalytics(analytics);
  }, [products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isDemoMode) {
      alert('Función no disponible en modo demo');
      return;
    }
    
    // Validar formulario
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) errors.name = 'El nombre es requerido';
    if (!formData.sale_price || parseFloat(formData.sale_price) <= 0) errors.sale_price = 'El precio de venta es requerido';
    if (!formData.stock || parseInt(formData.stock) < 0) errors.stock = 'El stock es requerido';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        sale_price: parseFloat(formData.sale_price),
        purchase_price: parseFloat(formData.purchase_price) || 0,
        stock: parseInt(formData.stock),
        barcode: formData.barcode.trim(),
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
      loadProducts();
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
        alert('Función no disponible en modo demo');
        return;
      }
      
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id);

        if (error) throw error;
        loadProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error al eliminar producto: ' + (error as Error).message);
      }
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

  const handleQuickEdit = async (product: ProductWithCategory, field: string, value: any) => {
    if (isDemoMode) {
      alert('Función no disponible en modo demo');
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ [field]: value })
        .eq('id', product.id);

      if (error) throw error;
      loadProducts();
    } catch (error) {
      console.error('Error in quick edit:', error);
      alert('Error al actualizar: ' + (error as Error).message);
    }
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
    setFormErrors({});
    setDuplicateCheck({ name: false, barcode: false });
  };

  // Filtrado y ordenamiento inteligente
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter(product => {
      // Filtro por búsqueda
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(searchLower);
        const matchesDescription = product.description.toLowerCase().includes(searchLower);
        const matchesBarcode = product.barcode.includes(searchTerm);
        const matchesCategory = product.category?.name.toLowerCase().includes(searchLower);
        const matchesSupplier = product.supplier?.name.toLowerCase().includes(searchLower);
        
        if (!matchesName && !matchesDescription && !matchesBarcode && !matchesCategory && !matchesSupplier) {
          return false;
        }
      }
      
      // Filtro por categoría
      if (categoryFilter && product.category_id !== categoryFilter) {
        return false;
      }
      
      // Filtro por proveedor
      if (supplierFilter && product.supplier_id !== supplierFilter) {
        return false;
      }
      
      // Filtro por stock
      if (stockFilter !== 'all') {
        switch (stockFilter) {
          case 'low':
            if (product.stock > 5) return false;
            break;
          case 'out':
            if (product.stock > 0) return false;
            break;
          case 'normal':
            if (product.stock <= 5) return false;
            break;
        }
      }
      
      // Filtro por rango de precio
      if (priceRange.min && product.sale_price < parseFloat(priceRange.min)) {
        return false;
      }
      if (priceRange.max && product.sale_price > parseFloat(priceRange.max)) {
        return false;
      }
      
      return true;
    });

    // Ordenamiento
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'price':
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
        case 'profit':
          aValue = calculateProfit(a.sale_price, a.purchase_price || 0);
          bValue = calculateProfit(b.sale_price, b.purchase_price || 0);
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

    return filtered;
  }, [products, searchTerm, categoryFilter, supplierFilter, stockFilter, priceRange, sortBy, sortOrder]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Gestión Inteligente de Productos</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center"
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
      {productAnalytics && showAnalytics && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-900 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Análisis Inteligente de Inventario
            </h3>
            <button
              onClick={() => setShowAnalytics(false)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Ocultar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900">Valor Total</h4>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(productAnalytics.totalValue)}</p>
              <p className="text-xs text-blue-700">Inventario completo</p>
            </div>
            <div className="bg-white border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900">Ganancia Potencial</h4>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(productAnalytics.totalValue - productAnalytics.totalCost)}
              </p>
              <p className="text-xs text-green-700">Si se vende todo</p>
            </div>
            <div className="bg-white border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900">Stock Bajo</h4>
              <p className="text-2xl font-bold text-yellow-900">{productAnalytics.lowStockProducts}</p>
              <p className="text-xs text-yellow-700">Requieren atención</p>
            </div>
            <div className="bg-white border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-900">Sin Stock</h4>
              <p className="text-2xl font-bold text-red-900">{productAnalytics.outOfStockProducts}</p>
              <p className="text-xs text-red-700">No disponibles</p>
            </div>
          </div>
        </div>
      )}

      {/* Filtros Avanzados */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, descripción, código de barras, categoría o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className={`px-3 py-2 rounded-lg border transition-colors duration-200 ${
                  showAnalytics 
                    ? 'bg-blue-100 border-blue-300 text-blue-700' 
                    : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              >
                {viewMode === 'grid' ? '📋' : '⊞'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">Todo el stock</option>
              <option value="normal">Stock normal</option>
              <option value="low">Stock bajo</option>
              <option value="out">Sin stock</option>
            </select>

            <input
              type="number"
              placeholder="Precio mín"
              value={priceRange.min}
              onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />

            <input
              type="number"
              placeholder="Precio máx"
              value={priceRange.max}
              onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as any);
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="name-asc">Nombre A-Z</option>
              <option value="name-desc">Nombre Z-A</option>
              <option value="price-asc">Precio menor</option>
              <option value="price-desc">Precio mayor</option>
              <option value="stock-asc">Menos stock</option>
              <option value="stock-desc">Más stock</option>
              <option value="profit-desc">Mayor ganancia</option>
              <option value="created_at-desc">Más recientes</option>
            </select>
          </div>

          {(searchTerm || categoryFilter || supplierFilter || stockFilter !== 'all' || priceRange.min || priceRange.max) && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Mostrando {filteredAndSortedProducts.length} de {products.length} productos</span>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('');
                  setSupplierFilter('');
                  setStockFilter('all');
                  setPriceRange({ min: '', max: '' });
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Product Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {editingProduct ? 'Editar Producto' : 'Agregar Producto'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: iPhone 15 Pro 128GB"
                />
                {formErrors.name && (
                  <p className="text-red-600 text-xs mt-1">{formErrors.name}</p>
                )}
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
                  placeholder="Código único del producto"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Descripción detallada del producto..."
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
                {formErrors.sale_price && (
                  <p className="text-red-600 text-xs mt-1">{formErrors.sale_price}</p>
                )}
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
                  Stock Inicial *
                </label>
                <FormattedNumberInput
                  value={formData.stock}
                  onChange={(value) => setFormData({ ...formData, stock: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
                {formErrors.stock && (
                  <p className="text-red-600 text-xs mt-1">{formErrors.stock}</p>
                )}
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

            {/* Configuración IMEI/Serial */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-medium text-purple-900 mb-3 flex items-center">
                <Hash className="h-4 w-4 mr-2" />
                Configuración IMEI/Serial
              </h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="has_imei_serial"
                    checked={formData.has_imei_serial}
                    onChange={(e) => setFormData({ ...formData, has_imei_serial: e.target.checked })}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
                  />
                  <label htmlFor="has_imei_serial" className="ml-2 text-sm text-slate-700">
                    Este producto maneja IMEI/Serial
                  </label>
                </div>
                
                {formData.has_imei_serial && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Tipo de Identificador
                      </label>
                      <select
                        value={formData.imei_serial_type}
                        onChange={(e) => setFormData({ ...formData, imei_serial_type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="serial">Solo Número de Serie</option>
                        <option value="imei">Solo IMEI</option>
                        <option value="both">IMEI y Número de Serie</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="requires_imei_serial"
                        checked={formData.requires_imei_serial}
                        onChange={(e) => setFormData({ ...formData, requires_imei_serial: e.target.checked })}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
                      />
                      <label htmlFor="requires_imei_serial" className="ml-2 text-sm text-slate-700">
                        IMEI/Serial obligatorio para venta
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Validación del Formulario */}
            <ProductFormValidation
              formData={formData}
              errors={formErrors}
              duplicateCheck={duplicateCheck}
            />

            {isDemoMode && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-yellow-600 mr-2" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Modo Demo</h4>
                    <p className="text-sm text-yellow-800">
                      Los cambios no se guardarán en modo demo.
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

      {/* Products Display */}
      {loading ? (
        <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : filteredAndSortedProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">
            {products.length === 0 
              ? 'No hay productos registrados' 
              : 'No se encontraron productos que coincidan con los filtros'}
          </p>
          {products.length === 0 && (
            <button
              onClick={() => {
                setShowForm(true);
                setEditingProduct(null);
                resetForm();
              }}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Agregar Primer Producto
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedProducts.map((product) => {
            const profit = calculateProfit(product.sale_price, product.purchase_price || 0);
            const margin = calculateProfitMargin(product.sale_price, product.purchase_price || 0);
            
            return (
              <div key={product.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200 border group relative">
                {/* Quick Actions */}
                <ProductQuickActions
                  product={product}
                  onDuplicate={handleDuplicate}
                  onViewDetails={(p) => {
                    setSelectedProduct(p);
                    setShowDetailsModal(true);
                  }}
                  onQuickEdit={handleQuickEdit}
                />

                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">{product.name}</h3>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-2">{product.description}</p>
                    
                    {/* Precio y Ganancia */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-green-600">
                          {formatCurrency(product.sale_price)}
                        </span>
                        {product.purchase_price && product.purchase_price > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                            +{margin.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {product.purchase_price && product.purchase_price > 0 && (
                        <p className="text-xs text-slate-500">
                          Costo: {formatCurrency(product.purchase_price)} • Ganancia: {formatCurrency(profit)}
                        </p>
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
                
                {/* Información adicional */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm px-2 py-1 rounded-full ${
                      product.stock === 0 
                        ? 'bg-red-100 text-red-800' 
                        : product.stock <= 5 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-green-100 text-green-800'
                    }`}>
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
                        {product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'}
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    {product.category && (
                      <span className="flex items-center">
                        <Package className="h-3 w-3 mr-1" />
                        {product.category.name}
                      </span>
                    )}
                    {product.supplier && (
                      <span className="flex items-center">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {product.supplier.name}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-xs text-slate-400">
                    Creado: {new Date(product.created_at).toLocaleDateString('es-ES')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista de Lista */
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Producto</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Precio</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Stock</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Categoría</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Ganancia</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAndSortedProducts.map((product) => {
                  const profit = calculateProfit(product.sale_price, product.purchase_price || 0);
                  const margin = calculateProfitMargin(product.sale_price, product.purchase_price || 0);
                  
                  return (
                    <tr key={product.id} className="hover:bg-slate-50 transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-900">{product.name}</h4>
                            <p className="text-sm text-slate-600 line-clamp-1">{product.description}</p>
                            {product.barcode && (
                              <p className="text-xs text-slate-500 font-mono">{product.barcode}</p>
                            )}
                          </div>
                          {product.has_imei_serial && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              <Hash className="h-3 w-3 inline mr-1" />
                              {product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-green-600">{formatCurrency(product.sale_price)}</p>
                          {product.purchase_price && product.purchase_price > 0 && (
                            <p className="text-xs text-slate-500">
                              Costo: {formatCurrency(product.purchase_price)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          product.stock === 0 
                            ? 'bg-red-100 text-red-800' 
                            : product.stock <= 5 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-green-100 text-green-800'
                        }`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-900">
                          {product.category?.name || 'Sin categoría'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {product.purchase_price && product.purchase_price > 0 ? (
                          <div>
                            <p className="font-medium text-slate-900">{formatCurrency(profit)}</p>
                            <p className="text-xs text-slate-500">{margin.toFixed(1)}% margen</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              setShowDetailsModal(true);
                            }}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {product.has_imei_serial && (
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setShowImeiManager(true);
                              }}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                              title="Gestionar IMEI/Serial"
                            >
                              <Hash className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(product)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors duration-200"
                            title="Duplicar"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modales */}
      {showImeiManager && selectedProduct && (
        <ImeiSerialManager
          isOpen={showImeiManager}
          onClose={() => {
            setShowImeiManager(false);
            setSelectedProduct(null);
          }}
          onUpdate={loadProducts}
          product={selectedProduct}
        />
      )}

      {showBulkImport && (
        <BulkProductImport
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => {
            setShowBulkImport(false);
            loadProducts();
          }}
          categories={categories}
          suppliers={suppliers}
        />
      )}

      {showDetailsModal && selectedProduct && (
        <ProductDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
        />
      )}
    </div>
  );
}