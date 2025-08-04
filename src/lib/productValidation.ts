// Utilidades de validación para productos

import { validateImeiFormat, validateSerialNumber } from './imeiValidation';
import { supabase, isDemoMode } from './supabase';

export interface ProductValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export interface StockValidationResult {
  isValid: boolean;
  availableStock: number;
  reservedStock: number;
  availableImeiSerials: number;
  error?: string;
}

export interface SaleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedItems: Array<{
    productId: string;
    quantity: number;
    availableStock: number;
    selectedImeiSerials?: string[];
  }>;
}
export interface ProductFormData {
  name: string;
  description: string;
  sale_price: string;
  purchase_price: string;
  stock: string;
  barcode: string;
  category_id: string;
  supplier_id: string;
  has_imei_serial: boolean;
  imei_serial_type: 'imei' | 'serial' | 'both';
  requires_imei_serial: boolean;
}

// Validaciones específicas por campo
export const validateProductName = (name: string): string => {
  if (!name.trim()) {
    return 'El nombre es requerido';
  }
  if (name.trim().length < 2) {
    return 'El nombre debe tener al menos 2 caracteres';
  }
  if (name.trim().length > 100) {
    return 'El nombre no puede exceder 100 caracteres';
  }
  if (!/^[a-zA-Z0-9\s\-\.\,\(\)\+\&\/]+$/.test(name.trim())) {
    return 'El nombre contiene caracteres no válidos';
  }
  return '';
};

export const validateSalePrice = (price: string): string => {
  const numPrice = parseFloat(price);
  if (!price || isNaN(numPrice)) {
    return 'El precio de venta es requerido';
  }
  if (numPrice <= 0) {
    return 'El precio de venta debe ser mayor a 0';
  }
  if (numPrice > 999999999) {
    return 'El precio de venta es demasiado alto';
  }
  return '';
};

export const validatePurchasePrice = (price: string): string => {
  if (!price) return ''; // Opcional
  
  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) {
    return 'El precio de compra debe ser un número válido';
  }
  if (numPrice < 0) {
    return 'El precio de compra no puede ser negativo';
  }
  if (numPrice > 999999999) {
    return 'El precio de compra es demasiado alto';
  }
  return '';
};

export const validateStock = (stock: string): string => {
  const numStock = parseInt(stock);
  if (!stock || isNaN(numStock)) {
    return 'El stock es requerido';
  }
  if (numStock < 0) {
    return 'El stock no puede ser negativo';
  }
  if (numStock > 999999) {
    return 'El stock es demasiado alto';
  }
  return '';
};

export const validateBarcode = (barcode: string): string => {
  if (!barcode) return ''; // Opcional
  
  if (barcode.length < 8) {
    return 'El código de barras debe tener al menos 8 caracteres';
  }
  if (barcode.length > 50) {
    return 'El código de barras no puede exceder 50 caracteres';
  }
  if (!/^[A-Za-z0-9\-\.\ \$\/\+\%]+$/.test(barcode)) {
    return 'El código de barras contiene caracteres no válidos';
  }
  return '';
};

