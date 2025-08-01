import React from 'react';
import { AlertCircle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../lib/currency';

interface ValidationResult {
  isValid: boolean;
  message: string;
  type: 'error' | 'warning' | 'success' | 'info';
}

interface ProductFormValidationProps {
  formData: {
    name: string;
    sale_price: string;
    purchase_price: string;
    stock: string;
    barcode: string;
  };
  errors: Record<string, string>;
  duplicateCheck: {
    name: boolean;
    barcode: boolean;
  };
}

export default function ProductFormValidation({ 
  formData, 
  errors, 
  duplicateCheck 
}: ProductFormValidationProps) {
  
  const validatePricing = (): ValidationResult => {
    const salePrice = parseFloat(formData.sale_price) || 0;
    const purchasePrice = parseFloat(formData.purchase_price) || 0;
    
    if (salePrice === 0 || purchasePrice === 0) {
      return {
        isValid: true,
        message: 'Ingresa ambos precios para ver el análisis de rentabilidad',
        type: 'info'
      };
    }
    
    const profit = salePrice - purchasePrice;
    const margin = (profit / purchasePrice) * 100;
    
    if (profit < 0) {
      return {
        isValid: false,
        message: `Pérdida de ${formatCurrency(Math.abs(profit))} por unidad (${margin.toFixed(1)}%)`,
        type: 'error'
      };
    } else if (margin < 10) {
      return {
        isValid: true,
        message: `Margen bajo: ${formatCurrency(profit)} por unidad (${margin.toFixed(1)}%)`,
        type: 'warning'
      };
    } else if (margin > 100) {
      return {
        isValid: true,
        message: `Margen muy alto: ${formatCurrency(profit)} por unidad (${margin.toFixed(1)}%)`,
        type: 'warning'
      };
    } else {
      return {
        isValid: true,
        message: `Ganancia saludable: ${formatCurrency(profit)} por unidad (${margin.toFixed(1)}%)`,
        type: 'success'
      };
    }
  };
  
  const validateStock = (): ValidationResult => {
    const stock = parseInt(formData.stock) || 0;
    
    if (stock === 0) {
      return {
        isValid: true,
        message: 'Stock en cero - el producto no estará disponible para venta',
        type: 'warning'
      };
    } else if (stock < 5) {
      return {
        isValid: true,
        message: 'Stock bajo - considera aumentar la cantidad',
        type: 'warning'
      };
    } else if (stock > 1000) {
      return {
        isValid: true,
        message: 'Stock muy alto - verifica que sea correcto',
        type: 'info'
      };
    } else {
      return {
        isValid: true,
        message: `Stock adecuado: ${stock} unidades`,
        type: 'success'
      };
    }
  };
  
  const pricingValidation = validatePricing();
  const stockValidation = validateStock();
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'info':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };
  
  const getTextColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-red-700';
      case 'warning':
        return 'text-yellow-700';
      case 'success':
        return 'text-green-700';
      case 'info':
        return 'text-blue-700';
      default:
        return 'text-slate-700';
    }
  };
  
  const getBgColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };
  
  // Solo mostrar si hay datos relevantes
  const shouldShow = formData.sale_price || formData.purchase_price || formData.stock;
  
  if (!shouldShow) return null;
  
  return (
    <div className="space-y-3">
      {/* Validación de Precios */}
      {(formData.sale_price || formData.purchase_price) && (
        <div className={`p-3 rounded-lg border ${getBgColor(pricingValidation.type)}`}>
          <div className="flex items-center">
            {getIcon(pricingValidation.type)}
            <span className={`ml-2 text-sm font-medium ${getTextColor(pricingValidation.type)}`}>
              {pricingValidation.message}
            </span>
          </div>
        </div>
      )}
      
      {/* Validación de Stock */}
      {formData.stock && (
        <div className={`p-3 rounded-lg border ${getBgColor(stockValidation.type)}`}>
          <div className="flex items-center">
            {getIcon(stockValidation.type)}
            <span className={`ml-2 text-sm font-medium ${getTextColor(stockValidation.type)}`}>
              {stockValidation.message}
            </span>
          </div>
        </div>
      )}
      
      {/* Errores de Duplicados */}
      {(duplicateCheck.name || duplicateCheck.barcode) && (
        <div className="p-3 rounded-lg border bg-red-50 border-red-200">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="ml-2 text-sm font-medium text-red-700">
              {duplicateCheck.name && duplicateCheck.barcode 
                ? 'El nombre y código de barras ya existen'
                : duplicateCheck.name 
                  ? 'El nombre del producto ya existe'
                  : 'El código de barras ya existe'
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
}