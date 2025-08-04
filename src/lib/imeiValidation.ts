// Utilidades para validación de IMEI y prevención de duplicados

import { supabase, isDemoMode } from './supabase';

export interface ImeiValidationResult {
  isValid: boolean;
  isDuplicate: boolean;
  error?: string;
  existingProductId?: string;
  existingProductName?: string;
}

export interface BulkImeiValidationResult {
  validImeis: string[];
  duplicateImeis: Array<{
    imei: string;
    existingProductId: string;
    existingProductName: string;
  }>;
  invalidImeis: Array<{
    imei: string;
    error: string;
  }>;
}

// Validar formato de IMEI
export const validateImeiFormat = (imei: string): { isValid: boolean; error?: string } => {
  if (!imei || typeof imei !== 'string') {
    return { isValid: false, error: 'IMEI es requerido' };
  }

  const cleanImei = imei.trim();

  // IMEI debe tener exactamente 15 dígitos
  if (cleanImei.length !== 15) {
    return { isValid: false, error: 'IMEI debe tener exactamente 15 dígitos' };
  }

  // IMEI debe contener solo números
  if (!/^\d{15}$/.test(cleanImei)) {
    return { isValid: false, error: 'IMEI debe contener solo números' };
  }

  // Validar algoritmo de Luhn para IMEI (opcional pero recomendado)
  if (!validateImeiLuhn(cleanImei)) {
    return { isValid: false, error: 'IMEI no tiene un formato válido (falla verificación Luhn)' };
  }

  return { isValid: true };
};

// Algoritmo de Luhn para validar IMEI
const validateImeiLuhn = (imei: string): boolean => {
  // Tomar los primeros 14 dígitos para calcular el dígito de verificación
  const digits = imei.slice(0, 14).split('').map(Number);
  let sum = 0;

  for (let i = 0; i < digits.length; i++) {
    let digit = digits[i];
    
    // Duplicar cada segundo dígito desde la derecha
    if ((digits.length - i) % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10);
      }
    }
    
    sum += digit;
  }

  // El dígito de verificación debe hacer que la suma sea múltiplo de 10
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(imei[14]);
};

