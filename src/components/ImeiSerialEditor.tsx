import React, { useState, useEffect } from 'react';
import { Hash, Save, X, AlertTriangle, CheckCircle, Smartphone, Search, Plus, Trash2, Edit2 } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { SaleWithItems, ProductImeiSerial } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';

interface ImeiSerialEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  sale: SaleWithItems;
  saleItem: any;
  itemIndex: number;
}

export default function ImeiSerialEditor({ 
  isOpen, 
  onClose, 
  onUpdate, 
  sale, 
  saleItem, 
  itemIndex 
}: ImeiSerialEditorProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [availableImeiSerials, setAvailableImeiSerials] = useState<ProductImeiSerial[]>([]);
  const [currentImeiSerials, setCurrentImeiSerials] = useState<ProductImeiSerial[]>([]);
  const [selectedImeiSerials, setSelectedImeiSerials] = useState<ProductImeiSerial[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAvailable, setShowAvailable] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadImeiSerialData();
    }
  }, [isOpen, saleItem.id]);

  if (!isOpen) return null;

  const loadImeiSerialData = async () => {
    try {
      setLoading(true);

      if (isDemoMode) {
        // Datos demo
        const demoCurrentImeiSerials = saleItem.sale_item_imei_serials || [];
        const demoAvailableImeiSerials = [
          {
            id: 'demo-available-1',
            product_id: saleItem.product.id,
            imei_number: '123456789012345',
            serial_number: 'SN123456',
            status: 'available',
            notes: 'Unidad disponible'
          }
        ];

        setCurrentImeiSerials(demoCurrentImeiSerials);
        setAvailableImeiSerials(demoAvailableImeiSerials);
        setSelectedImeiSerials([]);
        setLoading(false);
        return;
      }

      // Cargar IMEI/Serial actuales de esta venta
      const { data: currentData, error: currentError } = await supabase
        .from('product_imei_serials')
        .select('*')
        .eq('sale_item_id', saleItem.id)
        .eq('sale_id', sale.id);

      if (currentError) throw currentError;

      // Cargar IMEI/Serial disponibles para intercambio
      const { data: availableData, error: availableError } = await supabase
        .from('product_imei_serials')
        .select('*')
        .eq('product_id', saleItem.product.id)
        .eq('status', 'available');

      if (availableError) throw availableError;

      setCurrentImeiSerials(currentData || []);
      setAvailableImeiSerials(availableData || []);
      setSelectedImeiSerials([]);
    } catch (error) {
      console.error('Error loading IMEI/Serial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveImeiSerial = async (imeiSerialId: string) => {
    if (!window.confirm('¿Estás seguro de que quieres quitar este IMEI/Serial de la venta?')) {
      return;
    }

    try {
      if (isDemoMode) {
        alert('Función no disponible en modo demo');
        return;
      }

      // Marcar como disponible nuevamente
      const { error } = await supabase
        .from('product_imei_serials')
        .update({
          status: 'available',
          sale_id: null,
          sale_item_id: null,
          sold_at: null
        })
        .eq('id', imeiSerialId);

      if (error) throw error;

      await loadImeiSerialData();
      alert('IMEI/Serial removido de la venta y marcado como disponible');
    } catch (error) {
      console.error('Error removing IMEI/Serial:', error);
      alert('Error al remover IMEI/Serial: ' + (error as Error).message);
    }
  };

  const handleAddImeiSerial = async (imeiSerialId: string) => {
    try {
      if (isDemoMode) {
        alert('Función no disponible en modo demo');
        return;
      }

      // Marcar como vendido en esta venta
      const { error } = await supabase
        .from('product_imei_serials')
        .update({
          status: 'sold',
          sale_id: sale.id,
          sale_item_id: saleItem.id,
          sold_at: new Date().toISOString()
        })
        .eq('id', imeiSerialId);

      if (error) throw error;

      await loadImeiSerialData();
      setShowAvailable(false);
      alert('IMEI/Serial agregado a la venta exitosamente');
    } catch (error) {
      console.error('Error adding IMEI/Serial:', error);
      alert('Error al agregar IMEI/Serial: ' + (error as Error).message);
    }
  };

  const handleReplaceImeiSerial = async (oldImeiSerialId: string, newImeiSerialId: string) => {
    try {
      if (isDemoMode) {
        alert('Función no disponible en modo demo');
        return;
      }

      // Marcar el anterior como disponible
      const { error: removeError } = await supabase
        .from('product_imei_serials')
        .update({
          status: 'available',
          sale_id: null,
          sale_item_id: null,
          sold_at: null
        })
        .eq('id', oldImeiSerialId);

      if (removeError) throw removeError;

      // Marcar el nuevo como vendido
      const { error: addError } = await supabase
        .from('product_imei_serials')
        .update({
          status: 'sold',
          sale_id: sale.id,
          sale_item_id: saleItem.id,
          sold_at: new Date().toISOString()
        })
        .eq('id', newImeiSerialId);

      if (addError) throw addError;

      await loadImeiSerialData();
      alert('IMEI/Serial reemplazado exitosamente');
    } catch (error) {
      console.error('Error replacing IMEI/Serial:', error);
      alert('Error al reemplazar IMEI/Serial: ' + (error as Error).message);
    }
  };

  const filteredAvailableImeiSerials = availableImeiSerials.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      item.imei_number.includes(searchTerm) ||
      item.serial_number.includes(searchTerm) ||
      item.notes.toLowerCase().includes(searchLower)
    );
  });

  const getDisplayText = (item: ProductImeiSerial) => {
    if (saleItem.product.imei_serial_type === 'imei') {
      return item.imei_number;
    } else if (saleItem.product.imei_serial_type === 'serial') {
      return item.serial_number;
    } else {
      return `${item.imei_number || 'N/A'} / ${item.serial_number || 'N/A'}`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                <Hash className="h-6 w-6 mr-3 text-purple-600" />
                Editar {saleItem.product.imei_serial_type === 'imei' ? 'IMEI' : 
                        saleItem.product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI/Serial'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Producto: {saleItem.product.name} • Venta: #{sale.id.slice(-8)} • Cantidad: {saleItem.quantity}
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
          <div className="space-y-6">
            {/* IMEI/Serial Actuales */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-slate-900">
                  {saleItem.product.imei_serial_type === 'imei' ? 'IMEI' : 
                   saleItem.product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI/Serial'} 
                  Vendidos ({currentImeiSerials.length})
                </h4>
                <button
                  onClick={() => setShowAvailable(!showAvailable)}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center text-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {showAvailable ? 'Ocultar' : 'Agregar/Cambiar'}
                </button>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Cargando datos...</p>
                </div>
              ) : currentImeiSerials.length === 0 ? (
                <div className="text-center py-8 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-600 font-medium">
                    No hay {saleItem.product.imei_serial_type === 'imei' ? 'IMEI' : 
                             saleItem.product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI/Serial'} 
                    registrados para esta venta
                  </p>
                  <p className="text-sm text-red-500 mt-1">
                    Esto puede indicar un error en la venta original
                  </p>
                  <button
                    onClick={() => setShowAvailable(true)}
                    className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
                  >
                    Corregir Ahora
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentImeiSerials.map((item) => (
                    <div key={item.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-mono text-sm text-slate-900 mb-1">
                            {getDisplayText(item)}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-slate-600">{item.notes}</p>
                          )}
                          <div className="flex items-center mt-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              item.status === 'sold' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {item.status === 'sold' ? 'Vendido' : item.status}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveImeiSerial(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          title="Quitar de la venta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* IMEI/Serial Disponibles */}
            {showAvailable && (
              <div className="border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-slate-900">
                    {saleItem.product.imei_serial_type === 'imei' ? 'IMEI' : 
                     saleItem.product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI/Serial'} 
                    Disponibles ({filteredAvailableImeiSerials.length})
                  </h4>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                {filteredAvailableImeiSerials.length === 0 ? (
                  <div className="text-center py-8 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <Smartphone className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                    <p className="text-yellow-600">
                      No hay {saleItem.product.imei_serial_type === 'imei' ? 'IMEI' : 
                               saleItem.product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI/Serial'} 
                      disponibles para este producto
                    </p>
                    <p className="text-sm text-yellow-500 mt-1">
                      Todos están vendidos o no hay stock registrado
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto">
                    {filteredAvailableImeiSerials.map((item) => (
                      <div key={item.id} className="border border-green-200 rounded-lg p-4 bg-green-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-mono text-sm text-slate-900 mb-1">
                              {getDisplayText(item)}
                            </div>
                            {item.notes && (
                              <p className="text-xs text-slate-600">{item.notes}</p>
                            )}
                            <div className="flex items-center mt-2">
                              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                                Disponible
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleAddImeiSerial(item.id)}
                              className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors duration-200 text-xs"
                              title="Agregar a la venta"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            {currentImeiSerials.length > 0 && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleReplaceImeiSerial(e.target.value, item.id);
                                    e.target.value = '';
                                  }
                                }}
                                className="text-xs p-1 border border-slate-300 rounded"
                                title="Reemplazar con este"
                              >
                                <option value="">Reemplazar...</option>
                                {currentImeiSerials.map((current) => (
                                  <option key={current.id} value={current.id}>
                                    {getDisplayText(current)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Información de la Venta */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3">Información de la Venta</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Venta ID:</span>
                  <span className="ml-2 font-mono text-blue-900">#{sale.id.slice(-8)}</span>
                </div>
                <div>
                  <span className="text-blue-700">Fecha:</span>
                  <span className="ml-2 text-blue-900">
                    {new Date(sale.created_at).toLocaleDateString('es-ES')}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Cliente:</span>
                  <span className="ml-2 text-blue-900">{sale.customer?.name || 'Sin cliente'}</span>
                </div>
                <div>
                  <span className="text-blue-700">Vendedor:</span>
                  <span className="ml-2 text-blue-900">{sale.user?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-blue-700">Cantidad vendida:</span>
                  <span className="ml-2 text-blue-900">{saleItem.quantity} unidad{saleItem.quantity > 1 ? 'es' : ''}</span>
                </div>
                <div>
                  <span className="text-blue-700">Registrados:</span>
                  <span className="ml-2 text-blue-900">
                    {currentImeiSerials.length} de {saleItem.quantity}
                  </span>
                  {currentImeiSerials.length !== saleItem.quantity && (
                    <span className="ml-2 text-red-600 text-xs">⚠️ Incompleto</span>
                  )}
                </div>
              </div>
            </div>

            {/* Advertencias */}
            {currentImeiSerials.length !== saleItem.quantity && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Advertencia</h4>
                    <p className="text-sm text-yellow-800">
                      Se vendieron {saleItem.quantity} unidades pero solo hay {currentImeiSerials.length} 
                      {saleItem.product.imei_serial_type === 'imei' ? ' IMEI' : 
                       saleItem.product.imei_serial_type === 'serial' ? ' números de serie' : ' IMEI/Serial'} 
                      registrados. Esto puede causar problemas de inventario.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isDemoMode && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-yellow-600 mr-2" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Modo Demo</h4>
                    <p className="text-sm text-yellow-800">
                      Las modificaciones no se guardarán en modo demo.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-between">
          <div className="text-sm text-slate-600">
            {currentImeiSerials.length === saleItem.quantity ? (
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                <span>Todos los {saleItem.product.imei_serial_type === 'imei' ? 'IMEI' : 
                                 saleItem.product.imei_serial_type === 'serial' ? 'Serial' : 'IMEI/Serial'} 
                están correctamente registrados</span>
              </div>
            ) : (
              <div className="flex items-center text-orange-600">
                <AlertTriangle className="h-4 w-4 mr-1" />
                <span>Faltan {saleItem.quantity - currentImeiSerials.length} registros</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                onUpdate();
                onClose();
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              Guardar Cambios
            </button>
            <button
              onClick={onClose}
              className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}