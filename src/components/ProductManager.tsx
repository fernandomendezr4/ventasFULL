import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, Filter, X, Download, Upload, Eye, Hash } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { ProductWithCategory, Category, Supplier } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import ImeiSerialManager from './ImeiSerialManager';
import BulkProductImport from './BulkProductImport';
import ProductDetailsModal from './ProductDetailsModal';

// Datos demo para cuando no hay conexión a Supabase
const demoProducts: ProductWithCategory[] = [
  {
    id: 'demo-product-1',
    name: 'iPhone 15 Pro',
    description: 'Smartphone Apple último modelo',
    sale_price: 4500000,
    purchase_price: 3800000,
    stock: 5,
    barcode: '123456789',
    category_id: 'demo-cat-1',
    supplier_id: 'demo-sup-1',
    created_at: new Date().toISOString(),
    has_imei_serial: true,
    imei_serial_type: 'imei',
    requires_imei_serial: true,
    bulk_import_batch: '',
    import_notes: '',
    imported_at: null,
    imported_by: null,
    category: { id: 'demo-cat-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
    supplier: { id: 'demo-sup-1', name: 'Proveedor Demo', contact_person: 'Juan Pérez', email: 'juan@proveedor.com', phone: '123456789', address: 'Calle 123', created_at: new Date().toISOString() }
  },
  {
    id: 'demo-product-2',
    name: 'Samsung Galaxy S24',
    description: 'Smartphone Samsung premium',
    sale_price: 3200000,
    purchase_price: 2600000,
    stock: 8,
    barcode: '987654321',
    category_id: 'demo-cat-1',
    supplier_id: 'demo-sup-1',
    created_at: new Date().toISOString(),
    has_imei_serial: true,
    imei_serial_type: 'imei',
    requires_imei_serial: true,
    bulk_import_batch: '',
    import_notes: '',
    imported_at: null,
    imported_by: null,
    category: { id: 'demo-cat-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
    supplier: { id: 'demo-sup-1', name: 'Proveedor Demo', contact_person: 'Juan Pérez', email: 'juan@proveedor.com', phone: '123456789', address: 'Calle 123', created_at: new Date().toISOString() }
  },
  {
    id: 'demo-product-3',
    name: 'Audífonos Bluetooth',
    description: 'Audífonos inalámbricos premium',
    sale_price: 250000,
    purchase_price: 180000,
    stock: 2,
    barcode: '456789123',
    category_id: 'demo-cat-2',
    supplier_id: 'demo-sup-1',
    created_at: new Date().toISOString(),
    has_imei_serial: false,
    imei_serial_type: 'serial',
    requires_imei_serial: false,
    bulk_import_batch: '',
    import_notes: '',
    imported_at: null,
    imported_by: null,
    category: { id: 'demo-cat-2', name: 'Accesorios', description: 'Accesorios tecnológicos', created_at: new Date().toISOString() },
    supplier: { id: 'demo-sup-1', name: 'Proveedor Demo', contact_person: 'Juan Pérez', email: 'juan@proveedor.com', phone: '123456789', address: 'Calle 123', created_at: new Date().toISOString() }
  }
];

const demoCategories: Category[] = [
  { id: 'demo-cat-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
  { id: 'demo-cat-2', name: 'Accesorios', description: 'Accesorios tecnológicos', created_at: new Date().toISOString() }
];

const demoSuppliers: Supplier[] = [
  { id: 'demo-sup-1', name: 'Proveedor Demo', contact_person: 'Juan Pérez', email: 'juan@proveedor.com', phone: '123456789', address: 'Calle 123', created_at: new Date().toISOString() }
];

export default function ProductManager() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showImeiManager, setShowImeiManager] = useState(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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
    requires_imei_serial: false,
    imei_serial_list: ''
  });

  const [showImeiSerialInput, setShowImeiSerialInput] = useState(false);
  const [imeiSerialEntries, setImeiSerialEntries] = useState<Array<{
    imei_number: string;
    serial_number: string;
    notes: string;
  }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (isDemoMode || !supabase) {
      // Modo demo
      setProducts(demoProducts);
      setCategories(demoCategories);
      setSuppliers(demoSuppliers);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Usar la vista optimizada que incluye stock efectivo
      const { data: productsData, error: productsError } = await supabase
        .from('products_detailed')
        .select(`
          *,
          category:categories(id, name, description),
          supplier:suppliers(id, name, contact_person, email, phone, address)
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
      alert('Error al cargar datos: ' + (error as Error).message);
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
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
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

  const resetForm = () => {
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
      requires_imei_serial: false,
      imei_serial_list: ''
    });
    setImeiSerialEntries([]);
    setShowImeiSerialInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.sale_price) {
      alert('El nombre y precio de venta son obligatorios');
      return;
    }

    // Validar IMEI/Serial si es requerido
    if (formData.has_imei_serial && formData.requires_imei_serial && 
        imeiSerialEntries.length === 0 && !formData.imei_serial_list.trim()) {
      alert('Debe agregar al menos un IMEI/Serial para este producto');
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

      if (isDemoMode || !supabase) {
        // Modo demo
        const newProduct: ProductWithCategory = {
          id: `demo-product-${Date.now()}`,
          ...productData,
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
          alert('Producto actualizado correctamente en modo demo');
        } else {
          setProducts(prev => [...prev, newProduct]);
          alert('Producto creado correctamente en modo demo');
        }
      } else {
        let createdProductId: string;
        
        if (editingProduct) {
          const { error } = await supabase
            .from('products')
            .update(productData)
            .eq('id', editingProduct.id);

          if (error) throw error;
          createdProductId = editingProduct.id;
          alert('Producto actualizado correctamente');
        } else {
          const { data: newProduct, error } = await supabase
            .from('products')
            .insert([productData])
            .select()
            .single();

          if (error) throw error;
          createdProductId = newProduct.id;
          alert('Producto creado correctamente');
        }
        
        // Agregar IMEI/Serial si se proporcionaron
        if (formData.has_imei_serial && (imeiSerialEntries.length > 0 || formData.imei_serial_list.trim())) {
          await saveImeiSerialData(createdProductId);
        }
        
        await loadData();
      }

      setShowForm(false);
      setEditingProduct(null);
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar producto: ' + (error as Error).message);
    }
  };

  const handleEdit = (product: ProductWithCategory) => {
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
      requires_imei_serial: product.requires_imei_serial || false,
      imei_serial_list: ''
    });
    setImeiSerialEntries([]);
    setShowImeiSerialInput(false);
    setShowForm(true);
  };

  const handleDelete = async (product: ProductWithCategory) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el producto "${product.name}"?`)) {
      return;
    }

    try {
      if (isDemoMode || !supabase) {
        // Modo demo
        setProducts(prev => prev.filter(p => p.id !== product.id));
        alert('Producto eliminado correctamente en modo demo');
        return;
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== product.id));
      alert('Producto eliminado correctamente');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error al eliminar producto: ' + (error as Error).message);
    }
  };

  const handleViewDetails = (product: ProductWithCategory) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const handleManageImeiSerial = (product: ProductWithCategory) => {
    setSelectedProduct(product);
    setShowImeiManager(true);
  };

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) return 'text-red-600 bg-red-50 border-red-200';
    if (stock <= 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getStockStatusText = (stock: number) => {
    if (stock === 0) return 'Sin stock';
    if (stock <= 5) return 'Stock bajo';
    return 'En stock';
  };

  const saveImeiSerialData = async (productId: string) => {
    try {
      const imeiSerialData = [];
      
      // Procesar entradas individuales
      for (const entry of imeiSerialEntries) {
        if (entry.imei_number.trim() || entry.serial_number.trim()) {
          imeiSerialData.push({
            product_id: productId,
            imei_number: entry.imei_number.trim(),
            serial_number: entry.serial_number.trim(),
            notes: entry.notes.trim() || 'Agregado al crear producto',
            created_by: user?.id,
            updated_by: user?.id
          });
        }
      }
      
      // Procesar lista masiva
      if (formData.imei_serial_list.trim()) {
        const lines = formData.imei_serial_list.trim().split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            // Detectar si es IMEI (15 dígitos) o serial
            const isIMEI = /^\d{15}$/.test(trimmedLine);
            
            imeiSerialData.push({
              product_id: productId,
              imei_number: isIMEI ? trimmedLine : '',
              serial_number: isIMEI ? '' : trimmedLine,
              notes: 'Agregado masivamente al crear producto',
              created_by: user?.id,
              updated_by: user?.id
            });
          }
        }
      }
      
      if (imeiSerialData.length > 0) {
        const { error } = await supabase
          .from('product_imei_serials')
          .insert(imeiSerialData);
        
        if (error) throw error;
        
        console.log(`Se agregaron ${imeiSerialData.length} registros IMEI/Serial`);
      }
    } catch (error) {
      console.error('Error saving IMEI/Serial data:', error);
      alert('Producto creado pero hubo un error al guardar los IMEI/Serial: ' + (error as Error).message);
    }
  };

  const addImeiSerialEntry = () => {
    setImeiSerialEntries([
      ...imeiSerialEntries,
      { imei_number: '', serial_number: '', notes: '' }
    ]);
  };

  const removeImeiSerialEntry = (index: number) => {
    setImeiSerialEntries(imeiSerialEntries.filter((_, i) => i !== index));
  };

  const updateImeiSerialEntry = (index: number, field: string, value: string) => {
    const updated = [...imeiSerialEntries];
    updated[index] = { ...updated[index], [field]: value };
    setImeiSerialEntries(updated);
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
          `"${product.category?.name || ''}"`,
          `"${product.supplier?.name || ''}"`,
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
      
      alert('Productos exportados exitosamente');
    } catch (error) {
      console.error('Error exporting products:', error);
      alert('Error al exportar productos');
    }
  };

  const lowStockCount = products.filter(p => p.stock <= 5 && p.stock > 0).length;
  const outOfStockCount = products.filter(p => p.stock === 0).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-slate-200 rounded w-2/3"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-8 w-8 text-blue-600" />
            Productos
          </h2>
          <p className="text-slate-600 mt-1">
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
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
          >
            <Upload className="w-4 h-4" />
            Importar
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingProduct(null);
              resetForm();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar productos por nombre, descripción o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name-asc">Nombre A-Z</option>
              <option value="name-desc">Nombre Z-A</option>
              <option value="stock-asc">Stock menor</option>
              <option value="stock-desc">Stock mayor</option>
              <option value="price-asc">Precio menor</option>
              <option value="price-desc">Precio mayor</option>
              <option value="created_at-desc">Más recientes</option>
              <option value="created_at-asc">Más antiguos</option>
            </select>
          </div>
        </div>

        {(searchTerm || selectedCategory || selectedSupplier || stockFilter !== 'all') && (
          <div className="flex items-center gap-2 text-sm text-slate-600 mt-3">
            <Filter className="w-4 h-4" />
            <span>Mostrando {filteredProducts.length} de {products.length} productos</span>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                setSelectedSupplier('');
                setStockFilter('all');
              }}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors duration-200"
            >
              <X className="w-3 h-3" />
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-200 group">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 line-clamp-2 mb-2">{product.name}</h3>
                  {product.description && (
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">{product.description}</p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={() => handleViewDetails(product)}
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
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    title="Eliminar producto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Precio:</span>
                  <span className="font-bold text-green-600 text-lg">
                    {formatCurrency(product.sale_price)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Stock:</span>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStockStatusColor((product as any).effective_stock || product.stock)}`}>
                      {(product as any).effective_stock || product.stock} - {getStockStatusText((product as any).effective_stock || product.stock)}
                    </span>
                    {product.requires_imei_serial && (product as any).effective_stock !== product.stock && (
                      <p className="text-xs text-orange-600 mt-1">
                        Stock físico: {product.stock} | Disponible: {(product as any).effective_stock || 0}
                      </p>
                    )}
                  </div>
                </div>

                {product.category && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Categoría:</span>
                    <span className="text-sm text-slate-900 font-medium">{product.category.name}</span>
                  </div>
                )}

                {product.supplier && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Proveedor:</span>
                    <span className="text-sm text-slate-900">{product.supplier.name}</span>
                  </div>
                )}

                {product.has_imei_serial && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 flex items-center">
                      <Hash className="h-3 w-3 mr-1" />
                      {product.imei_serial_type === 'imei' ? 'IMEI' : 
                       product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI/Serial'}:
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          (product as any).available_imei_serial_count > 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {(product as any).available_imei_serial_count || 0} disponibles
                        </span>
                        {product.requires_imei_serial && (product as any).available_imei_serial_count === 0 && (
                          <p className="text-xs text-red-600 mt-1">⚠️ Sin unidades para venta</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleManageImeiSerial(product)}
                        className="text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors duration-200"
                      >
                        Gestionar
                      </button>
                    </div>
                  </div>
                )}

                {product.barcode && (
                  <div className="text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded border">
                    {product.barcode}
                  </div>
                )}
              </div>

              {/* Profit calculation if purchase price exists */}
              {product.purchase_price && product.purchase_price > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Ganancia:</span>
                    <span className={`font-medium ${
                      product.sale_price > product.purchase_price ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(product.sale_price - product.purchase_price)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No se encontraron productos</h3>
          <p className="text-slate-600 mb-6">
            {searchTerm || selectedCategory || selectedSupplier || stockFilter !== 'all'
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Comienza agregando tu primer producto'
            }
          </p>
          {!searchTerm && !selectedCategory && !selectedSupplier && stockFilter === 'all' && (
            <button
              onClick={() => {
                setShowForm(true);
                setEditingProduct(null);
                resetForm();
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="w-5 h-5" />
              Agregar Primer Producto
            </button>
          )}
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-slate-900">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingProduct(null);
                    resetForm();
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      placeholder="Nombre del producto"
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
                      placeholder="Código de barras"
                    />
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
                    placeholder="Descripción del producto"
                  />
                </div>

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
                    <input
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      min="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

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
                      <option value="">Seleccionar categoría</option>
                      {categories.map(category => (
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
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="has_imei_serial"
                      checked={formData.has_imei_serial}
                      onChange={(e) => {
                        setFormData({ ...formData, has_imei_serial: e.target.checked });
                        if (!e.target.checked) {
                          setShowImeiSerialInput(false);
                          setImeiSerialEntries([]);
                          setFormData(prev => ({ ...prev, imei_serial_list: '' }));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <label htmlFor="has_imei_serial" className="text-sm font-medium text-slate-700">
                      Este producto tiene IMEI/Serial
                    </label>
                  </div>

                  {formData.has_imei_serial && (
                    <div className="space-y-3 ml-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Tipo de identificador
                        </label>
                        <select
                          value={formData.imei_serial_type}
                          onChange={(e) => setFormData({ ...formData, imei_serial_type: e.target.value as 'imei' | 'serial' | 'both' })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                          checked={formData.requires_imei_serial}
                          onChange={(e) => setFormData({ ...formData, requires_imei_serial: e.target.checked })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                        />
                        <label htmlFor="requires_imei_serial" className="text-sm text-slate-700">
                          Requerir IMEI/Serial para vender
                        </label>
                      </div>

                      {/* Botón para mostrar/ocultar entrada de IMEI/Serial */}
                      <div className="border-t border-purple-200 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowImeiSerialInput(!showImeiSerialInput)}
                          className="flex items-center gap-2 text-sm text-purple-700 hover:text-purple-900 font-medium transition-colors duration-200"
                        >
                          <Hash className="h-4 w-4" />
                          {showImeiSerialInput ? 'Ocultar' : 'Agregar'} IMEI/Serial ahora
                        </button>
                        <p className="text-xs text-purple-600 mt-1">
                          Puedes agregar los códigos IMEI/Serial directamente al crear el producto
                        </p>
                      </div>

                      {/* Formulario de IMEI/Serial */}
                      {showImeiSerialInput && (
                        <div className="border-t border-purple-200 pt-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h5 className="font-medium text-purple-900">
                              Agregar {formData.imei_serial_type === 'imei' ? 'IMEI' : 
                                      formData.imei_serial_type === 'serial' ? 'Números de Serie' : 'IMEI/Serial'}
                            </h5>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={addImeiSerialEntry}
                                className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 transition-colors duration-200"
                              >
                                + Individual
                              </button>
                            </div>
                          </div>

                          {/* Entradas individuales */}
                          {imeiSerialEntries.length > 0 && (
                            <div className="space-y-3">
                              <h6 className="text-sm font-medium text-purple-800">Entradas Individuales:</h6>
                              {imeiSerialEntries.map((entry, index) => (
                                <div key={index} className="bg-white border border-purple-200 rounded p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-purple-700">
                                      Entrada #{index + 1}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => removeImeiSerialEntry(index)}
                                      className="text-red-600 hover:text-red-800 transition-colors duration-200"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                    {(formData.imei_serial_type === 'imei' || formData.imei_serial_type === 'both') && (
                                      <div>
                                        <label className="block text-xs text-slate-600 mb-1">
                                          IMEI (15 dígitos)
                                        </label>
                                        <input
                                          type="text"
                                          value={entry.imei_number}
                                          onChange={(e) => updateImeiSerialEntry(index, 'imei_number', e.target.value)}
                                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                                          placeholder="123456789012345"
                                          maxLength={15}
                                          pattern="[0-9]{15}"
                                        />
                                      </div>
                                    )}
                                    {(formData.imei_serial_type === 'serial' || formData.imei_serial_type === 'both') && (
                                      <div>
                                        <label className="block text-xs text-slate-600 mb-1">
                                          Número de Serie
                                        </label>
                                        <input
                                          type="text"
                                          value={entry.serial_number}
                                          onChange={(e) => updateImeiSerialEntry(index, 'serial_number', e.target.value)}
                                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                                          placeholder="ABC123DEF456"
                                        />
                                      </div>
                                    )}
                                    <div>
                                      <label className="block text-xs text-slate-600 mb-1">
                                        Notas (opcional)
                                      </label>
                                      <input
                                        type="text"
                                        value={entry.notes}
                                        onChange={(e) => updateImeiSerialEntry(index, 'notes', e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="Notas adicionales..."
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Entrada masiva */}
                          <div className="space-y-2">
                            <h6 className="text-sm font-medium text-purple-800">Entrada Masiva:</h6>
                            <textarea
                              value={formData.imei_serial_list}
                              onChange={(e) => setFormData({ ...formData, imei_serial_list: e.target.value })}
                              rows={6}
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                              placeholder={`Ingresa un ${formData.imei_serial_type === 'imei' ? 'IMEI' : 
                                          formData.imei_serial_type === 'serial' ? 'número de serie' : 'IMEI o serial'} por línea:

Ejemplo:
${formData.imei_serial_type === 'imei' ? '123456789012345\n987654321098765' : 
  formData.imei_serial_type === 'serial' ? 'ABC123DEF456\nXYZ789GHI012' : 
  '123456789012345\nABC123DEF456\n987654321098765'}`}
                            />
                            <p className="text-xs text-purple-600">
                              {formData.imei_serial_list.trim() ? 
                                `${formData.imei_serial_list.trim().split('\n').filter(line => line.trim()).length} códigos detectados` :
                                'Los números de 15 dígitos se detectarán automáticamente como IMEI'
                              }
                            </p>
                          </div>

                          {/* Resumen total */}
                          {(imeiSerialEntries.length > 0 || formData.imei_serial_list.trim()) && (
                            <div className="bg-purple-100 border border-purple-300 rounded p-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-purple-900">Total a agregar:</span>
                                <span className="font-bold text-purple-900">
                                  {imeiSerialEntries.filter(e => e.imei_number.trim() || e.serial_number.trim()).length + 
                                   (formData.imei_serial_list.trim() ? formData.imei_serial_list.trim().split('\n').filter(line => line.trim()).length : 0)} 
                                  códigos
                                </span>
                              </div>
                              <p className="text-xs text-purple-700 mt-1">
                                Se crearán automáticamente al guardar el producto
                              </p>
                            </div>
                          )}
                        </div>
                      )}
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
                    className="px-4 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
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
        <ProductDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
        />
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
    </div>
  );
}