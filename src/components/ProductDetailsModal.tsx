import React from 'react';
import { X, Package, DollarSign, TrendingUp, Calendar, User, Barcode, Smartphone, Tag, Truck } from 'lucide-react';
import { ProductWithCategory } from '../lib/types';
import { formatCurrency, calculateProfit, calculateProfitMargin } from '../lib/currency';

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductWithCategory | null;
}

export default function ProductDetailsModal({ 
  isOpen, 
  onClose, 
  product 
}: ProductDetailsModalProps) {
  
  if (!isOpen || !product) return null;
  
  const profit = calculateProfit(product.sale_price, product.purchase_price);
  const margin = calculateProfitMargin(product.sale_price, product.purchase_price);
  const totalValue = product.sale_price * product.stock;
  const totalCost = product.purchase_price * product.stock;
  const totalProfit = profit * product.stock;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                <Package className="h-6 w-6 mr-3 text-blue-600" />
                {product.name}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Información completa del producto
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información General */}
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="font-medium text-slate-900 mb-3">Información General</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-600">Nombre:</label>
                    <p className="font-medium text-slate-900">{product.name}</p>
                  </div>
                  
                  {product.description && (
                    <div>
                      <label className="text-sm text-slate-600">Descripción:</label>
                      <p className="text-slate-900">{product.description}</p>
                    </div>
                  )}
                  
                  {product.barcode && (
                    <div>
                      <label className="text-sm text-slate-600 flex items-center">
                        <Barcode className="h-4 w-4 mr-1" />
                        Código de Barras:
                      </label>
                      <p className="font-mono text-slate-900">{product.barcode}</p>
                    </div>
                  )}
                  
                  {product.category && (
                    <div>
                      <label className="text-sm text-slate-600 flex items-center">
                        <Tag className="h-4 w-4 mr-1" />
                        Categoría:
                      </label>
                      <p className="text-slate-900">{product.category.name}</p>
                    </div>
                  )}
                  
                  {product.supplier && (
                    <div>
                      <label className="text-sm text-slate-600 flex items-center">
                        <Truck className="h-4 w-4 mr-1" />
                        Proveedor:
                      </label>
                      <p className="text-slate-900">{product.supplier.name}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm text-slate-600 flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      Fecha de Registro:
                    </label>
                    <p className="text-slate-900">
                      {new Date(product.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Configuración IMEI/Serial */}
              {product.has_imei_serial && (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-3 flex items-center">
                    <Smartphone className="h-4 w-4 mr-2" />
                    Configuración IMEI/Serial
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-purple-700">Tipo:</span>
                      <span className="font-medium text-purple-900">
                        {product.imei_serial_type === 'imei' ? 'Solo IMEI' :
                         product.imei_serial_type === 'serial' ? 'Solo Serial' : 'IMEI y Serial'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Obligatorio:</span>
                      <span className="font-medium text-purple-900">
                        {product.requires_imei_serial ? 'Sí' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Información Financiera */}
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900 mb-3 flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Información Financiera
                </h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-green-700">Precio de Compra:</label>
                      <p className="font-bold text-green-900">{formatCurrency(product.purchase_price)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-green-700">Precio de Venta:</label>
                      <p className="font-bold text-green-900">{formatCurrency(product.sale_price)}</p>
                    </div>
                  </div>
                  
                  {product.purchase_price > 0 && (
                    <>
                      <div className="border-t border-green-200 pt-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm text-green-700">Ganancia por Unidad:</label>
                            <p className={`font-bold ${profit >= 0 ? 'text-green-900' : 'text-red-600'}`}>
                              {formatCurrency(profit)}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm text-green-700">Margen:</label>
                            <p className={`font-bold ${margin >= 0 ? 'text-green-900' : 'text-red-600'}`}>
                              {margin.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border-t border-green-200 pt-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm text-green-700">Inversión Total:</label>
                            <p className="font-bold text-green-900">{formatCurrency(totalCost)}</p>
                          </div>
                          <div>
                            <label className="text-sm text-green-700">Ganancia Potencial:</label>
                            <p className={`font-bold ${totalProfit >= 0 ? 'text-green-900' : 'text-red-600'}`}>
                              {formatCurrency(totalProfit)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Información de Stock */}
              <div className={`p-4 rounded-lg border ${
                product.stock > 10 
                  ? 'bg-green-50 border-green-200' 
                  : product.stock > 0 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : 'bg-red-50 border-red-200'
              }`}>
                <h4 className={`font-medium mb-3 flex items-center ${
                  product.stock > 10 
                    ? 'text-green-900' 
                    : product.stock > 0 
                      ? 'text-yellow-900' 
                      : 'text-red-900'
                }`}>
                  <Package className="h-4 w-4 mr-2" />
                  Información de Stock
                </h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`text-sm ${
                        product.stock > 10 
                          ? 'text-green-700' 
                          : product.stock > 0 
                            ? 'text-yellow-700' 
                            : 'text-red-700'
                      }`}>
                        Stock Actual:
                      </label>
                      <p className={`font-bold text-2xl ${
                        product.stock > 10 
                          ? 'text-green-900' 
                          : product.stock > 0 
                            ? 'text-yellow-900' 
                            : 'text-red-900'
                      }`}>
                        {product.stock}
                      </p>
                    </div>
                    <div>
                      <label className={`text-sm ${
                        product.stock > 10 
                          ? 'text-green-700' 
                          : product.stock > 0 
                            ? 'text-yellow-700' 
                            : 'text-red-700'
                      }`}>
                        Valor Total:
                      </label>
                      <p className={`font-bold text-lg ${
                        product.stock > 10 
                          ? 'text-green-900' 
                          : product.stock > 0 
                            ? 'text-yellow-900' 
                            : 'text-red-900'
                      }`}>
                        {formatCurrency(totalValue)}
                      </p>
                    </div>
                  </div>
                  
                  <div className={`text-sm p-2 rounded ${
                    product.stock === 0 
                      ? 'bg-red-100 text-red-800' 
                      : product.stock <= 5 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-green-100 text-green-800'
                  }`}>
                    {product.stock === 0 
                      ? '⚠️ Producto sin stock - No disponible para venta'
                      : product.stock <= 5 
                        ? '⚠️ Stock bajo - Considera reabastecer pronto'
                        : '✅ Stock adecuado'
                    }
                  </div>
                </div>
              </div>
              
              {/* Información de Importación */}
              {product.bulk_import_batch && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3">Información de Importación</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Lote:</span>
                      <span className="font-mono text-blue-900">{product.bulk_import_batch}</span>
                    </div>
                    {product.imported_at && (
                      <div className="flex justify-between">
                        <span className="text-blue-700">Fecha de Importación:</span>
                        <span className="text-blue-900">
                          {new Date(product.imported_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    )}
                    {product.import_notes && (
                      <div>
                        <label className="text-blue-700">Notas:</label>
                        <p className="text-blue-900">{product.import_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}