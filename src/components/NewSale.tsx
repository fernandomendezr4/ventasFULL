import React, { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, X, Search, Package, User, UserPlus } from 'lucide-react';
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
    loadProducts();
    loadCustomers();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories (*)
        `)
        .gt('stock', 0)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
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

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([customerFormData])
        .select()
        .single();

      if (error) throw error;

      setSelectedCustomer(data);
      setShowCustomerForm(false);
      setCustomerFormData({ name: '', email: '', phone: '', address: '', cedula: '' });
      loadCustomers();
      alert('Cliente agregado exitosamente');
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Error al crear cliente: ' + (error as Error).message);
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
      }
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && quantity > product.stock) {
      return;
    }

    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, quantity }
        : item
    ));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  const calculateSubtotal = () => {
    return calculateTotal();
  };

  const calculateFinalTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = parseFloat(discountAmount) || 0;
    return Math.max(0, subtotal - discount);
  };

  const handleSale = async () => {
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }

    const subtotal = calculateSubtotal();
    const discount = parseFloat(discountAmount) || 0;
    const finalTotal = calculateFinalTotal();

    if (discount > subtotal) {
      alert('El descuento no puede ser mayor al subtotal');
      return;
    }

    if (paymentType === 'installment' && !selectedCustomer) {
      alert('Debe seleccionar un cliente para ventas por abonos');
      return;
    }

    try {
      setSaving(true);

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{
          subtotal: subtotal,
          discount_amount: discount,
          total_amount: finalTotal,
          customer_id: selectedCustomer?.id || null,
          user_id: null,
          payment_type: paymentType,
          total_paid: paymentType === 'cash' ? finalTotal : 0,
          payment_status: paymentType === 'cash' ? 'paid' : 'pending'
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
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

      // If cash sale, record payment
      if (paymentType === 'cash') {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert([{
            sale_id: sale.id,
            amount: finalTotal,
            payment_method: 'cash',
            notes: 'Pago completo - Venta de contado'
          }]);

        if (paymentError) throw paymentError;
      }

      // Clear cart and refresh products
      setCart([]);
      setSelectedCustomer(null);
      setPaymentType('cash');
      setDiscountAmount('');
      loadProducts();
      
      const message = paymentType === 'installment' 
        ? `Venta por abonos creada exitosamente. Total: $${finalTotal.toFixed(2)} (Subtotal: $${subtotal.toFixed(2)}, Descuento: $${discount.toFixed(2)})`
        : `Venta de contado realizada con éxito. Total: $${finalTotal.toFixed(2)}`;
      
      alert(message);
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Error al realizar la venta: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addToCartByBarcode = async (barcode: string) => {
    if (!barcode.trim()) return;

    try {
      const { data: product, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories (*)
        `)
        .eq('barcode', barcode.trim())
        .gt('stock', 0)
        .single();

      if (error || !product) {
        alert('Producto no encontrado o sin stock');
        return;
      }

      addToCart(product);
    } catch (error) {
      console.error('Error searching product by barcode:', error);
      alert('Error al buscar producto');
    }
  };

  const handleBarcodeSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const barcode = (e.target as HTMLInputElement).value;
      addToCartByBarcode(barcode);
      (e.target as HTMLInputElement).value = '';
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Nueva Venta</h2>
            <p className="text-slate-600">
              {paymentType === 'cash' ? 'Venta de contado' : 'Venta por abonos'}
            </p>
          </div>
          <div className="text-right">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
              </div>
              {parseFloat(discountAmount) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Descuento:</span>
                  <span className="font-medium text-red-600">-${parseFloat(discountAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-1">
                <p className="text-sm text-slate-600">Total a Pagar</p>
                <p className="text-3xl font-bold text-green-600">${calculateFinalTotal().toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedCustomer && (
              <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                <User className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">{selectedCustomer.name}</p>
                  <p className="text-sm text-blue-600">Cliente seleccionado</p>
                </div>
              </div>
            )}
            {cart.length > 0 && (
              <div className="flex items-center gap-3 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                <ShoppingCart className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">{cart.length} productos</p>
                  <p className="text-sm text-green-600">En el carrito</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Payment Type Selection */}
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border">
              <button
                onClick={() => setPaymentType('cash')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  paymentType === 'cash'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Contado
              </button>
              <button
                onClick={() => setPaymentType('installment')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  paymentType === 'installment'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Abonos
              </button>
            </div>
            
            <button
              onClick={handleSale}
              disabled={cart.length === 0 || saving}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center font-medium shadow-sm"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              {saving ? 'Procesando...' : 'Finalizar Venta'}
            </button>
          </div>
        </div>
      </div>

      {/* Discount Section */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 text-orange-600">
            Descuento
          </h3>
          <p className="text-sm text-slate-600 mt-1">Aplicar descuento en dinero a la venta</p>
        </div>
        
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Monto del Descuento
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={calculateSubtotal()}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-600">Descuento máximo</p>
              <p className="text-lg font-bold text-orange-600">${calculateSubtotal().toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Installment Warning */}
      {paymentType === 'installment' && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 text-blue-600">
              Venta por Abonos
            </h3>
            <p className="text-sm text-slate-600 mt-1">El cliente podrá realizar pagos parciales</p>
          </div>
          
          <div className="p-6">
            {!selectedCustomer && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-medium">⚠️ Debe seleccionar un cliente para ventas por abonos</p>
              </div>
            )}
            
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Información de la Venta por Abonos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600 font-medium">Total de la venta:</span>
                  <p className="text-blue-900 font-bold">${calculateFinalTotal().toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Estado inicial:</span>
                  <p className="text-blue-900 font-bold">Pendiente de pago</p>
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                * El cliente podrá realizar abonos parciales hasta completar el total
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Customer Selection - Updated for installments */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <User className="h-5 w-5 mr-2 text-blue-600" />
                Información del Cliente
                {paymentType === 'installment' && (
                  <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                    Requerido para abonos
                  </span>
                )}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {paymentType === 'installment' 
                  ? 'Debe seleccionar un cliente para ventas por abonos'
                  : 'Selecciona o crea un cliente para la venta (opcional)'
                }
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCustomerList(!showCustomerList)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
              >
                <User className="h-4 w-4 mr-2" />
                Seleccionar
              </button>
              <button
                onClick={() => setShowCustomerForm(!showCustomerForm)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Nuevo
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {selectedCustomer ? (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-900">{selectedCustomer.name}</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    {selectedCustomer.cedula && <p>Cédula: {selectedCustomer.cedula}</p>}
                    {selectedCustomer.email && <p>Email: {selectedCustomer.email}</p>}
                    {selectedCustomer.phone && <p>Teléfono: {selectedCustomer.phone}</p>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-blue-600 hover:text-blue-800 transition-colors duration-200 p-2 hover:bg-blue-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-slate-300 rounded-lg">
              <User className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-500 font-medium">Venta sin cliente asignado</p>
              <p className="text-sm text-slate-400 mt-1">Puedes proceder sin seleccionar un cliente</p>
            </div>
          )}

          {/* Customer List */}
          {showCustomerList && (
            <div className="mt-4 border-t pt-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, cédula o email..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowCustomerList(false);
                      setCustomerSearch('');
                    }}
                    className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">{customer.name}</h4>
                        <div className="text-sm text-slate-600">
                          {customer.cedula && <span>CC: {customer.cedula}</span>}
                          {customer.cedula && customer.email && <span> • </span>}
                          {customer.email && <span>{customer.email}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredCustomers.length === 0 && (
                  <p className="text-center text-slate-500 py-4">No se encontraron clientes</p>
                )}
              </div>
            </div>
          )}

          {/* Customer Form */}
          {showCustomerForm && (
            <div className="mt-4 border-t pt-4">
              <form onSubmit={handleCustomerSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Nombre completo *"
                    required
                    value={customerFormData.name}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Cédula"
                    value={customerFormData.cedula}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, cedula: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={customerFormData.email}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="tel"
                    placeholder="Teléfono"
                    value={customerFormData.phone}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Dirección"
                  value={customerFormData.address}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
                  >
                    Crear Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomerForm(false)}
                    className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products - Improved */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                    <Package className="h-5 w-5 mr-2 text-purple-600" />
                    Catálogo de Productos
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">Selecciona productos para agregar al carrito</p>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar productos o código..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Escanear código de barras..."
                      onKeyDown={handleBarcodeSearch}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-green-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <div key={i} className="p-4 border border-slate-200 rounded-lg animate-pulse">
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">No hay productos disponibles</p>
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-blue-300 cursor-pointer transition-all duration-200 group"
                      onClick={() => addToCart(product)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors duration-200">
                            {product.name}
                          </h4>
                          {product.barcode && (
                            <p className="text-xs text-slate-500 font-mono">{product.barcode}</p>
                          )}
                          <p className="text-lg font-bold text-green-600">${product.price.toFixed(2)}</p>
                          <p className={`text-xs ${
                            product.stock > 10 
                              ? 'text-green-600' 
                              : product.stock > 0 
                                ? 'text-yellow-600' 
                                : 'text-red-600'
                          }`}>
                            Stock: {product.stock}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 group-hover:scale-110"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cart - Improved */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border sticky top-6">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2 text-green-600" />
                Carrito de Compras
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {cart.length} {cart.length === 1 ? 'producto' : 'productos'} seleccionados
              </p>
            </div>
            
            <div className="p-6">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Carrito vacío</p>
                  <p className="text-sm text-slate-400 mt-1">Agrega productos para comenzar</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900 text-sm">{item.product.name}</h4>
                        <p className="text-sm text-green-600 font-medium">${item.product.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors duration-200"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium bg-white px-2 py-1 rounded border">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors duration-200"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200 ml-2"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {cart.length > 0 && (
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Subtotal:</span>
                      <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                    </div>
                    {parseFloat(discountAmount) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Descuento:</span>
                        <span className="font-medium text-red-600">-${parseFloat(discountAmount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t">
                      <span>Total:</span>
                      <span className="text-green-600">${calculateFinalTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const filteredProducts = products.filter(product =>
  product.name.toLowerCase().includes(searchTerm.toLowerCase())
);

return (
  <div className="space-y-6">
    {/* Header with Summary */}
    <div className="bg-white rounded-xl shadow-sm p-6 border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Nueva Venta</h2>
          <p className="text-slate-600">
            {paymentType === 'cash' ? 'Venta de contado' : 'Venta por abonos'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-600">Total a Pagar</p>
          <p className="text-3xl font-bold text-green-600">${calculateTotal().toFixed(2)}</p>
          {paymentType === 'installment' && (
            <div className="mt-2 text-sm">
              <p className="text-slate-600">
                Pago inicial: ${parseFloat(installmentData.downPayment || '0').toFixed(2)}
              </p>
              <p className="text-slate-600">
                {installmentData.totalInstallments} cuotas de ${installmentData.installmentAmount}
              </p>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {selectedCustomer && (
            <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
              <User className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">{selectedCustomer.name}</p>
                <p className="text-sm text-blue-600">Cliente seleccionado</p>
              </div>
            </div>
          )}
          {cart.length > 0 && (
            <div className="flex items-center gap-3 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
              <ShoppingCart className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">{cart.length} productos</p>
                <p className="text-sm text-green-600">En el carrito</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Payment Type Selection */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border">
            <button
              onClick={() => setPaymentType('cash')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                paymentType === 'cash'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Contado
            </button>
            <button
              onClick={() => setPaymentType('installment')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                paymentType === 'installment'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Abonos
            </button>
          </div>
          
          <button
            onClick={handleSale}
            disabled={cart.length === 0 || saving}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center font-medium shadow-sm"
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            {saving ? 'Procesando...' : 'Finalizar Venta'}
          </button>
        </div>
      </div>
    </div>

    {/* Installment Configuration */}
    {paymentType === 'installment' && (
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 text-blue-600">
            Configuración de Abonos
          </h3>
          <p className="text-sm text-slate-600 mt-1">Configure los términos del pago por abonos</p>
        </div>
        
        <div className="p-6">
          {!selectedCustomer && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-yellow-800 font-medium">⚠️ Debe seleccionar un cliente para ventas por abonos</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Número de Cuotas
              </label>
              <select
                value={installmentData.totalInstallments}
                onChange={(e) => setInstallmentData(prev => ({
                  ...prev,
                  totalInstallments: parseInt(e.target.value)
                }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={2}>2 cuotas</option>
                <option value={3}>3 cuotas</option>
                <option value={4}>4 cuotas</option>
                <option value={6}>6 cuotas</option>
                <option value={12}>12 cuotas</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pago Inicial (Opcional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={calculateTotal()}
                value={installmentData.downPayment}
                onChange={(e) => setInstallmentData(prev => ({
                  ...prev,
                  downPayment: e.target.value
                }))}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Valor por Cuota
              </label>
              <input
                type="text"
                value={`$${installmentData.installmentAmount}`}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
              />
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Resumen del Plan de Pagos</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-600 font-medium">Total de la venta:</span>
                <p className="text-blue-900 font-bold">${calculateTotal().toFixed(2)}</p>
              </div>
              <div>
                <span className="text-blue-600 font-medium">Pago inicial:</span>
                <p className="text-blue-900 font-bold">${(parseFloat(installmentData.downPayment) || 0).toFixed(2)}</p>
              </div>
              <div>
                <span className="text-blue-600 font-medium">Saldo a financiar:</span>
                <p className="text-blue-900 font-bold">${(calculateTotal() - (parseFloat(installmentData.downPayment) || 0)).toFixed(2)}</p>
              </div>
              <div>
                <span className="text-blue-600 font-medium">Cuotas mensuales:</span>
                <p className="text-blue-900 font-bold">{installmentData.totalInstallments} x ${installmentData.installmentAmount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Customer Selection - Updated for installments */}
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <User className="h-5 w-5 mr-2 text-blue-600" />
              Información del Cliente
              {paymentType === 'installment' && (
                <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                  Requerido para abonos
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              {paymentType === 'installment' 
                ? 'Debe seleccionar un cliente para ventas por abonos'
                : 'Selecciona o crea un cliente para la venta (opcional)'
              }
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCustomerList(!showCustomerList)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
            >
              <User className="h-4 w-4 mr-2" />
              Seleccionar
            </button>
            <button
              onClick={() => setShowCustomerForm(!showCustomerForm)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Nuevo
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        {selectedCustomer ? (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900">{selectedCustomer.name}</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  {selectedCustomer.cedula && <p>Cédula: {selectedCustomer.cedula}</p>}
                  {selectedCustomer.email && <p>Email: {selectedCustomer.email}</p>}
                  {selectedCustomer.phone && <p>Teléfono: {selectedCustomer.phone}</p>}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedCustomer(null)}
              className="text-blue-600 hover:text-blue-800 transition-colors duration-200 p-2 hover:bg-blue-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed border-slate-300 rounded-lg">
            <User className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-500 font-medium">Venta sin cliente asignado</p>
            <p className="text-sm text-slate-400 mt-1">Puedes proceder sin seleccionar un cliente</p>
          </div>
        )}

        {/* Customer List */}
        {showCustomerList && (
          <div className="mt-4 border-t pt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, cédula o email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setShowCustomerList(false);
                    setCustomerSearch('');
                  }}
                  className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900">{customer.name}</h4>
                      <div className="text-sm text-slate-600">
                        {customer.cedula && <span>CC: {customer.cedula}</span>}
                        {customer.cedula && customer.email && <span> • </span>}
                        {customer.email && <span>{customer.email}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredCustomers.length === 0 && (
                <p className="text-center text-slate-500 py-4">No se encontraron clientes</p>
              )}
            </div>
          </div>
        )}

        {/* Customer Form */}
        {showCustomerForm && (
          <div className="mt-4 border-t pt-4">
            <form onSubmit={handleCustomerSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Nombre completo *"
                  required
                  value={customerFormData.name}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Cédula"
                  value={customerFormData.cedula}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, cedula: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={customerFormData.email}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="tel"
                  placeholder="Teléfono"
                  value={customerFormData.phone}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <input
                type="text"
                placeholder="Dirección"
                value={customerFormData.address}
                onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Crear Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomerForm(false)}
                  className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Products - Improved */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <Package className="h-5 w-5 mr-2 text-purple-600" />
                  Catálogo de Productos
                </h3>
                <p className="text-sm text-slate-600 mt-1">Selecciona productos para agregar al carrito</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <div key={i} className="p-4 border border-slate-200 rounded-lg animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                ))
              ) : filteredProducts.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">No hay productos disponibles</p>
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-blue-300 cursor-pointer transition-all duration-200 group"
                    onClick={() => addToCart(product)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors duration-200">
                          {product.name}
                        </h4>
                        <p className="text-lg font-bold text-green-600">${product.price.toFixed(2)}</p>
                        <p className={`text-xs ${
                          product.stock > 10 
                            ? 'text-green-600' 
                            : product.stock > 0 
                              ? 'text-yellow-600' 
                              : 'text-red-600'
                        }`}>
                          Stock: {product.stock}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(product);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 group-hover:scale-110"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cart - Improved */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border sticky top-6">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <ShoppingCart className="h-5 w-5 mr-2 text-green-600" />
              Carrito de Compras
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              {cart.length} {cart.length === 1 ? 'producto' : 'productos'} seleccionados
            </p>
          </div>
          
          <div className="p-6">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Carrito vacío</p>
                <p className="text-sm text-slate-400 mt-1">Agrega productos para comenzar</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900 text-sm">{item.product.name}</h4>
                      <p className="text-sm text-green-600 font-medium">${item.product.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors duration-200"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium bg-white px-2 py-1 rounded border">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors duration-200"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200 ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {cart.length > 0 && (
              <div className="border-t border-slate-200 pt-4 mt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium">${calculateTotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t">
                    <span>Total:</span>
                    <span className="text-green-600">${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);
}

      // If installment sale, create installment record and payment schedule
      if (paymentType === 'installment') {
        const remainingBalance = total - downPayment;
        
        // Create installment sale record
        const { data: installmentSale, error: installmentError } = await supabase
          .from('installment_sales')
          .insert([{
            sale_id: sale.id,
            total_installments: installmentData.totalInstallments,
            installment_amount: parseFloat(installmentData.installmentAmount),
            down_payment: downPayment,
            remaining_balance: remainingBalance,
            status: remainingBalance <= 0 ? 'completed' : 'active'
          }])
          .select()
          .single();

        if (installmentError) throw installmentError;

        // Create payment schedule
        const installmentPayments = [];
        const today = new Date();
        
        for (let i = 1; i <= installmentData.totalInstallments; i++) {
          const dueDate = new Date(today);
          dueDate.setMonth(dueDate.getMonth() + i);
          
          installmentPayments.push({
            installment_sale_id: installmentSale.id,
            installment_number: i,
            amount_paid: 0,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending'
          });
        }

        const { error: paymentsError } = await supabase
          .from('installment_payments')
          .insert(installmentPayments);

        if (paymentsError) throw paymentsError;

        // Record down payment if any
        if (downPayment > 0) {
          const { error: paymentError } = await supabase
            .from('payments')
            .insert([{
              sale_id: sale.id,
              amount: downPayment,
              payment_method: 'cash',
              notes: 'Pago inicial - Venta por abonos'
            }]);

          if (paymentError) throw paymentError;
        }
      } else {
        // Record cash payment
        const { error: paymentError } = await supabase
          .from('payments')
          .insert([{
            sale_id: sale.id,
            amount: total,
            payment_method: 'cash',
            notes: 'Pago completo - Venta de contado'
          }]);

        if (paymentError) throw paymentError;
      }

      // Clear cart and refresh products
      setCart([]);
      setSelectedCustomer(null);
      setPaymentType('cash');
      setInstallmentData({ totalInstallments: 3, downPayment: '', installmentAmount: '' });
      loadProducts();
      
      const message = paymentType === 'installment' 
        ? `Venta por abonos creada exitosamente. Total: $${total.toFixed(2)}, Pago inicial: $${downPayment.toFixed(2)}, Saldo pendiente: $${(total - downPayment).toFixed(2)}`
        : 'Venta de contado realizada con éxito';
      
      alert(message);
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Error al realizar la venta: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.cedula.includes(customerSearch) ||
    customer.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Nueva Venta</h2>
            <p className="text-slate-600">
              {paymentType === 'cash' ? 'Venta de contado' : 'Venta por abonos'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600">Total a Pagar</p>
            <p className="text-3xl font-bold text-green-600">${calculateTotal().toFixed(2)}</p>
            {paymentType === 'installment' && (
              <div className="mt-2 text-sm">
                <p className="text-slate-600">
                  Pago inicial: ${parseFloat(installmentData.downPayment || '0').toFixed(2)}
                </p>
                <p className="text-slate-600">
                  {installmentData.totalInstallments} cuotas de ${installmentData.installmentAmount}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedCustomer && (
              <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                <User className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">{selectedCustomer.name}</p>
                  <p className="text-sm text-blue-600">Cliente seleccionado</p>
                </div>
              </div>
            )}
            {cart.length > 0 && (
              <div className="flex items-center gap-3 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                <ShoppingCart className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">{cart.length} productos</p>
                  <p className="text-sm text-green-600">En el carrito</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Payment Type Selection */}
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border">
              <button
                onClick={() => setPaymentType('cash')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  paymentType === 'cash'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Contado
              </button>
              <button
                onClick={() => setPaymentType('installment')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  paymentType === 'installment'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Abonos
              </button>
            </div>
            
            <button
              onClick={handleSale}
              disabled={cart.length === 0 || saving}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center font-medium shadow-sm"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              {saving ? 'Procesando...' : 'Finalizar Venta'}
            </button>
          </div>
        </div>
      </div>

      {/* Installment Configuration */}
      {paymentType === 'installment' && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 text-blue-600">
              Configuración de Abonos
            </h3>
            <p className="text-sm text-slate-600 mt-1">Configure los términos del pago por abonos</p>
          </div>
          
          <div className="p-6">
            {!selectedCustomer && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 font-medium">⚠️ Debe seleccionar un cliente para ventas por abonos</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Número de Cuotas
                </label>
                <select
                  value={installmentData.totalInstallments}
                  onChange={(e) => setInstallmentData(prev => ({
                    ...prev,
                    totalInstallments: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={2}>2 cuotas</option>
                  <option value={3}>3 cuotas</option>
                  <option value={4}>4 cuotas</option>
                  <option value={6}>6 cuotas</option>
                  <option value={12}>12 cuotas</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Pago Inicial (Opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={calculateTotal()}
                  value={installmentData.downPayment}
                  onChange={(e) => setInstallmentData(prev => ({
                    ...prev,
                    downPayment: e.target.value
                  }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Valor por Cuota
                </label>
                <input
                  type="text"
                  value={`$${installmentData.installmentAmount}`}
                  readOnly
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                />
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Resumen del Plan de Pagos</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-600 font-medium">Total de la venta:</span>
                  <p className="text-blue-900 font-bold">${calculateTotal().toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Pago inicial:</span>
                  <p className="text-blue-900 font-bold">${(parseFloat(installmentData.downPayment) || 0).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Saldo a financiar:</span>
                  <p className="text-blue-900 font-bold">${(calculateTotal() - (parseFloat(installmentData.downPayment) || 0)).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Cuotas mensuales:</span>
                  <p className="text-blue-900 font-bold">{installmentData.totalInstallments} x ${installmentData.installmentAmount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Selection - Updated for installments */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <User className="h-5 w-5 mr-2 text-blue-600" />
                Información del Cliente
                {paymentType === 'installment' && (
                  <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                    Requerido para abonos
                  </span>
                )}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {paymentType === 'installment' 
                  ? 'Debe seleccionar un cliente para ventas por abonos'
                  : 'Selecciona o crea un cliente para la venta (opcional)'
                }
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCustomerList(!showCustomerList)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
              >
                <User className="h-4 w-4 mr-2" />
                Seleccionar
              </button>
              <button
                onClick={() => setShowCustomerForm(!showCustomerForm)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Nuevo
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {selectedCustomer ? (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-blue-900">{selectedCustomer.name}</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    {selectedCustomer.cedula && <p>Cédula: {selectedCustomer.cedula}</p>}
                    {selectedCustomer.email && <p>Email: {selectedCustomer.email}</p>}
                    {selectedCustomer.phone && <p>Teléfono: {selectedCustomer.phone}</p>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-blue-600 hover:text-blue-800 transition-colors duration-200 p-2 hover:bg-blue-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-slate-300 rounded-lg">
              <User className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-500 font-medium">Venta sin cliente asignado</p>
              <p className="text-sm text-slate-400 mt-1">Puedes proceder sin seleccionar un cliente</p>
            </div>
          )}

          {/* Customer List */}
          {showCustomerList && (
            <div className="mt-4 border-t pt-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, cédula o email..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowCustomerList(false);
                      setCustomerSearch('');
                    }}
                    className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">{customer.name}</h4>
                        <div className="text-sm text-slate-600">
                          {customer.cedula && <span>CC: {customer.cedula}</span>}
                          {customer.cedula && customer.email && <span> • </span>}
                          {customer.email && <span>{customer.email}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredCustomers.length === 0 && (
                  <p className="text-center text-slate-500 py-4">No se encontraron clientes</p>
                )}
              </div>
            </div>
          )}

          {/* Customer Form */}
          {showCustomerForm && (
            <div className="mt-4 border-t pt-4">
              <form onSubmit={handleCustomerSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Nombre completo *"
                    required
                    value={customerFormData.name}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Cédula"
                    value={customerFormData.cedula}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, cedula: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={customerFormData.email}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="tel"
                    placeholder="Teléfono"
                    value={customerFormData.phone}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Dirección"
                  value={customerFormData.address}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
                  >
                    Crear Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomerForm(false)}
                    className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products - Improved */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                    <Package className="h-5 w-5 mr-2 text-purple-600" />
                    Catálogo de Productos
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">Selecciona productos para agregar al carrito</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                  />
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <div key={i} className="p-4 border border-slate-200 rounded-lg animate-pulse">
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">No hay productos disponibles</p>
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-blue-300 cursor-pointer transition-all duration-200 group"
                      onClick={() => addToCart(product)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors duration-200">
                            {product.name}
                          </h4>
                          <p className="text-lg font-bold text-green-600">${product.price.toFixed(2)}</p>
                          <p className={`text-xs ${
                            product.stock > 10 
                              ? 'text-green-600' 
                              : product.stock > 0 
                                ? 'text-yellow-600' 
                                : 'text-red-600'
                          }`}>
                            Stock: {product.stock}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 group-hover:scale-110"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cart - Improved */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border sticky top-6">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2 text-green-600" />
                Carrito de Compras
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {cart.length} {cart.length === 1 ? 'producto' : 'productos'} seleccionados
              </p>
            </div>
            
            <div className="p-6">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Carrito vacío</p>
                  <p className="text-sm text-slate-400 mt-1">Agrega productos para comenzar</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900 text-sm">{item.product.name}</h4>
                        <p className="text-sm text-green-600 font-medium">${item.product.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors duration-200"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium bg-white px-2 py-1 rounded border">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors duration-200"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200 ml-2"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {cart.length > 0 && (
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Subtotal:</span>
                      <span className="font-medium">${calculateTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t">
                      <span>Total:</span>
                      <span className="text-green-600">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}