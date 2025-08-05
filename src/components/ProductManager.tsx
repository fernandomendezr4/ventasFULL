import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit2, Trash2, Package, Search, Filter, Eye, Copy, Upload, Download, BarChart3, AlertTriangle, CheckCircle, Hash, Tag, Truck, DollarSign, TrendingUp, TrendingDown, Zap, RefreshCw, Grid, List, SortAsc, SortDesc } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { ProductWithCategory, Category, Supplier, ProductImeiSerial } from '../lib/types';
import { formatCurrency, calculateProfit, calculateProfitMargin } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import ProductDetailsModal from './ProductDetailsModal';
import ImeiSerialManager from './ImeiSerialManager';
import BulkProductImport from './BulkProductImport';
import ProductFormValidation from './ProductFormValidation';
import ProductQuickActions from './ProductQuickActions';
import LazyLoader from './LazyLoader';
import { validateProductForm, generateSmartBarcode, calculateProfitMetrics } from '../lib/productValidation';

interface ProductStats {
  total_products: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  avg_profit_margin: number;
  top_category: string;
}

export default function ProductManager() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showImeiManager, setShowImeiManager] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  
  // Filtros y búsqueda inteligente
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [priceRangeFilter, setPriceRangeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'sale_price' | 'stock' | 'profit_margin'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Paginación inteligente
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  
  // Estadísticas
  const [productStats, setProductStats] = useState<ProductStats | null>(null);
  
  // Formulario inteligente
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
  
  // Validaciones y duplicados
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [duplicateCheck, setDuplicateCheck] = useState({ name: false, barcode: false });
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    // Validación en tiempo real con debounce
    const timeoutId = setTimeout(() => {
      if (showForm) {
        validateFormData();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData, showForm]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProducts(),
        loadCategories(),
        loadSuppliers(),
        loadProductStats()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      if (isDemoMode) {
        const demoProducts: ProductWithCategory[] = [
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
            imei_serial_type: 'imei',
            requires_imei_serial: true,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            category: { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Apple Store', contact_person: 'Juan Pérez', email: 'contacto@apple.com', phone: '3001234567', address: 'Calle 123', created_at: new Date().toISOString() }
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
            created_at: new Date(Date.now() - 86400000).toISOString(),
            has_imei_serial: true,
            imei_serial_type: 'imei',
            requires_imei_serial: true,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            category: { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-2', name: 'Samsung', contact_person: 'María García', email: 'contacto@samsung.com', phone: '3009876543', address: 'Carrera 45', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-3',
            name: 'Cargador USB-C 20W',
            description: 'Cargador rápido USB-C 20W universal',
            sale_price: 45000,
            purchase_price: 25000,
            stock: 2,
            barcode: '456789123456',
            category_id: 'demo-category-2',
            supplier_id: 'demo-supplier-1',
            created_at: new Date(Date.now() - 172800000).toISOString(),
            has_imei_serial: false,
            imei_serial_type: 'serial',
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            category: { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios para dispositivos', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Apple Store', contact_person: 'Juan Pérez', email: 'contacto@apple.com', phone: '3001234567', address: 'Calle 123', created_at: new Date().toISOString() }
          }
        ];
        
        setProducts(demoProducts);
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, description),
          supplier:suppliers(id, name, contact_person, email, phone, address)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    }
  };

  const loadCategories = async () => {
    try {
      if (isDemoMode) {
        const demoCategories: Category[] = [
          { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
          { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios para dispositivos', created_at: new Date().toISOString() },
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
        const demoSuppliers: Supplier[] = [
          { id: 'demo-supplier-1', name: 'Apple Store', contact_person: 'Juan Pérez', email: 'contacto@apple.com', phone: '3001234567', address: 'Calle 123', created_at: new Date().toISOString() },
          { id: 'demo-supplier-2', name: 'Samsung', contact_person: 'María García', email: 'contacto@samsung.com', phone: '3009876543', address: 'Carrera 45', created_at: new Date().toISOString() }
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

  const loadProductStats = async () => {
    try {
      if (isDemoMode) {
        const demoStats: ProductStats = {
          total_products: 3,
          total_value: 7745000,
          low_stock_count: 1,
          out_of_stock_count: 0,
          avg_profit_margin: 15.5,
          top_category: 'Smartphones'
        };
        setProductStats(demoStats);
        return;
      }

      // Calcular estadísticas desde los productos cargados
      const totalProducts = products.length;
      const totalValue = products.reduce((sum, p) => sum + (p.sale_price * p.stock), 0);
      const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 5).length;
      const outOfStockCount = products.filter(p => p.stock === 0).length;
      
      const profitMargins = products
        .filter(p => p.purchase_price > 0)
        .map(p => calculateProfitMargin(p.sale_price, p.purchase_price));
      
      const avgProfitMargin = profitMargins.length > 0 
        ? profitMargins.reduce((sum, margin) => sum + margin, 0) / profitMargins.length 
        : 0;

      const categoryCount = new Map<string, number>();
      products.forEach(p => {
        if (p.category?.name) {
          categoryCount.set(p.category.name, (categoryCount.get(p.category.name) || 0) + 1);
        }
      });
      
      const topCategory = Array.from(categoryCount.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin categoría';

      setProductStats({
        total_products: totalProducts,
        total_value: totalValue,
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount,
        avg_profit_margin: avgProfitMargin,
        top_category: topCategory
      });
    } catch (error) {
      console.error('Error loading product stats:', error);
    }
  };

  const validateFormData = useCallback(async () => {
    if (!showForm) return;

    setIsValidating(true);
    
    try {
      // Validación básica del formulario
      const validation = validateProductForm(formData);
      setFormErrors(validation.errors);

      // Verificar duplicados si hay datos relevantes
      if (formData.name.trim().length >= 3) {
        await checkDuplicates('name', formData.name.trim());
      }
      
      if (formData.barcode.trim().length >= 8) {
        await checkDuplicates('barcode', formData.barcode.trim());
      }
    } catch (error) {
      console.error('Error validating form:', error);
    } finally {
      setIsValidating(false);
    }
  }, [formData, showForm, editingProduct]);

  const checkDuplicates = async (field: 'name' | 'barcode', value: string) => {
    if (isDemoMode) {
      // Simular algunos duplicados en modo demo
      const demoExisting = {
        name: ['iPhone 15 Pro 128GB', 'Samsung Galaxy S24 256GB'],
        barcode: ['123456789012', '987654321098']
      };
      
      const isDuplicate = demoExisting[field].includes(value);
      setDuplicateCheck(prev => ({ ...prev, [field]: isDuplicate }));
      
      if (isDuplicate) {
        setFormErrors(prev => ({
          ...prev,
          [field]: `Ya existe un producto con este ${field === 'name' ? 'nombre' : 'código de barras'} en el sistema demo`
        }));
      }
      return;
    }

    if (!supabase) return;

    try {
      let query = supabase.from('products').select('id, name');
      
      if (field === 'name') {
        query = query.ilike('name', value);
      } else {
        query = query.eq('barcode', value);
      }

      if (editingProduct) {
        query = query.neq('id', editingProduct.id);
      }

      const { data, error } = await query.limit(1);

      if (error) {
        console.error(`Error checking ${field} duplicate:`, error);
        return;
      }

      const isDuplicate = data && data.length > 0;
      setDuplicateCheck(prev => ({ ...prev, [field]: isDuplicate }));

      if (isDuplicate) {
        setFormErrors(prev => ({
          ...prev,
          [field]: `Ya existe un producto con este ${field === 'name' ? 'nombre' : 'código de barras'}: "${data[0].name}"`
        }));
      } else {
        setFormErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    } catch (error) {
      console.error(`Error checking ${field} duplicate:`, error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (Object.keys(formErrors).length > 0 || duplicateCheck.name || duplicateCheck.barcode) {
      alert('Por favor corrige los errores antes de guardar');
      return;
    }

    try {
      setSaving(true);

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

      if (isDemoMode) {
        const newProduct: ProductWithCategory = {
          ...productData,
          id: `demo-product-${Date.now()}`,
          created_at: new Date().toISOString(),
          bulk_import_batch: '',
          import_notes: '',
          imported_at: null,
          imported_by: null,
          category: categories.find(c => c.id === productData.category_id) || null,
          supplier: suppliers.find(s => s.id === productData.supplier_id) || null
        };

        if (editingProduct) {
          setProducts(prev => prev.map(p => p.id === editingProduct.id ? newProduct : p));
        } else {
          setProducts(prev => [newProduct, ...prev]);
        }

        alert('Producto guardado exitosamente (modo demo)');
        handleCloseForm();
        await loadProductStats();
        return;
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        alert('Producto actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        alert('Producto creado exitosamente');
      }

      handleCloseForm();
      await loadProducts();
      await loadProductStats();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar producto: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product: ProductWithCategory) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      sale_price: product.sale_price.toString(),
      purchase_price: product.purchase_price?.toString() || '',
      stock: product.stock.toString(),
      barcode: product.barcode,
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      has_imei_serial: product.has_imei_serial,
      imei_serial_type: product.imei_serial_type,
      requires_imei_serial: product.requires_imei_serial,
    });
    setFormErrors({});
    setDuplicateCheck({ name: false, barcode: false });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      return;
    }

    if (isDemoMode) {
      setProducts(prev => prev.filter(p => p.id !== id));
      alert('Producto eliminado exitosamente (modo demo)');
      await loadProductStats();
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await loadProducts();
      await loadProductStats();
      alert('Producto eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error al eliminar producto: ' + (error as Error).message);
    }
  };

  const handleDuplicate = (product: ProductWithCategory) => {
    setEditingProduct(null);
    setFormData({
      name: `${product.name} (Copia)`,
      description: product.description,
      sale_price: product.sale_price.toString(),
      purchase_price: product.purchase_price?.toString() || '',
      stock: '0',
      barcode: '',
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      has_imei_serial: product.has_imei_serial,
      imei_serial_type: product.imei_serial_type,
      requires_imei_serial: product.requires_imei_serial,
    });
    setFormErrors({});
    setDuplicateCheck({ name: false, barcode: false });
    setShowForm(true);
  };

  const handleQuickEdit = async (product: ProductWithCategory, field: string, value: any) => {
    if (isDemoMode) {
      setProducts(prev => prev.map(p => 
        p.id === product.id ? { ...p, [field]: value } : p
      ));
      alert(`${field} actualizado exitosamente (modo demo)`);
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ [field]: value })
        .eq('id', product.id);

      if (error) throw error;
      
      await loadProducts();
      alert(`${field} actualizado exitosamente`);
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Error al actualizar: ' + (error as Error).message);
    }
  };

  const handleCloseForm = () => {
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
    setFormErrors({});
    setDuplicateCheck({ name: false, barcode: false });
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

  const exportProducts = () => {
    const csvContent = [
      ['Nombre', 'Descripción', 'Precio Venta', 'Precio Compra', 'Stock', 'Código', 'Categoría', 'Proveedor', 'IMEI/Serial', 'Tipo', 'Obligatorio'].join(','),
      ...filteredAndSortedProducts.map(product => [
        `"${product.name}"`,
        `"${product.description}"`,
        product.sale_price,
        product.purchase_price || 0,
        product.stock,
        `"${product.barcode}"`,
        `"${product.category?.name || ''}"`,
        `"${product.supplier?.name || ''}"`,
        product.has_imei_serial ? 'Sí' : 'No',
        product.imei_serial_type,
        product.requires_imei_serial ? 'Sí' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtrado y ordenamiento inteligente
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter(product => {
      // Búsqueda inteligente
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(searchLower);
        const matchesDescription = product.description.toLowerCase().includes(searchLower);
        const matchesBarcode = product.barcode.includes(searchTerm);
        const matchesCategory = product.category?.name.toLowerCase().includes(searchLower);
        const matchesSupplier = product.supplier?.name.toLowerCase().includes(searchLower);
        
        if (!(matchesName || matchesDescription || matchesBarcode || matchesCategory || matchesSupplier)) {
          return false;
        }
      }

      // Filtro por categoría
      if (categoryFilter !== 'all' && product.category_id !== categoryFilter) {
        return false;
      }

      // Filtro por proveedor
      if (supplierFilter !== 'all' && product.supplier_id !== supplierFilter) {
        return false;
      }

      // Filtro por stock
      if (stockFilter !== 'all') {
        switch (stockFilter) {
          case 'in_stock':
            if (product.stock <= 0) return false;
            break;
          case 'low_stock':
            if (product.stock > 5 || product.stock <= 0) return false;
            break;
          case 'out_of_stock':
            if (product.stock > 0) return false;
            break;
        }
      }

      // Filtro por rango de precios
      if (priceRangeFilter !== 'all') {
        switch (priceRangeFilter) {
          case 'under_100k':
            if (product.sale_price >= 100000) return false;
            break;
          case '100k_500k':
            if (product.sale_price < 100000 || product.sale_price >= 500000) return false;
            break;
          case '500k_1m':
            if (product.sale_price < 500000 || product.sale_price >= 1000000) return false;
            break;
          case 'over_1m':
            if (product.sale_price < 1000000) return false;
            break;
        }
      }

      return true;
    });

    // Ordenamiento inteligente
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'sale_price':
          aValue = a.sale_price;
          bValue = b.sale_price;
          break;
        case 'stock':
          aValue = a.stock;
          bValue = b.stock;
          break;
        case 'profit_margin':
          aValue = a.purchase_price > 0 ? calculateProfitMargin(a.sale_price, a.purchase_price) : 0;
          bValue = b.purchase_price > 0 ? calculateProfitMargin(b.sale_price, b.purchase_price) : 0;
          break;
        case 'created_at':
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [products, searchTerm, categoryFilter, supplierFilter, stockFilter, priceRangeFilter, sortBy, sortOrder]);

  // Paginación
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedProducts.slice(startIndex, endIndex);
  }, [filteredAndSortedProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) return 'bg-red-100 text-red-800 border-red-200';
    if (stock <= 5) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStockStatusLabel = (stock: number) => {
    if (stock === 0) return 'Sin stock';
    if (stock <= 5) return 'Stock bajo';
    return 'En stock';
  };

  const getProfitColor = (salePrice: number, purchasePrice: number) => {
    if (purchasePrice <= 0) return 'text-slate-600';
    const margin = calculateProfitMargin(salePrice, purchasePrice);
    if (margin < 10) return 'text-red-600';
    if (margin < 30) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-slate-200 rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-slate-200 rounded w-32 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-slate-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Gestión de Productos</h2>
          <p className="text-slate-600 mt-1">
            Administra tu inventario de manera inteligente y eficiente
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </button>
          <button
            onClick={exportProducts}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingProduct(null);
              handleCloseForm();
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      {productStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Productos</p>
                <p className="text-2xl font-bold text-blue-900">{productStats.total_products}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Valor Total</p>
                <p className="text-2xl font-bold text-green-900">{formatCurrency(productStats.total_value)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Stock Bajo</p>
                <p className="text-2xl font-bold text-yellow-900">{productStats.low_stock_count}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Sin Stock</p>
                <p className="text-2xl font-bold text-red-900">{productStats.out_of_stock_count}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Margen Promedio</p>
                <p className="text-2xl font-bold text-purple-900">{productStats.avg_profit_margin.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Filtros Avanzados */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, descripción, código, categoría o proveedor..."
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
              <option value="all">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los proveedores</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todo el stock</option>
              <option value="in_stock">En stock</option>
              <option value="low_stock">Stock bajo (≤5)</option>
              <option value="out_of_stock">Sin stock</option>
            </select>

            <select
              value={priceRangeFilter}
              onChange={(e) => setPriceRangeFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los precios</option>
              <option value="under_100k">Menos de $100k</option>
              <option value="100k_500k">$100k - $500k</option>
              <option value="500k_1m">$500k - $1M</option>
              <option value="over_1m">Más de $1M</option>
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as any);
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name-asc">Nombre A-Z</option>
              <option value="name-desc">Nombre Z-A</option>
              <option value="created_at-desc">Más recientes</option>
              <option value="created_at-asc">Más antiguos</option>
              <option value="sale_price-desc">Precio mayor</option>
              <option value="sale_price-asc">Precio menor</option>
              <option value="stock-desc">Mayor stock</option>
              <option value="stock-asc">Menor stock</option>
              <option value="profit_margin-desc">Mayor margen</option>
              <option value="profit_margin-asc">Menor margen</option>
            </select>

            <div className="flex border border-slate-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 transition-colors duration-200 ${
                  viewMode === 'grid' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 transition-colors duration-200 ${
                  viewMode === 'list' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Resumen de filtros */}
        {(searchTerm || categoryFilter !== 'all' || supplierFilter !== 'all' || stockFilter !== 'all' || priceRangeFilter !== 'all') && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Mostrando {filteredAndSortedProducts.length} de {products.length} productos
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setSupplierFilter('all');
                setStockFilter('all');
                setPriceRangeFilter('all');
                setCurrentPage(1);
              }}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Formulario de Producto */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-slate-900">
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>
            <button
              onClick={handleCloseForm}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.name ? 'border-red-300' : 'border-slate-300'
                    }`}
                    placeholder="Ej: iPhone 15 Pro 128GB"
                  />
                  {formErrors.name && (
                    <p className="text-red-600 text-xs mt-1 flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {formErrors.name}
                    </p>
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
                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.barcode ? 'border-red-300' : 'border-slate-300'
                      }`}
                      placeholder="Código único del producto"
                    />
                    <button
                      type="button"
                      onClick={generateBarcode}
                      className="bg-slate-600 text-white px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors duration-200 flex items-center"
                      title="Generar código automático"
                    >
                      <Zap className="h-4 w-4" />
                    </button>
                  </div>
                  {formErrors.barcode && (
                    <p className="text-red-600 text-xs mt-1 flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {formErrors.barcode}
                    </p>
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
                    Precio de Compra
                  </label>
                  <FormattedNumberInput
                    value={formData.purchase_price}
                    onChange={(value) => setFormData({ ...formData, purchase_price: value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.purchase_price ? 'border-red-300' : 'border-slate-300'
                    }`}
                    placeholder="0"
                    min="0"
                  />
                  {formErrors.purchase_price && (
                    <p className="text-red-600 text-xs mt-1">{formErrors.purchase_price}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Precio de Venta *
                  </label>
                  <div className="flex gap-2">
                    <FormattedNumberInput
                      value={formData.sale_price}
                      onChange={(value) => setFormData({ ...formData, sale_price: value })}
                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.sale_price ? 'border-red-300' : 'border-slate-300'
                      }`}
                      placeholder="0"
                      min="0"
                      required
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => suggestPrice(20)}
                        className="bg-green-100 text-green-700 px-2 py-2 rounded text-xs hover:bg-green-200 transition-colors duration-200"
                        title="Sugerir precio con 20% margen"
                      >
                        +20%
                      </button>
                      <button
                        type="button"
                        onClick={() => suggestPrice(30)}
                        className="bg-blue-100 text-blue-700 px-2 py-2 rounded text-xs hover:bg-blue-200 transition-colors duration-200"
                        title="Sugerir precio con 30% margen"
                      </button>
                    </div>
                  </div>
                  {formErrors.sale_price && (
                    <p className="text-red-600 text-xs mt-1">{formErrors.sale_price}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Stock Inicial *
                  </label>
                  <FormattedNumberInput
                    value={formData.stock}
                    onChange={(value) => setFormData({ ...formData, stock: value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.stock ? 'border-red-300' : 'border-slate-300'
                    }`}
                    placeholder="0"
                    min="0"
                    required
                  />
                  {formErrors.stock && (
                    <p className="text-red-600 text-xs mt-1">{formErrors.stock}</p>
                  )}
                </div>
              </div>

              {/* Análisis de Rentabilidad */}
              {formData.sale_price && formData.purchase_price && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-2">Análisis de Rentabilidad</h5>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-blue-700">Ganancia por unidad:</span>
                      <p className={`font-bold ${getProfitColor(parseFloat(formData.sale_price), parseFloat(formData.purchase_price))}`}>
                        {formatCurrency(calculateProfit(parseFloat(formData.sale_price), parseFloat(formData.purchase_price)))}
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-700">Margen:</span>
                      <p className={`font-bold ${getProfitColor(parseFloat(formData.sale_price), parseFloat(formData.purchase_price))}`}>
                        {calculateProfitMargin(parseFloat(formData.sale_price), parseFloat(formData.purchase_price)).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-700">Inversión total:</span>
                      <p className="font-bold text-blue-900">
                        {formatCurrency(parseFloat(formData.purchase_price) * parseInt(formData.stock || '0'))}
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-700">Ganancia potencial:</span>
                      <p className="font-bold text-green-600">
                        {formatCurrency(calculateProfit(parseFloat(formData.sale_price), parseFloat(formData.purchase_price)) * parseInt(formData.stock || '0'))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Categorización */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-4">Categorización</h4>
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
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-medium text-purple-900 mb-4 flex items-center">
                <Hash className="h-4 w-4 mr-2" />
                Configuración IMEI/Serial
              </h4>
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
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
                  />
                  <label htmlFor="has_imei_serial" className="ml-2 text-sm text-slate-700">
                    Este producto maneja IMEI/Serial individual
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

                {formData.has_imei_serial && (
                  <div className="bg-purple-100 border border-purple-200 rounded p-3">
                    <p className="text-xs text-purple-800">
                      <strong>Nota:</strong> Los productos con IMEI/Serial permiten rastrear cada unidad individualmente. 
                      {formData.requires_imei_serial 
                        ? ' Será obligatorio registrar el IMEI/Serial antes de cada venta.'
                        : ' El IMEI/Serial es opcional para las ventas.'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Validaciones del Formulario */}
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
                      El producto se guardará localmente para demostración.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseForm}
                className="px-6 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || isValidating || Object.keys(formErrors).length > 0 || duplicateCheck.name || duplicateCheck.barcode}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    {editingProduct ? 'Actualizar' : 'Crear'} Producto
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Productos */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredAndSortedProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {products.length === 0 
                ? 'No hay productos registrados' 
                : 'No se encontraron productos que coincidan con los filtros'}
            </p>
            {products.length === 0 && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Crear Primer Producto
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Vista de Cuadrícula */
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedProducts.map((product) => {
                const profitMetrics = calculateProfitMetrics(product.sale_price, product.purchase_price, product.stock);
                
                return (
                  <LazyLoader key={product.id}>
                    <div className="group relative bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:-translate-y-1">
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

                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 line-clamp-2 mb-1">
                            {product.name}
                          </h3>
                          {product.category && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Tag className="h-3 w-3 mr-1" />
                              {product.category.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Precio:</span>
                          <span className="font-bold text-green-600">{formatCurrency(product.sale_price)}</span>
                        </div>
                        
                        {profitMetrics && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Margen:</span>
                            <span className={`font-bold ${getProfitColor(product.sale_price, product.purchase_price)}`}>
                              {profitMetrics.margin.toFixed(1)}%
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Stock:</span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStockStatusColor(product.stock)}`}>
                            {product.stock} {getStockStatusLabel(product.stock)}
                          </span>
                        </div>

                        {product.has_imei_serial && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">IMEI/Serial:</span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <Hash className="h-3 w-3 mr-1" />
                              {product.imei_serial_type === 'imei' ? 'IMEI' : 
                               product.imei_serial_type === 'serial' ? 'Serial' : 'Ambos'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center text-sm"
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Editar
                        </button>
                        
                        {product.has_imei_serial && (
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              setShowImeiManager(true);
                            }}
                            className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center text-sm"
                            title="Gestionar IMEI/Serial"
                          >
                            <Hash className="h-3 w-3" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center text-sm"
                          title="Eliminar producto"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </LazyLoader>
                );
              })}
            </div>
          </div>
        ) : (
          /* Vista de Lista */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Producto</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Categoría</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Precio</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Stock</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Margen</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">IMEI/Serial</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedProducts.map((product) => {
                  const profitMetrics = calculateProfitMetrics(product.sale_price, product.purchase_price, product.stock);
                  
                  return (
                    <tr key={product.id} className="hover:bg-slate-50 transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div>
                          <h4 className="font-medium text-slate-900">{product.name}</h4>
                          <p className="text-sm text-slate-600 line-clamp-2">{product.description}</p>
                          {product.barcode && (
                            <p className="text-xs text-slate-500 font-mono mt-1">{product.barcode}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {product.category ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <Tag className="h-3 w-3 mr-1" />
                            {product.category.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">Sin categoría</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-green-600">{formatCurrency(product.sale_price)}</p>
                          {product.purchase_price > 0 && (
                            <p className="text-xs text-slate-500">
                              Compra: {formatCurrency(product.purchase_price)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStockStatusColor(product.stock)}`}>
                          {product.stock} {getStockStatusLabel(product.stock)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {profitMetrics ? (
                          <div>
                            <p className={`font-bold ${getProfitColor(product.sale_price, product.purchase_price)}`}>
                              {profitMetrics.margin.toFixed(1)}%
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatCurrency(profitMetrics.profit)}/u
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {product.has_imei_serial ? (
                          <div className="flex items-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <Hash className="h-3 w-3 mr-1" />
                              {product.imei_serial_type === 'imei' ? 'IMEI' : 
                               product.imei_serial_type === 'serial' ? 'Serial' : 'Ambos'}
                            </span>
                            {product.requires_imei_serial && (
                              <span className="ml-1 text-xs text-purple-600">*</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">No</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              setShowDetailsModal(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                            title="Editar producto"
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
                            onClick={() => handleDuplicate(product)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors duration-200"
                            title="Duplicar producto"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Eliminar producto"
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
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredAndSortedProducts.length)} de {filteredAndSortedProducts.length} productos
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Anterior
                </button>
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-lg transition-colors duration-200 ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      <ProductDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
      />

      <ImeiSerialManager
        isOpen={showImeiManager}
        onClose={() => {
          setShowImeiManager(false);
          setSelectedProduct(null);
        }}
        onUpdate={() => {
          loadProducts();
          loadProductStats();
        }}
        product={selectedProduct!}
      />

      <BulkProductImport
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onSuccess={() => {
          setShowBulkImport(false);
          loadProducts();
          loadProductStats();
        }}
        categories={categories}
        suppliers={suppliers}
      />
    </div>
  );
}