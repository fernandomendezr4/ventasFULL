import React, { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, User, Search, Trash2, Calculator, CreditCard, Banknote, Building2, Smartphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, Customer, CartItem } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import PrintService from './PrintService';

export default function NewSale() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'installment'>('cash');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [discount, setDiscount] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [currentCashRegister, setCurrentCashRegister] = useState<any>(null);
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    cedula: ''
  });

  // Load payment methods from localStorage
  const getPaymentMethods = () => {
    try {
      const savedMethods = localStorage.getItem('payment_methods');
      if (savedMethods) {
        return JSON.parse(savedMethods);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
    return [
      { id: 'cash', name: 'Efectivo', icon: 'Banknote' },
      { id: 'card', name: 'Tarjeta', icon: 'CreditCard' },
      { id: 'transfer', name: 'Transferencia Bancaria', icon: 'Building2' },
      { id: 'nequi', name: 'NEQUI', icon: 'Smartphone' }
    ];
  };

  const paymentMethods = getPaymentMethods();

  useEffect(() => {
    loadProducts();
    loadCustomers();
    checkCashRegister();
  }, []);

  const checkCashRegister = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();

      if (error) {
        console.error('Error checking cash register:', error);
        return;
      }

      setCurrentCashRegister(data);
    } catch (error) {
      console.error('Error checking cash register:', error);
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
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        alert('No hay suficiente stock disponible');
        return;
      }
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && quantity > product.stock) {
      alert('No hay suficiente stock disponible');
      return;
    }

    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, quantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.sale_price * item.quantity), 0);
  };

  const getDiscountAmount = () => {
    return parseFloat(discount) || 0;
  };

  const getTotal = () => {
    return Math.max(0, getSubtotal() - getDiscountAmount());
  };

  const getChange = () => {
    if (paymentType !== 'cash') return 0;
    const received = parseFloat(amountReceived) || 0;
    return Math.max(0, received - getTotal());
  };

  const createCustomer = async () => {
    if (!customerFormData.name.trim()) {
      alert('El nombre del cliente es requerido');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([customerFormData])
        .select()
        .single();

      if (error) throw error;

      setSelectedCustomer(data);
      setCustomers([...customers, data]);
      setShowCustomerForm(false);
      setCustomerFormData({ name: '', email: '', phone: '', address: '', cedula: '' });
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Error al crear cliente: ' + (error as Error).message);
    }
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      alert('Agregue productos al carrito');
      return;
    }

    if (paymentType === 'cash') {
      const received = parseFloat(amountReceived) || 0;
      if (received < getTotal()) {
        alert('El monto recibido debe ser mayor o igual al total');
        return;
      }
    }

    try {
      setLoading(true);

      // Crear la venta
      const saleData = {
        total_amount: getTotal(),
        subtotal: getSubtotal(),
        discount_amount: getDiscountAmount(),
        customer_id: selectedCustomer?.id || null,
        user_id: user?.id || null,
        payment_type: paymentType,
        total_paid: paymentType === 'cash' ? getTotal() : 0,
        payment_status: paymentType === 'cash' ? 'paid' : 'pending'
      };

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([saleData])
        .select()
        .single();

      if (saleError) throw saleError;

      // Crear los items de la venta
      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.sale_price,
        total_price: item.product.sale_price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Actualizar stock de productos
      for (const item of cart) {
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: item.product.stock - item.quantity })
          .eq('id', item.product.id);

        if (stockError) {
          console.error('Error updating stock:', stockError);
        }
      }

      // Registrar pago en efectivo si aplica
      if (paymentType === 'cash' && currentCashRegister) {
        const { error: cashRegisterError } = await supabase
          .from('cash_register_sales')
          .insert([{
            cash_register_id: currentCashRegister.id,
            sale_id: sale.id,
            payment_method: paymentMethod,
            amount_received: parseFloat(amountReceived) || getTotal(),
            change_given: getChange()
          }]);

        if (cashRegisterError) {
          console.error('Error registering cash sale:', cashRegisterError);
        }
      }

      // Preparar datos para el comprobante
      const saleWithDetails = {
        ...sale,
        sale_items: saleItems.map(item => ({
          ...item,
          product: cart.find(cartItem => cartItem.product.id === item.product_id)?.product
        })),
        customer: selectedCustomer,
        user: user
      };

      setCompletedSale(saleWithDetails);

      // Limpiar formulario
      setCart([]);
      setSelectedCustomer(null);
      setAmountReceived('');
      setDiscount('');
      setPaymentType('cash');
      setPaymentMethod('cash');

      // Recargar productos para actualizar stock
      loadProducts();

    } catch (error) {
      console.error('Error completing sale:', error);
      alert('Error al completar la venta: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode.includes(searchTerm)
  );

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone.includes(customerSearchTerm) ||
    customer.email.toLowerCase().includes(customerSearchTerm.toLowerCase())
  );

  const getPaymentMethodIcon = (methodId: string) => {
    const method = paymentMethods.find(m => m.id === methodId);
    if (!method) return <CreditCard className="h-4 w-4" />;
    
    switch (method.icon) {
      case 'Banknote':
        return <Banknote className="h-4 w-4" />;
      case 'CreditCard':
        return <CreditCard className="h-4 w-4" />;
      case 'Building2':
        return <Building2 className="h-4 w-4" />;
      case 'Smartphone':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  if (completedSale) {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-900 mb-2">¡Venta Completada!</h2>
          <p className="text-green-700 mb-4">
            Venta #{completedSale.id.slice(-8)} por {formatCurrency(completedSale.total_amount)}
          </p>
          
          <div className="flex justify-center gap-4">
            <PrintService
              sale={completedSale}
              settings={(() => {
                const savedSettings = localStorage.getItem('app_settings');
                const printSettings = localStorage.getItem('print_settings');
                if (savedSettings || printSettings) {
                  const appSettings = savedSettings ? JSON.parse(savedSettings) : {};
                  const printConfig = printSettings ? JSON.parse(printSettings) : {};
                  return {
                    print_enabled: true,
                    auto_print: false,
                    print_copies: 1,
                    receipt_width: '80mm',
                    show_logo: true,
                    show_company_info: true,
                    show_customer_info: true,
                    show_payment_details: true,
                    show_footer_message: true,
                    footer_message: '¡Gracias por su compra!',
                    company_name: 'VentasFULL',
                    ...appSettings,
                    ...printConfig
                  };
                }
                return {
                  print_enabled: true,
                  auto_print: false,
                  print_copies: 1,
                  receipt_width: '80mm',
                  show_logo: true,
                  show_company_info: true,
                  show_customer_info: true,
                  show_payment_details: true,
                  show_footer_message: true,
                  footer_message: '¡Gracias por su compra!',
                  company_name: 'VentasFULL'
                };
              })()}
            />
            <button
              onClick={() => setCompletedSale(null)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Nueva Venta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Nueva Venta</h2>
        {!currentCashRegister && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-yellow-800 text-sm">
              ⚠️ No hay caja abierta. Las ventas en efectivo no se registrarán en caja.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Search */}
          <div className="bg-white rounded-xl shadow-sm p-6">
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

          {/* Products Grid */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Productos Disponibles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors duration-200 cursor-pointer"
                  onClick={() => addToCart(product)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{product.name}</h4>
                      <p className="text-sm text-slate-600">{formatCurrency(product.sale_price)}</p>
                      <p className="text-xs text-slate-500">Stock: {product.stock}</p>
                    </div>
                    <button className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cart and Checkout */}
        <div className="space-y-6">
          {/* Customer Selection */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Cliente</h3>
            {selectedCustomer ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-blue-900">{selectedCustomer.name}</h4>
                    {selectedCustomer.phone && (
                      <p className="text-sm text-blue-700">{selectedCustomer.phone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                {customerSearchTerm && (
                  <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerSearchTerm('');
                        }}
                        className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-medium text-slate-900">{customer.name}</div>
                        {customer.phone && (
                          <div className="text-sm text-slate-600">{customer.phone}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                
                <button
                  onClick={() => setShowCustomerForm(true)}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Cliente
                </button>
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Carrito de Compras</h3>
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">El carrito está vacío</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{item.product.name}</h4>
                      <p className="text-sm text-slate-600">{formatCurrency(item.product.sale_price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded ml-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment and Checkout */}
          {cart.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Pago</h3>
              
              {/* Payment Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de Pago
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentType('cash')}
                    className={`p-3 rounded-lg border-2 transition-colors duration-200 ${
                      paymentType === 'cash'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <Calculator className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Efectivo</span>
                  </button>
                  <button
                    onClick={() => setPaymentType('installment')}
                    className={`p-3 rounded-lg border-2 transition-colors duration-200 ${
                      paymentType === 'installment'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <CreditCard className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Abonos</span>
                  </button>
                </div>
              </div>

              {/* Payment Method for Cash */}
              {paymentType === 'cash' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Método de Pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Discount */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descuento
                </label>
                <FormattedNumberInput
                  value={discount}
                  onChange={setDiscount}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Amount Received for Cash */}
              {paymentType === 'cash' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monto Recibido
                  </label>
                  <FormattedNumberInput
                    value={amountReceived}
                    onChange={setAmountReceived}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={getTotal().toString()}
                    min="0"
                  />
                  {amountReceived && getChange() > 0 && (
                    <p className="text-sm text-green-600 mt-1">
                      Cambio: {formatCurrency(getChange())}
                    </p>
                  )}
                </div>
              )}

              {/* Totals */}
              <div className="space-y-2 mb-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(getSubtotal())}</span>
                </div>
                {getDiscountAmount() > 0 && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Descuento:</span>
                    <span>-{formatCurrency(getDiscountAmount())}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(getTotal())}</span>
                </div>
              </div>

              <button
                onClick={completeSale}
                disabled={loading || cart.length === 0}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Completar Venta
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Customer Form Modal */}
      {showCustomerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Nuevo Cliente</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre *
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
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={createCustomer}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                Crear Cliente
              </button>
              <button
                onClick={() => {
                  setShowCustomerForm(false);
                  setCustomerFormData({ name: '', email: '', phone: '', address: '', cedula: '' });
                }}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}