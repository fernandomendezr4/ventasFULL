import { useState, useEffect, useCallback } from 'react';
import { ProductFormData, validateProductForm, checkForDuplicates, generateSmartBarcode } from '../lib/productValidation';
import { Category } from '../lib/types';

export function useProductForm(initialData?: Partial<ProductFormData>) {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    sale_price: '',
    purchase_price: '',
    stock: '',
    barcode: '',
    category_id: '',
    supplier_id: '',
    has_imei_serial: false,
    imei_serial_type: 'serial',
    requires_imei_serial: false,
    ...initialData
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [duplicateCheck, setDuplicateCheck] = useState<{
    name: boolean;
    barcode: boolean;
  }>({
    name: false,
    barcode: false
  });
  const [isValidating, setIsValidating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Validar formulario completo
  const validateForm = useCallback(() => {
    const validation = validateProductForm(formData);
    setErrors(validation.errors);
    setWarnings(validation.warnings);
    return validation.isValid;
  }, [formData]);

  // Actualizar campo individual
  const updateField = useCallback((field: keyof ProductFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setIsDirty(true);

    // Limpiar error del campo si existe
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  }, [errors]);

  // Verificar duplicados con debounce
  const checkDuplicates = useCallback(
    debounce(async (field: 'name' | 'barcode', value: string, excludeId?: string) => {
      if (!value.trim()) return;
      
      setIsValidating(true);
      try {
        const isDuplicate = await checkForDuplicates(field, value, excludeId);
        setDuplicateCheck(prev => ({
          ...prev,
          [field]: isDuplicate
        }));
        
        if (isDuplicate) {
          setErrors(prev => ({
            ...prev,
            [field]: field === 'name' 
              ? 'Ya existe un producto con este nombre' 
              : 'Ya existe un producto con este código de barras'
          }));
        }
      } catch (error) {
        console.error('Error checking duplicates:', error);
      } finally {
        setIsValidating(false);
      }
    }, 500),
    []
  );

  // Generar código de barras inteligente
  const generateBarcode = useCallback((categories: Category[]) => {
    const category = categories.find(c => c.id === formData.category_id);
    const barcode = generateSmartBarcode(formData.name, category?.name);
    updateField('barcode', barcode);
  }, [formData.name, formData.category_id, updateField]);

  // Sugerir precio basado en precio de compra
  const suggestPrice = useCallback((marginPercentage: number = 30) => {
    const purchasePrice = parseFloat(formData.purchase_price) || 0;
    if (purchasePrice > 0) {
      const suggestedPrice = Math.round(purchasePrice * (1 + marginPercentage / 100));
      updateField('sale_price', suggestedPrice.toString());
    }
  }, [formData.purchase_price, updateField]);

  // Resetear formulario
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      sale_price: '',
      purchase_price: '',
      stock: '',
      barcode: '',
      category_id: '',
      supplier_id: '',
      has_imei_serial: false,
      imei_serial_type: 'serial',
      requires_imei_serial: false,
      ...initialData
    });
    setErrors({});
    setWarnings({});
    setDuplicateCheck({ name: false, barcode: false });
    setIsDirty(false);
  }, [initialData]);

  // Validar automáticamente cuando cambian los datos
  useEffect(() => {
    if (isDirty) {
      const timeoutId = setTimeout(() => {
        validateForm();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [formData, isDirty, validateForm]);

  return {
    formData,
    errors,
    warnings,
    duplicateCheck,
    isValidating,
    isDirty,
    updateField,
    validateForm,
    checkDuplicates,
    generateBarcode,
    suggestPrice,
    resetForm,
    isValid: Object.keys(errors).length === 0 && !duplicateCheck.name && !duplicateCheck.barcode
  };
}

// Utility function para debounce
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}