// Validación avanzada de duplicados con contexto completo
export const validateProductDuplicates = async (
  formData: ProductFormData,
  excludeId?: string
): Promise<{ isValid: boolean; errors: Record<string, string> }> => {
  const errors: Record<string, string> = {};

  if (isDemoMode) {
    // En modo demo, simular algunas validaciones
    const demoExistingNames = ['iPhone 15 Pro', 'Samsung Galaxy S24'];
    const demoExistingBarcodes = ['123456789012', '987654321098'];
    
    if (demoExistingNames.includes(formData.name.trim())) {
      errors.name = 'Ya existe un producto con este nombre en el sistema demo';
    }
    
    if (formData.barcode && demoExistingBarcodes.includes(formData.barcode.trim())) {
      errors.barcode = 'Ya existe un producto con este código de barras en el sistema demo';
    }
    
    return { isValid: Object.keys(errors).length === 0, errors };
  }

  if (!supabase) {
    return { isValid: true, errors: {} };
  }

  try {
    // Verificar nombre duplicado
    if (formData.name.trim()) {
      let nameQuery = supabase
        .from('products')
        .select('id, name')
        .ilike('name', formData.name.trim())
        .limit(1);

      if (excludeId) {
        nameQuery = nameQuery.neq('id', excludeId);
      }

      const { data: nameCheck, error: nameError } = await nameQuery;

      if (nameError) {
        console.error('Error checking name duplicate:', nameError);
        errors.name = 'Error al verificar duplicados de nombre';
      } else if (nameCheck && nameCheck.length > 0) {
        errors.name = `Ya existe un producto con el nombre "${formData.name.trim()}"`;
      }
    }

    // Verificar código de barras duplicado
    if (formData.barcode.trim()) {
      let barcodeQuery = supabase
        .from('products')
        .select('id, name, barcode')
        .eq('barcode', formData.barcode.trim())
        .limit(1);

      if (excludeId) {
        barcodeQuery = barcodeQuery.neq('id', excludeId);
      }

      const { data: barcodeCheck, error: barcodeError } = await barcodeQuery;

      if (barcodeError) {
        console.error('Error checking barcode duplicate:', barcodeError);
        errors.barcode = 'Error al verificar duplicados de código de barras';
      } else if (barcodeCheck && barcodeCheck.length > 0) {
        errors.barcode = `El código de barras "${formData.barcode.trim()}" ya está asignado al producto "${barcodeCheck[0].name}"`;
      }
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  } catch (error) {
    console.error('Error in duplicate validation:', error);
    return {
      isValid: false,
      errors: { general: 'Error al validar duplicados en la base de datos' }
    };
  }
};

// Validar stock disponible para venta
export const validateStockAvailability = async (
  productId: string,
  requestedQuantity: number
): Promise<StockValidationResult> => {
  try {
    if (isDemoMode) {
      // Demo mode: simular stock disponible
      return {
        isValid: requestedQuantity <= 10,
        availableStock: 10,
        reservedStock: 0,
        availableImeiSerials: 5,
        error: requestedQuantity > 10 ? 'Stock insuficiente en modo demo' : undefined
      };
    }

    if (!supabase) {
      return {
        isValid: false,
        availableStock: 0,
        reservedStock: 0,
        availableImeiSerials: 0,
        error: 'Sistema de base de datos no disponible'
      };
    }

    // Obtener información del producto
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, stock, has_imei_serial, requires_imei_serial, imei_serial_type')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return {
        isValid: false,
        availableStock: 0,
        reservedStock: 0,
        availableImeiSerials: 0,
        error: 'Producto no encontrado'
      };
    }

    // Para productos con IMEI/Serial requerido, verificar disponibilidad
    if (product.requires_imei_serial) {
      const { data: availableImeiSerials, error: imeiError } = await supabase
        .from('product_imei_serials')
        .select('id')
        .eq('product_id', productId)
        .eq('status', 'available');

      if (imeiError) {
        return {
          isValid: false,
          availableStock: product.stock,
          reservedStock: 0,
          availableImeiSerials: 0,
          error: 'Error al verificar IMEI/Serial disponibles'
        };
      }

      const availableImeiCount = availableImeiSerials?.length || 0;
      
      if (requestedQuantity > availableImeiCount) {
        return {
          isValid: false,
          availableStock: product.stock,
          reservedStock: 0,
          availableImeiSerials: availableImeiCount,
          error: `Solo hay ${availableImeiCount} unidades con ${product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'} disponibles`
        };
      }

      return {
        isValid: true,
        availableStock: product.stock,
        reservedStock: 0,
        availableImeiSerials: availableImeiCount
      };
    } else {
      // Para productos sin IMEI/Serial, verificar stock normal
      if (requestedQuantity > product.stock) {
        return {
          isValid: false,
          availableStock: product.stock,
          reservedStock: 0,
          availableImeiSerials: 0,
          error: `Stock insuficiente. Disponible: ${product.stock}, Solicitado: ${requestedQuantity}`
        };
      }

      return {
        isValid: true,
        availableStock: product.stock,
        reservedStock: 0,
        availableImeiSerials: 0
      };
    }
  } catch (error) {
    console.error('Error validating stock availability:', error);
    return {
      isValid: false,
      availableStock: 0,
      reservedStock: 0,
      availableImeiSerials: 0,
      error: 'Error interno al validar stock'
    };
  }
};

