import React from 'react';
import { X, Package, Barcode, DollarSign, Calendar, User, Building2 } from 'lucide-react';
import type { Product, Category, Supplier } from '../lib/types';

interface ProductDetailsModalProps {
  product: Product & {
    category?: Category;
    supplier?: Supplier;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function ProductDetailsModal({ product, isOpen, onClose }: ProductDetailsModalProps) {
  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Package className="w-5 h-5 mr-2 text-blue-600" />
            Detalles del Producto
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Información Básica</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <p className="mt-1 text-sm text-gray-900 font-medium">{product.name}</p>
                </div>
                
                {product.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Descripción</label>
                    <p className="mt-1 text-sm text-gray-600">{product.description}</p>
                  </div>
                )}

                {product.barcode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 flex items-center">
                      <Barcode className="w-4 h-4 mr-1" />
                      Código de Barras
                    </label>
                    <p className="mt-1 text-sm text-gray-900 font-mono">{product.barcode}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Precios e Inventario</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 flex items-center">
                    <DollarSign className="w-4 h-4 mr-1" />
                    Precio de Venta
                  </label>
                  <p className="mt-1 text-lg font-semibold text-green-600">
                    {formatCurrency(product.sale_price)}
                  </p>
                </div>

                {product.purchase_price && product.purchase_price > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Precio de Compra</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {formatCurrency(product.purchase_price)}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">Stock Disponible</label>
                  <p className={`mt-1 text-lg font-semibold ${
                    product.stock > 10 ? 'text-green-600' : 
                    product.stock > 0 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {product.stock} unidades
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Category and Supplier */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {product.category && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Categoría</label>
                <p className="mt-1 text-sm text-gray-900">{product.category.name}</p>
                {product.category.description && (
                  <p className="text-xs text-gray-500">{product.category.description}</p>
                )}
              </div>
            )}

            {product.supplier && (
              <div>
                <label className="block text-sm font-medium text-gray-700 flex items-center">
                  <Building2 className="w-4 h-4 mr-1" />
                  Proveedor
                </label>
                <p className="mt-1 text-sm text-gray-900">{product.supplier.name}</p>
                {product.supplier.contact_person && (
                  <p className="text-xs text-gray-500">Contacto: {product.supplier.contact_person}</p>
                )}
              </div>
            )}
          </div>

          {/* IMEI/Serial Information */}
          {product.has_imei_serial && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Información IMEI/Serial
              </h3>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo</label>
                    <p className="mt-1 text-sm text-gray-900 capitalize">
                      {product.imei_serial_type}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Requerido</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {product.requires_imei_serial ? 'Sí' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Import Information */}
          {product.bulk_import_batch && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Información de Importación
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lote de Importación</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{product.bulk_import_batch}</p>
                </div>
                
                {product.imported_at && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      Fecha de Importación
                    </label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(product.imported_at)}</p>
                  </div>
                )}

                {product.import_notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Notas de Importación</label>
                    <p className="mt-1 text-sm text-gray-600">{product.import_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Información del Sistema</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Fecha de Creación
                </label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(product.created_at)}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">ID del Producto</label>
                <p className="mt-1 text-xs text-gray-500 font-mono">{product.id}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}