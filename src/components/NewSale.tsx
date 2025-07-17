import React, { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, User, Search, X, CreditCard, Banknote, Smartphone, Building2, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, Customer, CartItem } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import PrintService from './PrintService';

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  image_url?: string;
}

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'cash', name: 'Efectivo', icon: 'Banknote' },
  { id: 'card', name: 'Tarjeta', icon: 'CreditCard' },
  { id: 'transfer', name: 'Transferencia Bancaria', icon: 'Building2' },
  { id: 'nequi', name: 'NEQUI', icon: 'Smartphone' }
];

export default function NewSale() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCustomerSelectionModal, setShowCustomerSelectionModal] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'installment'>('cash');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DEFAULT_PAYMENT_METHODS);
  const [amountReceived, setAmountReceived] = useState('');
  const [discount, setDiscount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  
  // New customer form data
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    cedula: ''
  });

  useEffect(() => {
    loadProducts();
    loadCustomers();
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = () => {
    try {
      const savedMethods = localStorage.getItem('payment_methods');
      if (savedMethods) {
        const methods = JSON.parse(savedMethods);
        setPaymentMethods(methods);
      } else {
        setPaymentMethods(DEFAULT_PAYMENT_METHODS);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
      setPaymentMethods(DEFAULT_PAYMENT_METHODS);
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
      if (existingItem.quantity < product.stock) {
        setCart(cart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        alert(`Stock insuficiente. Solo hay ${product.stock} unidades disponibles.`);
      }
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQuantity > product.stock) {
      alert(`Stock insuficiente. Solo hay ${product.stock} unidades disponibles.`);
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
    return cart.reduce((sum, item) => sum + (item.product.sale_price * item.quantity), 0);
  };

  const calculateDiscount = () => {
    return parseFloat(discount) || 0;
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount();
  };

  const calculateChange = () => {
    if (paymentType !== 'cash') return 0;
    const received = parseFloat(amountReceived) || 0;
    const total = calculateTotal();
    return Math.max(0, received - total);
  };

  const handleCustomerSelection = (type: 'generic' | 'existing' | 'new') => {
    setShowCustomerSelectionModal(false);
    
    if (type === 'generic') {
      // Cliente genérico - no seleccionar ningún cliente específico
      setSelectedCustomer(null);
    } else if (type === 'existing') {
      // Mostrar modal para seleccionar cliente existente
      setShowCustomerModal(true);
    } else if (type === 'new') {
      // Mostrar formulario para crear nuevo cliente
      setShowNewCustomerForm(true);
    }
  };

  const handleCreateNewCustomer = async () => {
    if (!newCustomerData.name.trim()) {
      alert('El nombre del cliente es requerido');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([newCustomerData])
        .select()
        .single();

      if (error) throw error;

      setSelectedCustomer(data);
      setShowNewCustomerForm(false);
      setNewCustomerData({ name: '', email: '', phone: '', address: '', cedula: '' });
      
      // Recargar la lista de clientes
      loadCustomers();
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Error al crear cliente: ' + (error as Error).message);
    }
  };

  const processSale = async () => {
    if (cart.length === 0) {
      alert('Agrega productos al carrito');
      return;
    }

    // Validar que si es venta por abonos, debe tener cliente seleccionado
    if (paymentType === 'installment' && !selectedCustomer) {
      alert('Para ventas por abonos debe seleccionar un cliente');
      return;
    }

    if (paymentType === 'cash') {
      const received = parseFloat(amountReceived) || 0;
      const total = calculateTotal();
      
      if (received < total) {
        alert('El monto recibido debe ser mayor o igual al total');
        return;
      }
    }

    try {
      setLoading(true);

      const subtotal = calculateSubtotal();
      const discountAmount = calculateDiscount();
      const total = calculateTotal();

      // Create sale
      const saleData = {
        total_amount: total,
        subtotal: subtotal,
        discount_amount: discountAmount,
        customer_id: selectedCustomer?.id || null,
        user_id: user?.id || null,
        payment_type: paymentType,
        total_paid: paymentType === 'cash' ? total : 0,
        payment_status: paymentType === 'cash' ? 'paid' : 'pending',
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
        unit_price: item.product.sale_price,
        total_price: item.product.sale_price * item.quantity,
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

      // Record payment if cash
      if (paymentType === 'cash') {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert([{
            sale_id: sale.id,
            amount: total,
            payment_method: paymentMethod === 'nequi' ? 'other' : paymentMethod,
            notes: `Pago completo - ${paymentMethods.find(m => m.id === paymentMethod)?.name || paymentMethod}`
          }]);

        if (paymentError) throw paymentError;

        // Register in cash register if open
        try {
          const { data: currentRegister } = await supabase
            .from('cash_registers')
            .select('*')
            .eq('status', 'open')
            .eq('user_id', user?.id)
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (currentRegister) {
            await supabase
              .from('cash_movements')
              .insert([{
                cash_register_id: currentRegister.id,
                type: 'sale',
                category: 'ventas_efectivo',
                amount: total,
                description: `Venta #${sale.id.slice(-8)} - ${paymentMethods.find(m => m.id === paymentMethod)?.name || paymentMethod}`,
                reference_id: sale.id,
                created_by: user?.id
              }]);

            await supabase
              .from('cash_registers')
              .update({
                total_sales: (currentRegister.total_sales || 0) + total
              })
              .eq('id', currentRegister.id);
          }
        } catch (error) {
          console.error('Error updating cash register:', error);
        }
      }

      // Prepare sale data for printing
      const saleForPrint = {
        ...sale,
        customer: selectedCustomer,
        user: user,
        sale_items: cart.map(item => ({
          product: item.product,
          quantity: item.quantity,
          unit_price: item.product.sale_price,
          total_price: item.product.sale_price * item.quantity
        })),
        payment_method_name: paymentMethods.find(m => m.id === paymentMethod)?.name || paymentMethod
      };

      setCompletedSale(saleForPrint);
      setShowPrintModal(true);

      // Reset form
      setCart([]);
      setSelectedCustomer(null);
      setAmountReceived('');
      setDiscount('');
      setPaymentType('cash');
      setPaymentMethod('cash');
      loadProducts();
    } catch (error) {
      console.error('Error processing sale:', error);
      alert('Error al procesar la venta: ' + (error as Error).message);
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
    customer.cedula.includes(customerSearchTerm)
  );

  const getPaymentMethodIcon = (methodId: string) => {
    const method = paymentMethods.find(m => m.id === methodId);
    if (!method) return <CreditCard className="h-5 w-5" />;

    // If there's a custom image, use it
    if (method.image_url) {
      return (
        <img 
          src={method.image_url} 
          alt={method.name}
          className="h-5 w-5 object-contain"
          onError={(e) => {
            // Fallback to icon if image fails to load
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      );
    }

    // Default icons
    switch (method.icon) {
      case 'Banknote':
        return <Banknote className="h-5 w-5" />;
      case 'CreditCard':
        return <CreditCard className="h-5 w-5" />;
      case 'Building2':
        return <Building2 className="h-5 w-5" />;
      case 'Smartphone':
        return <Smartphone className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Nueva Venta</h2>
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
                placeholder="Buscar productos por nombre o código de barras..."
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
                  onClick={() => addToCart(product)}
                  className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{product.name}</h4>
                      <p className="text-sm text-slate-600">{formatCurrency(product.sale_price)}</p>
                      <p className="text-xs text-slate-500">Stock: {product.stock}</p>
                    </div>
                    <Plus className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cart and Checkout Section */}
        <div className="space-y-6">
          {/* Customer Selection */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Cliente</h3>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <p className="font-medium text-blue-900">{selectedCustomer.name}</p>
                  <p className="text-sm text-blue-700">{selectedCustomer.phone}</p>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 text-blue-600 hover:text-blue-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustomerSelectionModal(true)}
                className="w-full p-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center"
              >
                <User className="h-4 w-4 mr-2" />
                {paymentType === 'installment' ? 'Seleccionar Cliente (Requerido)' : 'Seleccionar Cliente (Opcional)'}
              </button>
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
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Section */}
          {cart.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Pago</h3>
              
              {/* Payment Type */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tipo de Pago
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentType('cash')}
                      className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                        paymentType === 'cash'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <div className="text-center">
                        <Banknote className="h-5 w-5 mx-auto mb-1" />
                        <span className="text-sm font-medium">Efectivo</span>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setPaymentType('installment');
                        if (!selectedCustomer) {
                          setShowCustomerSelectionModal(true);
                        }
                      }}
                      className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                        paymentType === 'installment'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <div className="text-center">
                        <CreditCard className="h-5 w-5 mx-auto mb-1" />
                        <span className="text-sm font-medium">Abonos</span>
                      </div>
                    </button>
                  </div>
                  {paymentType === 'installment' && !selectedCustomer && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                      ⚠️ Para ventas por abonos debe seleccionar un cliente
                    </div>
                  )}
                </div>

                {/* Payment Method Selection */}
                {paymentType === 'cash' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Método de Pago *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {paymentMethods.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => setPaymentMethod(method.id)}
                          className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                            paymentMethod === method.id
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          <div className="text-center">
                            <div className="flex justify-center mb-1">
                              {getPaymentMethodIcon(method.id)}
                            </div>
                            <span className="text-xs font-medium">{method.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discount */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Descuento (opcional)
                  </label>
                  <FormattedNumberInput
                    value={discount}
                    onChange={(value) => setDiscount(value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    max={calculateSubtotal().toString()}
                  />
                </div>

                {/* Amount Received (only for cash) */}
                {paymentType === 'cash' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Monto Recibido
                    </label>
                    <FormattedNumberInput
                      value={amountReceived}
                      onChange={(value) => setAmountReceived(value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={calculateTotal().toString()}
                      min={calculateTotal().toString()}
                    />
                  </div>
                )}

                {/* Totals */}
                <div className="space-y-2 pt-4 border-t border-slate-200">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  {calculateDiscount() > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Descuento:</span>
                      <span>-{formatCurrency(calculateDiscount())}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(calculateTotal())}</span>
                  </div>
                  {paymentType === 'cash' && amountReceived && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Cambio:</span>
                      <span>{formatCurrency(calculateChange())}</span>
                    </div>
                  )}
                </div>

                {/* Process Sale Button */}
                <button
                  onClick={processSale}
                  disabled={loading || cart.length === 0}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center font-medium"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {paymentType === 'cash' ? 'Procesar Venta' : 'Crear Venta a Crédito'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Selection Modal */}
      {showCustomerSelectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Seleccionar Tipo de Cliente</h3>
              <p className="text-sm text-slate-600 mt-1">
                {paymentType === 'installment' 
                  ? 'Para ventas por abonos debe seleccionar un cliente específico'
                  : 'Elige el tipo de cliente para esta venta'
                }
              </p>
            </div>
            
            <div className="p-6 space-y-3">
              {paymentType === 'cash' && (
                <button
                  onClick={() => handleCustomerSelection('generic')}
                  className="w-full p-4 border-2 border-slate-300 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-left"
                >
                  <div className="flex items-center">
                    <User className="h-6 w-6 text-slate-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-slate-900">Cliente Genérico</h4>
                      <p className="text-sm text-slate-600">Venta sin datos específicos del cliente</p>
                    </div>
                  </div>
                </button>
              )}
              
              <button
                onClick={() => handleCustomerSelection('existing')}
                className="w-full p-4 border-2 border-slate-300 rounded-lg hover:border-green-300 hover:bg-green-50 transition-all duration-200 text-left"
              >
                <div className="flex items-center">
                  <Search className="h-6 w-6 text-slate-600 mr-3" />
                  <div>
                    <h4 className="font-medium text-slate-900">Cliente Existente</h4>
                    <p className="text-sm text-slate-600">Seleccionar de la lista de clientes registrados</p>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => handleCustomerSelection('new')}
                className="w-full p-4 border-2 border-slate-300 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 text-left"
              >
                <div className="flex items-center">
                  <UserPlus className="h-6 w-6 text-slate-600 mr-3" />
                  <div>
                    <h4 className="font-medium text-slate-900">Nuevo Cliente</h4>
                    <p className="text-sm text-slate-600">Crear un nuevo cliente y asignarlo a esta venta</p>
                  </div>
                </div>
              </button>
            </div>
            
            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setShowCustomerSelectionModal(false)}
                className="w-full bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Seleccionar Cliente Existente</h3>
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, teléfono o cédula..."
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowCustomerModal(false);
                      setCustomerSearchTerm('');
                    }}
                    className="w-full text-left p-3 hover:bg-slate-50 rounded-lg transition-colors duration-200"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{customer.name}</p>
                      <p className="text-sm text-slate-600">{customer.phone}</p>
                      {customer.cedula && (
                        <p className="text-xs text-slate-500">CC: {customer.cedula}</p>
                      )}
                    </div>
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <p className="text-slate-500 text-center py-4">No se encontraron clientes</p>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setCustomerSearchTerm('');
                }}
                className="w-full bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Form Modal */}
      {showNewCustomerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Crear Nuevo Cliente</h3>
              <p className="text-sm text-slate-600 mt-1">
                Ingresa los datos del nuevo cliente
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newCustomerData.name}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nombre del cliente"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cédula
                </label>
                <input
                  type="text"
                  value={newCustomerData.cedula}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, cedula: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Número de cédula"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={newCustomerData.phone}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Número de teléfono"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newCustomerData.email}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Correo electrónico"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Dirección
                </label>
                <textarea
                  value={newCustomerData.address}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Dirección del cliente"
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleCreateNewCustomer}
                disabled={!newCustomerData.name.trim()}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Crear Cliente
              </button>
              <button
                onClick={() => {
                  setShowNewCustomerForm(false);
                  setNewCustomerData({ name: '', email: '', phone: '', address: '', cedula: '' });
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && completedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                ¡Venta Completada!
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                ¿Deseas imprimir el comprobante?
              </p>
            </div>
            
            <div className="p-6">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-900">Total de la venta:</span>
                    <span className="text-xl font-bold text-green-900">
                      {formatCurrency(completedSale.total_amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700">Método de pago:</span>
                    <span className="text-green-800">{completedSale.payment_method_name}</span>
                  </div>
                  {completedSale.customer && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-700">Cliente:</span>
                      <span className="text-green-800">{completedSale.customer.name}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3">
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
                        receipt_header: '',
                        receipt_footer: 'Conserve este comprobante',
                        company_name: 'VentasFULL',
                        company_address: '',
                        company_phone: '',
                        company_email: '',
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
                      receipt_header: '',
                      receipt_footer: 'Conserve este comprobante',
                      company_name: 'VentasFULL',
                      company_address: '',
                      company_phone: '',
                      company_email: ''
                    };
                  })()}
                  onPrint={() => {
                    setShowPrintModal(false);
                    setCompletedSale(null);
                  }}
                />
                <button
                  onClick={() => {
                    setShowPrintModal(false);
                    setCompletedSale(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
                >
                  Continuar sin Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}