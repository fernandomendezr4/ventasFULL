import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, Search, Filter, TrendingUp, DollarSign, Upload, Download, FileText, Smartphone, Hash, Save, X, AlertCircle, CheckCircle, Camera, Barcode } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProductWithCategory, Category, Supplier, BulkProductData, BulkImportResult, ImeiSerialData } from '../lib/types';
import { formatCurrency, calculateProfit, calculateProfitMargin } from '../lib/currency';
import FormattedNumberInput from './FormattedNumberInput';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';
import BulkProductImport from './BulkProductImport';
import ImeiSerialManager from './ImeiSerialManager';

export default function ProductManager() {
  const { notification, showSuccess, showError, showWarning, hideNotification } = useNotification();
  const { confirmation, showConfirmation, hideConfirmation, handleConfirm } = useConfirmation();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showImeiSerialManager, setShowImeiSerialManager] = useState(false);
  const [selectedProductForImei, setSelectedProductForImei] = useState<ProductWithCategory | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
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
  const [duplicateCheck, setDuplicateCheck] = useState<{
    name: boolean;
    barcode: boolean;
  }>({
    name: false,
    barcode: false
  });

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadSuppliers();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // Cargar productos con información completa
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories (id, name),
          supplier:suppliers (id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setProducts(data as ProductWithCategory[]);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  // Validación en tiempo real
  const validateField = (field: string, value: string) => {
    const errors: Record<string, string> = {};
    
    switch (field) {
      case 'name':
        if (!value.trim()) {
          errors.name = 'El nombre es requerido';
        } else if (value.trim().length < 2) {
          errors.name = 'El nombre debe tener al menos 2 caracteres';
        } else if (value.trim().length > 100) {
          errors.name = 'El nombre no puede exceder 100 caracteres';
        }
        break;
        
      case 'sale_price':
        const salePrice = parseFloat(value);
        if (!value || salePrice <= 0) {
          errors.sale_price = 'El precio de venta es requerido y debe ser mayor a 0';
        } else if (salePrice > 999999999) {
          errors.sale_price = 'El precio de venta es demasiado alto';
        }
        break;
        
      case 'purchase_price':
        const purchasePrice = parseFloat(value);
        if (value && purchasePrice < 0) {
          errors.purchase_price = 'El precio de compra no puede ser negativo';
        } else if (purchasePrice > 999999999) {
          errors.purchase_price = 'El precio de compra es demasiado alto';
        }
        break;
        
      case 'stock':
        const stock = parseInt(value);
        if (!value || stock < 0) {
          errors.stock = 'El stock es requerido y no puede ser negativo';
        } else if (stock > 999999) {
          errors.stock = 'El stock es demasiado alto';
        }
        break;
        
      case 'barcode':
        if (value && value.length > 0) {
          if (value.length < 8) {
            errors.barcode = 'El código de barras debe tener al menos 8 caracteres';
          } else if (value.length > 50) {
            errors.barcode = 'El código de barras no puede exceder 50 caracteres';
          } else if (!/^[A-Za-z0-9\-\.\ \$\/\+\%]+$/.test(value)) {
            errors.barcode = 'El código de barras contiene caracteres no válidos';
          }
        }
        break;
    }
    
    setFormErrors(prev => ({
      ...prev,
      [field]: errors[field] || ''
    }));
    
    return !errors[field];
  };

  // Verificar duplicados
  const checkDuplicates = async (field: 'name' | 'barcode', value: string) => {
    if (!value.trim()) return;
    
    try {
      let query = supabase.from('products').select('id, name, barcode');
      
      if (field === 'name') {
        query = query.ilike('name', value.trim());
      } else {
        query = query.eq('barcode', value.trim());
      }
      
      // Excluir el producto actual si estamos editando
      if (editingProduct) {
        query = query.neq('id', editingProduct.id);
      }
      
      const { data, error } = await query.limit(1);
      
      if (error) throw error;
      
      const isDuplicate = data && data.length > 0;
      setDuplicateCheck(prev => ({
        ...prev,
        [field]: isDuplicate
      }));
      
      if (isDuplicate) {
        setFormErrors(prev => ({
          ...prev,
          [field]: field === 'name' 
            ? 'Ya existe un producto con este nombre' 
            : 'Ya existe un producto con este código de barras'
        }));
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
    }
  };

  // Validación completa del formulario
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    // Validar campos requeridos
    if (!formData.name.trim()) {
      errors.name = 'El nombre es requerido';
    }
    
    if (!formData.sale_price || parseFloat(formData.sale_price) <= 0) {
      errors.sale_price = 'El precio de venta es requerido y debe ser mayor a 0';
    }
    
    if (!formData.stock || parseInt(formData.stock) < 0) {
      errors.stock = 'El stock es requerido y no puede ser negativo';
    }
    
    // Validar precios lógicos
    const salePrice = parseFloat(formData.sale_price) || 0;
    const purchasePrice = parseFloat(formData.purchase_price) || 0;
    
    if (purchasePrice > 0 && salePrice < purchasePrice) {
      errors.sale_price = 'El precio de venta no puede ser menor al precio de compra';
    }
    
    // Validar IMEI/Serial si está habilitado
    if (formData.has_imei_serial && formData.requires_imei_serial) {
      if (!formData.imei_serial_type) {
        errors.imei_serial_type = 'Debe seleccionar el tipo de identificador';
      }
    }
    
    // Verificar duplicados
    if (duplicateCheck.name || duplicateCheck.barcode) {
      if (duplicateCheck.name) errors.name = 'Ya existe un producto con este nombre';
      if (duplicateCheck.barcode) errors.barcode = 'Ya existe un producto con este código de barras';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showError(
        'Formulario Incompleto',
        'Por favor corrige los errores en el formulario antes de continuar'
      );
      return;
    }
    
    try {
      setIsSubmitting(true);
      
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
      setFormErrors({});
      setDuplicateCheck({ name: false, barcode: false });
      setShowAdvancedOptions(false);
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
        requires_imei_serial: false
      });
      loadProducts();
      showSuccess(
        editingProduct ? '¡Producto Actualizado!' : '¡Producto Creado!',
        editingProduct 
          ? `El producto ${formData.name} ha sido actualizado exitosamente`
          : `El producto ${formData.name} ha sido creado exitosamente`
      );
    } catch (error) {
      console.error('Error saving product:', error);
      
      const errorMessage = (error as Error).message;
      
      // Manejar errores específicos
      if (errorMessage.includes('duplicate key value violates unique constraint')) {
        if (errorMessage.includes('barcode')) {
          showError('Código Duplicado', 'Ya existe un producto con este código de barras');
        } else {
          showError('Producto Duplicado', 'Ya existe un producto con estos datos');
        }
      } else if (errorMessage.includes('check constraint')) {
        showError('Datos Inválidos', 'Los datos ingresados no cumplen con las validaciones requeridas');
      } else {
        showError(
          'Error al Guardar Producto',
          'No se pudo guardar el producto. ' + errorMessage
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    
    // Validar campo en tiempo real
    validateField(field, value);
    
    // Verificar duplicados para nombre y código de barras
    if ((field === 'name' || field === 'barcode') && value.trim()) {
      const timeoutId = setTimeout(() => {
        checkDuplicates(field as 'name' | 'barcode', value);
      }, 500); // Debounce de 500ms
      
      return () => clearTimeout(timeoutId);
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
      requires_imei_serial: false
    });
    setFormErrors({});
    setDuplicateCheck({ name: false, barcode: false });
    setShowAdvancedOptions(false);
  };

  const handleCancelForm = () => {
    if (Object.values(formData).some(value => value !== '' && value !== false && value !== 'serial')) {
      if (window.confirm('¿Estás seguro de que quieres cancelar? Se perderán los datos ingresados.')) {
        setShowForm(false);
        setEditingProduct(null);
        resetForm();
      }
    } else {
      setShowForm(false);
      setEditingProduct(null);
      resetForm();
    }
  };

  const calculateProfitInfo = () => {
    const salePrice = parseFloat(formData.sale_price) || 0;
    const purchasePrice = parseFloat(formData.purchase_price) || 0;
    const stock = parseInt(formData.stock) || 0;
    
    if (salePrice > 0 && purchasePrice > 0) {
      const profit = calculateProfit(salePrice, purchasePrice);
      const margin = calculateProfitMargin(salePrice, purchasePrice);
      const totalProfit = profit * stock;
      
      return {
        profit,
        margin,
        totalProfit,
        isValid: profit >= 0
      };
    }
    
    return null;
  };

  const generateSmartBarcode = () => {
    // Generar código más inteligente basado en categoría y timestamp
    const categoryCode = formData.category_id ? 
      categories.find(c => c.id === formData.category_id)?.name.substring(0, 3).toUpperCase() || 'GEN' : 
      'GEN';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const barcode = `${categoryCode}${timestamp}${random}`;
    
    handleFieldChange('barcode', barcode);
  };

  const suggestPrice = () => {
    const purchasePrice = parseFloat(formData.purchase_price) || 0;
    if (purchasePrice > 0) {
      // Sugerir precio con 30% de margen
      const suggestedPrice = Math.round(purchasePrice * 1.3);
      handleFieldChange('sale_price', suggestedPrice.toString());
  };

  const handleEdit = (product: ProductWithCategory) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      sale_price: product.sale_price.toString(),
      purchase_price: product.purchase_price.toString(),
      stock: product.stock.toString(),
      barcode: product.barcode,
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      has_imei_serial: product.has_imei_serial,
      imei_serial_type: product.imei_serial_type,
      requires_imei_serial: product.requires_imei_serial,
    });
    setShowForm(true);
    setShowAdvancedOptions(product.has_imei_serial || product.barcode !== '' || product.description !== '');
  };

  const handleDelete = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    showConfirmation(
      'Eliminar Producto',
      `¿Estás seguro de que quieres eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

          if (error) throw error;
          loadProducts();
          showSuccess(
            '¡Producto Eliminado!',
            `El producto "${product.name}" ha sido eliminado exitosamente`
          );
        } catch (error) {
          console.error('Error deleting product:', error);
          showError(
            'Error al Eliminar Producto',
            'No se pudo eliminar el producto. ' + (error as Error).message
          );
        }
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      }
    );
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode.includes(searchTerm);
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleImeiSerialManagement = (product: ProductWithCategory) => {
    setSelectedProductForImei(product);
    setShowImeiSerialManager(true);
  };

  const downloadTemplate = () => {
    const template = [
      {
        name: 'Producto Ejemplo',
        description: 'Descripción del producto',
        sale_price: 100000,
        purchase_price: 80000,
        stock: 10,
        barcode: '1234567890123',
        category_id: '', // UUID de categoría (opcional)
        supplier_id: '', // UUID de proveedor (opcional)
        has_imei_serial: false,
        imei_serial_type: 'serial', // 'imei', 'serial', o 'both'
        requires_imei_serial: false,
        import_notes: 'Notas de importación'
      }
    ];
    
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_productos.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Productos</h2>
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar Masivo
          </button>
          <button
            onClick={downloadTemplate}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Plantilla
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
      </div>

      {/* Product Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-lg border-2 border-blue-200 p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                <Package className="h-6 w-6 mr-3 text-blue-600" />
                {editingProduct ? 'Editar Producto' : 'Agregar Nuevo Producto'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {editingProduct ? 'Modifica la información del producto' : 'Completa la información del nuevo producto'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelForm}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Información Básica */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-medium text-slate-900 mb-4 flex items-center">
                <Package className="h-4 w-4 mr-2" />
                Información Básica
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    onBlur={(e) => checkDuplicates('name', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                      formErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-300'
                    }`}
                    placeholder="Ej: iPhone 15 Pro Max 256GB"
                  />
                  {formErrors.name && (
                    <div className="flex items-center mt-1 text-red-600 text-sm">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {formErrors.name}
                    </div>
                  )}
                  {duplicateCheck.name && (
                    <div className="flex items-center mt-1 text-yellow-600 text-sm">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Ya existe un producto con este nombre
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => handleFieldChange('category_id', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Precios y Stock */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-medium text-slate-900 mb-4 flex items-center">
                <DollarSign className="h-4 w-4 mr-2" />
                Precios y Stock
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Precio de Compra
                  </label>
                  <div className="relative">
                    <FormattedNumberInput
                      value={formData.purchase_price}
                      onChange={(value) => handleFieldChange('purchase_price', value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.purchase_price ? 'border-red-300 bg-red-50' : 'border-slate-300'
                      }`}
                      placeholder="0"
                      min="0"
                    />
                    {formErrors.purchase_price && (
                      <div className="flex items-center mt-1 text-red-600 text-sm">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {formErrors.purchase_price}
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Precio de Venta *
                  </label>
                  <div className="relative">
                    <FormattedNumberInput
                      value={formData.sale_price}
                      onChange={(value) => handleFieldChange('sale_price', value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.sale_price ? 'border-red-300 bg-red-50' : 'border-slate-300'
                      }`}
                      required
                      min="0"
                      placeholder="0"
                    />
                    {formData.purchase_price && (
                      <button
                        type="button"
                        onClick={suggestPrice}
                        className="absolute right-2 top-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors duration-200"
                      >
                        +30%
                      </button>
                    )}
                    {formErrors.sale_price && (
                      <div className="flex items-center mt-1 text-red-600 text-sm">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {formErrors.sale_price}
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Stock Inicial *
                  </label>
                  <FormattedNumberInput
                    value={formData.stock}
                    onChange={(value) => handleFieldChange('stock', value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.stock ? 'border-red-300 bg-red-50' : 'border-slate-300'
                    }`}
                    required
                    min="0"
                    placeholder="0"
                  />
                  {formErrors.stock && (
                    <div className="flex items-center mt-1 text-red-600 text-sm">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {formErrors.stock}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Análisis de Ganancia */}
              {(() => {
                const profitInfo = calculateProfitInfo();
                if (profitInfo) {
                  return (
                    <div className={`mt-4 p-4 rounded-lg border ${
                      profitInfo.isValid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}>
                      <h5 className={`font-medium mb-2 flex items-center ${
                        profitInfo.isValid ? 'text-green-900' : 'text-red-900'
                      }`}>
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Análisis de Rentabilidad
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className={profitInfo.isValid ? 'text-green-700' : 'text-red-700'}>
                            Ganancia por unidad:
                          </span>
                          <p className={`font-bold ${profitInfo.isValid ? 'text-green-900' : 'text-red-900'}`}>
                            {formatCurrency(profitInfo.profit)}
                          </p>
                        </div>
                        <div>
                          <span className={profitInfo.isValid ? 'text-green-700' : 'text-red-700'}>
                            Margen de ganancia:
                          </span>
                          <p className={`font-bold ${profitInfo.isValid ? 'text-green-900' : 'text-red-900'}`}>
                            {profitInfo.margin.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <span className={profitInfo.isValid ? 'text-green-700' : 'text-red-700'}>
                            Ganancia total (stock):
                          </span>
                          <p className={`font-bold ${profitInfo.isValid ? 'text-green-900' : 'text-red-900'}`}>
                            {formatCurrency(profitInfo.totalProfit)}
                          </p>
                        </div>
                      </div>
                      {!profitInfo.isValid && (
                        <div className="mt-2 text-red-700 text-sm">
                          ⚠️ El precio de venta es menor al precio de compra. Esto resultará en pérdidas.
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Opciones Avanzadas */}
            <div className="border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors duration-200"
              >
                <span className="font-medium text-slate-900">Opciones Avanzadas</span>
                <svg 
                  className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${
                    showAdvancedOptions ? 'rotate-180' : ''
                  }`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showAdvancedOptions && (
                <div className="p-4 border-t border-slate-200 space-y-4">
                  {/* Código de Barras */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Código de Barras
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.barcode}
                        onChange={(e) => handleFieldChange('barcode', e.target.value)}
                        onBlur={(e) => checkDuplicates('barcode', e.target.value)}
                        placeholder="Código de barras (opcional)"
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          formErrors.barcode ? 'border-red-300 bg-red-50' : 'border-slate-300'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={generateSmartBarcode}
                        className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm flex items-center"
                      >
                        <Barcode className="h-4 w-4 mr-1" />
                        Generar
                      </button>
                    </div>
                    {formErrors.barcode && (
                      <div className="flex items-center mt-1 text-red-600 text-sm">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {formErrors.barcode}
                      </div>
                    )}
                    {duplicateCheck.barcode && (
                      <div className="flex items-center mt-1 text-yellow-600 text-sm">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Ya existe un producto con este código de barras
                      </div>
                    )}
                  </div>
                  
                  {/* Proveedor */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Proveedor
                    </label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => handleFieldChange('supplier_id', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seleccionar proveedor</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Descripción */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Descripción
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleFieldChange('description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Descripción detallada del producto (opcional)"
                    />
                  </div>
                  
                  {/* IMEI/Serial Configuration */}
                  <div className="border border-slate-300 rounded-lg p-4 bg-white">
                    <h5 className="font-medium text-slate-900 mb-3 flex items-center">
                      <Smartphone className="h-4 w-4 mr-2" />
                      Configuración IMEI/Serial
                    </h5>
                    
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="has_imei_serial"
                          checked={formData.has_imei_serial}
                          onChange={(e) => handleFieldChange('has_imei_serial', e.target.checked.toString())}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                        />
                        <label htmlFor="has_imei_serial" className="ml-2 text-sm text-slate-700">
                          Este producto requiere seguimiento individual (IMEI/Serial)
                        </label>
                      </div>
                      
                      {formData.has_imei_serial && (
                        <div className="ml-6 space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Tipo de Identificador
                            </label>
                            <select
                              value={formData.imei_serial_type}
                              onChange={(e) => handleFieldChange('imei_serial_type', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="serial">Solo Número de Serie</option>
                              <option value="imei">Solo IMEI (para celulares)</option>
                              <option value="both">IMEI y Número de Serie</option>
                            </select>
                          </div>
                          
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="requires_imei_serial"
                              checked={formData.requires_imei_serial}
                              onChange={(e) => handleFieldChange('requires_imei_serial', e.target.checked.toString())}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                            />
                            <label htmlFor="requires_imei_serial" className="ml-2 text-sm text-slate-700">
                              IMEI/Serial es obligatorio para la venta
                            </label>
                          </div>
                          
                          <div className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                            💡 <strong>Tip:</strong> Activa esta opción para productos como celulares, tablets o equipos electrónicos que requieren seguimiento individual.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Botones de Acción */}
            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="submit"
                disabled={isSubmitting || Object.keys(formErrors).some(key => formErrors[key] !== '')}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center font-medium"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {editingProduct ? 'Actualizando...' : 'Guardando...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editingProduct ? 'Actualizar Producto' : 'Guardar Producto'}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelForm}
                disabled={isSubmitting}
                className="bg-slate-200 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-300 disabled:opacity-50 transition-colors duration-200 font-medium"
              >
                Cancelar
              </button>
            </div>
            
            {/* Indicadores de Validación */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  {formData.name && !formErrors.name ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  ) : (
                    <div className="h-4 w-4 border-2 border-slate-300 rounded-full mr-1"></div>
                  )}
                  <span className={formData.name && !formErrors.name ? 'text-green-600' : 'text-slate-500'}>
                    Nombre válido
                  </span>
                </div>
                <div className="flex items-center">
                  {formData.sale_price && !formErrors.sale_price ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  ) : (
                    <div className="h-4 w-4 border-2 border-slate-300 rounded-full mr-1"></div>
                  )}
                  <span className={formData.sale_price && !formErrors.sale_price ? 'text-green-600' : 'text-slate-500'}>
                    Precio válido
                  </span>
                </div>
                <div className="flex items-center">
                  {formData.stock && !formErrors.stock ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  ) : (
                    <div className="h-4 w-4 border-2 border-slate-300 rounded-full mr-1"></div>
                  )}
                  <span className={formData.stock && !formErrors.stock ? 'text-green-600' : 'text-slate-500'}>
                    Stock válido
                  </span>
                </div>
              </div>
              
              {Object.keys(formErrors).some(key => formErrors[key] !== '') && (
                <div className="text-red-600 text-sm">
                  {Object.keys(formErrors).filter(key => formErrors[key] !== '').length} error(es) por corregir
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Products Grid - Mejorado */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            </div>
          ))
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {products.length === 0 
                ? 'No hay productos registrados. ¡Agrega tu primer producto!' 
                : 'No hay productos que coincidan con tu búsqueda'}
            </p>
            {products.length === 0 && (
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditingProduct(null);
                  resetForm();
                }}
                className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center mx-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Primer Producto
              </button>
            )}
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200 border border-slate-200 hover:border-blue-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 line-clamp-2">{product.name}</h3>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{product.description}</p>
                  
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {product.barcode && (
                      <span className="inline-block bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full font-mono">
                        {product.barcode}
                      </span>
                    )}
                    {product.category && (
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {product.category.name}
                      </span>
                    )}
                    {product.has_imei_serial && (
                      <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                        <Smartphone className="h-3 w-3 inline mr-1" />
                        {product.imei_serial_type === 'imei' ? 'IMEI' : 
                         product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI+Serial'}
                      </span>
                    )}
                    {product.bulk_import_batch && (
                      <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                        <Upload className="h-3 w-3 inline mr-1" />
                        Lote: {product.bulk_import_batch.slice(-8)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-1 ml-2">
                  {product.has_imei_serial && (
                    <button
                      onClick={() => handleImeiSerialManagement(product)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                      title="Gestionar IMEI/Serial"
                    >
                      <Hash className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(product)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
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
              
              {/* Información de Precios Mejorada */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Precio de compra:</span>
                    <p className="font-semibold text-slate-900">{formatCurrency(product.purchase_price)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Precio de venta:</span>
                    <p className="font-semibold text-green-600">{formatCurrency(product.sale_price)}</p>
                  </div>
                </div>
                
                {product.purchase_price > 0 && (
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <TrendingUp className="h-4 w-4 mr-1 text-green-600" />
                        <span className="text-green-700">Ganancia:</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-900">
                          {formatCurrency(calculateProfit(product.sale_price, product.purchase_price))}
                        </p>
                        <p className="text-xs text-green-700">
                          {calculateProfitMargin(product.sale_price, product.purchase_price).toFixed(1)}% margen
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-4">
                <div className={`text-sm px-3 py-1 rounded-full font-medium ${
                  product.stock > 10 
                    ? 'bg-green-100 text-green-800' 
                    : product.stock > 0 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : 'bg-red-100 text-red-800'
                }`}>
                  Stock: {product.stock}
                  {product.stock === 0 && ' ⚠️'}
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Valor total:</p>
                  <p className="font-bold text-slate-900 text-sm">
                    {formatCurrency(product.sale_price * product.stock)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resumen de Productos */}
      {!loading && filteredProducts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Resumen de Inventario</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-600">Total Productos</p>
              <p className="text-2xl font-bold text-blue-900">{filteredProducts.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-600">Valor Total Inventario</p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(filteredProducts.reduce((sum, p) => sum + (p.sale_price * p.stock), 0))}
              </p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-sm font-medium text-yellow-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-yellow-900">
                {filteredProducts.filter(p => p.stock <= 10 && p.stock > 0).length}
              </p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-sm font-medium text-red-600">Sin Stock</p>
              <p className="text-2xl font-bold text-red-900">
                {filteredProducts.filter(p => p.stock === 0).length}
              </p>
            </div>
          </div>
        </div>
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

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkProductImport
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => {
            setShowBulkImport(false);
            loadProducts();
            showSuccess(
              '¡Importación Completada!',
              'Los productos han sido importados exitosamente'
            );
          }}
          categories={categories}
          suppliers={suppliers}
        />
      )}

      {/* IMEI/Serial Manager Modal */}
      {showImeiSerialManager && selectedProductForImei && (
        <ImeiSerialManager
          isOpen={showImeiSerialManager}
          onClose={() => {
            setShowImeiSerialManager(false);
            setSelectedProductForImei(null);
          }}
          product={selectedProductForImei}
          onUpdate={() => {
            loadProducts();
            showSuccess(
              '¡IMEI/Serial Actualizado!',
              'Los números IMEI/Serial han sido actualizados exitosamente'
            );
          }}
        />
      )}
    </div>
  );
}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre
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
                  Código de Barras
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Código de barras"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={generateBarcode}
                    className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm"
                  >
                    Auto
                  </button>
                </div>
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
                  Precio de Venta
                </label>
                <FormattedNumberInput
                  value={formData.sale_price}
                  onChange={(value) => setFormData({ ...formData, sale_price: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Stock
                </label>
                <FormattedNumberInput
                  value={formData.stock}
                  onChange={(value) => setFormData({ ...formData, stock: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="0"
                />
              </div>
              
              {/* IMEI/Serial Configuration */}
              <div className="md:col-span-2">
                <div className="border border-slate-300 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-3 flex items-center">
                    <Smartphone className="h-4 w-4 mr-2" />
                    Configuración IMEI/Serial
                  </h4>
                  
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
                        Este producto requiere seguimiento de IMEI/Serial
                      </label>
                    </div>
                    
                    {formData.has_imei_serial && (
                      <>
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
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                          />
                          <label htmlFor="requires_imei_serial" className="ml-2 text-sm text-slate-700">
                            IMEI/Serial es obligatorio para la venta
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Profit Calculator */}
            {formData.sale_price && formData.purchase_price && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900 mb-2 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Análisis de Ganancia
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-green-700">Ganancia por unidad:</span>
                    <p className="font-bold text-green-900">
                      {formatCurrency(calculateProfit(parseFloat(formData.sale_price) || 0, parseFloat(formData.purchase_price) || 0))}
                    </p>
                  </div>
                  <div>
                    <span className="text-green-700">Margen de ganancia:</span>
                    <p className="font-bold text-green-900">
                      {calculateProfitMargin(parseFloat(formData.sale_price) || 0, parseFloat(formData.purchase_price) || 0).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <span className="text-green-700">Ganancia total (stock):</span>
                    <p className="font-bold text-green-900">
                      {formatCurrency(calculateProfit(parseFloat(formData.sale_price) || 0, parseFloat(formData.purchase_price) || 0) * (parseInt(formData.stock) || 0))}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
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

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            </div>
          ))
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">No hay productos que coincidan con tu búsqueda</p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{product.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{product.description}</p>
                  {product.barcode && (
                    <p className="text-xs text-slate-500 mt-1 font-mono">Código: {product.barcode}</p>
                  )}
                  {product.category && (
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-2">
                      {product.category.name}
                    </span>
                  )}
                  {product.has_imei_serial && (
                    <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full mt-2 ml-2">
                      <Smartphone className="h-3 w-3 inline mr-1" />
                      {product.imei_serial_type === 'imei' ? 'IMEI' : 
                       product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI+Serial'}
                    </span>
                  )}
                  {product.bulk_import_batch && (
                    <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mt-2 ml-2">
                      <Upload className="h-3 w-3 inline mr-1" />
                      Lote: {product.bulk_import_batch.slice(-8)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {product.has_imei_serial && (
                    <button
                      onClick={() => handleImeiSerialManagement(product)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                      title="Gestionar IMEI/Serial"
                    >
                      <Hash className="h-4 w-4" />
                    </button>
                  )}
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
              
              {/* Pricing Information */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Precio de compra:</span>
                    <p className="font-semibold text-slate-900">{formatCurrency(product.purchase_price)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Precio de venta:</span>
                    <p className="font-semibold text-green-600">{formatCurrency(product.sale_price)}</p>
                  </div>
                </div>
                
                {product.purchase_price > 0 && (
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <TrendingUp className="h-4 w-4 mr-1 text-green-600" />
                        <span className="text-green-700">Ganancia:</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-900">
                          {formatCurrency(calculateProfit(product.sale_price, product.purchase_price))}
                        </p>
                        <p className="text-xs text-green-700">
                          {calculateProfitMargin(product.sale_price, product.purchase_price).toFixed(1)}% margen
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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
                <div className="text-right">
                  <p className="text-xs text-slate-500">Valor total stock:</p>
                  <p className="font-bold text-slate-900">
                    {formatCurrency(product.sale_price * product.stock)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

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

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkProductImport
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => {
            setShowBulkImport(false);
            loadProducts();
            showSuccess(
              '¡Importación Completada!',
              'Los productos han sido importados exitosamente'
            );
          }}
          categories={categories}
          suppliers={suppliers}
        />
      )}

      {/* IMEI/Serial Manager Modal */}
      {showImeiSerialManager && selectedProductForImei && (
        <ImeiSerialManager
          isOpen={showImeiSerialManager}
          onClose={() => {
            setShowImeiSerialManager(false);
            setSelectedProductForImei(null);
          }}
          product={selectedProductForImei}
          onUpdate={() => {
            loadProducts();
            showSuccess(
              '¡IMEI/Serial Actualizado!',
              'Los números IMEI/Serial han sido actualizados exitosamente'
            );
          }}
        />
      )}
    </div>
  );
}