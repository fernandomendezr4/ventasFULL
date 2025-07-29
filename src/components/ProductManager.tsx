import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, Search, Filter, TrendingUp, DollarSign, Upload, Download, FileText, Smartphone, Hash } from 'lucide-react';
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
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories (*),
          supplier:suppliers (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data as ProductWithCategory[]);
    } catch (error) {
      console.error('Error loading products:', error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      showError(
        'Error al Guardar Producto',
        'No se pudo guardar el producto. ' + (error as Error).message
      );
    }
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

  const generateBarcode = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const barcode = `${timestamp.slice(-8)}${random}`;
    setFormData({ ...formData, barcode });
  };

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
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {editingProduct ? 'Editar Producto' : 'Agregar Producto'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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