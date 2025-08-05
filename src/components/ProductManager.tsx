import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, Barcode, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';

interface Product {
  id: string;
  name: string;
  description: string;
  sale_price: number;
  purchase_price: number;
  stock: number;
  barcode: string;
  category_id: string | null;
  supplier_id: string | null;
  has_imei_serial: boolean;
  imei_serial_type: string;
  requires_imei_serial: boolean;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
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
    imei_serial_type: 'serial',
    requires_imei_serial: false
  });

  const { showNotification } = useNotification();
  const { showConfirmation } = useConfirmation();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [productsResult, categoriesResult, suppliersResult] = await Promise.all([
        supabase.from('products').select('*').order('name'),
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
      showNotification('Error loading data', 'error');
    } finally {
      setLoading(false);
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
    setEditingProduct(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        requires_imei_serial: formData.requires_imei_serial
      };

      let result;
      if (editingProduct) {
        result = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
      } else {
        result = await supabase
          .from('products')
          .insert([productData]);
      }

      if (result.error) throw result.error;

      showNotification(
        editingProduct ? 'Product updated successfully' : 'Product created successfully',
        'success'
      );
      
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving product:', error);
      showNotification('Error saving product', 'error');
    }
  };

  const handleEdit = (product: Product) => {
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
      requires_imei_serial: product.requires_imei_serial
    });
    setShowForm(true);
  };

  const handleDelete = async (product: Product) => {
    const confirmed = await showConfirmation(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      showNotification('Product deleted successfully', 'success');
      loadData();
    } catch (error) {
      console.error('Error deleting product:', error);
      showNotification('Error deleting product', 'error');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode.includes(searchTerm) ||
    product.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'No Category';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown Category';
  };

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return 'No Supplier';
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Unknown Supplier';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6" />
          Product Management
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search products by name, barcode, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{product.name}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(product)}
                  className="text-blue-600 hover:text-blue-800 p-1"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(product)}
                  className="text-red-600 hover:text-red-800 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-gray-600">{product.description || 'No description'}</p>
              
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="font-medium">${product.sale_price.toFixed(2)}</span>
              </div>

              {product.barcode && (
                <div className="flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">{product.barcode}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-500">Stock:</span>
                <span className={`font-medium ${product.stock <= 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {product.stock}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Category:</span>
                <span className="text-gray-700">{getCategoryName(product.category_id)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Supplier:</span>
                <span className="text-gray-700">{getSupplierName(product.supplier_id)}</span>
              </div>

              {product.has_imei_serial && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Package className="w-4 h-4" />
                  <span className="text-xs">Tracks {product.imei_serial_type}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm ? 'No products found matching your search.' : 'No products yet. Add your first product!'}
          </p>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.sale_price}
                    onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purchase Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier
                  </label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* IMEI/Serial Options */}
              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700">IMEI/Serial Tracking</h3>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="has_imei_serial"
                    checked={formData.has_imei_serial}
                    onChange={(e) => setFormData({ ...formData, has_imei_serial: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="has_imei_serial" className="text-sm text-gray-700">
                    This product has IMEI/Serial numbers
                  </label>
                </div>

                {formData.has_imei_serial && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tracking Type
                      </label>
                      <select
                        value={formData.imei_serial_type}
                        onChange={(e) => setFormData({ ...formData, imei_serial_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="serial">Serial Number</option>
                        <option value="imei">IMEI</option>
                        <option value="both">Both IMEI and Serial</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="requires_imei_serial"
                        checked={formData.requires_imei_serial}
                        onChange={(e) => setFormData({ ...formData, requires_imei_serial: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="requires_imei_serial" className="text-sm text-gray-700">
                        Require IMEI/Serial for sales
                      </label>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}