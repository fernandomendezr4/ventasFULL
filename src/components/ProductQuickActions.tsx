import React from 'react';
import { Copy, Eye, Package, TrendingUp, Barcode, Smartphone } from 'lucide-react';
import { ProductWithCategory } from '../lib/types';
import { formatCurrency } from '../lib/currency';

interface ProductQuickActionsProps {
  product: ProductWithCategory;
  onDuplicate: (product: ProductWithCategory) => void;
  onViewDetails: (product: ProductWithCategory) => void;
  onQuickEdit: (product: ProductWithCategory, field: string, value: any) => void;
}

export default function ProductQuickActions({ 
  product, 
  onDuplicate, 
  onViewDetails, 
  onQuickEdit 
}: ProductQuickActionsProps) {
  
  const handleStockAdjustment = (adjustment: number) => {
    const newStock = Math.max(0, product.stock + adjustment);
    onQuickEdit(product, 'stock', newStock);
  };
  
  const handlePriceAdjustment = (percentage: number) => {
    const newPrice = Math.round(product.sale_price * (1 + percentage / 100));
    onQuickEdit(product, 'sale_price', newPrice);
  };
  
  return (
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-2">
        <div className="flex flex-col gap-1">
          {/* Ver Detalles */}
          <button
            onClick={() => onViewDetails(product)}
            className="flex items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded transition-colors duration-200"
            title="Ver detalles completos"
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver Detalles
          </button>
          
          {/* Duplicar Producto */}
          <button
            onClick={() => onDuplicate(product)}
            className="flex items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded transition-colors duration-200"
            title="Crear producto similar"
          >
            <Copy className="h-4 w-4 mr-2" />
            Duplicar
          </button>
          
          {/* Ajustes Rápidos de Stock */}
          <div className="border-t border-slate-200 pt-1 mt-1">
            <p className="text-xs text-slate-500 px-3 py-1">Ajustar Stock:</p>
            <div className="flex gap-1 px-2">
              <button
                onClick={() => handleStockAdjustment(-1)}
                disabled={product.stock === 0}
                className="flex-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-200 disabled:opacity-50 transition-colors duration-200"
              >
                -1
              </button>
              <button
                onClick={() => handleStockAdjustment(1)}
                className="flex-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-200 transition-colors duration-200"
              >
                +1
              </button>
              <button
                onClick={() => handleStockAdjustment(10)}
                className="flex-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-200 transition-colors duration-200"
              >
                +10
              </button>
            </div>
          </div>
          
          {/* Ajustes Rápidos de Precio */}
          <div className="border-t border-slate-200 pt-1 mt-1">
            <p className="text-xs text-slate-500 px-3 py-1">Ajustar Precio:</p>
            <div className="flex gap-1 px-2">
              <button
                onClick={() => handlePriceAdjustment(-10)}
                className="flex-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-200 transition-colors duration-200"
              >
                -10%
              </button>
              <button
                onClick={() => handlePriceAdjustment(10)}
                className="flex-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-200 transition-colors duration-200"
              >
                +10%
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}