// Validar venta completa antes de procesar
export const validateSaleTransaction = async (
  cartItems: Array<{
    productId: string;
    quantity: number;
    selectedImeiSerials?: string[];
  }>
): Promise<SaleValidationResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validatedItems: Array<{
    productId: string;
    quantity: number;
    availableStock: number;
    selectedImeiSerials?: string[];
  }> = [];

  if (cartItems.length === 0) {
    errors.push('El carrito está vacío');
    return { isValid: false, errors, warnings, validatedItems };
  }

  try {
    for (const item of cartItems) {
      // Validar stock disponible
      const stockValidation = await validateStockAvailability(item.productId, item.quantity);
      
      if (!stockValidation.isValid) {
        errors.push(`Producto ${item.productId.slice(-8)}: ${stockValidation.error}`);
        continue;
      }

      // Obtener información del producto para validaciones adicionales
      if (!isDemoMode && supabase) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, name, requires_imei_serial, imei_serial_type')
          .eq('id', item.productId)
          .single();

        if (productError || !product) {
          errors.push(`Producto ${item.productId.slice(-8)}: No encontrado`);
          continue;
        }

        // Validar IMEI/Serial si es requerido
        if (product.requires_imei_serial) {
          if (!item.selectedImeiSerials || item.selectedImeiSerials.length !== item.quantity) {
            errors.push(`${product.name}: Debe seleccionar ${item.quantity} ${product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'} para completar la venta`);
            continue;
          }

          // Verificar que los IMEI/Serial seleccionados aún estén disponibles
          const { data: imeiCheck, error: imeiError } = await supabase
            .from('product_imei_serials')
            .select('id, status, imei_number, serial_number')
            .in('id', item.selectedImeiSerials)
            .eq('status', 'available');

          if (imeiError) {
            errors.push(`${product.name}: Error al verificar ${product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'}`);
            continue;
          }

          if (!imeiCheck || imeiCheck.length !== item.selectedImeiSerials.length) {
            const unavailableCount = item.selectedImeiSerials.length - (imeiCheck?.length || 0);
            errors.push(`${product.name}: ${unavailableCount} ${product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'} ya no están disponibles`);
            continue;
          }
        }
      }

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        availableStock: stockValidation.availableStock,
        selectedImeiSerials: item.selectedImeiSerials
      });
    }

    // Verificar duplicados en el carrito
    const productCounts = new Map<string, number>();
    cartItems.forEach(item => {
      productCounts.set(item.productId, (productCounts.get(item.productId) || 0) + item.quantity);
    });

    for (const [productId, totalQuantity] of productCounts) {
      if (totalQuantity !== cartItems.filter(item => item.productId === productId).reduce((sum, item) => sum + item.quantity, 0)) {
        warnings.push(`Producto ${productId.slice(-8)}: Cantidad duplicada en el carrito`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedItems
    };
  } catch (error) {
    console.error('Error validating sale transaction:', error);
    return {
      isValid: false,
      errors: ['Error interno al validar la transacción'],
      warnings,
      validatedItems
    };
  }
};

// Verificar integridad de IMEI/Serial antes de venta
export const validateImeiSerialIntegrity = async (
  productId: string,
  selectedImeiSerialIds: string[]
): Promise<{ isValid: boolean; errors: string[]; validIds: string[] }> => {
  const errors: string[] = [];
  const validIds: string[] = [];

  if (isDemoMode) {
    // En modo demo, simular validación exitosa
    return {
      isValid: true,
      errors: [],
      validIds: selectedImeiSerialIds
    };
  }

  if (!supabase) {
    return {
      isValid: false,
      errors: ['Sistema de base de datos no disponible'],
      validIds: []
    };
  }

  try {
    // Verificar que todos los IMEI/Serial existan y estén disponibles
    const { data: imeiSerials, error } = await supabase
      .from('product_imei_serials')
      .select('id, imei_number, serial_number, status, product_id')
      .in('id', selectedImeiSerialIds);

    if (error) {
      return {
        isValid: false,
        errors: ['Error al verificar IMEI/Serial en la base de datos'],
        validIds: []
      };
    }

    if (!imeiSerials || imeiSerials.length !== selectedImeiSerialIds.length) {
      const missingCount = selectedImeiSerialIds.length - (imeiSerials?.length || 0);
      errors.push(`${missingCount} IMEI/Serial no encontrados en la base de datos`);
    }

    for (const imeiSerial of imeiSerials || []) {
      // Verificar que pertenezca al producto correcto
      if (imeiSerial.product_id !== productId) {
        errors.push(`IMEI/Serial ${imeiSerial.imei_number || imeiSerial.serial_number} no pertenece a este producto`);
        continue;
      }

      // Verificar que esté disponible
      if (imeiSerial.status !== 'available') {
        errors.push(`IMEI/Serial ${imeiSerial.imei_number || imeiSerial.serial_number} ya no está disponible (estado: ${imeiSerial.status})`);
        continue;
      }

      validIds.push(imeiSerial.id);
    }

    return {
      isValid: errors.length === 0 && validIds.length === selectedImeiSerialIds.length,
      errors,
      validIds
    };
  } catch (error) {
    console.error('Error validating IMEI/Serial integrity:', error);
    return {
      isValid: false,
      errors: ['Error interno al validar integridad de IMEI/Serial'],
      validIds: []
    };
  }
};

