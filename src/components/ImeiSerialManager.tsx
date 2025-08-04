import React, { useState, useEffect } from 'react';
import { Hash, Plus, Trash2, Edit2, Save, X, Smartphone, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProductWithCategory, ProductImeiSerial, ImeiSerialData } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { 
  validateImeiFormat, 
  validateSerialNumber, 
  checkImeiDuplicate, 
  checkSerialDuplicate,
  normalizeImei,
  normalizeSerial 
} from '../lib/imeiValidation';

interface ImeiSerialManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  product: ProductWithCategory;
}

export default function ImeiSerialManager({ 
  isOpen, 
  onClose, 
  onUpdate, 
  product 
}: ImeiSerialManagerProps) {
  const { user } = useAuth();
  const [imeiSerials, setImeiSerials] = useState<ProductImeiSerial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductImeiSerial | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formData, setFormData] = useState<ImeiSerialData>({
    imei_number: '',
    serial_number: '',
    notes: ''
  });
  const [bulkAddMode, setBulkAddMode] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (isOpen && product?.id) {
      loadImeiSerials();
    }
  }, [isOpen, product?.id]);

  // Return null after hooks are called
  if (!product) {
    return null;
  }

  if (!isOpen) return null;

  const loadImeiSerials = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_imei_serials')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setImeiSerials(data || []);
    } catch (error) {
      console.error('Error loading IMEI/Serial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Limpiar errores previos
    setValidationErrors({});
    setIsValidating(true);

    try {
      // Validar que al menos uno de los campos esté lleno
      if (!formData.imei_number?.trim() && !formData.serial_number?.trim()) {
        alert('Debe ingresar al menos un IMEI o número de serie');
        return;
      }

      const errors: Record<string, string> = {};

      // Validar IMEI si se proporciona
      if (formData.imei_number?.trim()) {
        const imeiValidation = await checkImeiDuplicate(
          formData.imei_number.trim(), 
          editingItem?.id ? product.id : undefined
        );
        
        if (!imeiValidation.isValid) {
          errors.imei_number = imeiValidation.error || 'IMEI inválido';
        }
      }

      // Validar Serial si se proporciona
      if (formData.serial_number?.trim()) {
        const serialValidation = await checkSerialDuplicate(
          formData.serial_number.trim(),
          editingItem?.id ? product.id : undefined
        );
        
        if (!serialValidation.isValid) {
          errors.serial_number = serialValidation.error || 'Número de serie inválido';
        }
      }

      // Si hay errores de validación, mostrarlos
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      // Validación adicional: verificar que el producto aún existe y es editable
      if (!isDemoMode && supabase) {
        const { data: productCheck, error: productError } = await supabase
          .from('products')
          .select('id, name, has_imei_serial')
          .eq('id', product.id)
          .single();

        if (productError || !productCheck) {
          alert('Error: El producto ya no existe o no se puede acceder');
          return;
        }

        if (!productCheck.has_imei_serial) {
          alert('Error: Este producto ya no está configurado para manejar IMEI/Serial');
          return;
        }
      }
      // Proceder con el guardado
      const dataToSave = {
        product_id: product.id,
        imei_number: formData.imei_number?.trim() ? normalizeImei(formData.imei_number.trim()) : '',
        serial_number: formData.serial_number?.trim() ? normalizeSerial(formData.serial_number.trim()) : '',
        notes: formData.notes?.trim() || '',
        status: 'available' as const,
        created_by: user?.id,
        updated_by: user?.id
      };

      if (editingItem) {
        // Verificar que el item no esté vendido antes de editar
        if (editingItem.status === 'sold') {
          alert('No se puede editar un IMEI/Serial que ya fue vendido');
          return;
        }

        const { error } = await supabase
          .from('product_imei_serials')
          .update({
            ...dataToSave,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingItem.id);

        if (error) throw error;
        
        alert('Registro actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('product_imei_serials')
          .insert([dataToSave]);

        if (error) throw error;
        
        alert('Registro agregado exitosamente');
      }

      setShowAddForm(false);
      setEditingItem(null);
      setFormData({ imei_number: '', serial_number: '', notes: '' });
      setValidationErrors({});
      loadImeiSerials();
      onUpdate();
      
    } catch (error) {
      console.error('Error saving IMEI/Serial:', error);
      
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('duplicate key') || errorMessage.includes('unique')) {
        if (errorMessage.includes('imei')) {
          setValidationErrors({ imei_number: 'Este IMEI ya está registrado en el sistema' });
        } else if (errorMessage.includes('serial')) {
          setValidationErrors({ serial_number: 'Este número de serie ya está registrado en el sistema' });
        } else {
          alert('Error: Ya existe un registro con estos datos');
        }
      } else if (errorMessage.includes('check constraint')) {
        alert('Error: Los datos no cumplen con el formato requerido');
      } else {
        alert('Error al guardar: ' + errorMessage);
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleEdit = (item: ProductImeiSerial) => {
    setEditingItem(item);
    setFormData({
      imei_number: item.imei_number,
      serial_number: item.serial_number,
      notes: item.notes
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!isDemoMode && supabase) {
      // Verificar si el IMEI/Serial está vendido
      try {
        const { data: imeiSerial, error } = await supabase
          .from('product_imei_serials')
          .select('id, status, sale_id, imei_number, serial_number')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Error checking IMEI/Serial status:', error);
          alert('Error al verificar el estado del registro');
          return;
        }

        if (imeiSerial.status === 'sold') {
          alert(`No se puede eliminar este ${imeiSerial.imei_number ? 'IMEI' : 'número de serie'} porque ya fue vendido (Venta: ${imeiSerial.sale_id?.slice(-8)})`);
          return;
        }

        const displayValue = imeiSerial.imei_number || imeiSerial.serial_number;
        if (!window.confirm(`¿Estás seguro de que quieres eliminar el registro ${displayValue}?`)) {
          return;
        }
      } catch (error) {
        console.error('Error in pre-delete validation:', error);
        alert('Error al validar eliminación');
        return;
      }
    } else {
      if (!window.confirm('¿Estás seguro de que quieres eliminar este registro?')) {
        return;
      }
    }

      try {
        const { error } = await supabase
          .from('product_imei_serials')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        alert('Registro eliminado exitosamente');
        loadImeiSerials();
        onUpdate();
      } catch (error) {
        console.error('Error deleting IMEI/Serial:', error);
        
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('foreign key') || errorMessage.includes('violates')) {
          alert('No se puede eliminar este registro porque está siendo usado en ventas');
        } else {
          alert('Error al eliminar: ' + errorMessage);
        }
      }
  };

  const handleBulkAdd = async () => {
    if (!bulkData.trim()) {
      alert('Ingrese los datos para agregar');
      return;
    }

    setIsValidating(true);

    try {
      const lines = bulkData.trim().split('\n');
      const itemsToProcess = [];
      const rejectedItems = [];

      // Procesar cada línea
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Detectar si es IMEI (15 dígitos) o serial
        const isIMEI = /^\d{15}$/.test(trimmedLine);
        
        if (isIMEI) {
          // Validar IMEI
          const validation = await checkImeiDuplicate(trimmedLine, product.id);
          if (validation.isValid) {
            itemsToProcess.push({
              imei_number: normalizeImei(trimmedLine),
              serial_number: '',
              notes: 'Agregado masivamente',
              product_name: product.name
            });
          } else {
            rejectedItems.push({
              value: trimmedLine,
              type: 'IMEI',
              reason: validation.error || 'IMEI inválido'
            });
          }
        } else {
          // Validar Serial
          const validation = await checkSerialDuplicate(trimmedLine, product.id);
          if (validation.isValid) {
            itemsToProcess.push({
              imei_number: '',
              serial_number: normalizeSerial(trimmedLine),
              notes: 'Agregado masivamente',
              product_name: product.name
            });
          } else {
            rejectedItems.push({
              value: trimmedLine,
              type: 'Serial',
              reason: validation.error || 'Número de serie inválido'
            });
          }
        }
      }

      // Mostrar resumen de validación si hay elementos rechazados
      if (rejectedItems.length > 0) {
        const rejectedSummary = rejectedItems.map(item => 
          `${item.type}: ${item.value} - ${item.reason}`
        ).join('\n');
        
        const proceed = window.confirm(
          `Se encontraron ${rejectedItems.length} elementos inválidos que serán omitidos:\n\n${rejectedSummary}\n\n¿Desea continuar agregando los ${itemsToProcess.length} elementos válidos?`
        );
        
        if (!proceed) {
          return;
        }
      }

      if (itemsToProcess.length === 0) {
        alert('No hay elementos válidos para agregar');
        return;
      }

      // Insertar elementos válidos
      const itemsToInsert = itemsToProcess.map(item => ({
        product_id: product.id,
        imei_number: item.imei_number,
        serial_number: item.serial_number,
        notes: item.notes,
        created_by: user?.id,
        updated_by: user?.id
      }));

      const { error } = await supabase
        .from('product_imei_serials')
        .insert(itemsToInsert);

      if (error) throw error;

      setBulkAddMode(false);
      setBulkData('');
      loadImeiSerials();
      onUpdate();

      // Mostrar resumen de resultados
      let message = `Se agregaron ${itemsToProcess.length} registros exitosamente`;
      if (rejectedItems.length > 0) {
        message += `\n${rejectedItems.length} elementos fueron rechazados por duplicados o errores de formato`;
      }
      alert(message);

    } catch (error) {
      console.error('Error in bulk add:', error);
      alert('Error en agregado masivo: ' + (error as Error).message);
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'sold':
        return 'bg-blue-100 text-blue-800';
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800';
      case 'defective':
        return 'bg-red-100 text-red-800';
      case 'returned':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return 'Disponible';
      case 'sold':
        return 'Vendido';
      case 'reserved':
        return 'Reservado';
      case 'defective':
        return 'Defectuoso';
      case 'returned':
        return 'Devuelto';
      default:
        return status;
    }
  };

  const filteredItems = imeiSerials.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.imei_number.includes(searchTerm) ||
      item.serial_number.includes(searchTerm) ||
      item.notes.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                <Hash className="h-6 w-6 mr-3 text-purple-600" />
                Gestión de {product.imei_serial_type === 'imei' ? 'IMEI' : 
                           product.imei_serial_type === 'serial' ? 'Números de Serie' : 'IMEI y Números de Serie'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Producto: {product.name}
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

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900">Disponibles</h4>
                <p className="text-2xl font-bold text-green-900">
                  {imeiSerials.filter(item => item.status === 'available').length}
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900">Vendidos</h4>
                <p className="text-2xl font-bold text-blue-900">
                  {imeiSerials.filter(item => item.status === 'sold').length}
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-900">Defectuosos</h4>
                <p className="text-2xl font-bold text-red-900">
                  {imeiSerials.filter(item => item.status === 'defective').length}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-medium text-slate-900">Total</h4>
                <p className="text-2xl font-bold text-slate-900">{imeiSerials.length}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por IMEI, serial o notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos los estados</option>
                <option value="available">Disponibles</option>
                <option value="sold">Vendidos</option>
                <option value="reserved">Reservados</option>
                <option value="defective">Defectuosos</option>
                <option value="returned">Devueltos</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAddForm(true);
                    setEditingItem(null);
                    setFormData({ imei_number: '', serial_number: '', notes: '' });
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar
                </button>
                <button
                  onClick={() => setBulkAddMode(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Masivo
                </button>
              </div>
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-6">
                <h4 className="font-medium text-slate-900 mb-4">
                  {editingItem ? 'Editar Registro' : 'Agregar Nuevo Registro'}
                </h4>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(product.imei_serial_type === 'imei' || product.imei_serial_type === 'both') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          IMEI {product.imei_serial_type === 'imei' ? '*' : ''}
                        </label>
                        <input
                          type="text"
                          value={formData.imei_number || ''}
                          onChange={(e) => {
                            setFormData({ ...formData, imei_number: e.target.value });
                            // Limpiar error cuando el usuario empiece a escribir
                            if (validationErrors.imei_number) {
                              setValidationErrors(prev => ({ ...prev, imei_number: '' }));
                            }
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="15 dígitos"
                          maxLength={15}
                          pattern="[0-9]{15}"
                        />
                        {validationErrors.imei_number && (
                          <p className="text-red-600 text-xs mt-1 flex items-center">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {validationErrors.imei_number}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {(product.imei_serial_type === 'serial' || product.imei_serial_type === 'both') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Número de Serie {product.imei_serial_type === 'serial' ? '*' : ''}
                        </label>
                        <input
                          type="text"
                          value={formData.serial_number || ''}
                          onChange={(e) => {
                            setFormData({ ...formData, serial_number: e.target.value });
                            // Limpiar error cuando el usuario empiece a escribir
                            if (validationErrors.serial_number) {
                              setValidationErrors(prev => ({ ...prev, serial_number: '' }));
                            }
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Número de serie"
                        />
                        {validationErrors.serial_number && (
                          <p className="text-red-600 text-xs mt-1 flex items-center">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {validationErrors.serial_number}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Notas (opcional)
                    </label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Notas adicionales..."
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isValidating}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
                    >
                      {isValidating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Validando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          {editingItem ? 'Actualizar' : 'Agregar'}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingItem(null);
                        setFormData({ imei_number: '', serial_number: '', notes: '' });
                      }}
                      className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                      disabled={isValidating}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Bulk Add Form */}
            {bulkAddMode && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <h4 className="font-medium text-green-900 mb-4">Agregar Múltiples Registros</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      IMEI/Números de Serie (uno por línea)
                    </label>
                    <textarea
                      value={bulkData}
                      onChange={(e) => setBulkData(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`Ejemplo:
123456789012345
ABC123DEF456
987654321098765
XYZ789GHI012`}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Los números de 15 dígitos se detectarán automáticamente como IMEI
                    </p>
                    
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h5 className="text-sm font-medium text-blue-900 mb-2">Validaciones Aplicadas:</h5>
                      <ul className="text-xs text-blue-800 space-y-1">
                        <li>• IMEI: Exactamente 15 dígitos, formato válido, sin duplicados</li>
                        <li>• Serial: 3-50 caracteres, alfanumérico, sin duplicados</li>
                        <li>• Se verifican duplicados tanto en base de datos como en el lote</li>
                        <li>• Los elementos duplicados o inválidos serán rechazados automáticamente</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleBulkAdd}
                      disabled={!bulkData.trim() || isValidating}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
                    >
                      {isValidating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Validando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Todo
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setBulkAddMode(false);
                        setBulkData('');
                      }}
                      className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                      disabled={isValidating}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Items List */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Cargando registros...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <Smartphone className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">
                  {imeiSerials.length === 0 
                    ? 'No hay registros IMEI/Serial para este producto' 
                    : 'No se encontraron registros que coincidan con los filtros'}
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {(product.imei_serial_type === 'imei' || product.imei_serial_type === 'both') && (
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">IMEI</th>
                        )}
                        {(product.imei_serial_type === 'serial' || product.imei_serial_type === 'both') && (
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Serial</th>
                        )}
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Estado</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Notas</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Fecha</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors duration-200">
                          {(product.imei_serial_type === 'imei' || product.imei_serial_type === 'both') && (
                            <td className="px-4 py-3 text-sm font-mono text-slate-900">
                              {item.imei_number || '-'}
                            </td>
                          )}
                          {(product.imei_serial_type === 'serial' || product.imei_serial_type === 'both') && (
                            <td className="px-4 py-3 text-sm font-mono text-slate-900">
                              {item.serial_number || '-'}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                              {getStatusLabel(item.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                            {item.notes || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {new Date(item.created_at).toLocaleDateString('es-ES')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(item)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                                title="Editar"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}