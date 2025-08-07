import React, { useState, useEffect } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, User, CreditCard, Calculator, Search, Package, DollarSign, Hash, AlertTriangle, CheckCircle, Banknote, Building2, Smartphone, X } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { ProductWithCategory, Customer, CartItem } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import ImeiSerialSelector from './ImeiSerialSelector';
import PrintService from './PrintService';

export default function NewSale() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentType, setPaymentType] = useState<'cash' | 'installment'>('cash');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showImeiSelector, setShowImeiSelector] = useState(false);
  const [selectedCartItem, setSelectedCartItem] = useState<CartItem | null>(null);
  const [processing, setProcessing] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [currentCashRegister, setCurrentCashRegister] = useState<any>(null);
  
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    cedula: '',
  });

  // Cargar métodos de pago desde localStorage
  const getPaymentMethods = () => {
    try {
      const savedMethods = localStorage.getItem('payment_methods');
      if (savedMethods) {
        return JSON.parse(savedMethods);
      }
    } catch (error) {
      console.error('Error cargando métodos de pago:', error);
    }
    return [
      { id: 'cash', name: 'Efectivo', icon: 'Banknote', enabled: true },
      { id: 'card', name: 'Tarjeta', icon: 'CreditCard', enabled: true },
      { id: 'transfer', name: 'Transferencia Bancaria', icon: 'Building2', enabled: true },
      { id: 'nequi', name: 'NEQUI', icon: 'Smartphone', enabled: true }
    ];
  };

  const paymentMethods = getPaymentMethods().filter(method => method.enabled);

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) {
      return 'bg-red-100 text-red-800';
    } else if (stock <= 5) {
      return 'bg-yellow-100 text-yellow-800';
    } else {
      return 'bg-green-100 text-green-800';
    }
  };

  useEffect(() => {
    loadData();
    checkCashRegister();
  }, []);

  const checkCashRegister = async () => {
    if (!user) return;
    
    if (isDemoMode) {
      // Modo demo: simular caja abierta
      setCurrentCashRegister({
        id: 'demo-cash-register',
        user_id: user.id,
        status: 'open',
        opening_amount: 100000,
        opened_at: new Date().toISOString()
      });
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();

      if (error) {
        console.error('Error verificando caja registradora:', error);
        return;
      }

      setCurrentCashRegister(data);
    } catch (error) {
      console.error('Error verificando caja registradora:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Datos demo en español
        const demoProducts = [
          {
            id: 'demo-product-1',
            name: 'iPhone 15 Pro 128GB',
            description: 'Smartphone Apple iPhone 15 Pro 128GB Titanio Natural',
            sale_price: 4500000,
            purchase_price: 4000000,
            stock: 5,
            barcode: '123456789012',
            category_id: 'demo-category-1',
            supplier_id: 'demo-supplier-1',
            has_imei_serial: true,
            imei_serial_type: 'imei' as const,
            requires_imei_serial: true,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date().toISOString(),
            category: { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Distribuidora Tech', contact_person: 'Juan Pérez', email: 'contacto@tech.com', phone: '3001234567', address: 'Calle 123 #45-67', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-2',
            name: 'Samsung Galaxy S24 256GB',
            description: 'Smartphone Samsung Galaxy S24 256GB Negro',
            sale_price: 3200000,
            purchase_price: 2800000,
            stock: 8,
            barcode: '987654321098',
            category_id: 'demo-category-1',
            supplier_id: 'demo-supplier-2',
            has_imei_serial: true,
            imei_serial_type: 'imei' as const,
            requires_imei_serial: true,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            category: { id: 'demo-category-1', name: 'Smartphones', description: 'Teléfonos inteligentes', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-2', name: 'Importadora Global', contact_person: 'María García', email: 'ventas@global.com', phone: '3009876543', address: 'Carrera 45 #12-34', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-3',
            name: 'Cargador USB-C 20W',
            description: 'Cargador rápido USB-C 20W universal',
            sale_price: 45000,
            purchase_price: 25000,
            stock: 50,
            barcode: '456789123456',
            category_id: 'demo-category-2',
            supplier_id: 'demo-supplier-1',
            has_imei_serial: false,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            created_at: new Date(Date.now() - 172800000).toISOString(),
            category: { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios para dispositivos', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-1', name: 'Distribuidora Tech', contact_person: 'Juan Pérez', email: 'contacto@tech.com', phone: '3001234567', address: 'Calle 123 #45-67', created_at: new Date().toISOString() }
          }
        ];
        
        const demoCustomers = [
          {
            id: 'demo-customer-1',
            name: 'Juan Pérez',
            email: 'juan@email.com',
            phone: '3001234567',
            address: 'Calle 123 #45-67, Bogotá',
            cedula: '12345678',
            created_at: new Date().toISOString()
          },
          {
            id: 'demo-customer-2',
            name: 'María García',
            email: 'maria@email.com',
            phone: '3009876543',
            address: 'Carrera 45 #12-34, Medellín',
            cedula: '87654321',
            created_at: new Date(Date.now() - 86400000).toISOString()
          }
        ];
        
        setProducts(demoProducts);
        setCustomers(demoCustomers);
        setLoading(false);
        return;
      }
      
      const [productsResult, customersResult] = await Promise.all([
        supabase
          .from('products')
          .select(`
            *,
            category:categories(id, name, description),
            supplier:suppliers(id, name, contact_person, email, phone, address)
          `)
          .gt('stock', 0)
          .order('name'),
        supabase.from('customers').select('*').order('name')
      ]);

      if (productsResult.error) throw productsResult.error;
      if (customersResult.error) throw customersResult.error;

      setProducts(productsResult.data || []);
      setCustomers(customersResult.data || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: ProductWithCategory) => {
    // Verificar si el producto requiere IMEI/Serial
    if (product.requires_imei_serial) {
      const cartItem: CartItem = {
        product,
        quantity: 1,
        needsImeiSelection: true
      };
      setSelectedCartItem(cartItem);
      setShowImeiSelector(true);
      return;
    }

    // Verificar si ya está en el carrito
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Verificar stock disponible
      if (existingItem.quantity >= product.stock) {
        alert(`Stock insuficiente. Máximo disponible: ${product.stock}`);
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

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.stock) {
      alert(`Stock insuficiente. Máximo disponible: ${product.stock}`);
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

  const handleImeiSelection = (selectedImeiSerials: any[]) => {
    if (!selectedCartItem) return;

    const existingItem = cart.find(item => item.product.id === selectedCartItem.product.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.product.id === selectedCartItem.product.id
          ? { 
              ...item, 
              quantity: selectedImeiSerials.length,
              selectedImeiSerials,
              needsImeiSelection: false
            }
          : item
      ));
    } else {
      setCart([...cart, {
        product: selectedCartItem.product,
        quantity: selectedImeiSerials.length,
        selectedImeiSerials,
        needsImeiSelection: false
      }]);
    }

    setSelectedCartItem(null);
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.sale_price * item.quantity), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = parseFloat(discountAmount) || 0;
    return Math.max(0, subtotal - discount);
  };

  const calculateChange = () => {
    if (paymentType !== 'cash') return 0;
    const total = calculateTotal();
    const received = parseFloat(amountReceived) || 0;
    return Math.max(0, received - total);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isDemoMode) {
      // Crear cliente demo
      const newCustomer = {
        id: `demo-customer-${Date.now()}`,
        name: customerFormData.name,
        email: customerFormData.email,
        phone: customerFormData.phone,
        address: customerFormData.address,
        cedula: customerFormData.cedula,
        created_at: new Date().toISOString()
      };
      
      setCustomers([...customers, newCustomer]);
      setSelectedCustomer(newCustomer);
      setShowCustomerForm(false);
      setCustomerFormData({ name: '', email: '', phone: '', address: '', cedula: '' });
      alert('Cliente creado exitosamente en modo demo');
      return;
    }
    
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
      console.error('Error creando cliente:', error);
      alert('Error al crear cliente: ' + (error as Error).message);
    }
  };

  const processSale = async () => {
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }

    // Verificar que todos los productos con IMEI/Serial requerido tengan selección
    const incompleteItems = cart.filter(item => 
      item.product.requires_imei_serial && 
      (!item.selectedImeiSerials || item.selectedImeiSerials.length !== item.quantity)
    );

    if (incompleteItems.length > 0) {
      alert(`Los siguientes productos requieren selección de ${incompleteItems[0].product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'}:\n${incompleteItems.map(item => item.product.name).join('\n')}`);
      return;
    }

    const total = calculateTotal();

    if (paymentType === 'cash') {
      const received = parseFloat(amountReceived) || 0;
      if (received < total) {
        alert('El monto recibido es insuficiente');
        return;
      }
    }

    if (isDemoMode) {
      // Simular venta exitosa en modo demo
      const demoSale = {
        id: `demo-sale-${Date.now()}`,
        total_amount: total,
        subtotal: calculateSubtotal(),
        discount_amount: parseFloat(discountAmount) || 0,
        payment_type: paymentType,
        payment_method: paymentMethod,
        amount_received: parseFloat(amountReceived) || total,
        change_given: calculateChange(),
        customer: selectedCustomer,
        user: { name: user?.name || 'Usuario Demo', email: user?.email || 'demo@email.com' },
        sale_items: cart.map(item => ({
          product: item.product,
          quantity: item.quantity,
          unit_price: item.product.sale_price,
          total_price: item.product.sale_price * item.quantity,
          selectedImeiSerials: item.selectedImeiSerials
        })),
        created_at: new Date().toISOString()
      };
      
      setCompletedSale(demoSale);
      setCart([]);
      setSelectedCustomer(null);
      setAmountReceived('');
      setDiscountAmount('');
      setPaymentType('cash');
      setPaymentMethod('cash');
      return;
    }

    try {
      setProcessing(true);

      // Crear la venta
      const saleData = {
        total_amount: total,
        subtotal: calculateSubtotal(),
        discount_amount: parseFloat(discountAmount) || 0,
        customer_id: selectedCustomer?.id || null,
        user_id: user?.id,
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

      // Crear items de venta
      const saleItemsData = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.sale_price,
        total_price: item.product.sale_price * item.quantity
      }));

      const { data: saleItems, error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItemsData)
        .select();

      if (itemsError) throw itemsError;

      // Actualizar stock y marcar IMEI/Serial como vendidos
      for (let i = 0; i < cart.length; i++) {
        const cartItem = cart[i];
        const saleItem = saleItems[i];

        // Actualizar stock para productos sin IMEI/Serial requerido
        if (!cartItem.product.requires_imei_serial) {
          const { error: stockError } = await supabase
            .from('products')
            .update({ stock: cartItem.product.stock - cartItem.quantity })
            .eq('id', cartItem.product.id);

          if (stockError) {
            console.error('Error actualizando stock:', stockError);
          }
        }

        // Marcar IMEI/Serial como vendidos
        if (cartItem.selectedImeiSerials && cartItem.selectedImeiSerials.length > 0) {
          const { error: imeiError } = await supabase
            .from('product_imei_serials')
            .update({
              status: 'sold',
              sale_id: sale.id,
              sale_item_id: saleItem.id,
              sold_at: new Date().toISOString()
            })
            .in('id', cartItem.selectedImeiSerials.map(imei => imei.id));

          if (imeiError) {
            console.error('Error actualizando IMEI/Serial:', imeiError);
          }
        }
      }

      // Registrar pago si es en efectivo
      if (paymentType === 'cash') {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert([{
            sale_id: sale.id,
            amount: total,
            payment_method: paymentMethod,
            payment_date: new Date().toISOString(),
            notes: paymentMethod === 'other' ? `Método: ${paymentMethod}` : ''
          }]);

        if (paymentError) {
          console.error('Error registrando pago:', paymentError);
        }

        // Registrar en caja si está abierta
        if (currentCashRegister) {
          const { error: cashRegisterError } = await supabase
            .from('cash_register_sales')
            .insert([{
              cash_register_id: currentCashRegister.id,
              sale_id: sale.id,
              payment_method: paymentMethod,
              amount_received: parseFloat(amountReceived) || total,
              change_given: calculateChange(),
              payment_notes: paymentMethod === 'other' ? `Método: ${paymentMethod}` : ''
            }]);

          if (cashRegisterError) {
            console.error('Error registrando en caja:', cashRegisterError);
          }
        }
      }

      // Preparar datos para el comprobante
      const completedSaleData = {
        ...sale,
        customer: selectedCustomer,
        user: { name: user?.name, email: user?.email },
        sale_items: cart.map((item, index) => ({
          ...saleItems[index],
          product: item.product,
          selectedImeiSerials: item.selectedImeiSerials
        })),
        payment_method: paymentMethod,
        amount_received: parseFloat(amountReceived) || total,
        change_given: calculateChange()
      };

      setCompletedSale(completedSaleData);

      // Limpiar formulario
      setCart([]);
      setSelectedCustomer(null);
      setAmountReceived('');
      setDiscountAmount('');
      setPaymentType('cash');
      setPaymentMethod('cash');

      // Recargar productos para actualizar stock
      loadData();

    } catch (error) {
      console.error('Error procesando venta:', error);
      alert('Error al procesar la venta: ' + (error as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode.includes(searchTerm)
  );

  const getPaymentMethodIcon = (methodId: string) => {
    switch (methodId) {
      case 'cash':
        return <Banknote className="h-4 w-4" />;
      case 'card':
        return <CreditCard className="h-4 w-4" />;
      case 'transfer':
        return <Building2 className="h-4 w-4" />;
      case 'nequi':
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
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-900 mb-2">¡Venta Completada!</h2>
          <p className="text-green-700 mb-4">
            Venta #{completedSale.id.slice(-8)} por {formatCurrency(completedSale.total_amount)}
          </p>
          {completedSale.customer && (
            <p className="text-sm text-green-600 mb-4">
              Cliente: {completedSale.customer.name}
            </p>
          )}
          {paymentType === 'cash' && calculateChange() > 0 && (
            <p className="text-lg font-semibold text-green-800 mb-6">
              Cambio: {formatCurrency(calculateChange())}
            </p>
          )}
          
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

  if (!currentCashRegister) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-yellow-900 mb-2">Caja Registradora Requerida</h2>
          <p className="text-yellow-700 mb-6">
            Para realizar ventas, primero debes abrir una caja registradora.
          </p>
          <button
            onClick={() => window.location.hash = '#cash-register'}
            className="bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 transition-colors duration-200"
          >
            Ir a Caja Registradora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Nueva Venta</h2>
        <div className="text-sm text-slate-600">
          Caja: {currentCashRegister.id.slice(-8)} • Abierta: {new Date(currentCashRegister.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Productos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Productos Disponibles</h3>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">
                  {products.length === 0 
                    ? 'No hay productos disponibles' 
                    : 'No se encontraron productos que coincidan con la búsqueda'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
                    onClick={() => addToCart(product)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{product.name}</h4>
                        <p className="text-sm text-slate-600 mt-1">{product.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-lg font-bold text-green-600">
                            {formatCurrency(product.sale_price)}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStockStatusColor(product.stock)}`}>
                            Stock: {product.stock}
                          </span>
                          {product.has_imei_serial && (
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                              {product.imei_serial_type === 'imei' ? 'IMEI' : product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI/Serial'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(product);
                        }}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Carrito y Pago */}
        <div className="space-y-6">
          {/* Carrito */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <ShoppingCart className="h-5 w-5 mr-2" />
              Carrito ({cart.length})
            </h3>

            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">El carrito está vacío</p>
                <p className="text-xs text-slate-400 mt-1">
                  Haz clic en los productos para agregarlos
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.product.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900 text-sm">{item.product.name}</h4>
                        <p className="text-xs text-slate-600">{formatCurrency(item.product.sale_price)} c/u</p>
                        {item.product.has_imei_serial && (
                          <div className="mt-1">
                            {item.needsImeiSelection ? (
                              <button
                                onClick={() => {
                                  setSelectedCartItem(item);
                                  setShowImeiSelector(true);
                                }}
                                className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded hover:bg-orange-200 transition-colors duration-200"
                              >
                                Seleccionar {item.product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'}
                              </button>
                            ) : (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                {item.product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'} seleccionado
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded ml-2"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right mt-2">
                      <span className="font-bold text-slate-900">
                        {formatCurrency(item.product.sale_price * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cliente */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Cliente
            </h3>

            {selectedCustomer ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-blue-900">{selectedCustomer.name}</h4>
                    {selectedCustomer.phone && (
                      <p className="text-sm text-blue-700">{selectedCustomer.phone}</p>
                    )}
                    {selectedCustomer.cedula && (
                      <p className="text-sm text-blue-700">CC: {selectedCustomer.cedula}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  onChange={(e) => {
                    if (e.target.value === 'new') {
                      setShowCustomerForm(true);
                    } else if (e.target.value) {
                      const customer = customers.find(c => c.id === e.target.value);
                      setSelectedCustomer(customer || null);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Venta sin cliente</option>
                  <option value="new">+ Crear nuevo cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.phone && `(${customer.phone})`}
                    </option>
                  ))}
                </select>

                {showCustomerForm && (
                  <form onSubmit={handleCreateCustomer} className="space-y-3 p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium text-slate-900">Nuevo Cliente</h4>
                    <input
                      type="text"
                      placeholder="Nombre completo *"
                      value={customerFormData.name}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Teléfono"
                      value={customerFormData.phone}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Cédula"
                      value={customerFormData.cedula}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, cedula: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm"
                      >
                        Crear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomerForm(false);
                          setCustomerFormData({ name: '', email: '', phone: '', address: '', cedula: '' });
                        }}
                        className="flex-1 bg-slate-200 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200 text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Resumen y Pago */}
          {cart.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                <Calculator className="h-5 w-5 mr-2" />
                Resumen de Pago
              </h3>

              <div className="space-y-4">
                {/* Totales */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Descuento:</span>
                      <span className="font-medium text-orange-600">
                        -{formatCurrency(parseFloat(discountAmount) || 0)}
                      </span>
                    </div>
                    <FormattedNumberInput
                      value={discountAmount}
                      onChange={setDiscountAmount}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="0"
                      min="0"
                      max={calculateSubtotal().toString()}
                    />
                  </div>
                  
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200">
                    <span>Total:</span>
                    <span className="text-green-600">{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>

                {/* Tipo de Pago */}
                <div>
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
                      <Banknote className="h-5 w-5 mx-auto mb-1" />
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

                {/* Método de Pago para Efectivo */}
                {paymentType === 'cash' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Método de Pago
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {paymentMethods.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => setPaymentMethod(method.id)}
                          className={`p-2 rounded-lg border transition-colors duration-200 flex items-center justify-center ${
                            paymentMethod === method.id
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {getPaymentMethodIcon(method.id)}
                          <span className="ml-2 text-sm">{method.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monto Recibido para Efectivo */}
                {paymentType === 'cash' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Monto Recibido *
                    </label>
                    <FormattedNumberInput
                      value={amountReceived}
                      onChange={setAmountReceived}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={calculateTotal().toString()}
                      min="0"
                    />
                    {amountReceived && parseFloat(amountReceived) >= calculateTotal() && (
                      <div className="mt-2 text-sm">
                        <span className="text-green-600 font-medium">
                          Cambio: {formatCurrency(calculateChange())}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Botón de Procesar Venta */}
                <button
                  onClick={processSale}
                  disabled={
                    processing || 
                    cart.length === 0 || 
                    (paymentType === 'cash' && (!amountReceived || parseFloat(amountReceived) < calculateTotal())) ||
                    cart.some(item => item.needsImeiSelection)
                  }
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center font-medium"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Procesar Venta
                    </>
                  )}
                </button>

                {cart.some(item => item.needsImeiSelection) && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-orange-600 mr-2" />
                      <span className="text-sm text-orange-800">
                        Algunos productos requieren selección de IMEI/Serial
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Selección IMEI/Serial */}
      {showImeiSelector && selectedCartItem && (
        <ImeiSerialSelector
          isOpen={showImeiSelector}
          onClose={() => {
            setShowImeiSelector(false);
            setSelectedCartItem(null);
          }}
          onSelect={handleImeiSelection}
          productId={selectedCartItem.product.id}
          productName={selectedCartItem.product.name}
          requiredQuantity={selectedCartItem.quantity}
          imeiSerialType={selectedCartItem.product.imei_serial_type}
        />
      )}
    </div>
  );
}