// Reservar temporalmente IMEI/Serial durante el proceso de venta
export const reserveImeiSerials = async (
  imeiSerialIds: string[],
  reservationToken: string
): Promise<{ success: boolean; error?: string }> => {
  if (isDemoMode) {
    return { success: true };
  }

  if (!supabase) {
    return { success: false, error: 'Sistema de base de datos no disponible' };
  }

  try {
    const { error } = await supabase
      .from('product_imei_serials')
      .update({
        status: 'reserved',
        notes: `Reservado temporalmente: ${reservationToken}`,
        updated_at: new Date().toISOString()
      })
      .in('id', imeiSerialIds)
      .eq('status', 'available');

    if (error) {
      console.error('Error reserving IMEI/Serial:', error);
      return { success: false, error: 'Error al reservar IMEI/Serial' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in reserveImeiSerials:', error);
    return { success: false, error: 'Error interno al reservar IMEI/Serial' };
  }
};

// Liberar reservas de IMEI/Serial en caso de error
export const releaseImeiSerialReservations = async (
  reservationToken: string
): Promise<{ success: boolean; error?: string }> => {
  if (isDemoMode) {
    return { success: true };
  }

  if (!supabase) {
    return { success: false, error: 'Sistema de base de datos no disponible' };
  }

  try {
    const { error } = await supabase
      .from('product_imei_serials')
      .update({
        status: 'available',
        notes: '',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'reserved')
      .like('notes', `%${reservationToken}%`);

    if (error) {
      console.error('Error releasing IMEI/Serial reservations:', error);
      return { success: false, error: 'Error al liberar reservas de IMEI/Serial' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in releaseImeiSerialReservations:', error);
    return { success: false, error: 'Error interno al liberar reservas' };
  }
};
// Validación de lógica de negocio
export const validateBusinessLogic = (formData: ProductFormData): Record<string, string> => {
  const warnings: Record<string, string> = {};
  
  const salePrice = parseFloat(formData.sale_price) || 0;
  const purchasePrice = parseFloat(formData.purchase_price) || 0;
  const stock = parseInt(formData.stock) || 0;
  
  // Validar precios lógicos
  if (purchasePrice > 0 && salePrice < purchasePrice) {
    warnings.pricing = 'El precio de venta es menor al precio de compra. Esto resultará en pérdidas.';
  }
  
  // Validar margen de ganancia
  if (purchasePrice > 0 && salePrice > 0) {
    const margin = ((salePrice - purchasePrice) / purchasePrice) * 100;
    if (margin < 5) {
      warnings.margin = 'El margen de ganancia es muy bajo (menos del 5%)';
    } else if (margin > 200) {
      warnings.margin = 'El margen de ganancia es muy alto (más del 200%). Verifica los precios.';
    }
  }
  
  // Validar stock
  if (stock === 0) {
    warnings.stock = 'El producto tendrá stock cero y no estará disponible para venta';
  } else if (stock > 1000) {
    warnings.stock = 'Stock muy alto. Verifica que sea correcto.';
  }
  
  // Validar configuración IMEI/Serial
  if (formData.has_imei_serial && !formData.imei_serial_type) {
    warnings.imei_serial = 'Debe seleccionar el tipo de identificador IMEI/Serial';
  }
  
  // Advertencia sobre productos con IMEI/Serial requerido
  if (formData.has_imei_serial && formData.requires_imei_serial && stock > 0) {
    warnings.imei_serial_stock = `Este producto requiere IMEI/Serial obligatorio. Deberá agregar ${stock} registros IMEI/Serial únicos después de crear el producto.`;
  }
  
  return warnings;
};

// Validación completa del formulario
export const validateProductForm = (formData: ProductFormData): ProductValidationResult => {
  const errors: Record<string, string> = {};
  
  // Validar campos individuales
  const nameError = validateProductName(formData.name);
  if (nameError) errors.name = nameError;
  
  const salePriceError = validateSalePrice(formData.sale_price);
  if (salePriceError) errors.sale_price = salePriceError;
  
  const purchasePriceError = validatePurchasePrice(formData.purchase_price);
  if (purchasePriceError) errors.purchase_price = purchasePriceError;
  
  const stockError = validateStock(formData.stock);
  if (stockError) errors.stock = stockError;
  
  const barcodeError = validateBarcode(formData.barcode);
  if (barcodeError) errors.barcode = barcodeError;
  
  // Validar lógica de negocio
  const warnings = validateBusinessLogic(formData);
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings
  };
};

// Generar sugerencias inteligentes
export const generateProductSuggestions = (formData: ProductFormData) => {
  const suggestions: string[] = [];
  
  const salePrice = parseFloat(formData.sale_price) || 0;
  const purchasePrice = parseFloat(formData.purchase_price) || 0;
  
  // Sugerencias de precio
  if (purchasePrice > 0 && !salePrice) {
    const suggestedPrice = Math.round(purchasePrice * 1.3); // 30% margen
    suggestions.push(`Precio sugerido: ${suggestedPrice.toLocaleString('es-CO')} (30% margen)`);
  }
  
  // Sugerencias de stock
  if (!formData.stock || parseInt(formData.stock) === 0) {
    suggestions.push('Considera agregar stock inicial para que el producto esté disponible');
  }
  
  // Sugerencias de categoría
  if (!formData.category_id) {
    suggestions.push('Asignar una categoría ayuda a organizar mejor el inventario');
  }
  
  // Sugerencias de código de barras
  if (!formData.barcode) {
    suggestions.push('Un código de barras facilita la búsqueda y venta del producto');
  }
  
  return suggestions;
};

// Validar duplicados
export const checkForDuplicates = async (
  field: 'name' | 'barcode',
  value: string,
  excludeId?: string
): Promise<boolean> => {
  if (!value.trim()) return false;
  
  try {
    const { supabase } = await import('./supabase');
    if (!supabase) return false;
    
    let query = supabase.from('products').select('id');
    
    if (field === 'name') {
      query = query.ilike('name', value.trim());
    } else {
      query = query.eq('barcode', value.trim());
    }
    
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    
    const { data, error } = await query.limit(1);
    
    if (error) {
      console.error('Error checking duplicates:', error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error('Error in duplicate check:', error);
    return false;
  }
};

// Limpiar y formatear datos antes de guardar
export const sanitizeProductData = (formData: ProductFormData) => {
  return {
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
    requires_imei_serial: formData.requires_imei_serial,
  };
};

// Generar código de barras inteligente
export const generateSmartBarcode = (
  productName: string,
  categoryName?: string
): string => {
  // Usar las primeras 3 letras de la categoría o del producto
  const prefix = (categoryName || productName)
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  
  // Timestamp de 8 dígitos
  const timestamp = Date.now().toString().slice(-8);
  
  // Número aleatorio de 3 dígitos
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `${prefix.padEnd(3, 'X')}${timestamp}${random}`;
};

// Calcular métricas de rentabilidad
export const calculateProfitMetrics = (salePrice: number, purchasePrice: number, stock: number) => {
  if (salePrice <= 0 || purchasePrice <= 0) {
    return null;
  }
  
  const profit = salePrice - purchasePrice;
  const margin = (profit / purchasePrice) * 100;
  const totalProfit = profit * stock;
  const totalInvestment = purchasePrice * stock;
  const totalValue = salePrice * stock;
  const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
  
  return {
    profit,
    margin,
    totalProfit,
    totalInvestment,
    totalValue,
    roi,
    isHealthy: margin >= 10 && margin <= 100,
    riskLevel: margin < 5 ? 'high' : margin < 15 ? 'medium' : 'low'
  };
};