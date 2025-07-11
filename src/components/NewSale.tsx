import React, { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, X, Search, Package, User, UserPlus, Scan } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, CartItem, Customer } from '../lib/types';

export default function NewSale() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'installment'>('cash');
  const [discountAmount, setDiscountAmount] = useState('');
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    cedula: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProducts(),
        loadCustomers()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .gt('stock', 0)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      setCustomers([]);
    }
  };

  const handleBarcodeSearch = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && barcodeSearch.trim()) {
      const product = products.find(p => 
        p.barcode && p.barcode.toLowerCase() === barcodeSearch.trim().toLowerCase()
      );
      if (product) {
        addToCart(product);
        setBarcodeSearch('');
      } else {
        alert('Producto no encontrado con ese código de barras');
      }
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        setCart(cart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        alert('No hay suficiente stock disponible');
      }
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.stock) {
      alert('No hay suficiente stock disponible');
      return;
    }

    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = parseFloat(discountAmount) || 0;
    return Math.max(0, subtotal - discount);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([customerFormData])
        .select()
        .single();

      if (error) throw error;

      setCustomers([...customers, data]);
      setSelectedCustomer(data);
      setShowCustomerForm(false);
      setCustomerFormData({ name: '', email: '', phone: '', address: '', cedula: '' });
      alert('Cliente creado exitosamente');
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Error al crear cliente: ' + (error as Error).message);
    }
  };

  const handleSale = async () => {
    if (cart.length === 0) {
      alert('Agrega productos al carrito');
      return;
    }

    if (paymentType === 'installment' && !selectedCustomer) {
      alert('Selecciona un cliente para ventas por abonos');
      return;
    }

    const subtotal = calculateSubtotal();
    const discount = parseFloat(discountAmount) || 0;
    const total = calculateTotal();

    if (discount > subtotal) {
      alert('El descuento no puede ser mayor al subtotal');
      return;
    }

    if (total <= 0) {
      alert('El total de la venta debe ser mayor a 0');
      return;
    }

    try {
      setSaving(true);

      // Create sale
      const saleData = {
        subtotal: subtotal,
        discount_amount: discount,
        total_amount: total,
        customer_id: selectedCustomer?.id || null,
        payment_type: paymentType,
        total_paid: paymentType === 'cash' ? total : 0,
        payment_status: paymentType === 'cash' ? 'paid' : 'pending'
      };

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([saleData])
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Update product stock
      for (const item of cart) {
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: item.product.stock - item.quantity })
          .eq('id', item.product.id);

        if (stockError) throw stockError;
      }

      // Record payment for cash sales
      if (paymentType === 'cash') {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert([{
            sale_id: sale.id,
            amount: total,
            payment_method: 'cash',
            notes: 'Pago completo en efectivo'
          }]);

        if (paymentError) console.error('Error recording payment:', paymentError);
      }

      // Reset form
      setCart([]);
      setSelectedCustomer(null);
      setDiscountAmount('');
      setPaymentType('cash');
      setSearchTerm('');
      setBarcodeSearch('');
      
      // Reload products to update stock
      await loadProducts();

      alert(`Venta ${paymentType === 'cash' ? 'completada' : 'registrada'} exitosamente`);
    } catch (error) {
      console.error('Error processing sale:', error);
      alert('Error al procesar la venta: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (customer.cedula && customer.cedula.includes(customerSearch)) ||
    (customer.email && customer.email.toLowerCase().includes(customerSearch.toLowerCase())) ||
    (customer.phone && customer.phone.includes(customerSearch))
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-3 bg-slate-200 rounded"></div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-3 bg-slate-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Nueva Venta</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Tipo de pago:</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as 'cash' | 'installment')}
              className="px-3 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="cash">Efectivo</option>
              <option value="installment">Abono</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Productos</h3>
          
          {/* Barcode Scanner */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Código de Barras
            </label>
            <div className="relative">
              <Scan className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Escanea o escribe el código y presiona Enter"
                value={barcodeSearch}
                onChange={(e) => setBarcodeSearch(e.target.value)}
                onKeyDown={handleBarcodeSearch}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Product Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar productos por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Products List */}
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">
                  {products.length === 0 ? 'No hay productos con stock disponible' : 'No se encontraron productos'}
                </p>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors duration-200"
                  onClick={() => addToCart(product)}
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900">{product.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="font-semibold text-green-600">${product.price.toFixed(2)}</span>
                      <span>•</span>
                      <span className={`${product.stock <= 5 ? 'text-orange-600 font-medium' : ''}`}>
                        Stock: {product.stock}
                      </span>
                      {product.barcode && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                            {product.barcode}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2" />
            Carrito ({cart.length} productos)
          </h3>

          {/* Customer Selection for Installments */}
          {paymentType === 'installment' && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Cliente (requerido para abonos)</h4>
              {selectedCustomer ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-blue-900">{selectedCustomer.name}</p>
                    {selectedCustomer.phone && (
                      <p className="text-sm text-blue-700">{selectedCustomer.phone}</p>
                    )}
                    {selectedCustomer.cedula && (
                      <p className="text-sm text-blue-700">CC: {selectedCustomer.cedula}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCustomerList(true)}
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm flex items-center justify-center"
                    >
                      <User className="h-4 w-4 mr-1" />
                      Seleccionar Cliente
                    </button>
                    <button
                      onClick={() => setShowCustomerForm(true)}
                      className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm flex items-center"
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Nuevo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cart Items */}
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">El carrito está vacío</p>
                <p className="text-sm text-slate-400 mt-1">Agrega productos haciendo clic en ellos</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900">{item.product.name}</h4>
                    <p className="text-sm text-slate-600">${item.product.price.toFixed(2)} c/u</p>
                    {item.product.barcode && (
                      <p className="text-xs text-slate-500 font-mono">{item.product.barcode}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors duration-200"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors duration-200"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded ml-2 transition-colors duration-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="ml-4 font-semibold text-slate-900 min-w-[80px] text-right">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Discount */}
          {cart.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Descuento (en pesos)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={calculateSubtotal()}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Total */}
          {cart.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${calculateSubtotal().toFixed(2)}</span>
                </div>
                {parseFloat(discountAmount) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Descuento:</span>
                    <span>-${parseFloat(discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="text-green-600">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
              
              <button
                onClick={handleSale}
                disabled={saving || cart.length === 0 || (paymentType === 'installment' && !selectedCustomer)}
                className="w-full mt-4 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
              >
                {saving ? 'Procesando...' : 
                 paymentType === 'cash' ? 'Completar Venta en Efectivo' : 'Registrar Venta por Abonos'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Customer List Modal */}
      {showCustomerList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Seleccionar Cliente</h3>
                <button
                  onClick={() => {
                    setShowCustomerList(false);
                    setCustomerSearch('');
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Buscar por nombre, cédula, teléfono..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No se encontraron clientes</p>
                ) : (
                  filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setShowCustomerList(false);
                        setCustomerSearch('');
                      }}
                      className="w-full text-left p-3 hover:bg-slate-50 rounded-lg transition-colors duration-200 border border-slate-200"
                    >
                      <div className="font-medium text-slate-900">{customer.name}</div>
                      <div className="text-sm text-slate-600 space-y-1">
                        {customer.cedula && <div>CC: {customer.cedula}</div>}
                        {customer.phone && <div>Tel: {customer.phone}</div>}
                        {customer.email && <div>Email: {customer.email}</div>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Form Modal */}
      {showCustomerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Nuevo Cliente</h3>
                <button
                  onClick={() => {
                    setShowCustomerForm(false);
                    setCustomerFormData({ name: '', email: '', phone: '', address: '', cedula: '' });
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={customerFormData.name}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cédula
                </label>
                <input
                  type="text"
                  value={customerFormData.cedula}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, cedula: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={customerFormData.phone}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={customerFormData.email}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Dirección
                </label>
                <textarea
                  value={customerFormData.address}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Crear Cliente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomerForm(false);
                    setCustomerFormData({ name: '', email: '', phone: '', address: '', cedula: '' });
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}