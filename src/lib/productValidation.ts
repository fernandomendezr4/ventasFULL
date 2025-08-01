// Utilidades de validación para productos

export interface ProductValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
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