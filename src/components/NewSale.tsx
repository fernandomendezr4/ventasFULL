import React, { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, User, Search, Package, DollarSign, CreditCard, Hash, AlertTriangle, CheckCircle, Volume2 } from 'lucide-react';
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentType, setPaymentType] = useState<'cash' | 'installment'>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showImeiSelector, setShowImeiSelector] = useState(false);
  const [selectedProductForImei, setSelectedProductForImei] = useState<{
    product: ProductWithCategory;
    cartIndex: number;
  } | null>(null);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [currentCashRegister, setCurrentCashRegister] = useState<any>(null);
  
  // Nuevo estado para productos agotados
  const [outOfStockProducts, setOutOfStockProducts] = useState<Set<string>>(new Set());
  const [showOutOfStockModal, setShowOutOfStockModal] = useState(false);

  useEffect(() => {
    loadProducts();
    loadCustomers();
    checkCashRegister();
  }, []);

  const checkCashRegister = async () => {
    if (!user) return;
    
    if (isDemoMode) {
      setCurrentCashRegister({
        id: 'demo-cash-register',
        user_id: user.id,
        status: 'open'
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
      setLoading(true);
      
      if (isDemoMode) {
        const demoProducts = [
          {
            id: 'demo-product-1',
            name: 'iPhone 15 Pro',
            description: 'Smartphone Apple iPhone 15 Pro 128GB',
            sale_price: 4500000,
            purchase_price: 4000000,
            stock: 3,
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
            stock: 1, // Solo 1 en stock para demostrar agotamiento
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
            stock: 0, // Sin stock para demostrar producto agotado
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
          }
        ];
        
        setProducts(demoProducts);
        
        // Agregar productos sin stock al conjunto de agotados
        const outOfStock = new Set<string>();
        demoProducts.forEach(product => {
          if (product.stock === 0) {
            outOfStock.add(product.id);
          }
        });
        setOutOfStockProducts(outOfStock);
        
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
        .gt('stock', 0) // Solo productos con stock
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
      if (isDemoMode) {
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
        
        setCustomers(demoCustomers);
        return;
      }
      
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

  // Función para reproducir sonido de alerta
  const playOutOfStockSound = () => {
    try {
      // Crear un sonido usando Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configurar sonido de alerta (tono descendente)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing sound:', error);
      // Fallback: usar beep del sistema si está disponible
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('Producto agotado');
        utterance.volume = 0.1;
        utterance.rate = 2;
        speechSynthesis.speak(utterance);
      }
    }
  };

  const addToCart = (product: ProductWithCategory) => {
    // Verificar si el producto está agotado
    if (product.stock === 0 || outOfStockProducts.has(product.id)) {
      alert('Este producto está agotado');
      return;
    }

    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Verificar si hay suficiente stock para incrementar
      if (existingItem.quantity >= product.stock) {
        alert(`No hay suficiente stock. Disponible: ${product.stock}`);
        return;
      }
      
      updateCartQuantity(product.id, existingItem.quantity + 1);
    } else {
      const newItem: CartItem = {
        product,
        quantity: 1,
        needsImeiSelection: product.has_imei_serial && product.requires_imei_serial
      };
      setCart([...cart, newItem]);
    }
  };

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Verificar stock disponible
    if (newQuantity > product.stock) {
      alert(`No hay suficiente stock. Disponible: ${product.stock}`);
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

  const updateProductStock = async (productId: string, newStock: number) => {
    try {
      if (isDemoMode) {
        // En modo demo, actualizar localmente
        setProducts(prevProducts => 
          prevProducts.map(product => 
            product.id === productId 
              ? { ...product, stock: newStock }
              : product
          ).filter(product => product.stock > 0 || product.id === productId) // Mantener el producto actual aunque tenga stock 0
        );
        
        // Si el stock llega a 0, agregarlo a productos agotados
        if (newStock === 0) {
          setOutOfStockProducts(prev => new Set([...prev, productId]));
          
          // Reproducir sonido de alerta
          playOutOfStockSound();
          
          // Mostrar notificación
          const product = products.find(p => p.id === productId);
          if (product) {
            setTimeout(() => {
              alert(`¡PRODUCTO AGOTADO! ${product.name} ya no tiene stock disponible.`);
            }, 100);
          }
        }
        return;
      }

      const { error } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);

      if (error) throw error;

      // Actualizar estado local
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product.id === productId 
            ? { ...product, stock: newStock }
            : product
        ).filter(product => product.stock > 0 || product.id === productId)
      );

      // Si el stock llega a 0, agregarlo a productos agotados
      if (newStock === 0) {
        setOutOfStockProducts(prev => new Set([...prev, productId]));
        
        // Reproducir sonido de alerta
        playOutOfStockSound();
        
        // Mostrar notificación
        const product = products.find(p => p.id === productId);
        if (product) {
          setTimeout(() => {
            alert(`¡PRODUCTO AGOTADO! ${product.name} ya no tiene stock disponible.`);
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error updating product stock:', error);
    }
  };

  const processSale = async () => {
    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }

    if (!currentCashRegister) {
      alert('Debe abrir una caja registradora antes de realizar ventas');
      return;
    }

    // Verificar que todos los productos con IMEI requerido tengan selecciones
    const incompleteItems = cart.filter(item => 
      item.needsImeiSelection && (!item.selectedImeiSerials || item.selectedImeiSerials.length !== item.quantity)
    );

    if (incompleteItems.length > 0) {
      alert(`Debe seleccionar IMEI/Serial para: ${incompleteItems.map(item => item.product.name).join(', ')}`);
      return;
    }

    const subtotal = calculateSubtotal();
    const discount = parseFloat(discountAmount) || 0;
    const total = subtotal - discount;

    if (paymentType === 'cash') {
      const received = parseFloat(amountReceived) || 0;
      if (received < total) {
        alert('El monto recibido es insuficiente');
        return;
      }
    }

    try {
      setProcessing(true);

      if (isDemoMode) {
        // Simular venta en modo demo
        const saleId = `demo-sale-${Date.now()}`;
        
        // Actualizar stock de productos vendidos
        for (const item of cart) {
          const newStock = item.product.stock - item.quantity;
          await updateProductStock(item.product.id, newStock);
        }

        const completedSaleData = {
          id: saleId,
          total_amount: total,
          subtotal: subtotal,
          discount_amount: discount,
          payment_type: paymentType,
          payment_status: paymentType === 'cash' ? 'paid' : 'pending',
          total_paid: paymentType === 'cash' ? total : 0,
          created_at: new Date().toISOString(),
          customer: selectedCustomer,
          user: { id: user?.id, name: user?.name },
          sale_items: cart.map(item => ({
            id: `demo-item-${Date.now()}-${Math.random()}`,
            product: item.product,
            quantity: item.quantity,
            unit_price: item.product.sale_price,
            total_price: item.product.sale_price * item.quantity,
            sale_item_imei_serials: item.selectedImeiSerials?.map(imei => ({
              id: `demo-imei-${Date.now()}-${Math.random()}`,
              imei_serial: imei
            })) || []
          }))
        };

        setCompletedSale(completedSaleData);
        clearCart();
        alert('Venta procesada exitosamente en modo demo');
        return;
      }

      // Crear la venta
      const saleData = {
        total_amount: total,
        subtotal: subtotal,
        discount_amount: discount,
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

      // Actualizar stock y manejar IMEI/Serial
      for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        const saleItem = saleItems[i];
        const newStock = item.product.stock - item.quantity;

        // Actualizar stock del producto
        await updateProductStock(item.product.id, newStock);

        // Marcar IMEI/Serial como vendidos si aplica
        if (item.selectedImeiSerials && item.selectedImeiSerials.length > 0) {
          const { error: imeiUpdateError } = await supabase
            .from('product_imei_serials')
            .update({
              status: 'sold',
              sale_id: sale.id,
              sale_item_id: saleItem.id,
              sold_at: new Date().toISOString()
            })
            .in('id', item.selectedImeiSerials.map(imei => imei.id));

          if (imeiUpdateError) {
            console.error('Error updating IMEI/Serial:', imeiUpdateError);
          }
        }
      }

      // Registrar en caja registradora
      if (paymentType === 'cash') {
        const { error: cashRegisterError } = await supabase
          .from('cash_register_sales')
          .insert([{
            cash_register_id: currentCashRegister.id,
            sale_id: sale.id,
            payment_method: 'cash',
            amount_received: parseFloat(amountReceived) || total,
            change_given: Math.max(0, (parseFloat(amountReceived) || total) - total),
            discount_applied: discount
          }]);

        if (cashRegisterError) {
          console.error('Error registering sale in cash register:', cashRegisterError);
        }
      }

      // Preparar datos para mostrar
      const completedSaleData = {
        ...sale,
        customer: selectedCustomer,
        user: { id: user?.id, name: user?.name },
        sale_items: saleItems.map((saleItem, index) => ({
          ...saleItem,
          product: cart[index].product,
          sale_item_imei_serials: cart[index].selectedImeiSerials?.map(imei => ({
            id: `imei-${Date.now()}-${Math.random()}`,
            imei_serial: imei
          })) || []
        }))
      };

      setCompletedSale(completedSaleData);
      clearCart();
      alert('Venta procesada exitosamente');

    } catch (error) {
      console.error('Error processing sale:', error);
      alert('Error al procesar la venta: ' + (error as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setAmountReceived('');
    setDiscountAmount('');
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.sale_price * item.quantity), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = parseFloat(discountAmount) || 0;
    return subtotal - discount;
  };

  const calculateChange = () => {
    if (paymentType !== 'cash') return 0;
    const received = parseFloat(amountReceived) || 0;
    const total = calculateTotal();
    return Math.max(0, received - total);
  };

  const filteredProducts = products.filter(product => {
    if (outOfStockProducts.has(product.id)) return false; // Excluir productos agotados
    return !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode.includes(searchTerm);
  });

  const filteredCustomers = customers.filter(customer =>
    !customerSearchTerm || 
    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone.includes(customerSearchTerm) ||
    customer.cedula.includes(customerSearchTerm)
  );

  // Obtener lista de productos agotados para mostrar
  const outOfStockProductsList = products.filter(product => 
    outOfStockProducts.has(product.id)
  );

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
        <div className="flex gap-2">
          {outOfStockProductsList.length > 0 && (
            <button
              onClick={() => setShowOutOfStockModal(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Productos Agotados ({outOfStockProductsList.length})
            </button>
          )}
          {!currentCashRegister && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-yellow-800 text-sm">
                ⚠️ No hay caja abierta
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search */}
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
                    ? 'No hay productos con stock disponible' 
                    : 'No se encontraron productos que coincidan con la búsqueda'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors duration-200 cursor-pointer"
                    onClick={() => addToCart(product)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{product.name}</h4>
                        <p className="text-sm text-slate-600">{product.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-bold text-green-600">
                            {formatCurrency(product.sale_price)}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            product.stock > 10 
                              ? 'bg-green-100 text-green-800' 
                              : product.stock > 5 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-red-100 text-red-800'
                          }`}>
                            Stock: {product.stock}
                          </span>
                          {product.has_imei_serial && (
                            <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                              <Hash className="h-3 w-3 inline mr-1" />
                              {product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="space-y-6">
          {/* Customer Selection */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Cliente</h3>
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
                      className="w-full text-left p-3 hover:bg-slate-50 transition-colors duration-200 border-b border-slate-100 last:border-b-0"
                    >
                      <p className="font-medium text-slate-900">{customer.name}</p>
                      <p className="text-sm text-slate-600">{customer.phone} • {customer.cedula}</p>
                    </button>
                  ))}
                </div>
              )}
              
              {selectedCustomer && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-900">{selectedCustomer.name}</p>
                      <p className="text-sm text-blue-700">{selectedCustomer.phone}</p>
                    </div>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
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
                {cart.map((item, index) => (
                  <div key={item.product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{item.product.name}</h4>
                      <p className="text-sm text-slate-600">
                        {formatCurrency(item.product.sale_price)} × {item.quantity}
                      </p>
                      
                      {/* IMEI/Serial Status */}
                      {item.needsImeiSelection && (
                        <div className="mt-2">
                          {item.selectedImeiSerials && item.selectedImeiSerials.length === item.quantity ? (
                            <div className="flex items-center text-xs text-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              <span>{item.product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'} seleccionados</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedProductForImei({ product: item.product, cartIndex: index });
                                setShowImeiSelector(true);
                              }}
                              className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded hover:bg-purple-200 transition-colors duration-200"
                            >
                              <Hash className="h-3 w-3 inline mr-1" />
                              Seleccionar {item.product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          disabled={item.quantity >= item.product.stock}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">
                          {formatCurrency(item.product.sale_price * item.quantity)}
                        </p>
                      </div>
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
              
              <div className="space-y-4">
                {/* Payment Type */}
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
                      <DollarSign className="h-5 w-5 mx-auto mb-1" />
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

                {/* Discount */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Descuento (opcional)
                  </label>
                  <FormattedNumberInput
                    value={discountAmount}
                    onChange={setDiscountAmount}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    max={calculateSubtotal().toString()}
                  />
                </div>

                {/* Cash Payment Fields */}
                {paymentType === 'cash' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Monto Recibido
                    </label>
                    <FormattedNumberInput
                      value={amountReceived}
                      onChange={setAmountReceived}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={calculateTotal().toString()}
                      min="0"
                    />
                  </div>
                )}

                {/* Totals */}
                <div className="border-t border-slate-200 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  
                  {parseFloat(discountAmount) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Descuento:</span>
                      <span className="font-medium text-red-600">-{formatCurrency(parseFloat(discountAmount))}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(calculateTotal())}</span>
                  </div>
                  
                  {paymentType === 'cash' && parseFloat(amountReceived) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Cambio:</span>
                      <span className="font-medium text-green-600">{formatCurrency(calculateChange())}</span>
                    </div>
                  )}
                </div>

                {/* Process Sale Button */}
                <button
                  onClick={processSale}
                  disabled={processing || cart.length === 0 || !currentCashRegister}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
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
              </div>
            </div>
          )}
        </div>
      </div>

      {/* IMEI/Serial Selector Modal */}
      {showImeiSelector && selectedProductForImei && (
        <ImeiSerialSelector
          isOpen={showImeiSelector}
          onClose={() => {
            setShowImeiSelector(false);
            setSelectedProductForImei(null);
          }}
          onSelect={(selectedImeiSerials) => {
            if (selectedProductForImei) {
              const updatedCart = [...cart];
              updatedCart[selectedProductForImei.cartIndex] = {
                ...updatedCart[selectedProductForImei.cartIndex],
                selectedImeiSerials
              };
              setCart(updatedCart);
            }
            setShowImeiSelector(false);
            setSelectedProductForImei(null);
          }}
          productId={selectedProductForImei.product.id}
          productName={selectedProductForImei.product.name}
          requiredQuantity={cart[selectedProductForImei.cartIndex]?.quantity || 1}
          imeiSerialType={selectedProductForImei.product.imei_serial_type}
        />
      )}

      {/* Modal de Productos Agotados */}
      {showOutOfStockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                  <AlertTriangle className="h-6 w-6 mr-3 text-red-600" />
                  Productos Agotados
                  <Volume2 className="h-5 w-5 ml-2 text-orange-600" />
                </h3>
                <button
                  onClick={() => setShowOutOfStockModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Productos que se agotaron durante esta sesión de ventas
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {outOfStockProductsList.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <p className="text-green-600 font-medium">No hay productos agotados</p>
                  <p className="text-sm text-slate-600 mt-1">Todos los productos tienen stock disponible</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                      <div>
                        <h4 className="font-medium text-red-900">
                          {outOfStockProductsList.length} producto{outOfStockProductsList.length > 1 ? 's' : ''} agotado{outOfStockProductsList.length > 1 ? 's' : ''}
                        </h4>
                        <p className="text-sm text-red-700">
                          Estos productos ya no están disponibles para venta
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {outOfStockProductsList.map((product) => (
                      <div key={product.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-900">{product.name}</h4>
                            <p className="text-sm text-slate-600">{product.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="font-bold text-slate-700">
                                {formatCurrency(product.sale_price)}
                              </span>
                              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">
                                SIN STOCK
                              </span>
                              {product.category && (
                                <span className="text-xs text-slate-500">
                                  {product.category.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-600">Stock anterior:</p>
                            <p className="font-medium text-slate-900">Agotado</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Recomendaciones:</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Contacta a los proveedores para reabastecer</li>
                      <li>• Revisa productos similares disponibles</li>
                      <li>• Considera ajustar precios de productos relacionados</li>
                      <li>• Notifica a clientes interesados cuando llegue nuevo stock</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-200">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    // Limpiar la lista de productos agotados
                    setOutOfStockProducts(new Set());
                    setShowOutOfStockModal(false);
                  }}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Limpiar Lista
                </button>
                <button
                  onClick={() => setShowOutOfStockModal(false)}
                  className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}