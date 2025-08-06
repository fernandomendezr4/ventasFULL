import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, Search, Filter, Brain, Zap, TrendingUp, Lightbulb, BarChart3, CheckCircle, Eye, Hash, Tag, Truck, DollarSign, AlertTriangle, Download, Upload, Grid, List, ScanLine, Wand2 } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { ProductWithCategory, Category, Supplier } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import ImeiSerialManager from './ImeiSerialManager';
import BulkProductImport from './BulkProductImport';
import ProductFormValidation from './ProductFormValidation';
import SmartInventoryInsights from './SmartInventoryInsights';
import InventoryAnalyticsDashboard from './InventoryAnalyticsDashboard';
import ProductQuickActions from './ProductQuickActions';
import { 
  suggestCategory, 
  autoClassifyProduct, 
  analyzeCategoryPerformance,
  findAndClassifyUncategorizedProducts,
  type CategorySuggestion 
} from '../lib/intelligentCategories';
import { 
  validateProductForm, 
  validateProductDuplicates, 
  generateSmartBarcode,
  calculateProfitMetrics,
  type ProductFormData 
} from '../lib/productValidation';

export default function EnhancedProductManager() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showImeiManager, setShowImeiManager] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'inventory' | 'analytics' | 'ai-insights' | 'classification'>('inventory');
  
  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock'>('all');
  const [priceRangeFilter, setPriceRangeFilter] = useState<'all' | 'budget' | 'mid' | 'premium'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'sale_price' | 'stock' | 'profit_margin'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // IA y clasificación
  const [aiSuggestions, setAiSuggestions] = useState<CategorySuggestion[]>([]);
  const [uncategorizedProducts, setUncategorizedProducts] = useState<any[]>([]);
  const [categoryAnalytics, setCategoryAnalytics] = useState<any[]>([]);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [runningAiAnalysis, setRunningAiAnalysis] = useState(false);

  // Formulario
  const [formData, setFormData] = useState<ProductFormData>({
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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [duplicateCheck, setDuplicateCheck] = useState({ name: false, barcode: false });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Enhanced demo data with AI features
        const demoProducts = [
          {
            id: 'demo-product-1',
            name: 'iPhone 15 Pro 128GB Titanio Natural',
            description: 'Smartphone Apple iPhone 15 Pro con chip A17 Pro, cámara de 48MP y pantalla Super Retina XDR',
            sale_price: 4500000,
            purchase_price: 4000000,
            stock: 5,
            barcode: '194253404057',
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
            category: { id: 'demo-category-1', name: 'Smartphones Premium', description: 'Teléfonos inteligentes de gama alta', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Apple Authorized Distributor', contact_person: 'Juan Pérez', email: 'contacto@apple-dist.com', phone: '3001234567', address: 'Zona Franca Bogotá', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-2',
            name: 'Samsung Galaxy S24 Ultra 256GB',
            description: 'Smartphone Samsung con S Pen, cámara de 200MP y pantalla Dynamic AMOLED 2X',
            sale_price: 3800000,
            purchase_price: 3200000,
            stock: 8,
            barcode: '8806095048901',
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
            category: { id: 'demo-category-1', name: 'Smartphones Premium', description: 'Teléfonos inteligentes de gama alta', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-2', name: 'Samsung Electronics', contact_person: 'María García', email: 'ventas@samsung.com', phone: '3009876543', address: 'Centro Empresarial', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-3',
            name: 'AirPods Pro 2da Generación',
            description: 'Auriculares inalámbricos con cancelación activa de ruido y audio espacial',
            sale_price: 850000,
            purchase_price: 650000,
            stock: 15,
            barcode: '194253399957',
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
            category: { id: 'demo-category-2', name: 'Audio Premium', description: 'Equipos de audio de alta calidad', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Apple Authorized Distributor', contact_person: 'Juan Pérez', email: 'contacto@apple-dist.com', phone: '3001234567', address: 'Zona Franca Bogotá', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-4',
            name: 'MacBook Air M3 13" 256GB',
            description: 'Laptop ultradelgada con chip M3, pantalla Liquid Retina y hasta 18 horas de batería',
            sale_price: 5200000,
            purchase_price: 4600000,
            stock: 3,
            barcode: '194253421234',
            category_id: 'demo-category-3',
            supplier_id: 'demo-supplier-1',
            has_imei_serial: true,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: true,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date(Date.now() - 259200000).toISOString(),
            category: { id: 'demo-category-3', name: 'Laptops Premium', description: 'Computadores portátiles de alta gama', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Apple Authorized Distributor', contact_person: 'Juan Pérez', email: 'contacto@apple-dist.com', phone: '3001234567', address: 'Zona Franca Bogotá', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-5',
            name: 'Cargador MagSafe 15W',
            description: 'Cargador inalámbrico magnético para iPhone con tecnología MagSafe',
            sale_price: 180000,
            purchase_price: 120000,
            stock: 25,
            barcode: '194252157890',
            category_id: 'demo-category-4',
            supplier_id: 'demo-supplier-1',
            has_imei_serial: false,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date(Date.now() - 345600000).toISOString(),
            category: { id: 'demo-category-4', name: 'Accesorios de Carga', description: 'Cargadores y accesorios de energía', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Apple Authorized Distributor', contact_person: 'Juan Pérez', email: 'contacto@apple-dist.com', phone: '3001234567', address: 'Zona Franca Bogotá', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-6',
            name: 'iPad Air 11" M2 128GB',
            description: 'Tablet con chip M2, pantalla Liquid Retina y compatibilidad con Apple Pencil Pro',
            sale_price: 2800000,
            purchase_price: 2400000,
            stock: 0,
            barcode: '194253567890',
            category_id: 'demo-category-5',
            supplier_id: 'demo-supplier-1',
            has_imei_serial: true,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: true,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date(Date.now() - 432000000).toISOString(),
            category: { id: 'demo-category-5', name: 'Tablets', description: 'Tabletas y dispositivos portátiles', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Apple Authorized Distributor', contact_person: 'Juan Pérez', email: 'contacto@apple-dist.com', phone: '3001234567', address: 'Zona Franca Bogotá', created_at: new Date().toISOString() }
          }
        ];
        
        const demoCategories = [
          { id: 'demo-category-1', name: 'Smartphones Premium', description: 'Teléfonos inteligentes de gama alta', created_at: new Date().toISOString() },
          { id: 'demo-category-2', name: 'Audio Premium', description: 'Equipos de audio de alta calidad', created_at: new Date().toISOString() },
          { id: 'demo-category-3', name: 'Laptops Premium', description: 'Computadores portátiles de alta gama', created_at: new Date().toISOString() },
          { id: 'demo-category-4', name: 'Accesorios de Carga', description: 'Cargadores y accesorios de energía', created_at: new Date().toISOString() },
          { id: 'demo-category-5', name: 'Tablets', description: 'Tabletas y dispositivos portátiles', created_at: new Date().toISOString() }
        ];
        
        const demoSuppliers = [
          { id: 'demo-supplier-1', name: 'Apple Authorized Distributor', contact_person: 'Juan Pérez', email: 'contacto@apple-dist.com', phone: '3001234567', address: 'Zona Franca Bogotá', created_at: new Date().toISOString() },
          { id: 'demo-supplier-2', name: 'Samsung Electronics', contact_person: 'María García', email: 'ventas@samsung.com', phone: '3009876543', address: 'Centro Empresarial', created_at: new Date().toISOString() }
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

  const runAiAnalysis = async () => {
    try {
      setRunningAiAnalysis(true);
      
      // Analizar productos sin categoría
      const uncategorized = await findAndClassifyUncategorizedProducts();
      setUncategorizedProducts(uncategorized);
      
      // Analizar rendimiento de categorías
      const analytics = await analyzeCategoryPerformance();
      setCategoryAnalytics(analytics);
      
      // Generar sugerencias inteligentes
      if (uncategorized.length > 0) {
        const suggestions = await suggestCategory(
          'productos tecnológicos modernos',
          'análisis de inventario inteligente',
          categories
        );
        setAiSuggestions(suggestions);
        setShowAiSuggestions(true);
      }
    } catch (error) {
      console.error('Error running AI analysis:', error);
    } finally {
      setRunningAiAnalysis(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar formulario
    const validation = validateProductForm(formData);
    setFormErrors(validation.errors);
    
    if (!validation.isValid) {
      alert('Por favor corrige los errores en el formulario');
      return;
    }

    // Verificar duplicados
    const duplicateValidation = await validateProductDuplicates(formData, editingProduct?.id);
    if (!duplicateValidation.isValid) {
      setFormErrors(duplicateValidation.errors);
      return;
    }

    if (isDemoMode) {
      // Demo mode: simulate product creation/update
      const newProduct = {
        id: editingProduct?.id || `demo-product-${Date.now()}`,
        ...formData,
        sale_price: parseFloat(formData.sale_price) || 0,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        stock: parseInt(formData.stock) || 0,
        created_at: editingProduct?.created_at || new Date().toISOString(),
        category: categories.find(c => c.id === formData.category_id) || null,
        supplier: suppliers.find(s => s.id === formData.supplier_id) || null
      };
      
      if (editingProduct) {
        setProducts(products.map(p => p.id === editingProduct.id ? newProduct as ProductWithCategory : p));
      } else {
        setProducts([newProduct as ProductWithCategory, ...products]);
      }
      
      setShowForm(false);
      setEditingProduct(null);
      resetForm();
      alert(`Producto ${editingProduct ? 'actualizado' : 'creado'} exitosamente en modo demo`);
      return;
    }
    
    try {
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        sale_price: parseFloat(formData.sale_price) || 0,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        stock: parseInt(formData.stock) || 0,
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

  const generateBarcode = () => {
    const category = categories.find(c => c.id === formData.category_id);
    const barcode = generateSmartBarcode(formData.name, category?.name);
    setFormData({ ...formData, barcode });
  };

  const suggestPrice = (marginPercentage: number = 30) => {
    const purchasePrice = parseFloat(formData.purchase_price) || 0;
    if (purchasePrice > 0) {
      const suggestedPrice = Math.round(purchasePrice * (1 + marginPercentage / 100));
      setFormData({ ...formData, sale_price: suggestedPrice.toString() });
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

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) return 'bg-red-100 text-red-800 border-red-200';
    if (stock <= 5) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (stock > 50) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStockStatusLabel = (stock: number) => {
    if (stock === 0) return 'Sin Stock';
    if (stock <= 5) return 'Stock Bajo';
    if (stock > 50) return 'Sobrestock';
    return 'Stock Normal';
  };

  const getProfitMarginColor = (salePrice: number, purchasePrice: number | null) => {
    if (!purchasePrice) return 'text-slate-500';
    const margin = ((salePrice - purchasePrice) / purchasePrice) * 100;
    if (margin > 30) return 'text-green-600';
    if (margin > 15) return 'text-yellow-600';
    return 'text-red-600';
  };

  const calculateProfitMargin = (salePrice: number, purchasePrice: number | null) => {
    if (!purchasePrice) return 'N/A';
    const margin = ((salePrice - purchasePrice) / purchasePrice) * 100;
    return `${margin.toFixed(1)}%`;
  };

  // Filtrado avanzado
  const filteredProducts = products.filter(product => {
    // Búsqueda por texto
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        product.name.toLowerCase().includes(searchLower) ||
        product.description.toLowerCase().includes(searchLower) ||
        product.barcode.includes(searchTerm) ||
        product.category?.name.toLowerCase().includes(searchLower) ||
        product.supplier?.name.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Filtro por categoría
    if (categoryFilter && product.category_id !== categoryFilter) return false;

    // Filtro por proveedor
    if (supplierFilter && product.supplier_id !== supplierFilter) return false;

    // Filtro por stock
    if (stockFilter !== 'all') {
      switch (stockFilter) {
        case 'in_stock':
          if (product.stock <= 10) return false;
          break;
        case 'low_stock':
          if (product.stock === 0 || product.stock > 10) return false;
          break;
        case 'out_of_stock':
          if (product.stock !== 0) return false;
          break;
        case 'overstock':
          if (product.stock <= 50) return false;
          break;
      }
    }

    // Filtro por rango de precio
    if (priceRangeFilter !== 'all') {
      switch (priceRangeFilter) {
        case 'budget':
          if (product.sale_price > 500000) return false;
          break;
        case 'mid':
          if (product.sale_price <= 500000 || product.sale_price > 2000000) return false;
          break;
        case 'premium':
          if (product.sale_price <= 2000000) return false;
          break;
      }
    }

    return true;
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
      case 'profit_margin':
        aValue = a.purchase_price ? ((a.sale_price - a.purchase_price) / a.purchase_price) * 100 : 0;
        bValue = b.purchase_price ? ((b.sale_price - b.purchase_price) / b.purchase_price) * 100 : 0;
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

  const tabs = [
    { id: 'inventory', label: 'Inventario', icon: Package, description: 'Gestión de productos' },
    { id: 'analytics', label: 'Análisis', icon: BarChart3, description: 'Métricas y tendencias' },
    { id: 'ai-insights', label: 'IA Insights', icon: Brain, description: 'Inteligencia artificial' },
    { id: 'classification', label: 'Clasificación', icon: Tag, description: 'Organización automática' }
  ];

  return (
    <div className="space-y-6">
      {/* Header Inteligente */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-sm text-white p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center">
              <Package className="h-8 w-8 mr-3" />
              Sistema Inteligente de Inventario
              {isDemoMode && (
                <span className="ml-3 text-sm bg-yellow-500 text-yellow-900 px-3 py-1 rounded-full">
                  IA DEMO
                </span>
              )}
            </h1>
            <p className="text-blue-100 text-lg">
              Gestión avanzada con inteligencia artificial y análisis predictivo
            </p>
            <div className="flex items-center gap-6 mt-4 text-sm">
              <div className="flex items-center">
                <Brain className="h-4 w-4 mr-2" />
                <span>Clasificación automática</span>
              </div>
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                <span>Análisis predictivo</span>
              </div>
              <div className="flex items-center">
                <Zap className="h-4 w-4 mr-2" />
                <span>Optimización inteligente</span>
              </div>
              <div className="flex items-center">
                <Target className="h-4 w-4 mr-2" />
                <span>Insights de mercado</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <p className="text-blue-100 text-sm">Total de productos:</p>
              <p className="text-3xl font-bold">{products.length}</p>
              <p className="text-blue-200 text-xs">
                Valor total: {formatCurrency(products.reduce((sum, p) => sum + (p.sale_price * p.stock), 0))}
              </p>
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
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
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
          {/* Tab: Inventario */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              {/* Controles y Filtros Avanzados */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <div className="flex flex-col lg:flex-row gap-4 mb-4">
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
                      onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                      className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors duration-200"
                      title={`Cambiar a vista ${viewMode === 'grid' ? 'lista' : 'cuadrícula'}`}
                    >
                      {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={runAiAnalysis}
                      disabled={runningAiAnalysis}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                    >
                      {runningAiAnalysis ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Analizando...
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4 mr-2" />
                          Análisis IA
                        </>
                      )}
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
                      Nuevo Producto
                    </button>
                  </div>
                </div>

                {/* Filtros Avanzados */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                    <option value="in_stock">Stock normal</option>
                    <option value="low_stock">Stock bajo</option>
                    <option value="out_of_stock">Sin stock</option>
                    <option value="overstock">Sobrestock</option>
                  </select>

                  <select
                    value={priceRangeFilter}
                    onChange={(e) => setPriceRangeFilter(e.target.value as any)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="all">Todos los precios</option>
                    <option value="budget">Económico (&lt;$500K)</option>
                    <option value="mid">Medio ($500K-$2M)</option>
                    <option value="premium">Premium (&gt;$2M)</option>
                  </select>

                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split('-');
                      setSortBy(field as any);
                      setSortOrder(order as any);
                    }}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="name-asc">Nombre A-Z</option>
                    <option value="name-desc">Nombre Z-A</option>
                    <option value="created_at-desc">Más recientes</option>
                    <option value="created_at-asc">Más antiguos</option>
                    <option value="sale_price-desc">Precio mayor</option>
                    <option value="sale_price-asc">Precio menor</option>
                    <option value="stock-desc">Stock mayor</option>
                    <option value="stock-asc">Stock menor</option>
                    <option value="profit_margin-desc">Mayor margen</option>
                    <option value="profit_margin-asc">Menor margen</option>
                  </select>
                </div>

                {(searchTerm || categoryFilter || supplierFilter || stockFilter !== 'all' || priceRangeFilter !== 'all') && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                      Mostrando {filteredProducts.length} de {products.length} productos
                    </div>
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setCategoryFilter('');
                        setSupplierFilter('');
                        setStockFilter('all');
                        setPriceRangeFilter('all');
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                )}
              </div>

              {/* Lista/Grid de Productos */}
              {loading ? (
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse border">
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
                      <div className="h-8 bg-slate-200 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">
                    {products.length === 0 
                      ? 'No hay productos registrados' 
                      : 'No se encontraron productos que coincidan con los filtros'}
                  </p>
                  <button
                    onClick={() => {
                      setShowForm(true);
                      setEditingProduct(null);
                      resetForm();
                    }}
                    className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Agregar Primer Producto
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => {
                    const profitMetrics = calculateProfitMetrics(
                      product.sale_price, 
                      product.purchase_price || 0, 
                      product.stock
                    );

                    return (
                      <div key={product.id} className="group bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200 border relative">
                        <ProductQuickActions
                          product={product}
                          onDuplicate={handleDuplicate}
                          onViewDetails={(p) => setSelectedProduct(p)}
                          onQuickEdit={handleQuickEdit}
                        />

                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-1">{product.name}</h3>
                            <p className="text-sm text-slate-600 line-clamp-2">{product.description}</p>
                            
                            {/* Categoría y Proveedor */}
                            <div className="flex items-center gap-2 mt-2">
                              {product.category && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {product.category.name}
                                </span>
                              )}
                              {product.supplier && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  <Truck className="h-3 w-3 mr-1" />
                                  {product.supplier.name}
                                </span>
                              )}
                              {product.has_imei_serial && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <Hash className="h-3 w-3 mr-1" />
                                  {product.imei_serial_type.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Precios y Métricas */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Precio de venta:</span>
                            <span className="text-lg font-bold text-green-600">
                              {formatCurrency(product.sale_price)}
                            </span>
                          </div>

                          {product.purchase_price && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-600">Margen:</span>
                              <span className={`text-sm font-bold ${getProfitMarginColor(product.sale_price, product.purchase_price)}`}>
                                {calculateProfitMargin(product.sale_price, product.purchase_price)}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Stock:</span>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStockStatusColor(product.stock)}`}>
                              {product.stock} - {getStockStatusLabel(product.stock)}
                            </span>
                          </div>

                          {profitMetrics && (
                            <div className="pt-3 border-t border-slate-200">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">Ganancia potencial:</span>
                                <span className="font-bold text-purple-600">
                                  {formatCurrency(profitMetrics.totalProfit)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs mt-1">
                                <span className="text-slate-500">Nivel de riesgo:</span>
                                <span className={`font-medium ${
                                  profitMetrics.riskLevel === 'low' ? 'text-green-600' :
                                  profitMetrics.riskLevel === 'medium' ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {profitMetrics.riskLevel === 'low' ? 'Bajo' :
                                   profitMetrics.riskLevel === 'medium' ? 'Medio' : 'Alto'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                          <button
                            onClick={() => setSelectedProduct(product)}
                            className="flex-1 bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-200 transition-colors duration-200 flex items-center justify-center text-sm"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </button>
                          <button
                            onClick={() => handleEdit(product)}
                            className="flex-1 bg-green-100 text-green-700 px-3 py-2 rounded-lg hover:bg-green-200 transition-colors duration-200 flex items-center justify-center text-sm"
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Editar
                          </button>
                          {product.has_imei_serial && (
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setShowImeiManager(true);
                              }}
                              className="flex-1 bg-purple-100 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-200 transition-colors duration-200 flex items-center justify-center text-sm"
                            >
                              <Hash className="h-4 w-4 mr-1" />
                              IMEI/Serial
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Vista de Lista */
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
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
                        {filteredProducts.map((product) => (
                          <tr key={product.id} className="hover:bg-slate-50 transition-colors duration-200">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="flex-1">
                                  <h4 className="font-medium text-slate-900">{product.name}</h4>
                                  <p className="text-sm text-slate-600 truncate max-w-xs">{product.description}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {product.barcode && (
                                      <span className="text-xs text-slate-500 font-mono">{product.barcode}</span>
                                    )}
                                    {product.has_imei_serial && (
                                      <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        <Hash className="h-3 w-3 mr-1" />
                                        {product.imei_serial_type.toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {product.category ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {product.category.name}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500">Sin categoría</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="font-bold text-green-600">{formatCurrency(product.sale_price)}</p>
                                {product.purchase_price && (
                                  <p className="text-xs text-slate-500">
                                    Costo: {formatCurrency(product.purchase_price)}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStockStatusColor(product.stock)}`}>
                                {product.stock}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`font-medium ${getProfitMarginColor(product.sale_price, product.purchase_price)}`}>
                                {calculateProfitMargin(product.sale_price, product.purchase_price)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setSelectedProduct(product)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                                  title="Ver detalles"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleEdit(product)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                                  title="Editar"
                                >
                                  <Edit2 className="h-4 w-4" />
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
                                  onClick={() => handleDelete(product.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Análisis */}
          {activeTab === 'analytics' && (
            <InventoryAnalyticsDashboard 
              products={products}
              onProductAction={(productName, action) => {
                const product = products.find(p => p.name === productName);
                if (product) {
                  if (action === 'view') {
                    setSelectedProduct(product);
                  } else if (action === 'reorder') {
                    handleEdit(product);
                  }
                }
              }}
            />
          )}

          {/* Tab: IA Insights */}
          {activeTab === 'ai-insights' && (
            <div className="space-y-6">
              <SmartInventoryInsights 
                products={products}
                onApplyInsight={(insight) => {
                  alert(`Aplicando insight: ${insight.title}`);
                  // Implementar lógica específica según el tipo de insight
                }}
              />
              
              {/* Análisis de Categorías */}
              {categoryAnalytics.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border">
                  <div className="p-6 border-b border-slate-200">
                    <h4 className="text-lg font-semibold text-slate-900 flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
                      Análisis Inteligente de Categorías
                    </h4>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryAnalytics.map((category) => (
                        <div key={category.category_id} className="border border-slate-200 rounded-lg p-4">
                          <h5 className="font-bold text-slate-900 mb-3">{category.category_name}</h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Productos:</span>
                              <span className="font-medium">{category.product_count}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Ingresos:</span>
                              <span className="font-medium text-green-600">
                                {formatCurrency(category.total_revenue)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Margen:</span>
                              <span className={`font-medium ${getProfitMarginColor(100, 100 - category.profit_margin)}`}>
                                {category.profit_margin.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Participación:</span>
                              <span className="font-medium text-purple-600">
                                {category.market_share.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          
                          {category.recommendations.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <p className="text-xs text-slate-500 mb-1">Recomendación IA:</p>
                              <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                                {category.recommendations[0]}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Clasificación */}
          {activeTab === 'classification' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Clasificación Automática con IA</h3>
                <button
                  onClick={runAiAnalysis}
                  disabled={runningAiAnalysis}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                >
                  {runningAiAnalysis ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Ejecutar Análisis IA
                    </>
                  )}
                </button>
              </div>

              {/* Productos Sin Categoría */}
              {uncategorizedProducts.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border">
                  <div className="p-6 border-b border-slate-200">
                    <h4 className="text-lg font-semibold text-slate-900">
                      Productos Sin Categoría ({uncategorizedProducts.length})
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      La IA ha analizado estos productos y sugiere categorías automáticamente
                    </p>
                  </div>
                  <div className="p-6">
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
                                <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${
                                  item.suggestions[0].confidence >= 80 ? 'bg-green-100 text-green-800 border-green-200' :
                                  item.suggestions[0].confidence >= 60 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                  'bg-red-100 text-red-800 border-red-200'
                                }`}>
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
                                    onClick={async () => {
                                      try {
                                        if (isDemoMode) {
                                          alert('Clasificación aplicada en modo demo');
                                          return;
                                        }

                                        // Buscar categoría existente o crear nueva
                                        let categoryId = categories.find(c => 
                                          c.name.toLowerCase() === item.suggestions[0].suggested_name.toLowerCase()
                                        )?.id;

                                        if (!categoryId) {
                                          // Crear nueva categoría
                                          const { data: newCategory, error: categoryError } = await supabase
                                            .from('categories')
                                            .insert([{
                                              name: item.suggestions[0].suggested_name,
                                              description: `Categoría creada automáticamente por IA: ${item.suggestions[0].reasoning}`
                                            }])
                                            .select()
                                            .single();

                                          if (categoryError) throw categoryError;
                                          categoryId = newCategory.id;
                                          setCategories([...categories, newCategory]);
                                        }

                                        // Aplicar categoría al producto
                                        const { error } = await supabase
                                          .from('products')
                                          .update({ category_id: categoryId })
                                          .eq('id', item.product.id);

                                        if (error) throw error;
                                        
                                        alert('Producto clasificado exitosamente');
                                        loadData();
                                        runAiAnalysis();
                                      } catch (error) {
                                        alert('Error al clasificar: ' + (error as Error).message);
                                      }
                                    }}
                                    className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-xs"
                                  >
                                    Aplicar IA
                                  </button>
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
                          <button
                            onClick={() => {
                              // Mostrar todos los productos sin categoría
                              alert('Funcionalidad de paginación en desarrollo');
                            }}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200"
                          >
                            Ver todos
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <p className="text-green-600 font-medium">¡Todos los productos están categorizados!</p>
                  <p className="text-sm text-slate-600 mt-1">El sistema IA ha clasificado exitosamente todos los productos</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Formulario de Producto Mejorado */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Complete la información del producto. La IA ayudará con sugerencias automáticas.
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Información Básica */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-medium text-slate-900 mb-4">Información Básica</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre del Producto *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: iPhone 15 Pro 128GB"
                      required
                    />
                    {formErrors.name && (
                      <p className="text-red-600 text-xs mt-1">{formErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Código de Barras
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Código de barras"
                      />
                      <button
                        type="button"
                        onClick={generateBarcode}
                        className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center"
                        title="Generar código automático"
                      >
                        <ScanLine className="h-4 w-4" />
                      </button>
                    </div>
                    {formErrors.barcode && (
                      <p className="text-red-600 text-xs mt-1">{formErrors.barcode}</p>
                    )}
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
                </div>
              </div>

              {/* Precios y Stock */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-medium text-slate-900 mb-4">Precios y Stock</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      required
                    />
                    {formErrors.sale_price && (
                      <p className="text-red-600 text-xs mt-1">{formErrors.sale_price}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Precio de Compra
                    </label>
                    <div className="flex gap-2">
                      <FormattedNumberInput
                        value={formData.purchase_price}
                        onChange={(value) => setFormData({ ...formData, purchase_price: value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                        min="0"
                      />
                      <button
                        type="button"
                        onClick={() => suggestPrice(30)}
                        className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-xs"
                        title="Sugerir precio con 30% margen"
                      >
                        +30%
                      </button>
                    </div>
                    {formErrors.purchase_price && (
                      <p className="text-red-600 text-xs mt-1">{formErrors.purchase_price}</p>
                    )}
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
                      required
                    />
                    {formErrors.stock && (
                      <p className="text-red-600 text-xs mt-1">{formErrors.stock}</p>
                    )}
                  </div>
                </div>

                {/* Validación de Formulario */}
                <div className="mt-4">
                  <ProductFormValidation
                    formData={formData}
                    errors={formErrors}
                    duplicateCheck={duplicateCheck}
                  />
                </div>
              </div>

              {/* Categorización y Proveedores */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-medium text-slate-900 mb-4">Categorización y Proveedores</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              {/* Configuración IMEI/Serial */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-medium text-slate-900 mb-4">Configuración IMEI/Serial</h4>
                <div className="space-y-4">
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
                      Este producto maneja IMEI/Serial individual
                    </label>
                  </div>

                  {formData.has_imei_serial && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
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
                          <option value="imei">IMEI (15 dígitos)</option>
                          <option value="both">Ambos (IMEI y Serial)</option>
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

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingProduct(null);
                    resetForm();
                  }}
                  className="px-6 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  {editingProduct ? 'Actualizar' : 'Crear'} Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modales */}
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
      )}

      {/* Modal de Detalles del Producto */}
      {selectedProduct && !showImeiManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">{selectedProduct.name}</h3>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">Información General</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Descripción:</span>
                        <span className="font-medium text-slate-900 text-right max-w-xs">
                          {selectedProduct.description || 'Sin descripción'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Código de barras:</span>
                        <span className="font-mono text-slate-900">
                          {selectedProduct.barcode || 'Sin código'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Categoría:</span>
                        <span className="font-medium text-slate-900">
                          {selectedProduct.category?.name || 'Sin categoría'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Proveedor:</span>
                        <span className="font-medium text-slate-900">
                          {selectedProduct.supplier?.name || 'Sin proveedor'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">Configuración IMEI/Serial</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Maneja IMEI/Serial:</span>
                        <span className={`font-medium ${selectedProduct.has_imei_serial ? 'text-green-600' : 'text-slate-500'}`}>
                          {selectedProduct.has_imei_serial ? 'Sí' : 'No'}
                        </span>
                      </div>
                      {selectedProduct.has_imei_serial && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Tipo:</span>
                            <span className="font-medium text-slate-900">
                              {selectedProduct.imei_serial_type === 'imei' ? 'IMEI' :
                               selectedProduct.imei_serial_type === 'serial' ? 'Serial' : 'Ambos'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Obligatorio:</span>
                            <span className={`font-medium ${selectedProduct.requires_imei_serial ? 'text-red-600' : 'text-slate-500'}`}>
                              {selectedProduct.requires_imei_serial ? 'Sí' : 'No'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">Información Financiera</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Precio de venta:</span>
                        <span className="font-bold text-green-600">
                          {formatCurrency(selectedProduct.sale_price)}
                        </span>
                      </div>
                      {selectedProduct.purchase_price && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Precio de compra:</span>
                            <span className="font-medium text-slate-900">
                              {formatCurrency(selectedProduct.purchase_price)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Ganancia por unidad:</span>
                            <span className="font-bold text-purple-600">
                              {formatCurrency(selectedProduct.sale_price - selectedProduct.purchase_price)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Margen de ganancia:</span>
                            <span className={`font-bold ${getProfitMarginColor(selectedProduct.sale_price, selectedProduct.purchase_price)}`}>
                              {calculateProfitMargin(selectedProduct.sale_price, selectedProduct.purchase_price)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">Inventario</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Stock actual:</span>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStockStatusColor(selectedProduct.stock)}`}>
                          {selectedProduct.stock} - {getStockStatusLabel(selectedProduct.stock)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Valor en inventario:</span>
                        <span className="font-bold text-blue-600">
                          {formatCurrency(selectedProduct.sale_price * selectedProduct.stock)}
                        </span>
                      </div>
                      {selectedProduct.purchase_price && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">Inversión en stock:</span>
                          <span className="font-medium text-slate-900">
                            {formatCurrency(selectedProduct.purchase_price * selectedProduct.stock)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">Información del Sistema</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Creado:</span>
                        <span className="font-medium text-slate-900">
                          {new Date(selectedProduct.created_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">ID del producto:</span>
                        <span className="font-mono text-xs text-slate-500">
                          {selectedProduct.id.slice(-8)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => handleEdit(selectedProduct)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                Editar Producto
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Información del Sistema IA */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Brain className="h-5 w-5 mr-2 text-purple-600" />
          Sistema de Inteligencia Artificial para Inventario
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
              <Lightbulb className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Características del Sistema IA</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-blue-800">
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Clasificación automática por palabras clave</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Análisis de rentabilidad en tiempo real</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Sugerencias de precios inteligentes</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Detección de productos duplicados</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Optimización de códigos de barras</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Análisis de tendencias de mercado</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Recomendaciones de reabastecimiento</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Validación automática de datos</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Insights de competitividad</span>
            </div>
          </div>
        </div>

        {isDemoMode && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">IA Demo Activa</h4>
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