import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Minus, ShoppingCart, User, Search, Package, DollarSign, CreditCard, Hash, AlertTriangle, CheckCircle, Volume2, Zap, TrendingUp, Clock, Calculator, Star, Filter, ScanLine, Smartphone } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { ProductWithCategory, Customer, CartItem } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import ImeiSerialSelector from './ImeiSerialSelector';
import PrintService from './PrintService';

interface ProductSuggestion {
  product: ProductWithCategory;
  score: number;
  reason: string;
}

interface SaleInsight {
  type: 'warning' | 'info' | 'success' | 'error';
  message: string;
  action?: () => void;
}

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
  
  // Estados para inteligencia avanzada
  const [productSuggestions, setProductSuggestions] = useState<ProductSuggestion[]>([]);
  const [saleInsights, setSaleInsights] = useState<SaleInsight[]>([]);
  const [quickDiscounts, setQuickDiscounts] = useState<number[]>([5, 10, 15, 20]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [autoCalculateChange, setAutoCalculateChange] = useState(true);
  const [smartPricing, setSmartPricing] = useState(true);
  const [voiceSearch, setVoiceSearch] = useState(false);
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'popularity'>('name');
  
  // Estados para productos agotados
  const [outOfStockProducts, setOutOfStockProducts] = useState<Set<string>>(new Set());
  const [showOutOfStockModal, setShowOutOfStockModal] = useState(false);

  useEffect(() => {
    loadProducts();
    loadCustomers();
    checkCashRegister();
    loadRecentSales();
  }, []);

  // Efecto para generar sugerencias inteligentes
  useEffect(() => {
    if (products.length > 0) {
      generateProductSuggestions();
    }
  }, [products, selectedCustomer, cart, searchTerm]);

  // Efecto para análisis de venta en tiempo real
  useEffect(() => {
    if (cart.length > 0) {
      generateSaleInsights();
    } else {
      setSaleInsights([]);
    }
  }, [cart, selectedCustomer, paymentType, discountAmount]);

  // Efecto para auto-completar monto recibido
  useEffect(() => {
    if (autoCalculateChange && paymentType === 'cash' && cart.length > 0) {
      const total = calculateTotal();
      if (!amountReceived || parseFloat(amountReceived) < total) {
        setAmountReceived(total.toString());
      }
    }
  }, [cart, discountAmount, autoCalculateChange, paymentType]);

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
            stock: 1,
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
            name: 'Audífonos Bluetooth Premium',
            description: 'Audífonos inalámbricos con cancelación de ruido',
            sale_price: 450000,
            purchase_price: 320000,
            stock: 15,
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
          },
          {
            id: 'demo-product-4',
            name: 'Cargador Inalámbrico',
            description: 'Cargador inalámbrico rápido 15W',
            sale_price: 120000,
            purchase_price: 80000,
            stock: 25,
            barcode: '789123456789',
            category_id: 'demo-category-2',
            supplier_id: 'demo-supplier-3',
            created_at: new Date(Date.now() - 259200000).toISOString(),
            has_imei_serial: false,
            imei_serial_type: 'serial' as const,
            requires_imei_serial: false,
            bulk_import_batch: '',
            import_notes: '',
            imported_at: null,
            imported_by: null,
            category: { id: 'demo-category-2', name: 'Accesorios', description: 'Accesorios electrónicos', created_at: new Date().toISOString() },
            supplier: { id: 'demo-supplier-3', name: 'Accesorios Plus', contact_person: 'Contacto Accesorios', email: 'accesorios@plus.com', phone: '3005555555', address: 'Dirección Accesorios', created_at: new Date().toISOString() }
          },
          {
            id: 'demo-product-5',
            name: 'Protector de Pantalla',
            description: 'Protector de pantalla de vidrio templado',
            sale_price: 35000,
            purchase_price: 18000,
            stock: 0, // Sin stock para demostrar producto agotado
            barcode: '321654987321',
            category_id: 'demo-category-2',
            supplier_id: 'demo-supplier-3',
            created_at: new Date(Date.now() - 345600000).toISOString(),
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
          },
          {
            id: 'demo-customer-3',
            name: 'Carlos López',
            email: 'carlos@email.com',
            phone: '3005555555',
            address: 'Avenida 80 #23-45, Cali',
            cedula: '11223344',
            created_at: new Date(Date.now() - 172800000).toISOString()
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

  const loadRecentSales = async () => {
    try {
      if (isDemoMode) {
        const demoRecentSales = [
          {
            id: 'demo-recent-1',
            customer_id: 'demo-customer-1',
            total_amount: 4500000,
            created_at: new Date(Date.now() - 3600000).toISOString(),
            sale_items: [{ product_id: 'demo-product-1', quantity: 1 }]
          },
          {
            id: 'demo-recent-2',
            customer_id: 'demo-customer-2',
            total_amount: 570000,
            created_at: new Date(Date.now() - 7200000).toISOString(),
            sale_items: [
              { product_id: 'demo-product-3', quantity: 1 },
              { product_id: 'demo-product-4', quantity: 1 }
            ]
          }
        ];
        
        setRecentSales(demoRecentSales);
        return;
      }

      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          customer_id,
          total_amount,
          created_at,
          sale_items(product_id, quantity)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRecentSales(data || []);
    } catch (error) {
      console.error('Error loading recent sales:', error);
      setRecentSales([]);
    }
  };

  // Generar sugerencias inteligentes de productos
  const generateProductSuggestions = useCallback(() => {
    if (!showSuggestions || products.length === 0) return;

    const suggestions: ProductSuggestion[] = [];

    // Sugerencias basadas en historial del cliente
    if (selectedCustomer) {
      const customerSales = recentSales.filter(sale => sale.customer_id === selectedCustomer.id);
      const customerProducts = new Set(
        customerSales.flatMap(sale => sale.sale_items?.map((item: any) => item.product_id) || [])
      );

      products.forEach(product => {
        if (customerProducts.has(product.id) && !cart.some(item => item.product.id === product.id)) {
          suggestions.push({
            product,
            score: 90,
            reason: 'Producto comprado anteriormente por este cliente'
          });
        }
      });
    }

    // Sugerencias basadas en productos en el carrito (productos complementarios)
    if (cart.length > 0) {
      const cartCategories = new Set(cart.map(item => item.product.category_id));
      const cartPriceRange = {
        min: Math.min(...cart.map(item => item.product.sale_price)),
        max: Math.max(...cart.map(item => item.product.sale_price))
      };

      products.forEach(product => {
        if (cart.some(item => item.product.id === product.id)) return;

        let score = 0;
        let reason = '';

        // Productos de la misma categoría
        if (cartCategories.has(product.category_id)) {
          score += 30;
          reason = 'Producto relacionado por categoría';
        }

        // Productos en rango de precio similar
        if (product.sale_price >= cartPriceRange.min * 0.3 && product.sale_price <= cartPriceRange.max * 1.5) {
          score += 20;
          reason = reason ? `${reason} y precio similar` : 'Precio similar a productos en carrito';
        }

        // Productos complementarios específicos
        const hasSmartphone = cart.some(item => 
          item.product.category?.name.toLowerCase().includes('smartphone') ||
          item.product.name.toLowerCase().includes('iphone') ||
          item.product.name.toLowerCase().includes('samsung')
        );

        if (hasSmartphone && (
          product.name.toLowerCase().includes('cargador') ||
          product.name.toLowerCase().includes('protector') ||
          product.name.toLowerCase().includes('audífono') ||
          product.name.toLowerCase().includes('funda')
        )) {
          score += 50;
          reason = 'Accesorio complementario para smartphone';
        }

        if (score > 0) {
          suggestions.push({ product, score, reason });
        }
      });
    }

    // Productos populares (simulado basado en stock bajo = más vendido)
    if (suggestions.length < 3) {
      products
        .filter(product => 
          product.stock > 0 && 
          product.stock < 10 && 
          !cart.some(item => item.product.id === product.id)
        )
        .forEach(product => {
          suggestions.push({
            product,
            score: 40,
            reason: 'Producto popular (stock bajo)'
          });
        });
    }

    // Ordenar por score y tomar los mejores
    suggestions.sort((a, b) => b.score - a.score);
    setProductSuggestions(suggestions.slice(0, 6));
  }, [products, selectedCustomer, cart, recentSales, showSuggestions]);

  // Generar insights de venta en tiempo real
  const generateSaleInsights = useCallback(() => {
    const insights: SaleInsight[] = [];
    const total = calculateTotal();
    const subtotal = calculateSubtotal();

    // Análisis de descuento
    const discount = parseFloat(discountAmount) || 0;
    if (discount > 0) {
      const discountPercentage = (discount / subtotal) * 100;
      if (discountPercentage > 20) {
        insights.push({
          type: 'warning',
          message: `Descuento alto: ${discountPercentage.toFixed(1)}% del total`,
        });
      } else if (discountPercentage > 10) {
        insights.push({
          type: 'info',
          message: `Descuento aplicado: ${discountPercentage.toFixed(1)}%`,
        });
      }
    }

    // Análisis de margen de ganancia
    const totalProfit = cart.reduce((sum, item) => {
      const profit = (item.product.sale_price - (item.product.purchase_price || 0)) * item.quantity;
      return sum + profit;
    }, 0);

    const profitMargin = subtotal > 0 ? (totalProfit / subtotal) * 100 : 0;
    
    if (profitMargin < 10) {
      insights.push({
        type: 'warning',
        message: `Margen bajo: ${profitMargin.toFixed(1)}% (${formatCurrency(totalProfit)})`,
      });
    } else if (profitMargin > 50) {
      insights.push({
        type: 'success',
        message: `Excelente margen: ${profitMargin.toFixed(1)}% (${formatCurrency(totalProfit)})`,
      });
    }

    // Análisis de stock después de la venta
    cart.forEach(item => {
      const stockAfterSale = item.product.stock - item.quantity;
      if (stockAfterSale === 0) {
        insights.push({
          type: 'warning',
          message: `${item.product.name} se agotará con esta venta`,
        });
      } else if (stockAfterSale <= 3) {
        insights.push({
          type: 'info',
          message: `${item.product.name} quedará con stock bajo (${stockAfterSale})`,
        });
      }
    });

    // Sugerencias de venta cruzada
    if (cart.length === 1) {
      const cartProduct = cart[0].product;
      if (cartProduct.category?.name.toLowerCase().includes('smartphone')) {
        insights.push({
          type: 'info',
          message: '💡 Sugiere accesorios: cargador, protector, audífonos',
          action: () => {
            const accessories = products.filter(p => 
              p.category?.name.toLowerCase().includes('accesorio') && p.stock > 0
            );
            if (accessories.length > 0) {
              setSearchTerm('cargador');
            }
          }
        });
      }
    }

    // Análisis de cliente
    if (selectedCustomer) {
      const customerSales = recentSales.filter(sale => sale.customer_id === selectedCustomer.id);
      if (customerSales.length > 0) {
        const avgPurchase = customerSales.reduce((sum, sale) => sum + sale.total_amount, 0) / customerSales.length;
        if (total > avgPurchase * 1.5) {
          insights.push({
            type: 'info',
            message: `Venta superior al promedio del cliente (${formatCurrency(avgPurchase)})`,
          });
        }
      }
    }

    // Análisis de pago
    if (paymentType === 'cash' && total > 1000000) {
      insights.push({
        type: 'info',
        message: '💳 Considera ofrecer pago en abonos para montos altos',
        action: () => setPaymentType('installment')
      });
    }

    setSaleInsights(insights);
  }, [cart, selectedCustomer, discountAmount, paymentType, recentSales, products]);

  // Función para reproducir sonido de alerta
  const playOutOfStockSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const addToCart = (product: ProductWithCategory) => {
    if (product.stock === 0 || outOfStockProducts.has(product.id)) {
      alert('Este producto está agotado');
      return;
    }

    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
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
        setProducts(prevProducts => 
          prevProducts.map(product => 
            product.id === productId 
              ? { ...product, stock: newStock }
              : product
          ).filter(product => product.stock > 0 || product.id === productId)
        );
        
        if (newStock === 0) {
          setOutOfStockProducts(prev => new Set([...prev, productId]));
          playOutOfStockSound();
          
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

      setProducts(prevProducts => 
        prevProducts.map(product => 
          product.id === productId 
            ? { ...product, stock: newStock }
            : product
        ).filter(product => product.stock > 0 || product.id === productId)
      );

      if (newStock === 0) {
        setOutOfStockProducts(prev => new Set([...prev, productId]));
        playOutOfStockSound();
        
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
        const saleId = `demo-sale-${Date.now()}`;
        
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

      for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        const saleItem = saleItems[i];
        const newStock = item.product.stock - item.quantity;

        await updateProductStock(item.product.id, newStock);

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
    setSaleInsights([]);
    setProductSuggestions([]);
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

  const applyQuickDiscount = (percentage: number) => {
    const subtotal = calculateSubtotal();
    const discountValue = (subtotal * percentage) / 100;
    setDiscountAmount(discountValue.toString());
  };

  const addSuggestedProduct = (suggestion: ProductSuggestion) => {
    addToCart(suggestion.product);
    setProductSuggestions(prev => prev.filter(s => s.product.id !== suggestion.product.id));
  };

  // Filtros inteligentes para productos
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product => {
      if (outOfStockProducts.has(product.id)) return false;
      
      // Filtro por búsqueda
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(searchLower);
        const matchesBarcode = product.barcode.includes(searchTerm);
        const matchesCategory = product.category?.name.toLowerCase().includes(searchLower);
        const matchesDescription = product.description.toLowerCase().includes(searchLower);
        
        if (!matchesName && !matchesBarcode && !matchesCategory && !matchesDescription) {
          return false;
        }
      }
      
      // Filtro por categoría
      if (categoryFilter && product.category_id !== categoryFilter) {
        return false;
      }
      
      // Filtro por rango de precio
      if (priceRange.min && product.sale_price < parseFloat(priceRange.min)) {
        return false;
      }
      if (priceRange.max && product.sale_price > parseFloat(priceRange.max)) {
        return false;
      }
      
      return true;
    });

    // Ordenamiento inteligente
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.sale_price - b.sale_price;
        case 'stock':
          return b.stock - a.stock;
        case 'popularity':
          // Simular popularidad basada en stock bajo (más vendido)
          const aPopularity = Math.max(0, 50 - a.stock);
          const bPopularity = Math.max(0, 50 - b.stock);
          return bPopularity - aPopularity;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [products, outOfStockProducts, searchTerm, categoryFilter, priceRange, sortBy]);

  const filteredCustomers = customers.filter(customer =>
    !customerSearchTerm || 
    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone.includes(customerSearchTerm) ||
    customer.cedula.includes(customerSearchTerm)
  );

  const outOfStockProductsList = products.filter(product => 
    outOfStockProducts.has(product.id)
  );

  const categories = useMemo(() => {
    const uniqueCategories = new Map();
    products.forEach(product => {
      if (product.category) {
        uniqueCategories.set(product.category.id, product.category);
      }
    });
    return Array.from(uniqueCategories.values());
  }, [products]);

  // Función para búsqueda por voz (experimental)
  const startVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Búsqueda por voz no soportada en este navegador');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setVoiceSearch(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchTerm(transcript);
      setVoiceSearch(false);
    };

    recognition.onerror = () => {
      setVoiceSearch(false);
      alert('Error en búsqueda por voz');
    };

    recognition.onend = () => {
      setVoiceSearch(false);
    };

    recognition.start();
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
        <h2 className="text-3xl font-bold text-slate-900">Nueva Venta Inteligente</h2>
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

      {/* Insights de Venta en Tiempo Real */}
      {saleInsights.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center">
            <Zap className="h-5 w-5 mr-2 text-yellow-600" />
            Análisis Inteligente de Venta
          </h3>
          <div className="space-y-2">
            {saleInsights.map((insight, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  insight.type === 'success' ? 'bg-green-50 border-green-200' :
                  insight.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  insight.type === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <span className={`text-sm ${
                  insight.type === 'success' ? 'text-green-800' :
                  insight.type === 'warning' ? 'text-yellow-800' :
                  insight.type === 'error' ? 'text-red-800' :
                  'text-blue-800'
                }`}>
                  {insight.message}
                </span>
                {insight.action && (
                  <button
                    onClick={insight.action}
                    className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded hover:bg-opacity-75 transition-colors duration-200"
                  >
                    Aplicar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Búsqueda Avanzada */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, código de barras, categoría o descripción..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={startVoiceSearch}
                  disabled={voiceSearch}
                  className={`px-3 py-2 rounded-lg border transition-colors duration-200 ${
                    voiceSearch 
                      ? 'bg-red-100 border-red-300 text-red-700' 
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Búsqueda por voz"
                >
                  {voiceSearch ? (
                    <div className="animate-pulse">🎤</div>
                  ) : (
                    '🎤'
                  )}
                </button>
                <button
                  onClick={() => setBarcodeMode(!barcodeMode)}
                  className={`px-3 py-2 rounded-lg border transition-colors duration-200 ${
                    barcodeMode 
                      ? 'bg-blue-100 border-blue-300 text-blue-700' 
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Modo código de barras"
                >
                  <ScanLine className="h-4 w-4" />
                </button>
              </div>

              {/* Filtros Avanzados */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((category: any) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Precio mín"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />

                <input
                  type="number"
                  placeholder="Precio máx"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="name">Ordenar por Nombre</option>
                  <option value="price">Ordenar por Precio</option>
                  <option value="stock">Ordenar por Stock</option>
                  <option value="popularity">Ordenar por Popularidad</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sugerencias Inteligentes */}
          {productSuggestions.length > 0 && showSuggestions && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-purple-900 flex items-center">
                  <Star className="h-5 w-5 mr-2 text-yellow-500" />
                  Sugerencias Inteligentes
                </h3>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-purple-600 hover:text-purple-800 text-sm"
                >
                  Ocultar
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {productSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.product.id}
                    className="bg-white border border-purple-200 rounded-lg p-4 hover:border-purple-300 transition-colors duration-200 cursor-pointer"
                    onClick={() => addSuggestedProduct(suggestion)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{suggestion.product.name}</h4>
                        <p className="text-sm text-purple-600 mb-1">{suggestion.reason}</p>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-600">
                            {formatCurrency(suggestion.product.sale_price)}
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                            Score: {suggestion.score}
                          </span>
                        </div>
                      </div>
                      <button className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 transition-colors duration-200">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Products Grid */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Productos Disponibles ({filteredProducts.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className={`text-sm px-3 py-1 rounded-lg transition-colors duration-200 ${
                    showSuggestions 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Star className="h-3 w-3 inline mr-1" />
                  Sugerencias
                </button>
                <button
                  onClick={() => setAutoCalculateChange(!autoCalculateChange)}
                  className={`text-sm px-3 py-1 rounded-lg transition-colors duration-200 ${
                    autoCalculateChange 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Calculator className="h-3 w-3 inline mr-1" />
                  Auto-cambio
                </button>
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
                    ? 'No hay productos con stock disponible' 
                    : 'No se encontraron productos que coincidan con los filtros'}
                </p>
                {(searchTerm || categoryFilter || priceRange.min || priceRange.max) && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setCategoryFilter('');
                      setPriceRange({ min: '', max: '' });
                    }}
                    className="mt-3 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map((product) => {
                  const isInCart = cart.some(item => item.product.id === product.id);
                  const cartItem = cart.find(item => item.product.id === product.id);
                  const profit = product.sale_price - (product.purchase_price || 0);
                  const margin = product.purchase_price ? (profit / product.purchase_price) * 100 : 0;

                  return (
                    <div
                      key={product.id}
                      className={`border rounded-lg p-4 transition-all duration-200 cursor-pointer ${
                        isInCart 
                          ? 'border-green-300 bg-green-50 shadow-md' 
                          : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
                      }`}
                      onClick={() => !isInCart && addToCart(product)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-slate-900">{product.name}</h4>
                            {isInCart && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                En carrito: {cartItem?.quantity}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mb-2">{product.description}</p>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-green-600">
                              {formatCurrency(product.sale_price)}
                            </span>
                            {smartPricing && profit > 0 && (
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                +{margin.toFixed(0)}% margen
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              product.stock > 10 
                                ? 'bg-green-100 text-green-800' 
                                : product.stock > 5 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-red-100 text-red-800'
                            }`}>
                              Stock: {product.stock}
                            </span>
                            
                            {product.category && (
                              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                                {product.category.name}
                              </span>
                            )}
                            
                            {product.has_imei_serial && (
                              <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                                <Hash className="h-3 w-3 inline mr-1" />
                                {product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {isInCart ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateCartQuantity(product.id, cartItem!.quantity - 1);
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-8 text-center font-medium">{cartItem?.quantity}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateCartQuantity(product.id, cartItem!.quantity + 1);
                              }}
                              disabled={cartItem!.quantity >= product.stock}
                              className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                  placeholder="Buscar cliente por nombre, teléfono o cédula..."
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
                        // Cargar historial del cliente
                        const customerSales = recentSales.filter(sale => sale.customer_id === customer.id);
                        setCustomerHistory(customerSales);
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
                      {customerHistory.length > 0 && (
                        <p className="text-xs text-blue-600">
                          {customerHistory.length} compras anteriores
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerHistory([]);
                      }}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Carrito de Compras ({cart.length})
              </h3>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Limpiar
                </button>
              )}
            </div>
            
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">El carrito está vacío</p>
                <p className="text-xs text-slate-400 mt-1">
                  Agrega productos haciendo clic en ellos
                </p>
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
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Pago Inteligente</h3>
              
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

                {/* Descuentos Rápidos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Descuento
                    </label>
                    <div className="flex gap-1">
                      {quickDiscounts.map(percentage => (
                        <button
                          key={percentage}
                          onClick={() => applyQuickDiscount(percentage)}
                          className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded hover:bg-orange-200 transition-colors duration-200"
                        >
                          {percentage}%
                        </button>
                      ))}
                    </div>
                  </div>
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
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Monto Recibido
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAmountReceived(calculateTotal().toString())}
                          className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200 transition-colors duration-200"
                        >
                          Exacto
                        </button>
                        <button
                          onClick={() => {
                            const total = calculateTotal();
                            const roundedUp = Math.ceil(total / 1000) * 1000;
                            setAmountReceived(roundedUp.toString());
                          }}
                          className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 transition-colors duration-200"
                        >
                          Redondear
                        </button>
                      </div>
                    </div>
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

                  {/* Análisis de Ganancia */}
                  {smartPricing && cart.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-700">Ganancia estimada:</span>
                        <span className="font-bold text-blue-900">
                          {formatCurrency(cart.reduce((sum, item) => {
                            const profit = (item.product.sale_price - (item.product.purchase_price || 0)) * item.quantity;
                            return sum + profit;
                          }, 0))}
                        </span>
                      </div>
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
                    <h4 className="font-medium text-blue-900 mb-2">Recomendaciones Inteligentes:</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Contacta a los proveedores para reabastecer automáticamente</li>
                      <li>• Revisa productos similares disponibles en el inventario</li>
                      <li>• Considera ajustar precios de productos relacionados</li>
                      <li>• Notifica a clientes frecuentes cuando llegue nuevo stock</li>
                      <li>• Analiza patrones de venta para mejorar predicciones de stock</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-200">
              <div className="flex gap-3">
                <button
                  onClick={() => {
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