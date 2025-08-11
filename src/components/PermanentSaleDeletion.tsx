import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, Shield, Search, Calendar, User, DollarSign, Eye, Download, RefreshCw, Lock, CheckCircle, X } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { SaleWithItems } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import { deleteSaleSafely, getSaleDeletionImpact } from '../lib/saleValidation';
import ConfirmationModal from './ConfirmationModal';

export default function PermanentSaleDeletion() {
  const { user } = useAuth();
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionPassword, setDeletionPassword] = useState('');
  const [deletionImpact, setDeletionImpact] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Datos demo para ventas
        const demoSales = [
          {
            id: 'demo-sale-1',
            total_amount: 1500000,
            subtotal: 1500000,
            discount_amount: 0,
            payment_type: 'cash',
            payment_status: 'paid',
            total_paid: 1500000,
            created_at: new Date().toISOString(),
            customer: { 
              id: 'demo-customer-1', 
              name: 'Juan Pérez', 
              phone: '3001234567', 
              email: 'juan@email.com', 
              cedula: '12345678', 
              address: 'Calle 123', 
              created_at: new Date().toISOString() 
            },
            user: { 
              id: 'demo-user-1', 
              name: 'Vendedor Demo', 
              email: 'vendedor@demo.com', 
              role: 'employee', 
              is_active: true, 
              created_at: new Date().toISOString() 
            },
            sale_items: [
              {
                id: 'demo-item-1',
                sale_id: 'demo-sale-1',
                product_id: 'demo-product-1',
                quantity: 1,
                unit_price: 1500000,
                total_price: 1500000,
                product: {
                  id: 'demo-product-1',
                  name: 'iPhone 15 Pro',
                  description: 'Smartphone Apple',
                  sale_price: 1500000,
                  purchase_price: 1200000,
                  stock: 5,
                  barcode: '123456789',
                  category_id: 'demo-category-1',
                  supplier_id: 'demo-supplier-1',
                  has_imei_serial: true,
                  imei_serial_type: 'imei' as const,
                  requires_imei_serial: true,
                  bulk_import_batch: '',
                  import_notes: '',
                  imported_at: null,
                  imported_by: null,
                  created_at: new Date().toISOString()
                },
                product_imei_serials: []
              }
            ],
            payments: [],
            notes: ''
          }
        ];
        
        setSales(demoSales as SaleWithItems[]);
        setLoading(false);
        return;
      }
      
      // Cargar ventas reales
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers (id, name, phone, email, cedula, address, created_at),
          user:users (id, name, email, role, is_active, created_at),
          sale_items (
            id,
            sale_id,
            product_id,
            quantity,
            unit_price,
            total_price,
            product:products (id, name, description, sale_price, purchase_price, stock, barcode, category_id, supplier_id, has_imei_serial, imei_serial_type, requires_imei_serial, bulk_import_batch, import_notes, imported_at, imported_by, created_at),
            product_imei_serials (
              id,
              imei_number,
              serial_number,
              notes
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      
      const salesFormatted = (data || []).map(sale => ({
        ...sale,
        sale_items: sale.sale_items || [],
        payments: [],
        notes: sale.notes || ''
      }));
      
      setSales(salesFormatted as SaleWithItems[]);
    } catch (error) {
      console.error('Error loading sales:', error);
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSale = (saleId: string) => {
    const newSelected = new Set(selectedSales);
    if (newSelected.has(saleId)) {
      newSelected.delete(saleId);
    } else {
      newSelected.add(saleId);
    }
    setSelectedSales(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedSales.size === filteredSales.length) {
      setSelectedSales(new Set());
    } else {
      setSelectedSales(new Set(filteredSales.map(sale => sale.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedSales.size === 0) {
      alert('Selecciona al menos una venta para eliminar');
      return;
    }

    // Calcular impacto total
    const selectedSalesList = sales.filter(sale => selectedSales.has(sale.id));
    const totalAmount = selectedSalesList.reduce((sum, sale) => sum + sale.total_amount, 0);
    const totalItems = selectedSalesList.reduce((sum, sale) => sum + sale.sale_items.length, 0);

    setDeletionImpact({
      sales_count: selectedSales.size,
      total_amount: totalAmount,
      total_items: totalItems,
      sales: selectedSalesList
    });

    setShowConfirmation(true);
  };

  const confirmDeletion = async () => {
    if (!deletionReason.trim()) {
      alert('Debe proporcionar una razón para la eliminación');
      return;
    }

    if (!deletionPassword.trim()) {
      alert('Debe ingresar su contraseña para confirmar');
      return;
    }

    try {
      setDeleting(true);
      
      if (isDemoMode) {
        // Simular eliminación en modo demo
        await new Promise(resolve => setTimeout(resolve, 2000));
        setSales(prev => prev.filter(sale => !selectedSales.has(sale.id)));
        setSelectedSales(new Set());
        setShowConfirmation(false);
        setDeletionReason('');
        setDeletionPassword('');
        setDeletionImpact(null);
        alert(`${selectedSales.size} ventas eliminadas permanentemente en modo demo`);
        return;
      }

      // Eliminar ventas seleccionadas una por una
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const saleId of selectedSales) {
        try {
          const result = await deleteSaleSafely(
            saleId,
            user?.id || '',
            user?.role || 'employee',
            `Eliminación permanente: ${deletionReason}`
          );

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`Venta #${saleId.slice(-8)}: ${result.error}`);
          }
        } catch (error) {
          errorCount++;
          errors.push(`Venta #${saleId.slice(-8)}: ${(error as Error).message}`);
        }
      }

      // Mostrar resultado
      let message = `Eliminación completada:\n✅ ${successCount} ventas eliminadas exitosamente`;
      if (errorCount > 0) {
        message += `\n❌ ${errorCount} ventas con errores:\n${errors.join('\n')}`;
      }

      alert(message);

      // Limpiar estado y recargar
      setSelectedSales(new Set());
      setShowConfirmation(false);
      setDeletionReason('');
      setDeletionPassword('');
      setDeletionImpact(null);
      await loadSales();

    } catch (error) {
      console.error('Error in bulk deletion:', error);
      alert('Error en eliminación masiva: ' + (error as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const exportSalesData = () => {
    const selectedSalesList = sales.filter(sale => selectedSales.has(sale.id));
    
    if (selectedSalesList.length === 0) {
      alert('Selecciona ventas para exportar');
      return;
    }

    const csvContent = [
      'ID,Fecha,Cliente,Vendedor,Total,Tipo_Pago,Estado,Items',
      ...selectedSalesList.map(sale => [
        sale.id.slice(-8),
        new Date(sale.created_at).toLocaleDateString('es-ES'),
        sale.customer?.name || 'Sin cliente',
        sale.user?.name || 'N/A',
        sale.total_amount,
        sale.payment_type === 'cash' ? 'Efectivo' : 'Abonos',
        sale.payment_status === 'paid' ? 'Pagada' : sale.payment_status === 'partial' ? 'Parcial' : 'Pendiente',
        sale.sale_items.length
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_seleccionadas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch = !searchTerm || 
      sale.id.includes(searchTerm) ||
      sale.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customer?.phone.includes(searchTerm) ||
      sale.user?.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDate = !dateFilter || sale.created_at.startsWith(dateFilter);

    return matchesSearch && matchesDate;
  });

  // Verificar permisos
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <div className="text-red-600 mb-4">
            <Shield className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Acceso Restringido</h2>
          <p className="text-slate-600 mb-4">
            Solo los administradores pueden acceder a la eliminación permanente de ventas.
          </p>
          <p className="text-sm text-slate-500">
            Esta función requiere permisos especiales por motivos de seguridad.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con advertencia de seguridad */}
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-red-900 flex items-center">
              <Trash2 className="h-8 w-8 mr-3" />
              Eliminación Permanente de Ventas
              {isDemoMode && (
                <span className="ml-3 text-sm bg-yellow-500 text-yellow-900 px-3 py-1 rounded-full">
                  MODO DEMO
                </span>
              )}
            </h1>
            <p className="text-red-700 text-lg mt-2">
              ⚠️ ZONA DE ALTA SEGURIDAD - Las eliminaciones son PERMANENTES e IRREVERSIBLES
            </p>
            <div className="flex items-center gap-6 mt-4 text-sm text-red-800">
              <div className="flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                <span>Solo administradores</span>
              </div>
              <div className="flex items-center">
                <Lock className="h-4 w-4 mr-2" />
                <span>Requiere confirmación con contraseña</span>
              </div>
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <span>Auditoría completa registrada</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-red-700 text-sm">Usuario:</p>
            <p className="font-semibold text-red-900">{user.name}</p>
            <p className="text-red-600 text-sm">Rol: {user.role}</p>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ID de venta, cliente o vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={loadSales}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Acciones de selección */}
      {filteredSales.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleSelectAll}
                className="flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200"
              >
                <input
                  type="checkbox"
                  checked={selectedSales.size === filteredSales.length && filteredSales.length > 0}
                  onChange={() => {}}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded mr-2"
                />
                {selectedSales.size === filteredSales.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </button>
              {selectedSales.size > 0 && (
                <span className="text-sm text-slate-600">
                  {selectedSales.size} venta{selectedSales.size > 1 ? 's' : ''} seleccionada{selectedSales.size > 1 ? 's' : ''}
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              {selectedSales.size > 0 && (
                <>
                  <button
                    onClick={exportSalesData}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Seleccionadas
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar Permanentemente ({selectedSales.size})
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lista de ventas */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-12 text-center">
            <Trash2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {sales.length === 0 
                ? 'No hay ventas registradas' 
                : 'No se encontraron ventas que coincidan con los filtros'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredSales.map((sale) => (
              <div key={sale.id} className="p-6 hover:bg-slate-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedSales.has(sale.id)}
                      onChange={() => handleSelectSale(sale.id)}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-slate-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            Venta #{sale.id.slice(-8)}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {new Date(sale.created_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                            {sale.customer && (
                              <span className="flex items-center">
                                <User className="h-4 w-4 mr-1 text-blue-600" />
                                {sale.customer.name}
                              </span>
                            )}
                            {sale.user && (
                              <span className="flex items-center">
                                <User className="h-4 w-4 mr-1 text-green-600" />
                                {sale.user.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            {formatCurrency(sale.total_amount)}
                          </span>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            sale.payment_status === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : sale.payment_status === 'partial'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {sale.payment_status === 'paid' ? 'Pagada' : 
                             sale.payment_status === 'partial' ? 'Parcial' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedSale(sale);
                        setShowSaleDetails(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      {showConfirmation && deletionImpact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-red-200 bg-red-50">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
                <div>
                  <h3 className="text-xl font-semibold text-red-900">
                    Confirmación de Eliminación Permanente
                  </h3>
                  <p className="text-red-700 text-sm mt-1">
                    Esta acción NO se puede deshacer. Los datos se eliminarán permanentemente.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Resumen del impacto */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-900 mb-3">Impacto de la Eliminación</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-900">{deletionImpact.sales_count}</p>
                    <p className="text-red-700">Ventas a eliminar</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-900">{formatCurrency(deletionImpact.total_amount)}</p>
                    <p className="text-red-700">Monto total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-900">{deletionImpact.total_items}</p>
                    <p className="text-red-700">Items afectados</p>
                  </div>
                </div>
              </div>

              {/* Lista de ventas a eliminar */}
              <div>
                <h4 className="font-medium text-slate-900 mb-3">Ventas que serán eliminadas:</h4>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {deletionImpact.sales.map((sale: SaleWithItems) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                      <div>
                        <span className="font-medium">#{sale.id.slice(-8)}</span>
                        <span className="text-slate-600 ml-2">
                          {sale.customer?.name || 'Sin cliente'}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(sale.total_amount)}</p>
                        <p className="text-slate-500 text-xs">
                          {new Date(sale.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Razón de eliminación */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Razón de la Eliminación *
                </label>
                <textarea
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Explica detalladamente por qué estas ventas deben ser eliminadas permanentemente..."
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Esta razón quedará registrada en los logs de auditoría
                </p>
              </div>

              {/* Confirmación con contraseña */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirma tu Contraseña *
                </label>
                <input
                  type="password"
                  value={deletionPassword}
                  onChange={(e) => setDeletionPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Ingresa tu contraseña para confirmar"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Requerido para verificar tu identidad antes de la eliminación
                </p>
              </div>

              {isDemoMode && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-yellow-600 mr-2" />
                    <div>
                      <h4 className="font-medium text-yellow-900">Modo Demo</h4>
                      <p className="text-sm text-yellow-800">
                        Las eliminaciones se simularán. No se afectarán datos reales.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Advertencias finales */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-900 mb-2">⚠️ ADVERTENCIAS CRÍTICAS</h4>
                <ul className="text-sm text-red-800 space-y-1">
                  <li>• Los datos eliminados NO se pueden recuperar</li>
                  <li>• Se restaurará el stock y se liberarán los IMEI/Serial</li>
                  <li>• Se eliminarán todos los abonos y pagos asociados</li>
                  <li>• Esta acción quedará registrada en auditoría</li>
                  <li>• Puede afectar reportes y estadísticas históricas</li>
                </ul>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setDeletionReason('');
                  setDeletionPassword('');
                  setDeletionImpact(null);
                }}
                className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-lg hover:bg-slate-300 transition-colors duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeletion}
                disabled={deleting || !deletionReason.trim() || !deletionPassword.trim()}
                className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium flex items-center justify-center"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    ELIMINAR PERMANENTEMENTE
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalles de venta */}
      {selectedSale && showSaleDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  Detalle de Venta #{selectedSale.id.slice(-8)}
                </h3>
                <button
                  onClick={() => {
                    setShowSaleDetails(false);
                    setSelectedSale(null);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Información general */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-slate-900 mb-3">Información de la Venta</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Fecha:</span>
                        <span className="font-medium">
                          {new Date(selectedSale.created_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Total:</span>
                        <span className="font-bold text-green-600">
                          {formatCurrency(selectedSale.total_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Tipo de pago:</span>
                        <span className="font-medium">
                          {selectedSale.payment_type === 'cash' ? 'Efectivo' : 'Abonos'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Estado:</span>
                        <span className={`font-medium ${
                          selectedSale.payment_status === 'paid' ? 'text-green-600' : 
                          selectedSale.payment_status === 'partial' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {selectedSale.payment_status === 'paid' ? 'Pagada' : 
                           selectedSale.payment_status === 'partial' ? 'Parcial' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-900 mb-3">Cliente y Vendedor</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-slate-600">Cliente:</span>
                        <p className="font-medium">
                          {selectedSale.customer?.name || 'Sin cliente'}
                        </p>
                        {selectedSale.customer?.phone && (
                          <p className="text-slate-500">{selectedSale.customer.phone}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-600">Vendedor:</span>
                        <p className="font-medium">
                          {selectedSale.user?.name || 'N/A'}
                        </p>
                        {selectedSale.user?.email && (
                          <p className="text-slate-500">{selectedSale.user.email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Productos */}
                <div>
                  <h4 className="font-medium text-slate-900 mb-3">Productos ({selectedSale.sale_items.length})</h4>
                  <div className="space-y-3">
                    {selectedSale.sale_items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <h5 className="font-medium text-slate-900">{item.product.name}</h5>
                          <p className="text-sm text-slate-600">
                            {formatCurrency(item.unit_price)} × {item.quantity}
                          </p>
                        </div>
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(item.total_price)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowSaleDetails(false);
                  setSelectedSale(null);
                }}
                className="w-full bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Información de seguridad */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Shield className="h-5 w-5 mr-2 text-slate-600" />
          Información de Seguridad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-slate-900 mb-2">Qué se Elimina</h4>
            <ul className="text-sm text-slate-700 space-y-1">
              <li>• La venta y todos sus items</li>
              <li>• Todos los pagos y abonos asociados</li>
              <li>• Registros en cajas registradoras</li>
              <li>• Referencias en reportes</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-slate-900 mb-2">Qué se Restaura</h4>
            <ul className="text-sm text-slate-700 space-y-1">
              <li>• Stock de productos (si aplica)</li>
              <li>• IMEI/Serial a estado disponible</li>
              <li>• Balance de inventario</li>
              <li>• Disponibilidad para nuevas ventas</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Auditoría y Trazabilidad</h4>
          <p className="text-sm text-blue-800">
            Todas las eliminaciones quedan registradas en el sistema de auditoría con:
            fecha, hora, usuario responsable, razón de eliminación, y detalles completos 
            de los datos eliminados para cumplimiento normativo.
          </p>
        </div>

        {isDemoMode && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-900">Modo Demo Activo</h4>
            <p className="text-sm text-yellow-800 mt-1">
              Las eliminaciones se simularán. Para usar la funcionalidad completa, 
              configura las variables de entorno de Supabase y conecta una base de datos real.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}