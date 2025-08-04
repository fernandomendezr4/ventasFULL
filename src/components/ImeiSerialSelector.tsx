import React, { useState, useEffect } from 'react';
import { Hash, Check, X, AlertTriangle, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProductImeiSerial } from '../lib/types';
import { validateImeiFormat, validateSerialNumber } from '../lib/imeiValidation';

interface ImeiSerialSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selectedImeiSerials: ProductImeiSerial[]) => void;
  productId: string;
  productName: string;
  requiredQuantity: number;
  imeiSerialType: 'imei' | 'serial' | 'both';
}

export default function ImeiSerialSelector({
  isOpen,
  onClose,
  onSelect,
  productId,
  productName,
  requiredQuantity,
  imeiSerialType
}: ImeiSerialSelectorProps) {
  const [availableImeiSerials, setAvailableImeiSerials] = useState<ProductImeiSerial[]>([]);
  const [selectedImeiSerials, setSelectedImeiSerials] = useState<ProductImeiSerial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAvailableImeiSerials();
      setSelectedImeiSerials([]);
    }
  }, [isOpen, productId]);

  if (!isOpen) return null;

  const loadAvailableImeiSerials = async () => {
    try {
      setLoading(true);
      
      if (!supabase) {
        // Modo demo - generar datos de ejemplo
        const demoImeiSerials: ProductImeiSerial[] = Array.from({ length: Math.max(5, requiredQuantity + 2) }, (_, i) => ({
          id: `demo-imei-${i}`,
          product_id: productId,
          imei_number: imeiSerialType === 'imei' || imeiSerialType === 'both' 
            ? `12345678901234${i.toString().padStart(1, '0')}` : '',
          serial_number: imeiSerialType === 'serial' || imeiSerialType === 'both' 
            ? `SN${productName.substring(0, 3).toUpperCase()}${i.toString().padStart(3, '0')}` : '',
          status: 'available' as const,
          sale_id: null,
          sale_item_id: null,
          sold_at: null,
          notes: `Unidad demo ${i + 1} - ${productName}`,
          created_at: new Date().toISOString(),
          created_by: null,
          updated_at: new Date().toISOString(),
          updated_by: null
        }));
        
        setAvailableImeiSerials(demoImeiSerials);
        setLoading(false);
        return;
      }

      // Cargar solo IMEI/Serial disponibles (no vendidos, no reservados por mucho tiempo)
      let query = supabase
        .from('product_imei_serials')
        .select('*')
        .eq('product_id', productId)
        .in('status', ['available']);

      // También incluir reservados que sean muy recientes (menos de 5 minutos)
      // para evitar problemas de concurrencia
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: availableData, error: availableError } = await query.order('created_at', { ascending: true });
      
      if (availableError) throw availableError;
      
      // Filtrar reservados antiguos
      const filteredData = (availableData || []).filter(item => {
        if (item.status === 'available') return true;
        if (item.status === 'reserved') {
          return new Date(item.updated_at || item.created_at) > new Date(fiveMinutesAgo);
        }
        return false;
      });
      // Filtrar por tipo si es necesario
      if (imeiSerialType === 'imei') {
        const imeiFiltered = filteredData.filter(item => 
          item.imei_number && item.imei_number.trim() !== ''
        );
        setAvailableImeiSerials(imeiFiltered);
      } else if (imeiSerialType === 'serial') {
        const serialFiltered = filteredData.filter(item => 
          item.serial_number && item.serial_number.trim() !== ''
        );
        setAvailableImeiSerials(serialFiltered);
      } else {
        // both - debe tener al menos uno de los dos
        const bothFiltered = filteredData.filter(item => 
          (item.imei_number && item.imei_number.trim() !== '') ||
          (item.serial_number && item.serial_number.trim() !== '')
        );
        setAvailableImeiSerials(bothFiltered);
      }

      // Filtrar elementos con formato válido
      const validImeiSerials = filteredData.filter(item => {
        if (imeiSerialType === 'imei' && item.imei_number) {
          return validateImeiFormat(item.imei_number).isValid;
        } else if (imeiSerialType === 'serial' && item.serial_number) {
          return validateSerialNumber(item.serial_number).isValid;
        } else if (imeiSerialType === 'both') {
          const imeiValid = !item.imei_number || validateImeiFormat(item.imei_number).isValid;
          const serialValid = !item.serial_number || validateSerialNumber(item.serial_number).isValid;
          return imeiValid && serialValid && (item.imei_number || item.serial_number);
        }
        return false;
      });
      
      setAvailableImeiSerials(validImeiSerials);
    } catch (error) {
      console.error('Error loading available IMEI/Serial:', error);
      setAvailableImeiSerials([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelection = (imeiSerial: ProductImeiSerial) => {
    const isSelected = selectedImeiSerials.some(item => item.id === imeiSerial.id);
    
    if (isSelected) {
      setSelectedImeiSerials(prev => prev.filter(item => item.id !== imeiSerial.id));
    } else {
      if (selectedImeiSerials.length < requiredQuantity) {
        setSelectedImeiSerials(prev => [...prev, imeiSerial]);
      }
    }
  };

  const handleConfirm = () => {
    if (selectedImeiSerials.length !== requiredQuantity) {
      alert(`Debe seleccionar exactamente ${requiredQuantity} unidad${requiredQuantity > 1 ? 'es' : ''} para completar la venta`);
      return;
    }
    
    // Validación adicional antes de confirmar
    const invalidSelections = selectedImeiSerials.filter(item => {
      if (imeiSerialType === 'imei' && item.imei_number) {
        return !validateImeiFormat(item.imei_number).isValid;
      } else if (imeiSerialType === 'serial' && item.serial_number) {
        return !validateSerialNumber(item.serial_number).isValid;
      }
      return false;
    });
    
    if (invalidSelections.length > 0) {
      alert('Algunas selecciones tienen formato inválido. Por favor, actualice la página y vuelva a intentar.');
      return;
    }

    // Verificar que no haya duplicados en la selección
    const imeiNumbers = selectedImeiSerials.map(item => item.imei_number).filter(Boolean);
    const serialNumbers = selectedImeiSerials.map(item => item.serial_number).filter(Boolean);
    
    const uniqueImeis = new Set(imeiNumbers);
    const uniqueSerials = new Set(serialNumbers);
    
    if (imeiNumbers.length !== uniqueImeis.size || serialNumbers.length !== uniqueSerials.size) {
      alert('Error: Se detectaron duplicados en la selección. Por favor, verifique su selección.');
      return;
    }
    
    onSelect(selectedImeiSerials);
    onClose();
  };

  const filteredImeiSerials = availableImeiSerials.filter(item => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      item.imei_number.includes(searchTerm) ||
      item.serial_number.includes(searchTerm) ||
      item.notes.toLowerCase().includes(searchLower)
    );
  });

  const getDisplayText = (item: ProductImeiSerial) => {
    if (imeiSerialType === 'imei') {
      return item.imei_number;
    } else if (imeiSerialType === 'serial') {
      return item.serial_number;
    } else {
      // both
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
                Seleccionar {imeiSerialType === 'imei' ? 'IMEI' : 
                           imeiSerialType === 'serial' ? 'Números de Serie' : 'IMEI/Serial'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Producto: {productName} • Cantidad requerida: {requiredQuantity}
              </p>
              <p className="text-sm text-slate-500">
                Seleccionados: {selectedImeiSerials.length} de {requiredQuantity}
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
          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder={`Buscar por ${imeiSerialType === 'imei' ? 'IMEI' : 
                                       imeiSerialType === 'serial' ? 'número de serie' : 'IMEI o serial'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Package className="h-5 w-5 text-blue-600 mr-2" />
                <span className="font-medium text-blue-900">
                  Unidades disponibles: {filteredImeiSerials.length}
                </span>
              </div>
              <div className="text-sm text-blue-700">
                {selectedImeiSerials.length === requiredQuantity ? (
                  <span className="flex items-center text-green-600">
                    <Check className="h-4 w-4 mr-1" />
                    Selección completa
                  </span>
                ) : (
                  <span className="flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Seleccionadas: {selectedImeiSerials.length} de {requiredQuantity}
                  </span>
                )}
              </div>
            </div>
            
            {/* Barra de progreso */}
            <div className="mt-3">
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(selectedImeiSerials.length / requiredQuantity) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* IMEI/Serial List */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Cargando unidades disponibles...</p>
            </div>
          ) : filteredImeiSerials.length === 0 ? (
            <div className="text-center py-12">
              <Hash className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">
                {availableImeiSerials.length === 0 
                  ? `No hay unidades disponibles para este producto. Verifique el stock de ${imeiSerialType === 'imei' ? 'IMEI' : imeiSerialType === 'serial' ? 'números de serie' : 'IMEI/Serial'} válidos.`
                  : 'No se encontraron unidades que coincidan con la búsqueda'}
              </p>
              {availableImeiSerials.length === 0 && (
                <p className="text-sm text-slate-400 mt-2">
                  Debe agregar {imeiSerialType === 'imei' ? 'códigos IMEI válidos' : imeiSerialType === 'serial' ? 'números de serie válidos' : 'códigos IMEI/Serial válidos'} en la gestión de productos antes de poder vender este artículo.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredImeiSerials.map((item) => {
                const isSelected = selectedImeiSerials.some(selected => selected.id === item.id);
                const canSelect = !isSelected && selectedImeiSerials.length < requiredQuantity;
                
                return (
                  <div
                    key={item.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-green-500 bg-green-50'
                        : canSelect
                          ? 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                          : 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-50'
                    }`}
                    onClick={() => canSelect || isSelected ? handleToggleSelection(item) : null}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <Hash className={`h-4 w-4 mr-2 ${
                          isSelected ? 'text-green-600' : 'text-slate-600'
                        }`} />
                        <span className="font-medium text-slate-900">
                          {imeiSerialType === 'imei' ? 'IMEI' : 
                           imeiSerialType === 'serial' ? 'Serial' : 'IMEI/Serial'}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {(imeiSerialType === 'imei' || imeiSerialType === 'both') && item.imei_number && (
                        <div>
                          <label className="text-xs text-slate-500">IMEI:</label>
                          <p className="font-mono text-sm text-slate-900">{item.imei_number}</p>
                          {!validateImeiFormat(item.imei_number).isValid && (
                            <p className="text-xs text-red-600">⚠️ Formato inválido</p>
                          )}
                        </div>
                      )}
                      
                      {(imeiSerialType === 'serial' || imeiSerialType === 'both') && item.serial_number && (
                        <div>
                          <label className="text-xs text-slate-500">Serial:</label>
                          <p className="font-mono text-sm text-slate-900">{item.serial_number}</p>
                          {!validateSerialNumber(item.serial_number).isValid && (
                            <p className="text-xs text-red-600">⚠️ Formato inválido</p>
                          )}
                        </div>
                      )}
                      
                      {item.notes && (
                        <div>
                          <label className="text-xs text-slate-500">Notas:</label>
                          <p className="text-sm text-slate-600">{item.notes}</p>
                        </div>
                      )}
                      
                      <div className="text-xs text-slate-400">
                        Registrado: {new Date(item.created_at).toLocaleDateString('es-ES')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {selectedImeiSerials.length > 0 && (
              <div className="max-w-md">
                <p className="font-medium mb-1">Unidades seleccionadas:</p>
                <div className="text-xs space-y-1 max-h-20 overflow-y-auto">
                  {selectedImeiSerials.map((item, index) => (
                    <div key={item.id} className="bg-green-50 px-2 py-1 rounded border border-green-200">
                      {index + 1}. {getDisplayText(item)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Advertencia sobre validación */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-blue-600 mr-2" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium">Validación Automática Activa</p>
                  <p>Solo se muestran IMEI/Serial con formato válido y sin duplicados. Los elementos inválidos se filtran automáticamente.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedImeiSerials.length !== requiredQuantity}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirmar Selección ({selectedImeiSerials.length}/{requiredQuantity})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}