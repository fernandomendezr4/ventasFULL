import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Package, Search, Filter, Eye, Copy, Hash, AlertTriangle, CheckCircle, Upload, Download, BarChart3, Brain, Zap, TrendingUp, Lightbulb, Target, Smartphone, RefreshCw, X } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { ProductWithCategory, Category, Supplier } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import ImeiSerialManager from './ImeiSerialManager';
import BulkProductImport from './BulkProductImport';
import ProductDetailsModal from './ProductDetailsModal';
import SmartInventoryInsights from './SmartInventoryInsights';
import InventoryAnalyticsDashboard from './InventoryAnalyticsDashboard';
import { suggestCategory, autoClassifyProduct, type CategorySuggestion } from '../lib/intelligentCategories';

export default function EnhancedProductManager() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showImeiManager, setShowImeiManager] = useState(false);
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'sale_price' | 'stock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'analytics'>('grid');
  const [smartSuggestions, setSmartSuggestions] = useState<CategorySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{
    name: boolean;
    barcode: boolean;
  }>({
    name: false,
    barcode: false
  });
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

  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Demo mode: provide comprehensive sample data
        const demoProducts = [
          {
            id: 'demo-product-1',
            name: 'iPhone 15 Pro 128GB',
            description: 'Smartphone Apple iPhone 15 Pro 128GB Titanio Natural con chip A17 Pro',
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
            description: 'Smartphone Samsung Galaxy S24 256GB Negro con cámara de 200MP',
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
            description: 'Cargador rápido USB-C 20W universal compatible con iPhone y Android',
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
          },
          {
            id: 'demo-product-4',
            name: 'AirPods Pro 2da Gen',
            description: 'Auriculares inalámbricos Apple AirPods Pro con cancelación activa de ruido',
            sale_price: 850000,
            purchase_price: 650000,
            stock: 12,
            barcode: '789456123789',
            category_id: 'demo-category-3',
            supplier_id: 'demo-supplier-1',
            has_imei_serial: true,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date(Date.now() - 259200000).toISOString(),
            category: { id: 'demo-category-3', name: 'Audio', description: 'Equipos de audio y sonido', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Distribuidora Tech', contact_person: 'Juan Pérez', email: 'contacto@tech.com', phone: '3001234567', address: 'Calle 123 #45-67', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-5',
            name: 'Funda iPhone 15 Pro',
            description: 'Funda protectora transparente para iPhone 15 Pro con protección anti-caídas',
            sale_price: 35000,
            purchase_price: 18000,
            stock: 25,
            barcode: '321654987321',
            category_id: 'demo-category-2',
            supplier_id: 'demo-supplier-2',
            has_imei_serial: false,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date(Date.now() - 345600000).toISOString(),
            category: { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios para dispositivos', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-2', name: 'Importadora Global', contact_person: 'María García', email: 'ventas@global.com', phone: '3009876543', address: 'Carrera 45 #12-34', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-6',
            name: 'Power Bank 20000mAh',
            description: 'Batería externa portátil 20000mAh con carga rápida y pantalla LED',
            sale_price: 120000,
            purchase_price: 80000,
            stock: 0,
            barcode: '654321987654',
            category_id: 'demo-category-2',
            supplier_id: 'demo-supplier-1',
            has_imei_serial: false,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date(Date.now() - 432000000).toISOString(),
            category: { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios para dispositivos', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Distribuidora Tech', contact_person: 'Juan Pérez', email: 'contacto@tech.com', phone: '3001234567', address: 'Calle 123 #45-67', created_at: new Date().toISOString() }
          }
        ];
        
        const demoCategories = [
          { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
          { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios para dispositivos', created_at: new Date().toISOString() },
          { id: 'demo-category-3', name: 'Audio', description: 'Equipos de audio y sonido', created_at: new Date().toISOString() }
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
      ...formData,
      name: suggestion.suggested_name,
      description: `${suggestion.reasoning}. Palabras clave: ${suggestion.keywords_matched.join(', ')}.`
    });
    setShowForm(true);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isDemoMode) {
      // Demo mode: simulate product creation/update
      const newProduct = {
        id: editingProduct?.id || `demo-product-${Date.now()}`,
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
        bulk_import_batch: '',
        import_notes: '',
        imported_at: null,
        imported_by: null,
        created_at: editingProduct?.created_at || new Date().toISOString(),
        category: formData.category_id ? categories.find(c => c.id === formData.category_id) || null : null,
        supplier: formData.supplier_id ? suppliers.find(s => s.id === formData.supplier_id) || null : null
      };
      
      if (editingProduct) {
        setProducts(products.map(p => p.id === editingProduct.id ? newProduct : p));
      } else {
        setProducts([newProduct, ...products]);
      }
      
      setShowForm(false);
      setEditingProduct(null);
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
      loadData();
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
      stock: '0', // Reset stock for duplicated product
      barcode: '', // Reset barcode to avoid duplicates
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      has_imei_serial: product.has_imei_serial,
      imei_serial_type: product.imei_serial_type,
      requires_imei_serial: product.requires_imei_serial,
    });
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleQuickStockUpdate = async (productId: string, newStock: number) => {
    if (isDemoMode) {
      setProducts(products.map(p => 
        p.id === productId ? { ...p, stock: newStock } : p
      ));
      return;
    }
    
    try {
      const { error } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Error al actualizar stock: ' + (error as Error).message);
    }
  };

  const handleQuickPriceUpdate = async (productId: string, newPrice: number) => {
    if (isDemoMode) {
      setProducts(products.map(p => 
        p.id === productId ? { ...p, sale_price: newPrice } : p
      ));
      return;
    }
    
    try {
      const { error } = await supabase
        .from('products')
        .update({ sale_price: newPrice })
        .eq('id', productId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Error al actualizar precio: ' + (error as Error).message);
    }
  };

  const handleInsightAction = (insight: any) => {
    switch (insight.type) {
      case 'reorder':
        alert('Funcionalidad de reorden automático en desarrollo');
        break;
      case 'price_optimization':
        alert('Funcionalidad de optimización de precios en desarrollo');
        break;
      case 'category_suggestion':
        setViewMode('grid');
        setCategoryFilter('');
        break;
      default:
        alert('Acción no implementada');
    }
  };

  // Filtrado y paginación optimizados
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode.includes(searchTerm);
      
      const matchesCategory = !categoryFilter || product.category_id === categoryFilter;
      
      const matchesStock = stockFilter === 'all' || 
        (stockFilter === 'in_stock' && product.stock > 0) ||
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
  }, [products, searchTerm, categoryFilter, stockFilter, sortBy, sortOrder]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) {
      return 'bg-red-100 text-red-800 border-red-200';
    } else if (stock <= 10) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    } else {
      return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getStockStatusText = (stock: number) => {
    if (stock === 0) return 'Sin stock';
    if (stock <= 10) return 'Stock bajo';
    return 'En stock';
  };

  const calculateProfitMargin = (salePrice: number, purchasePrice: number) => {
    if (!purchasePrice || purchasePrice === 0) return 0;
    return ((salePrice - purchasePrice) / purchasePrice) * 100;
  };

  const getProfitMarginColor = (margin: number) => {
    if (margin >= 30) return 'text-green-600';
    if (margin >= 15) return 'text-yellow-600';
    if (margin > 0) return 'text-orange-600';
    return 'text-red-600';
  };

  if (viewMode === 'analytics') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-slate-900">Análisis de Inventario</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
            >
              Volver a Productos
            </button>
          </div>
        </div>
        <InventoryAnalyticsDashboard 
          products={products} 
          onProductAction={(productName, action) => {
            if (action === 'view') {
              const product = products.find(p => p.name === productName);
              if (product) {
                setSelectedProduct(product);
                setShowProductDetails(true);
              }
            } else if (action === 'reorder') {
              alert('Funcionalidad de reorden en desarrollo');
            }
          }}
        />
        <SmartInventoryInsights 
          products={products} 
          onApplyInsight={handleInsightAction}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Productos</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('analytics')}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 flex items-center"
          >
            <Brain className="h-4 w-4 mr-2" />
            Análisis IA
          </button>
          <button
            onClick={generateSmartSuggestions}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
          >
            <Lightbulb className="h-4 w-4 mr-2" />
            Sugerencias IA
          </button>
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
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Producto
          </button>
        </div>
      </div>

      {/* Sugerencias Inteligentes */}
      {showSuggestions && smartSuggestions.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-purple-900 flex items-center">
              <Brain className="h-5 w-5 mr-2" />
              Sugerencias Inteligentes de Productos
            </h3>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-purple-600 hover:text-purple-800 transition-colors duration-200"
            >
              <X className="h-5 w-5" />
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
        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar productos por nombre, descripción o código de barras..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
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
              onChange={(e) => {
                setStockFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todo el stock</option>
              <option value="in_stock">En stock</option>
              <option value="low_stock">Stock bajo</option>
              <option value="out_of_stock">Sin stock</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'created_at' | 'sale_price' | 'stock')}
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
            <div className="flex border border-slate-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 transition-colors duration-200 ${
                  viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Package className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 transition-colors duration-200 ${
                  viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {(searchTerm || categoryFilter || stockFilter !== 'all') && (
          <div className="text-sm text-slate-600">
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
                  placeholder="Ej: iPhone 15 Pro 128GB"
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
                placeholder="Descripción detallada del producto..."
              />
            </div>

            {/* IMEI/Serial Configuration */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-3">Configuración IMEI/Serial</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="has_imei_serial"
                    checked={formData.has_imei_serial}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      has_imei_serial: e.target.checked,
                      requires_imei_serial: e.target.checked ? formData.requires_imei_serial : false
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor="has_imei_serial" className="ml-2 text-sm text-slate-700">
                    Este producto maneja IMEI/Serial
                  </label>
                </div>
                
                {formData.has_imei_serial && (
                  <div className="ml-6 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Tipo de Identificador
                      </label>
                      <select
                        value={formData.imei_serial_type}
                        onChange={(e) => setFormData({ ...formData, imei_serial_type: e.target.value as 'imei' | 'serial' | 'both' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="serial">Solo Número de Serie</option>
                        <option value="imei">Solo IMEI (15 dígitos)</option>
                        <option value="both">IMEI y Número de Serie</option>
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
                    
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <p className="text-xs text-blue-800">
                        <strong>Nota:</strong> Si marcas como obligatorio, cada unidad vendida requerirá 
                        un {formData.imei_serial_type === 'imei' ? 'IMEI' : 
                             formData.imei_serial_type === 'serial' ? 'número de serie' : 'IMEI/Serial'} único.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {isDemoMode && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-yellow-600 mr-2" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Modo Demo</h4>
                    <p className="text-sm text-yellow-800">
                      El producto se guardará localmente para demostración.
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
                onClick={() => setShowForm(false)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Producto</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Categoría</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Precio</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Stock</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Margen</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-500">
                        {products.length === 0 
                          ? 'No hay productos registrados' 
                          : 'No se encontraron productos que coincidan con los filtros'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => {
                    const margin = calculateProfitMargin(product.sale_price, product.purchase_price || 0);
                    return (
                      <tr key={product.id} className="hover:bg-slate-50 transition-colors duration-200">
                        <td className="px-6 py-4">
                          <div>
                            <h4 className="font-medium text-slate-900">{product.name}</h4>
                            <p className="text-sm text-slate-600 line-clamp-2">{product.description}</p>
                            {product.has_imei_serial && (
                              <div className="flex items-center mt-1">
                                <Hash className="h-3 w-3 text-purple-600 mr-1" />
                                <span className="text-xs text-purple-600">
                                  {product.imei_serial_type === 'imei' ? 'IMEI' : 
                                   product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI/Serial'}
                                  {product.requires_imei_serial && ' (Obligatorio)'}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {product.category?.name || 'Sin categoría'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">{formatCurrency(product.sale_price)}</p>
                            {product.purchase_price && (
                              <p className="text-sm text-slate-600">Compra: {formatCurrency(product.purchase_price)}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full border ${getStockStatusColor(product.stock)}`}>
                            {product.stock} {getStockStatusText(product.stock)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {product.purchase_price ? (
                            <span className={`font-medium ${getProfitMarginColor(margin)}`}>
                              {margin.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setShowProductDetails(true);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
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
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedProducts.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">
                {products.length === 0 
                  ? 'No hay productos registrados' 
                  : 'No se encontraron productos que coincidan con los filtros'}
              </p>
            </div>
          ) : (
            paginatedProducts.map((product) => {
              const margin = calculateProfitMargin(product.sale_price, product.purchase_price || 0);
              return (
                <div key={product.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200 group relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 mb-1">{product.name}</h3>
                      <p className="text-sm text-slate-600 line-clamp-2 mb-2">{product.description}</p>
                      
                      {/* Product badges */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {product.category?.name || 'Sin categoría'}
                        </span>
                        {product.has_imei_serial && (
                          <span className="inline-block px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                            <Hash className="h-3 w-3 inline mr-1" />
                            {product.imei_serial_type === 'imei' ? 'IMEI' : 
                             product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI/Serial'}
                          </span>
                        )}
                        {product.requires_imei_serial && (
                          <span className="inline-block px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                            Obligatorio
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Precio:</span>
                          <span className="font-bold text-green-600">{formatCurrency(product.sale_price)}</span>
                        </div>
                        
                        {product.purchase_price && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Margen:</span>
                            <span className={`font-medium ${getProfitMarginColor(margin)}`}>
                              {margin.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Stock:</span>
                          <span className={`inline-block px-2 py-1 text-xs rounded-full border ${getStockStatusColor(product.stock)}`}>
                            {product.stock}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedProduct(product);
                        setShowProductDetails(true);
                      }}
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center text-sm"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </button>
                    
                    {product.has_imei_serial && (
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowImeiManager(true);
                        }}
                        className="flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center justify-center text-sm"
                      >
                        <Hash className="h-4 w-4 mr-1" />
                        IMEI
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleEdit(product)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} de {filteredProducts.length} productos
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Anterior
            </button>
            <span className="px-3 py-2 text-sm text-slate-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
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
        <>
          <ImeiSerialManager
            isOpen={showImeiManager}
            onClose={() => {
              setShowImeiManager(false);
              setSelectedProduct(null);
            }}
            onUpdate={() => {
              loadData();
            }}
            product={selectedProduct}
          />

          <ProductDetailsModal
            isOpen={showProductDetails}
            onClose={() => {
              setShowProductDetails(false);
              setSelectedProduct(null);
            }}
            onEdit={(product) => {
              setShowProductDetails(false);
              handleEdit(product);
            }}
            onDelete={(productId) => {
              setShowProductDetails(false);
              handleDelete(productId);
            }}
            onQuickUpdate={(field, value) => {
              if (field === 'stock') {
                handleQuickStockUpdate(selectedProduct.id, value);
              } else if (field === 'sale_price') {
                handleQuickPriceUpdate(selectedProduct.id, value);
              }
            }}
            product={selectedProduct}
          />
        </>
      )}

      {/* Información del Sistema IA */}
      <div className="bg-gradient-to-r from-slate-50 to-purple-50 border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Brain className="h-5 w-5 mr-2 text-purple-600" />
          Sistema de Inteligencia Artificial para Productos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <span>Optimización de precios inteligente</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Detección de duplicados avanzada</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Sugerencias de stock automáticas</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Análisis de rentabilidad en tiempo real</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Gestión avanzada de IMEI/Serial</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Importación masiva con validación</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Dashboard de análisis predictivo</span>
            </div>
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