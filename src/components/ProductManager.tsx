import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, Search, Filter, Eye, Hash, Upload, Download, AlertTriangle, CheckCircle, Smartphone, Tag, Truck, DollarSign, BarChart3 } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { ProductWithCategory, Category, Supplier } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import ProductDetailsModal from './ProductDetailsModal';
import ImeiSerialManager from './ImeiSerialManager';
import BulkProductImport from './BulkProductImport';
import { 
  validateImeiFormat, 
  validateSerialNumber, 
  checkImeiDuplicate, 
  checkSerialDuplicate,
  normalizeImei,
  normalizeSerial 
} from '../lib/imeiValidation';
import { validateProductDuplicates, validateBusinessLogic } from '../lib/productValidation';

export default function ProductManager() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showImeiManager, setShowImeiManager] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'sale_price' | 'stock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);

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
    loadProducts();
    loadCategories();
    loadSuppliers();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Demo mode: provide sample products data
        const demoProducts = [
          {
            id: 'demo-product-1',
            name: 'iPhone 15 Pro',
            description: 'Smartphone Apple iPhone 15 Pro 128GB',
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
            name: 'Samsung Galaxy S24',
            description: 'Smartphone Samsung Galaxy S24 256GB',
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
            name: 'Audífonos Bluetooth',
            description: 'Audífonos inalámbricos premium',
            sale_price: 250000,
            purchase_price: 180000,
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
            name: 'Xiaomi Redmi Note 13',
            description: 'Smartphone Xiaomi Redmi Note 13 128GB',
            sale_price: 800000,
            purchase_price: 650000,
            stock: 12,
            barcode: '789123456789',
            category_id: 'demo-category-1',
            supplier_id: 'demo-supplier-4',
            created_at: new Date(Date.now() - 259200000).toISOString(),
            has_imei_serial: true,
            imei_serial_type: 'imei' as const,
            requires_imei_serial: true,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            category: { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-4', name: 'Xiaomi Store', contact_person: 'Contacto Xiaomi', email: 'xiaomi@store.com', phone: '3007777777', address: 'Dirección Xiaomi', created_at: new Date().toISOString() }
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
          { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios electrónicos', created_at: new Date().toISOString() }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isDemoMode) {
      alert('Función no disponible en modo demo');
      return;
    }
    
    // Limpiar errores previos
    setValidationErrors({});
    setIsValidating(true);

    try {
      // Validaciones básicas
      if (!formData.name.trim()) {
        setValidationErrors({ name: 'El nombre es requerido' });
        return;
      }

      if (!formData.sale_price || parseFloat(formData.sale_price) <= 0) {
        setValidationErrors({ sale_price: 'El precio de venta debe ser mayor a 0' });
        return;
      }

      if (!formData.stock || parseInt(formData.stock) < 0) {
        setValidationErrors({ stock: 'El stock no puede ser negativo' });
        return;
      }

      // Validar duplicados usando la nueva función
      const duplicateValidation = await validateProductDuplicates(formData, editingProduct?.id);
      
      if (!duplicateValidation.isValid) {
        setValidationErrors(duplicateValidation.errors);
        return;
      }

      // Validar lógica de negocio
      const businessWarnings = validateBusinessLogic(formData);
      
      // Mostrar advertencias si las hay (pero no bloquear el guardado)
      if (Object.keys(businessWarnings).length > 0) {
        const warningMessages = Object.values(businessWarnings).join('\n');
        const proceed = window.confirm(
          `Se detectaron las siguientes advertencias:\n\n${warningMessages}\n\n¿Desea continuar guardando el producto?`
        );
        
        if (!proceed) {
          return;
        }
      }

      // Validación especial para productos con IMEI/Serial
      if (formData.has_imei_serial && formData.requires_imei_serial && parseInt(formData.stock) > 0) {
        const proceed = window.confirm(
          `Este producto requiere IMEI/Serial obligatorio.\n\n` +
          `Después de crear el producto, deberá agregar ${formData.stock} registros únicos de ${formData.imei_serial_type === 'imei' ? 'IMEI' : formData.imei_serial_type === 'serial' ? 'números de serie' : 'IMEI y números de serie'}.\n\n` +
          `¿Desea continuar?`
        );
        
        if (!proceed) {
          return;
        }
      }

      // Validar límites de base de datos
      const salePrice = parseFloat(formData.sale_price);
      const purchasePrice = parseFloat(formData.purchase_price) || 0;
      const stock = parseInt(formData.stock);

      if (salePrice > 999999999.99) {
        setValidationErrors({ sale_price: 'El precio de venta excede el límite máximo permitido' });
        return;
      }

      if (purchasePrice > 999999999.99) {
        setValidationErrors({ purchase_price: 'El precio de compra excede el límite máximo permitido' });
        return;
      }

      if (stock > 999999) {
        setValidationErrors({ stock: 'El stock excede el límite máximo permitido' });
        return;
      }

      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        sale_price: salePrice,
        purchase_price: purchasePrice,
        stock: stock,
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
        
        alert('Producto actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        
        // Mostrar mensaje específico para productos con IMEI/Serial
        if (formData.has_imei_serial && formData.requires_imei_serial && parseInt(formData.stock) > 0) {
          alert(
            `Producto creado exitosamente.\n\n` +
            `IMPORTANTE: Este producto requiere ${formData.imei_serial_type === 'imei' ? 'IMEI' : formData.imei_serial_type === 'serial' ? 'números de serie' : 'IMEI y números de serie'} obligatorios.\n\n` +
            `Debe agregar ${formData.stock} registros únicos en la gestión de IMEI/Serial antes de que esté disponible para venta.`
          );
        } else {
          alert('Producto creado exitosamente');
        }
      }

      setShowForm(false);
      setEditingProduct(null);
      resetForm();
      loadProducts();
      
    } catch (error) {
      console.error('Error saving product:', error);
      
      // Manejar errores específicos de la base de datos
      const errorMessage = (error as Error).message;
      
      if (errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
        if (errorMessage.includes('products_name_key') || errorMessage.includes('name')) {
          setValidationErrors({ name: 'Ya existe un producto con este nombre' });
        } else if (errorMessage.includes('products_barcode') || errorMessage.includes('barcode')) {
          setValidationErrors({ barcode: 'Ya existe un producto con este código de barras' });
        } else {
          alert('Error: Ya existe un producto con datos similares');
        }
      } else if (errorMessage.includes('check constraint')) {
        alert('Error: Los datos no cumplen con las validaciones requeridas');
      } else if (errorMessage.includes('foreign key')) {
        alert('Error: Categoría o proveedor seleccionado no válido');
      } else {
        alert('Error al guardar producto: ' + errorMessage);
      }
    } finally {
      setIsValidating(false);
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
      has_imei_serial: product.has_imei_serial || false,
      imei_serial_type: product.imei_serial_type || 'serial',
      requires_imei_serial: product.requires_imei_serial || false,
    });
    setValidationErrors({});
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    // Verificar si el producto tiene ventas asociadas
    if (!isDemoMode && supabase) {
      try {
        const { data: salesCheck, error } = await supabase
          .from('sale_items')
          .select('id')
          .eq('product_id', id)
          .limit(1);

        if (error) {
          console.error('Error checking product sales:', error);
          alert('Error al verificar ventas del producto');
          return;
        }

        if (salesCheck && salesCheck.length > 0) {
          alert('No se puede eliminar este producto porque tiene ventas asociadas. Para mantener la integridad de los datos, considere desactivarlo en lugar de eliminarlo.');
          return;
        }

        // Verificar IMEI/Serial asociados
        const { data: imeiCheck, error: imeiError } = await supabase
          .from('product_imei_serials')
          .select('id, status')
          .eq('product_id', id);

        if (imeiError) {
          console.error('Error checking IMEI/Serial:', imeiError);
        }

        const soldImeiCount = imeiCheck?.filter(item => item.status === 'sold').length || 0;
        
        if (soldImeiCount > 0) {
          alert(`No se puede eliminar este producto porque tiene ${soldImeiCount} unidades vendidas con IMEI/Serial registrados.`);
          return;
        }

        const totalImeiCount = imeiCheck?.length || 0;
        const confirmMessage = totalImeiCount > 0 
          ? `¿Estás seguro de que quieres eliminar este producto?\n\nEsto también eliminará ${totalImeiCount} registros IMEI/Serial asociados.`
          : '¿Estás seguro de que quieres eliminar este producto?';

        if (!window.confirm(confirmMessage)) {
          return;
        }
      } catch (error) {
        console.error('Error in pre-delete validation:', error);
        alert('Error al validar eliminación del producto');
        return;
      }
    } else if (isDemoMode) {
      if (isDemoMode) {
        alert('Función no disponible en modo demo');
        return;
      }
    } else {
      if (!window.confirm('¿Estás seguro de que quieres eliminar este producto?')) {
        return;
      }
    }
      
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        alert('Producto eliminado exitosamente');
        loadProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('foreign key') || errorMessage.includes('violates')) {
          alert('No se puede eliminar el producto porque está siendo usado en otras partes del sistema');
        } else {
          alert('Error al eliminar producto: ' + errorMessage);
        }
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
    setValidationErrors({});
  };

  const generateBarcode = () => {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setFormData({ ...formData, barcode: `${timestamp}${random}` });
  };

  const filteredProducts = products.filter(product => {
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
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) return 'bg-red-100 text-red-800 border-red-200';
    if (stock <= 10) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStockStatusText = (stock: number) => {
    if (stock === 0) return 'Sin stock';
    if (stock <= 10) return 'Stock bajo';
    return 'En stock';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Productos</h2>
        <div className="flex gap-2">
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

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, descripción o código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
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
              <option value="in_stock">En stock</option>
              <option value="low_stock">Stock bajo</option>
              <option value="out_of_stock">Sin stock</option>
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
              <option value="sale_price-asc">Precio menor</option>
              <option value="sale_price-desc">Precio mayor</option>
              <option value="stock-asc">Stock menor</option>
              <option value="stock-desc">Stock mayor</option>
              <option value="created_at-desc">Más recientes</option>
              <option value="created_at-asc">Más antiguos</option>
            </select>
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
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (validationErrors.name) {
                      setValidationErrors(prev => ({ ...prev, name: '' }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nombre del producto"
                />
                {validationErrors.name && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.name}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Precio de Venta *
                </label>
                <FormattedNumberInput
                  value={formData.sale_price}
                  onChange={(value) => {
                    setFormData({ ...formData, sale_price: value });
                    if (validationErrors.sale_price) {
                      setValidationErrors(prev => ({ ...prev, sale_price: '' }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                  required
                />
                {validationErrors.sale_price && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.sale_price}</p>
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
                  onChange={(value) => {
                    setFormData({ ...formData, stock: value });
                    if (validationErrors.stock) {
                      setValidationErrors(prev => ({ ...prev, stock: '' }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                  required
                />
                {validationErrors.stock && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.stock}</p>
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
                    onChange={(e) => {
                      setFormData({ ...formData, barcode: e.target.value });
                      if (validationErrors.barcode) {
                        setValidationErrors(prev => ({ ...prev, barcode: '' }));
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Código de barras"
                  />
                  <button
                    type="button"
                    onClick={generateBarcode}
                    className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                  >
                    Generar
                  </button>
                </div>
                {validationErrors.barcode && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.barcode}</p>
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

            {/* IMEI/Serial Configuration */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-medium text-purple-900 mb-3 flex items-center">
                <Smartphone className="h-4 w-4 mr-2" />
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
                    Este producto maneja IMEI/Números de Serie
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
                        <option value="serial">Solo Números de Serie</option>
                        <option value="imei">Solo IMEI (15 dígitos)</option>
                        <option value="both">IMEI y Números de Serie</option>
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
                    
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <h5 className="text-sm font-medium text-blue-900 mb-1">Validaciones Automáticas:</h5>
                      <ul className="text-xs text-blue-800 space-y-1">
                        <li>• IMEI: Exactamente 15 dígitos, formato válido según algoritmo Luhn</li>
                        <li>• Serial: 3-50 caracteres alfanuméricos, sin caracteres especiales</li>
                        <li>• Verificación automática de duplicados en toda la base de datos</li>
                        <li>• Prevención de duplicados en importaciones masivas</li>
                      </ul>
                    </div>
                    
                    {formData.requires_imei_serial && parseInt(formData.stock) > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <div className="flex items-center">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                          <div className="text-xs text-yellow-800">
                            <p className="font-medium">Recordatorio:</p>
                            <p>Después de crear este producto, deberás agregar {formData.stock} registros IMEI/Serial únicos para que esté disponible para venta.</p>
                          </div>
                        </div>
                      </div>
                    )}
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
                      Los cambios no se guardarán en modo demo. Las validaciones de IMEI funcionan normalmente.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isValidating}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
              >
                {isValidating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Validando...
                  </>
                ) : (
                  <>
                    {editingProduct ? 'Actualizar' : 'Agregar'}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingProduct(null);
                  resetForm();
                }}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                disabled={isValidating}
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
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 flex items-center">
                    <Package className="h-4 w-4 mr-2 text-blue-600" />
                    {product.name}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{product.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStockStatusColor(product.stock)}`}>
                      {getStockStatusText(product.stock)} ({product.stock})
                    </span>
                    {product.has_imei_serial && (
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                        <Hash className="h-3 w-3 inline mr-1" />
                        {product.imei_serial_type === 'imei' ? 'IMEI' : 
                         product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI/Serial'}
                        {product.requires_imei_serial && ' (Obligatorio)'}
                      </span>
                    )}
                  </div>
                </div>
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
                    title="Editar producto"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    title="Eliminar producto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Precio:</span>
                  <span className="font-bold text-green-600">{formatCurrency(product.sale_price)}</span>
                </div>
                
                {product.purchase_price > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Ganancia:</span>
                    <span className="font-medium text-slate-900">
                      {formatCurrency(product.sale_price - product.purchase_price)}
                    </span>
                  </div>
                )}
                
                {product.category && (
                  <div className="flex items-center">
                    <Tag className="h-3 w-3 mr-1 text-slate-500" />
                    <span className="text-xs text-slate-600">{product.category.name}</span>
                  </div>
                )}
                
                {product.supplier && (
                  <div className="flex items-center">
                    <Truck className="h-3 w-3 mr-1 text-slate-500" />
                    <span className="text-xs text-slate-600">{product.supplier.name}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  Creado: {new Date(product.created_at).toLocaleDateString('es-ES')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <ProductDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
      />

      <ImeiSerialManager
        isOpen={showImeiManager && selectedProduct !== null}
        onClose={() => {
          setShowImeiManager(false);
          setSelectedProduct(null);
        }}
        onUpdate={loadProducts}
        product={selectedProduct}
      />

      <BulkProductImport
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onSuccess={loadProducts}
        categories={categories}
        suppliers={suppliers}
      />
    </div>
  );
}