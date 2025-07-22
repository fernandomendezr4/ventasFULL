import React, { useState, useEffect } from 'react';
import { FileText, Calendar, User, Package, DollarSign, TrendingUp, TrendingDown, Eye, Edit2, Trash2, Search, Filter, Download, Printer, Building2, Users, Truck, ShoppingCart, CreditCard, AlertTriangle, CheckCircle, Clock, X, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';

interface DetailedCashRegisterReport {
  register_info: any;
  movements_summary: any;
  sales_detail: any;
  installments_detail: any;
  discrepancy_analysis: any;
  audit_trail: any;
}

interface MovementWithDetails {
  id: string;
  cash_register_id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  created_at: string;
  created_by: string;
  created_by_name: string;
  reference_id?: string;
  // Detalles de venta
  sale_details?: {
    sale_id: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    customer_cedula: string;
    payment_method: string;
    total_amount: number;
    discount_amount: number;
    items: Array<{
      product_id: string;
      product_name: string;
      product_barcode: string;
      category_name: string;
      supplier_name: string;
      supplier_contact: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      purchase_price: number;
      profit_per_unit: number;
      total_profit: number;
    }>;
  };
  // Detalles de abono
  installment_details?: {
    installment_id: string;
    sale_id: string;
    customer_name: string;
    customer_phone: string;
    payment_method: string;
    original_sale_amount: number;
    total_paid_before: number;
    remaining_balance: number;
  };
}

export default function CashRegisterAudit() {
  const { user } = useAuth();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const { confirmation, showConfirmation, hideConfirmation, handleConfirm } = useConfirmation();
  
  const [registers, setRegisters] = useState<any[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<any>(null);
  const [detailedReport, setDetailedReport] = useState<DetailedCashRegisterReport | null>(null);
  const [movementsWithDetails, setMovementsWithDetails] = useState<MovementWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMovement, setEditingMovement] = useState<MovementWithDetails | null>(null);
  const [editFormData, setEditFormData] = useState({
    type: '',
    category: '',
    amount: '',
    description: ''
  });

  useEffect(() => {
    loadCashRegisters();
  }, []);

  const loadCashRegisters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cash_register_history_summary')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRegisters(data || []);
    } catch (error) {
      console.error('Error loading cash registers:', error);
      showError('Error', 'No se pudieron cargar los registros de caja');
    } finally {
      setLoading(false);
    }
  };

  const loadDetailedReport = async (registerId: string) => {
    try {
      setLoadingReport(true);
      
      // Cargar movimientos con detalles completos
      const { data: movements, error: movementsError } = await supabase
        .from('cash_movements')
        .select(`
          *,
          users!inner(name)
        `)
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (movementsError) throw movementsError;

      // Enriquecer movimientos con detalles de ventas y abonos
      const enrichedMovements: MovementWithDetails[] = [];

      for (const movement of movements || []) {
        const enrichedMovement: MovementWithDetails = {
          ...movement,
          created_by_name: movement.users?.name || 'Sistema'
        };

        // Si es una venta, cargar detalles completos
        if (movement.type === 'sale' && movement.reference_id) {
          const { data: saleData, error: saleError } = await supabase
            .from('sales')
            .select(`
              *,
              customer:customers(*),
              sale_items(
                *,
                product:products(
                  *,
                  category:categories(name),
                  supplier:suppliers(name, contact_person, phone, email)
                )
              ),
              payments(payment_method, notes)
            `)
            .eq('id', movement.reference_id)
            .single();

          if (!saleError && saleData) {
            const paymentMethod = saleData.payments?.[0]?.payment_method || 'cash';
            const paymentNotes = saleData.payments?.[0]?.notes || '';
            
            enrichedMovement.sale_details = {
              sale_id: saleData.id,
              customer_name: saleData.customer?.name || 'Cliente genérico',
              customer_phone: saleData.customer?.phone || '',
              customer_email: saleData.customer?.email || '',
              customer_cedula: saleData.customer?.cedula || '',
              payment_method: paymentMethod === 'other' && paymentNotes.includes('NEQUI') ? 'NEQUI' : 
                            paymentMethod === 'cash' ? 'Efectivo' :
                            paymentMethod === 'card' ? 'Tarjeta' :
                            paymentMethod === 'transfer' ? 'Transferencia' : paymentMethod,
              total_amount: saleData.total_amount,
              discount_amount: saleData.discount_amount || 0,
              items: saleData.sale_items?.map((item: any) => ({
                product_id: item.product.id,
                product_name: item.product.name,
                product_barcode: item.product.barcode || '',
                category_name: item.product.category?.name || 'Sin categoría',
                supplier_name: item.product.supplier?.name || 'Sin proveedor',
                supplier_contact: item.product.supplier?.contact_person || '',
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                purchase_price: item.product.purchase_price || 0,
                profit_per_unit: item.unit_price - (item.product.purchase_price || 0),
                total_profit: (item.unit_price - (item.product.purchase_price || 0)) * item.quantity
              })) || []
            };
          }
        }

        // Si es un abono, cargar detalles del abono y venta original
        if (movement.type === 'sale' && movement.category === 'abono' && movement.reference_id) {
          const { data: installmentData, error: installmentError } = await supabase
            .from('payment_installments')
            .select(`
              *,
              sale:sales(
                *,
                customer:customers(*)
              )
            `)
            .eq('id', movement.reference_id)
            .single();

          if (!installmentError && installmentData) {
            enrichedMovement.installment_details = {
              installment_id: installmentData.id,
              sale_id: installmentData.sale.id,
              customer_name: installmentData.sale.customer?.name || 'Cliente genérico',
              customer_phone: installmentData.sale.customer?.phone || '',
              payment_method: installmentData.payment_method === 'cash' ? 'Efectivo' :
                            installmentData.payment_method === 'card' ? 'Tarjeta' :
                            installmentData.payment_method === 'transfer' ? 'Transferencia' : 
                            installmentData.payment_method,
              original_sale_amount: installmentData.sale.total_amount,
              total_paid_before: (installmentData.sale.total_paid || 0) - installmentData.amount_paid,
              remaining_balance: installmentData.sale.total_amount - (installmentData.sale.total_paid || 0)
            };
          }
        }

        enrichedMovements.push(enrichedMovement);
      }

      setMovementsWithDetails(enrichedMovements);

      // Cargar información del registro
      const { data: registerInfo, error: registerError } = await supabase
        .from('cash_register_session_details')
        .select('*')
        .eq('cash_register_id', registerId)
        .single();

      if (registerError) throw registerError;

      setDetailedReport({
        register_info: registerInfo,
        movements_summary: {
          total_movements: enrichedMovements.length,
          total_sales: enrichedMovements.filter(m => m.type === 'sale').length,
          total_income: enrichedMovements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0),
          total_expenses: enrichedMovements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0)
        },
        sales_detail: enrichedMovements.filter(m => m.sale_details),
        installments_detail: enrichedMovements.filter(m => m.installment_details),
        discrepancy_analysis: registerInfo,
        audit_trail: enrichedMovements
      });

    } catch (error) {
      console.error('Error loading detailed report:', error);
      showError('Error', 'No se pudo cargar el reporte detallado');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleEditMovement = (movement: MovementWithDetails) => {
    setEditingMovement(movement);
    setEditFormData({
      type: movement.type,
      category: movement.category,
      amount: movement.amount.toString(),
      description: movement.description
    });
    setShowEditModal(true);
  };

  const handleUpdateMovement = async () => {
    if (!editingMovement) return;

    try {
      const amount = parseFloat(editFormData.amount);
      if (amount <= 0) {
        showError('Error', 'El monto debe ser mayor a cero');
        return;
      }

      const { error } = await supabase
        .from('cash_movements')
        .update({
          type: editFormData.type,
          category: editFormData.category,
          amount: amount,
          description: editFormData.description
        })
        .eq('id', editingMovement.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingMovement(null);
      loadDetailedReport(selectedRegister.cash_register_id);
      showSuccess('Éxito', 'Movimiento actualizado correctamente');
    } catch (error) {
      console.error('Error updating movement:', error);
      showError('Error', 'No se pudo actualizar el movimiento');
    }
  };

  const handleDeleteMovement = (movement: MovementWithDetails) => {
    showConfirmation(
      'Eliminar Movimiento',
      `¿Estás seguro de que quieres eliminar este movimiento de ${movement.type} por ${formatCurrency(movement.amount)}?`,
      async () => {
        try {
          const { error } = await supabase
            .from('cash_movements')
            .delete()
            .eq('id', movement.id);

          if (error) throw error;

          loadDetailedReport(selectedRegister.cash_register_id);
          showSuccess('Éxito', 'Movimiento eliminado correctamente');
        } catch (error) {
          console.error('Error deleting movement:', error);
          showError('Error', 'No se pudo eliminar el movimiento');
        }
      }
    );
  };

  const filteredRegisters = registers.filter(register => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const operatorName = register.operator_name?.toLowerCase() || '';
      const registerId = register.cash_register_id?.slice(-8) || '';
      
      if (!(operatorName.includes(searchLower) || registerId.includes(searchTerm))) {
        return false;
      }
    }
    
    if (dateFilter && !register.opened_at?.startsWith(dateFilter)) {
      return false;
    }
    
    if (statusFilter !== 'all' && register.status !== statusFilter) {
      return false;
    }
    
    return true;
  });

  const filteredMovements = movementsWithDetails.filter(movement => {
    if (movementTypeFilter !== 'all' && movement.type !== movementTypeFilter) {
      return false;
    }
    return true;
  });

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return <ShoppingCart className="h-4 w-4 text-green-600" />;
      case 'income':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'expense':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'opening':
        return <CheckCircle className="h-4 w-4 text-purple-600" />;
      case 'closing':
        return <Clock className="h-4 w-4 text-gray-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-slate-600" />;
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'sale':
        return 'Venta';
      case 'income':
        return 'Ingreso';
      case 'expense':
        return 'Gasto';
      case 'opening':
        return 'Apertura';
      case 'closing':
        return 'Cierre';
      default:
        return type;
    }
  };

  const exportToCSV = () => {
    if (!detailedReport) return;

    const csvData = filteredMovements.map(movement => ({
      'Fecha': new Date(movement.created_at).toLocaleDateString('es-ES'),
      'Hora': new Date(movement.created_at).toLocaleTimeString('es-ES'),
      'Tipo': getMovementTypeLabel(movement.type),
      'Categoría': movement.category,
      'Monto': movement.amount,
      'Descripción': movement.description,
      'Usuario': movement.created_by_name,
      'Cliente': movement.sale_details?.customer_name || movement.installment_details?.customer_name || '',
      'Teléfono Cliente': movement.sale_details?.customer_phone || movement.installment_details?.customer_phone || '',
      'Método Pago': movement.sale_details?.payment_method || movement.installment_details?.payment_method || '',
      'Productos': movement.sale_details?.items.map(item => `${item.product_name} (${item.quantity})`).join('; ') || '',
      'Proveedores': movement.sale_details?.items.map(item => item.supplier_name).filter((v, i, a) => a.indexOf(v) === i).join('; ') || '',
      'Ganancia Total': movement.sale_details?.items.reduce((sum, item) => sum + item.total_profit, 0) || 0
    }));

    const csvContent = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria_caja_${selectedRegister?.cash_register_id?.slice(-8)}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-slate-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (selectedRegister && detailedReport) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">
              Reporte Detallado - Caja #{selectedRegister.cash_register_id?.slice(-8)}
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Operador: {selectedRegister.operator_name} • 
              {new Date(selectedRegister.opened_at).toLocaleDateString('es-ES')} • 
              {selectedRegister.status === 'open' ? 'Abierta' : 'Cerrada'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </button>
            <button
              onClick={() => {
                setSelectedRegister(null);
                setDetailedReport(null);
                setMovementsWithDetails([]);
              }}
              className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
            >
              Volver
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-600">Apertura</p>
                <p className="text-xl font-bold text-blue-900">
                  {formatCurrency(selectedRegister.opening_amount || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-600">Ventas + Ingresos</p>
                <p className="text-xl font-bold text-green-900">
                  {formatCurrency((selectedRegister.total_sales_amount || 0) + (selectedRegister.total_income || 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-red-600">Gastos</p>
                <p className="text-xl font-bold text-red-900">
                  {formatCurrency(selectedRegister.total_expenses || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-purple-600">Balance Final</p>
                <p className="text-xl font-bold text-purple-900">
                  {formatCurrency(selectedRegister.calculated_balance || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Movement Type Filter */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-slate-400" />
            <select
              value={movementTypeFilter}
              onChange={(e) => setMovementTypeFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los movimientos</option>
              <option value="sale">Solo ventas</option>
              <option value="income">Solo ingresos</option>
              <option value="expense">Solo gastos</option>
              <option value="opening">Solo apertura</option>
              <option value="closing">Solo cierre</option>
            </select>
            <span className="text-sm text-slate-600">
              Mostrando {filteredMovements.length} de {movementsWithDetails.length} movimientos
            </span>
          </div>
        </div>

        {/* Detailed Movements */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h4 className="text-lg font-semibold text-slate-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-600" />
              Movimientos Detallados ({filteredMovements.length})
            </h4>
          </div>
          
          {loadingReport ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Cargando reporte detallado...</p>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No hay movimientos que mostrar</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredMovements.map((movement) => (
                <div key={movement.id} className="p-6 hover:bg-slate-50 transition-colors duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        {getMovementIcon(movement.type)}
                        <div>
                          <h5 className="font-medium text-slate-900">
                            {getMovementTypeLabel(movement.type)}
                            {movement.category && ` - ${movement.category}`}
                          </h5>
                          <p className="text-sm text-slate-600">{movement.description}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(movement.created_at).toLocaleDateString('es-ES')} {new Date(movement.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              {movement.created_by_name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Detalles de Venta */}
                      {movement.sale_details && (
                        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                          <h6 className="font-medium text-green-900 mb-3 flex items-center">
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Detalles de Venta
                          </h6>
                          
                          {/* Información del Cliente */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="bg-white p-3 rounded border">
                              <h7 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                                <Users className="h-3 w-3 mr-1" />
                                Cliente
                              </h7>
                              <p className="text-sm text-slate-900 font-medium">{movement.sale_details.customer_name}</p>
                              {movement.sale_details.customer_phone && (
                                <p className="text-xs text-slate-600">Tel: {movement.sale_details.customer_phone}</p>
                              )}
                              {movement.sale_details.customer_email && (
                                <p className="text-xs text-slate-600">Email: {movement.sale_details.customer_email}</p>
                              )}
                              {movement.sale_details.customer_cedula && (
                                <p className="text-xs text-slate-600">CC: {movement.sale_details.customer_cedula}</p>
                              )}
                            </div>
                            
                            <div className="bg-white p-3 rounded border">
                              <h7 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                                <CreditCard className="h-3 w-3 mr-1" />
                                Pago
                              </h7>
                              <p className="text-sm text-slate-900 font-medium">{movement.sale_details.payment_method}</p>
                              <p className="text-xs text-slate-600">Total: {formatCurrency(movement.sale_details.total_amount)}</p>
                              {movement.sale_details.discount_amount > 0 && (
                                <p className="text-xs text-orange-600">Descuento: {formatCurrency(movement.sale_details.discount_amount)}</p>
                              )}
                            </div>
                          </div>

                          {/* Productos Vendidos */}
                          <div className="bg-white rounded border">
                            <div className="p-3 border-b bg-slate-50">
                              <h7 className="text-sm font-medium text-slate-700 flex items-center">
                                <Package className="h-3 w-3 mr-1" />
                                Productos Vendidos ({movement.sale_details.items.length})
                              </h7>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {movement.sale_details.items.map((item, index) => (
                                <div key={index} className="p-3 border-b border-slate-100 last:border-b-0">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <h8 className="font-medium text-slate-900">{item.product_name}</h8>
                                        {item.product_barcode && (
                                          <span className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">
                                            {item.product_barcode}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-600">
                                        <span className="flex items-center">
                                          <Package className="h-3 w-3 mr-1" />
                                          {item.category_name}
                                        </span>
                                        <span className="flex items-center">
                                          <Truck className="h-3 w-3 mr-1" />
                                          {item.supplier_name}
                                        </span>
                                        {item.supplier_contact && (
                                          <span>Contacto: {item.supplier_contact}</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-4 mt-1 text-xs">
                                        <span className="text-slate-600">
                                          {item.quantity} × {formatCurrency(item.unit_price)} = {formatCurrency(item.total_price)}
                                        </span>
                                        <span className="text-green-600">
                                          Ganancia: {formatCurrency(item.total_profit)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="p-3 bg-green-50 border-t">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-green-700">Ganancia Total:</span>
                                <span className="font-bold text-green-900">
                                  {formatCurrency(movement.sale_details.items.reduce((sum, item) => sum + item.total_profit, 0))}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Detalles de Abono */}
                      {movement.installment_details && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <h6 className="font-medium text-blue-900 mb-3 flex items-center">
                            <CreditCard className="h-4 w-4 mr-2" />
                            Detalles de Abono
                          </h6>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-3 rounded border">
                              <h7 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                                <Users className="h-3 w-3 mr-1" />
                                Cliente
                              </h7>
                              <p className="text-sm text-slate-900 font-medium">{movement.installment_details.customer_name}</p>
                              {movement.installment_details.customer_phone && (
                                <p className="text-xs text-slate-600">Tel: {movement.installment_details.customer_phone}</p>
                              )}
                            </div>
                            
                            <div className="bg-white p-3 rounded border">
                              <h7 className="text-sm font-medium text-slate-700 mb-2">Estado del Pago</h7>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Venta original:</span>
                                  <span className="font-medium">{formatCurrency(movement.installment_details.original_sale_amount)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Pagado antes:</span>
                                  <span className="font-medium">{formatCurrency(movement.installment_details.total_paid_before)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Este abono:</span>
                                  <span className="font-medium text-green-600">{formatCurrency(movement.amount)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1">
                                  <span className="text-slate-600">Saldo restante:</span>
                                  <span className="font-bold text-orange-600">{formatCurrency(movement.installment_details.remaining_balance)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2 ml-4">
                      <div className="text-right">
                        <p className={`text-xl font-bold ${
                          movement.type === 'expense' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {movement.type === 'expense' ? '-' : '+'}{formatCurrency(movement.amount)}
                        </p>
                      </div>
                      
                      {/* Botones de acción solo para admin */}
                      {user?.role === 'admin' && movement.type !== 'opening' && movement.type !== 'closing' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditMovement(movement)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="Editar movimiento"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMovement(movement)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Eliminar movimiento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Movement Modal */}
        {showEditModal && editingMovement && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Editar Movimiento</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Modificar detalles del movimiento de {getMovementTypeLabel(editingMovement.type).toLowerCase()}
                </p>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo de Movimiento
                  </label>
                  <select
                    value={editFormData.type}
                    onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={editingMovement.type === 'sale'} // No permitir cambiar ventas
                  >
                    <option value="income">Ingreso</option>
                    <option value="expense">Gasto</option>
                    {editingMovement.type === 'sale' && <option value="sale">Venta</option>}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {editFormData.type === 'income' ? (
                      <>
                        <option value="otros_ingresos">Otros Ingresos</option>
                        <option value="devolucion_proveedor">Devolución Proveedor</option>
                        <option value="ajuste_inventario">Ajuste Inventario</option>
                        <option value="prestamo">Préstamo</option>
                      </>
                    ) : editFormData.type === 'expense' ? (
                      <>
                        <option value="otros_gastos">Otros Gastos</option>
                        <option value="compra_productos">Compra Productos</option>
                        <option value="servicios">Servicios</option>
                        <option value="transporte">Transporte</option>
                        <option value="mantenimiento">Mantenimiento</option>
                        <option value="devolucion_cliente">Devolución Cliente</option>
                      </>
                    ) : (
                      <>
                        <option value="venta_efectivo">Venta Efectivo</option>
                        <option value="abono">Abono</option>
                      </>
                    )}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monto
                  </label>
                  <FormattedNumberInput
                    value={editFormData.amount}
                    onChange={(value) => setEditFormData({ ...editFormData, amount: value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    max="9999999"
                    disabled={editingMovement.type === 'sale'} // No permitir cambiar monto de ventas
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-200 flex gap-3">
                <button
                  onClick={handleUpdateMovement}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingMovement(null);
                  }}
                  className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notification Modal */}
        <NotificationModal
          isOpen={notification.isOpen}
          onClose={hideNotification}
          type={notification.type}
          title={notification.title}
          message={notification.message}
        />

        {/* Confirmation Modal */}
        <ConfirmationModal
          isOpen={confirmation.isOpen}
          onClose={hideConfirmation}
          onConfirm={handleConfirm}
          title={confirmation.title}
          message={confirmation.message}
          confirmText={confirmation.confirmText}
          cancelText={confirmation.cancelText}
          type={confirmation.type}
          loading={confirmation.loading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Auditoría de Cajas</h2>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por operador o ID de caja..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="open">Abiertas</option>
              <option value="closed">Cerradas</option>
            </select>
          </div>
        </div>
        {(searchTerm || dateFilter || statusFilter !== 'all') && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredRegisters.length} de {registers.length} registros
          </div>
        )}
      </div>

      {/* Registers List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredRegisters.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {registers.length === 0 
                ? 'No hay registros de caja disponibles' 
                : 'No se encontraron registros que coincidan con los filtros aplicados'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredRegisters.map((register) => (
              <div key={register.cash_register_id} className="p-6 hover:bg-slate-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          Caja #{register.cash_register_id?.slice(-8)}
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            register.status === 'open' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {register.status === 'open' ? 'Abierta' : 'Cerrada'}
                          </span>
                        </h3>
                        <p className="text-sm text-slate-600">
                          Operador: {register.operator_name} • 
                          {new Date(register.opened_at).toLocaleDateString('es-ES')} • 
                          Duración: {Math.round((register.session_duration_hours || 0) * 60)} min
                        </p>
                        <div className="flex items-center gap-6 mt-2 text-sm text-slate-600">
                          <span className="flex items-center">
                            <ShoppingCart className="h-4 w-4 mr-1 text-green-600" />
                            {register.total_sales_count || 0} ventas
                          </span>
                          <span className="flex items-center">
                            <CreditCard className="h-4 w-4 mr-1 text-blue-600" />
                            {register.total_installments_count || 0} abonos
                          </span>
                          <span className="flex items-center">
                            <FileText className="h-4 w-4 mr-1 text-purple-600" />
                            {register.total_movements_count || 0} movimientos
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">
                          {formatCurrency(register.calculated_balance || 0)}
                        </p>
                        <p className="text-sm text-slate-600">Balance calculado</p>
                        {register.discrepancy_amount && Math.abs(register.discrepancy_amount) > 0 && (
                          <p className={`text-sm font-medium ${
                            register.discrepancy_amount > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {register.discrepancy_amount > 0 ? 'Sobrante' : 'Faltante'}: {formatCurrency(Math.abs(register.discrepancy_amount))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedRegister(register);
                        loadDetailedReport(register.cash_register_id);
                      }}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                      title="Ver reporte detallado"
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
    </div>
  );
}