// Verificar si un IMEI ya existe en la base de datos
export const checkImeiDuplicate = async (
  imei: string, 
  excludeProductId?: string
): Promise<ImeiValidationResult> => {
  try {
    // Validar formato primero
    const formatValidation = validateImeiFormat(imei);
    if (!formatValidation.isValid) {
      return {
        isValid: false,
        isDuplicate: false,
        error: formatValidation.error
      };
    }

    if (isDemoMode) {
      // En modo demo, simular algunos IMEI duplicados
      const demoExistingImeis = [
        '123456789012345',
        '987654321098765',
        '111111111111111'
      ];
      
      const isDuplicate = demoExistingImeis.includes(imei.trim());
      
      if (isDuplicate) {
        return {
          isValid: false,
          isDuplicate: true,
          error: 'IMEI ya existe en el sistema',
          existingProductId: 'demo-product-existing',
          existingProductName: 'Producto Demo Existente'
        };
      }
      
      return {
        isValid: true,
        isDuplicate: false
      };
    }

    if (!supabase) {
      return {
        isValid: true,
        isDuplicate: false
      };
    }

    // Buscar IMEI en la base de datos
    let query = supabase
      .from('product_imei_serials')
      .select(`
        id,
        product_id,
        imei_number,
        product:products(id, name)
      `)
      .eq('imei_number', imei.trim());

    // Excluir producto específico si se proporciona (para ediciones)
    if (excludeProductId) {
      query = query.neq('product_id', excludeProductId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      console.error('Error checking IMEI duplicate:', error);
      return {
        isValid: false,
        isDuplicate: false,
        error: 'Error al verificar IMEI en la base de datos'
      };
    }

    if (data && data.length > 0) {
      const existingRecord = data[0];
      return {
        isValid: false,
        isDuplicate: true,
        error: `IMEI ya existe en el producto: ${existingRecord.product?.name || 'Producto desconocido'}`,
        existingProductId: existingRecord.product_id,
        existingProductName: existingRecord.product?.name || 'Producto desconocido'
      };
    }

    return {
      isValid: true,
      isDuplicate: false
    };

  } catch (error) {
    console.error('Error in IMEI duplicate check:', error);
    return {
      isValid: false,
      isDuplicate: false,
      error: 'Error interno al verificar IMEI'
    };
  }
};

// Validar múltiples IMEIs para importación masiva
export const validateBulkImeis = async (
  imeis: string[],
  excludeProductId?: string
): Promise<BulkImeiValidationResult> => {
  const validImeis: string[] = [];
  const duplicateImeis: Array<{
    imei: string;
    existingProductId: string;
    existingProductName: string;
  }> = [];
  const invalidImeis: Array<{
    imei: string;
    error: string;
  }> = [];

  // Verificar duplicados internos en el lote
  const imeiCounts = new Map<string, number>();
  const cleanImeis = imeis.map(imei => imei.trim()).filter(imei => imei.length > 0);

  // Contar ocurrencias de cada IMEI en el lote
  cleanImeis.forEach(imei => {
    imeiCounts.set(imei, (imeiCounts.get(imei) || 0) + 1);
  });

  // Verificar cada IMEI único
  const uniqueImeis = Array.from(imeiCounts.keys());
  
  for (const imei of uniqueImeis) {
    // Verificar duplicados internos en el lote
    if (imeiCounts.get(imei)! > 1) {
      invalidImeis.push({
        imei,
        error: `IMEI duplicado ${imeiCounts.get(imei)} veces en el lote`
      });
      continue;
    }

    // Verificar formato y duplicados en base de datos
    const validation = await checkImeiDuplicate(imei, excludeProductId);
    
    if (!validation.isValid) {
      if (validation.isDuplicate) {
        duplicateImeis.push({
          imei,
          existingProductId: validation.existingProductId!,
          existingProductName: validation.existingProductName!
        });
      } else {
        invalidImeis.push({
          imei,
          error: validation.error || 'IMEI inválido'
        });
      }
    } else {
      validImeis.push(imei);
    }
  }

  return {
    validImeis,
    duplicateImeis,
    invalidImeis
  };
};

// Validar lista de números de serie (similar a IMEI pero menos estricto)
export const validateSerialNumber = (serial: string): { isValid: boolean; error?: string } => {
  if (!serial || typeof serial !== 'string') {
    return { isValid: false, error: 'Número de serie es requerido' };
  }

  const cleanSerial = serial.trim();

  // Número de serie debe tener al menos 3 caracteres
  if (cleanSerial.length < 3) {
    return { isValid: false, error: 'Número de serie debe tener al menos 3 caracteres' };
  }

  // Número de serie no debe exceder 50 caracteres
  if (cleanSerial.length > 50) {
    return { isValid: false, error: 'Número de serie no puede exceder 50 caracteres' };
  }

  // Permitir letras, números, guiones y algunos símbolos
  if (!/^[A-Za-z0-9\-_\.]+$/.test(cleanSerial)) {
    return { isValid: false, error: 'Número de serie contiene caracteres no válidos' };
  }

  return { isValid: true };
};

// Verificar duplicados de números de serie
export const checkSerialDuplicate = async (
  serial: string,
  excludeProductId?: string
): Promise<ImeiValidationResult> => {
  try {
    // Validar formato primero
    const formatValidation = validateSerialNumber(serial);
    if (!formatValidation.isValid) {
      return {
        isValid: false,
        isDuplicate: false,
        error: formatValidation.error
      };
    }

    if (isDemoMode) {
      // En modo demo, simular algunos seriales duplicados
      const demoExistingSerials = [
        'SN123456789',
        'ABC123DEF456',
        'SERIAL001'
      ];
      
      const isDuplicate = demoExistingSerials.includes(serial.trim());
      
      if (isDuplicate) {
        return {
          isValid: false,
          isDuplicate: true,
          error: 'Número de serie ya existe en el sistema',
          existingProductId: 'demo-product-existing',
          existingProductName: 'Producto Demo Existente'
        };
      }
      
      return {
        isValid: true,
        isDuplicate: false
      };
    }

    if (!supabase) {
      return {
        isValid: true,
        isDuplicate: false
      };
    }

    // Buscar número de serie en la base de datos
    let query = supabase
      .from('product_imei_serials')
      .select(`
        id,
        product_id,
        serial_number,
        product:products(id, name)
      `)
      .eq('serial_number', serial.trim());

    // Excluir producto específico si se proporciona
    if (excludeProductId) {
      query = query.neq('product_id', excludeProductId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      console.error('Error checking serial duplicate:', error);
      return {
        isValid: false,
        isDuplicate: false,
        error: 'Error al verificar número de serie en la base de datos'
      };
    }

    if (data && data.length > 0) {
      const existingRecord = data[0];
      return {
        isValid: false,
        isDuplicate: true,
        error: `Número de serie ya existe en el producto: ${existingRecord.product?.name || 'Producto desconocido'}`,
        existingProductId: existingRecord.product_id,
        existingProductName: existingRecord.product?.name || 'Producto desconocido'
      };
    }

    return {
      isValid: true,
      isDuplicate: false
    };

  } catch (error) {
    console.error('Error in serial duplicate check:', error);
    return {
      isValid: false,
      isDuplicate: false,
      error: 'Error interno al verificar número de serie'
    };
  }
};

// Función para limpiar y normalizar IMEI
export const normalizeImei = (imei: string): string => {
  return imei.replace(/\D/g, '').trim();
};

// Función para limpiar y normalizar número de serie
export const normalizeSerial = (serial: string): string => {
  return serial.trim().toUpperCase();
};

// Validar IMEI/Serial según el tipo de producto
export const validateImeiSerial = async (
  value: string,
  type: 'imei' | 'serial' | 'both',
  field: 'imei' | 'serial',
  excludeProductId?: string
): Promise<ImeiValidationResult> => {
  if (field === 'imei') {
    return await checkImeiDuplicate(normalizeImei(value), excludeProductId);
  } else {
    return await checkSerialDuplicate(normalizeSerial(value), excludeProductId);
  }
};

// Función para procesar y validar IMEI/Serial en lotes
export const processBulkImeiSerials = async (
  items: Array<{
    imei_number?: string;
    serial_number?: string;
    product_name: string;
  }>,
  excludeProductId?: string
): Promise<{
  validItems: typeof items;
  rejectedItems: Array<{
    item: typeof items[0];
    reason: string;
  }>;
}> => {
  const validItems: typeof items = [];
  const rejectedItems: Array<{
    item: typeof items[0];
    reason: string;
  }> = [];

  // Verificar duplicados internos en el lote
  const imeiMap = new Map<string, string>();
  const serialMap = new Map<string, string>();

  for (const item of items) {
    let hasError = false;
    let errorReason = '';

    // Verificar IMEI si está presente
    if (item.imei_number) {
      const normalizedImei = normalizeImei(item.imei_number);
      
      // Verificar duplicado interno en el lote
      if (imeiMap.has(normalizedImei)) {
        hasError = true;
        errorReason = `IMEI ${normalizedImei} duplicado en el lote (también en producto: ${imeiMap.get(normalizedImei)})`;
      } else {
        // Verificar en base de datos
        const validation = await checkImeiDuplicate(normalizedImei, excludeProductId);
        if (!validation.isValid) {
          hasError = true;
          errorReason = validation.error || 'IMEI inválido';
        } else {
          imeiMap.set(normalizedImei, item.product_name);
        }
      }
    }

    // Verificar Serial si está presente
    if (!hasError && item.serial_number) {
      const normalizedSerial = normalizeSerial(item.serial_number);
      
      // Verificar duplicado interno en el lote
      if (serialMap.has(normalizedSerial)) {
        hasError = true;
        errorReason = `Número de serie ${normalizedSerial} duplicado en el lote (también en producto: ${serialMap.get(normalizedSerial)})`;
      } else {
        // Verificar en base de datos
        const validation = await checkSerialDuplicate(normalizedSerial, excludeProductId);
        if (!validation.isValid) {
          hasError = true;
          errorReason = validation.error || 'Número de serie inválido';
        } else {
          serialMap.set(normalizedSerial, item.product_name);
        }
      }
    }

    if (hasError) {
      rejectedItems.push({
        item,
        reason: errorReason
      });
    } else {
      validItems.push(item);
    }
  }

  return {
    validItems,
    rejectedItems
  };
};

// Hook para validación en tiempo real de IMEI
export const useImeiValidation = () => {
  const [validationCache, setValidationCache] = React.useState<Map<string, ImeiValidationResult>>(new Map());

  const validateImei = React.useCallback(async (
    imei: string,
    excludeProductId?: string
  ): Promise<ImeiValidationResult> => {
    const cacheKey = `${imei}_${excludeProductId || 'new'}`;
    
    // Verificar cache primero
    if (validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey)!;
    }

    const result = await checkImeiDuplicate(imei, excludeProductId);
    
    // Guardar en cache por 5 minutos
    setValidationCache(prev => {
      const newCache = new Map(prev);
      newCache.set(cacheKey, result);
      
      // Limpiar cache viejo (mantener solo últimas 50 entradas)
      if (newCache.size > 50) {
        const firstKey = newCache.keys().next().value;
        newCache.delete(firstKey);
      }
      
      return newCache;
    });

    return result;
  }, [validationCache]);

  const clearCache = React.useCallback(() => {
    setValidationCache(new Map());
  }, []);

  return {
    validateImei,
    clearCache
  };
};

// Función para generar IMEI de prueba válido (solo para desarrollo/demo)
export const generateTestImei = (): string => {
  // Generar 14 dígitos aleatorios
  let imei = '';
  for (let i = 0; i < 14; i++) {
    imei += Math.floor(Math.random() * 10).toString();
  }
  
  // Calcular dígito de verificación usando algoritmo de Luhn
  const digits = imei.split('').map(Number);
  let sum = 0;

  for (let i = 0; i < digits.length; i++) {
    let digit = digits[i];
    
    if ((digits.length - i) % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10);
      }
    }
    
    sum += digit;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return imei + checkDigit.toString();
};

// Función para generar número de serie único
export const generateTestSerial = (prefix: string = 'SN'): string => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
};