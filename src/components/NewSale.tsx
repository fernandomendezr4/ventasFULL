import React, { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, X, Search, Package, User, UserPlus, Scan, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, CartItem, Customer } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import FormattedNumberInput from './FormattedNumberInput';
import { useAuth } from '../contexts/AuthContext';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';
import PrintService from './PrintService';

export default function NewSale() {
  const { user: currentUser } = useAuth();
  const { notification, showSuccess, showError, showWarning, hideNotification } = useNotification();
  const { confirmation, showConfirmation, hideConfirmation, handleConfirm } = useConfirmation();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentCashRegister, setCurrentCashRegister] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cashRegisterLoading, setCashRegisterLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'installment'>('cash');
  const [discountAmount, setDiscountAmount] = useState('');
  const [initialPayment, setInitialPayment] = useState('');
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    cedula: '',
  });
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProducts(),
        loadCustomers(),
        loadCurrentCashRegister()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentCashRegister = async () => {
    try {
      setCashRegisterLoading(true);
      let query = supabase
        .from('cash_registers')
        .select(`
          *,
          user:users(*)
        `)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1);

      // Si es empleado, solo mostrar su propia caja
      if (currentUser?.role === 'employee') {
        query = query.eq('user_id', currentUser.id);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      setCurrentCashRegister(data);
      
      // Si no hay caja abierta, limpiar el carrito por seguridad
      if (!data) {
        setCart([]);
        setSelectedCustomer(null);
      }
    } catch (error) {
      console.error('Error loading current cash register:', error);
      setCurrentCashRegister(null);
      setCart([]);
      setSelectedCustomer(null);
    } finally {
      setCashRegisterLoading(false);
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
      if (!currentCashRegister) {
        showWarning(
          'Caja Cerrada',
          'Debe haber una caja abierta para buscar productos'
        );
        return;
      }
      
      const product = products.find(p => 
        p.barcode && p.barcode.toLowerCase() === barcodeSearch.trim().toLowerCase()
      );
      if (product) {
        addToCart(product);
        setBarcodeSearch('');
      } else {
        showWarning(
          'Producto No Encontrado',
          'No se encontró ningún producto con ese código de barras'
        );
      }
    }
  };

  const addToCart = (product: Product) => {
    if (!currentCashRegister) {
      showWarning(
        'Caja Cerrada',
        'Debe haber una caja abierta para agregar productos al carrito'
      );
      return;
    }
    
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        setCart(cart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        showWarning(
          'Stock Insuficiente',
          `Solo hay ${product.stock} unidades disponibles de ${product.name}`
        );
      }
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (!currentCashRegister) {
      showWarning(
        'Caja Cerrada',
        'Debe haber una caja abierta para modificar el carrito'
      );
      return;
    }
    
    if (newQuantity === 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.stock) {
      showWarning(
        'Stock Insuficiente',
        `Solo hay ${product.stock} unidades disponibles`
      );
      return;
    }

    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    if (!currentCashRegister) {
      showWarning(
        'Caja Cerrada',
        'Debe haber una caja abierta para modificar el carrito'
      );
      return;
    }
    
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.sale_price * item.quantity), 0);
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
      showSuccess(
        '¡Cliente Creado!',
        `El cliente ${data.name} ha sido creado exitosamente`
      );
    } catch (error) {
      console.error('Error creating customer:', error);
      showError(
        'Error al Crear Cliente',
        'No se pudo crear el cliente. ' + (error as Error).message
      );
    }
  };

  const handleSale = async () => {
    if (cart.length === 0) {
      showWarning(
        'Carrito Vacío',
        'Debes agregar productos al carrito antes de realizar la venta'
      );
      return;
    }

    if (!currentCashRegister) {
      showWarning(
        'Caja Cerrada',
        'Debe haber una caja abierta para realizar ventas. Ve a la sección de Caja Registradora para abrir una caja.'
      );
      return;
    }

    if (paymentType === 'installment' && !selectedCustomer) {
      showWarning(
        'Cliente Requerido',
        'Debes seleccionar un cliente para realizar ventas por abonos'
      );
      return;
    }

    const subtotal = calculateSubtotal();
    const discount = parseFloat(discountAmount) || 0;
    const total = calculateTotal();

    if (discount > subtotal) {
      showWarning(
        'Descuento Inválido',
        'El descuento no puede ser mayor al subtotal de la venta'
      );
      return;
    }

    if (total <= 0) {
      showWarning(
        'Total Inválido',
        'El total de la venta debe ser mayor a 0'
      );
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
        user_id: currentCashRegister.user_id,
        payment_type: paymentType,
        total_paid: paymentType === 'cash' ? total : (parseFloat(initialPayment) || 0),
        payment_status: paymentType === 'cash' ? 'paid' : 
                       (parseFloat(initialPayment) || 0) >= total ? 'paid' :
                       (parseFloat(initialPayment) || 0) > 0 ? 'partial' : 'pending'
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
        total_price: item.product.sale_price * item.quantity
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

      // Register sale movement in cash register
      const { error: movementError } = await supabase
        .from('cash_movements')
        .insert([{
          cash_register_id: currentCashRegister.id,
          type: 'sale',
          category: 'ventas_efectivo',
          amount: paymentType === 'cash' ? total : (parseFloat(initialPayment) || 0),
          description: `Venta #${sale.id.slice(-8)} - ${cart.length} productos`,
          reference_id: sale.id,
          created_by: currentCashRegister.user_id
        }]);

      if (movementError) console.error('Error registering sale movement:', movementError);

      // Update cash register total sales
      const { error: registerUpdateError } = await supabase
        .from('cash_registers')
        .update({
          total_sales: (currentCashRegister.total_sales || 0) + (paymentType === 'cash' ? total : (parseFloat(initialPayment) || 0))
        })
        .eq('id', currentCashRegister.id);

      if (registerUpdateError) console.error('Error updating cash register:', registerUpdateError);

      // Record payment for cash sales
      if (paymentType === 'cash' || (paymentType === 'installment' && parseFloat(initialPayment) > 0)) {
        const paymentAmount = paymentType === 'cash' ? total : parseFloat(initialPayment);
        const { error: paymentError } = await supabase
          .from('payments')
          .insert([{
            sale_id: sale.id,
            amount: paymentAmount,
            payment_method: 'cash',
            notes: paymentType === 'cash' ? 'Pago completo en efectivo' : 'Abono inicial'
          }]);

        if (paymentError) console.error('Error recording payment:', paymentError);
        
        // Record initial payment as installment if it's an installment sale
        if (paymentType === 'installment' && parseFloat(initialPayment) > 0) {
          const { error: installmentError } = await supabase
            .from('payment_installments')
            .insert([{
              sale_id: sale.id,
              amount_paid: parseFloat(initialPayment),
              payment_method: 'cash',
              notes: 'Abono inicial'
            }]);

          if (installmentError) console.error('Error recording initial installment:', installmentError);
        }
      }

      // Reset form
      setCart([]);
      setSelectedCustomer(null);
      setDiscountAmount('');
      setPaymentType('cash');
      setInitialPayment('');
      setSearchTerm('');
      setBarcodeSearch('');
      
      // Reload products to update stock
      await loadProducts();
      // Reload cash register to update totals
      await loadCurrentCashRegister();

      // Prepare sale data for printing
      const saleForPrint = {
        ...sale,
        customer: selectedCustomer,
        user: currentUser,
        sale_items: cart.map(item => ({
          product: item.product,
          quantity: item.quantity,
          unit_price: item.product.sale_price,
          total_price: item.product.sale_price * item.quantity
        })),
        subtotal: subtotal,
        discount_amount: parseFloat(discountAmount) || 0,
        total_amount: total,
        payment_type: paymentType,
        total_paid: paymentType === 'cash' ? total : (parseFloat(initialPayment) || 0),
        payment_status: paymentType === 'cash' ? 'paid' : 
                       (parseFloat(initialPayment) || 0) >= total ? 'paid' :
                       (parseFloat(initialPayment) || 0) > 0 ? 'partial' : 'pending'
      };

      setCompletedSale(saleForPrint);

      showSuccess(
        paymentType === 'cash' ? '¡Venta Completada!' : '¡Venta Registrada!',
        paymentType === 'cash' 
          ? `Venta por ${formatCurrency(total)} completada exitosamente en efectivo`
          : `Venta por ${formatCurrency(total)} registrada para abonos. ${parseFloat(initialPayment) > 0 ? `Abono inicial: ${formatCurrency(parseFloat(initialPayment))}` : 'Sin abono inicial'}`
      );

      // Show print option
      setShowPrintModal(true);
    } catch (error) {
      console.error('Error processing sale:', error);
      showError(
        'Error al Procesar Venta',
        'No se pudo completar la venta. ' + (error as Error).message
      );
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
          {/* Cash Register Status */}
          <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
            currentCashRegister 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {currentCashRegister 
              ? `Caja Abierta - ${currentCashRegister.user?.name || 'Sin operador'}` 
              : 'Sin Caja Abierta'}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Tipo de pago:</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as 'cash' | 'installment')}
              disabled={!currentCashRegister}
              className="px-3 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="cash">Efectivo</option>
              <option value="installment">Abono</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cash Register Warning */}
      {!currentCashRegister && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
            <div>
              <h3 className="text-red-800 font-bold text-lg">⚠️ Caja Registradora Cerrada</h3>
              <p className="text-red-700 mt-2">
                <strong>No se pueden realizar ventas sin una caja abierta.</strong>
              </p>
              <p className="text-red-600 text-sm mt-1">
                {currentUser?.role === 'employee' 
                  ? 'Contacta a tu supervisor para abrir la caja registradora.' 
                  : 'Ve a la sección "Caja" en el menú lateral para abrir una caja registradora.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products Section - Disabled if no cash register */}
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
                disabled={!currentCashRegister}
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
                disabled={!currentCashRegister}
              />
            </div>
          </div>

          {/* Products List */}
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">
                  {!currentCashRegister 
                    ? 'Abre una caja registradora para ver los productos' 
                    : products.length === 0 
                      ? 'No hay productos con stock disponible' 
                      : 'No se encontraron productos'
                  }
                </p>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors duration-200"
                  onClick={() => currentCashRegister && addToCart(product)}
                  style={{ opacity: currentCashRegister ? 1 : 0.5, cursor: currentCashRegister ? 'pointer' : 'not-allowed' }}
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900">{product.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="font-semibold text-green-600">{formatCurrency(product.sale_price)}</span>
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
                  <button 
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    disabled={!currentCashRegister}
                    onClick={(e) => { e.stopPropagation(); currentCashRegister && addToCart(product); }}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cart Section - Disabled if no cash register */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2" />
            Carrito ({cart.length} productos)
          </h3>

          {/* Customer Selection for Installments */}
          {paymentType === 'installment' && currentCashRegister && (
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
                      disabled={!currentCashRegister}
                    >
                      <User className="h-4 w-4 mr-1" />
                      Seleccionar Cliente
                    </button>
                    <button
                      onClick={() => setShowCustomerForm(true)}
                      className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm flex items-center"
                      disabled={!currentCashRegister}
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
                <p className="text-slate-500">
                  {!currentCashRegister ? 'Caja cerrada - No se pueden agregar productos' : 'El carrito está vacío'}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {!currentCashRegister 
                    ? 'Abre una caja registradora para comenzar a vender' 
                    : 'Agrega productos haciendo clic en ellos'}
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900">{item.product.name}</h4>
                    <p className="text-sm text-slate-600">{formatCurrency(item.product.sale_price)} c/u</p>
                    {item.product.barcode && (
                      <p className="text-xs text-slate-500 font-mono">{item.product.barcode}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      disabled={!currentCashRegister}
                      className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors duration-200"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      disabled={!currentCashRegister}
                      className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors duration-200"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      disabled={!currentCashRegister}
                      className="p-1 text-red-600 hover:bg-red-50 rounded ml-2 transition-colors duration-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="ml-4 font-semibold text-slate-900 min-w-[80px] text-right">
                    {formatCurrency(item.product.sale_price * item.quantity)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Discount */}
          {cart.length > 0 && currentCashRegister && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Descuento (en pesos)
              </label>
              <FormattedNumberInput
                value={discountAmount}
                onChange={(value) => setDiscountAmount(value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!currentCashRegister}
                min="0"
                max={calculateSubtotal().toString()}
              />
            </div>
          )}

          {/* Initial Payment for Installments */}
          {cart.length > 0 && paymentType === 'installment' && currentCashRegister && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Abono Inicial (opcional)
              </label>
              <FormattedNumberInput
                value={initialPayment}
                onChange={(value) => setInitialPayment(value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!currentCashRegister}
                min="0"
                max={calculateTotal().toString()}
              />
              <p className="text-xs text-slate-500 mt-1">
                Monto que el cliente paga ahora. El resto quedará pendiente para futuros abonos.
              </p>
            </div>
          )}

          {/* Total */}
          {cart.length > 0 && currentCashRegister && (
            <div className="border-t border-slate-200 pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(calculateSubtotal())}</span>
                </div>
                {parseFloat(discountAmount) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Descuento:</span>
                    <span>-{formatCurrency(parseFloat(discountAmount))}</span>
                  </div>
                )}
                {paymentType === 'installment' && parseFloat(initialPayment) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Abono inicial:</span>
                    <span>{formatCurrency(parseFloat(initialPayment))}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="text-green-600">{formatCurrency(calculateTotal())}</span>
                </div>
                {paymentType === 'installment' && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Saldo pendiente:</span>
                    <span>{formatCurrency(calculateTotal() - (parseFloat(initialPayment) || 0))}</span>
                  </div>
                )}
              </div>
              
              <button
                onClick={handleSale}
                disabled={saving || cart.length === 0 || !currentCashRegister || (paymentType === 'installment' && !selectedCustomer) || cashRegisterLoading}
                className="w-full mt-4 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
              >
                {saving ? 'Procesando...' : 
                 paymentType === 'cash' ? 'Completar Venta en Efectivo' : 'Registrar Venta por Abonos'}
              </button>
            </div>
          )}
        </div>
        
        {/* Message when no cash register */}
        {!currentCashRegister && !loading && (
          <div className="lg:col-span-2 bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <AlertCircle className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-yellow-800 mb-2">Sistema de Ventas Deshabilitado</h3>
            <p className="text-yellow-700 mb-4">
              Para realizar ventas, primero debe abrir una caja registradora.
            </p>
          </div>
        )}
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

      {/* Print Modal */}
      {showPrintModal && completedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                ¡Venta Completada!
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                ¿Deseas imprimir el comprobante de venta?
              </p>
            </div>
            
            <div className="p-6">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-green-900">Total de la venta:</span>
                  <span className="text-xl font-bold text-green-900">
                    {formatCurrency(completedSale.total_amount)}
                  </span>
                </div>
                <div className="text-sm text-green-700 mt-1">
                  Venta #{completedSale.id?.slice(-8)} • {completedSale.sale_items.length} productos
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
    </div>
  );
}