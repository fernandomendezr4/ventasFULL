import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, User, Calendar, Search, Filter, Plus, Eye, Printer, CheckCircle, Clock, AlertTriangle, Phone, Edit2, Trash2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SaleWithItems, PaymentInstallment } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import PrintService from './PrintService';
import NotificationModal from './NotificationModal';
import { useNotification } from '../hooks/useNotification';

interface InstallmentWithSale extends PaymentInstallment {
  sale: SaleWithItems;
}

export default function InstallmentManager() {
  const { user } = useAuth();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const [installmentSales, setInstallmentSales] = useState<SaleWithItems[]>([]);
  const [installments, setInstallments] = useState<InstallmentWithSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<any>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedSaleHistory, setSelectedSaleHistory] = useState<SaleWithItems | null>(null);
  const [saleInstallments, setSaleInstallments] = useState<InstallmentWithSale[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showEditInstallmentModal, setShowEditInstallmentModal] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<InstallmentWithSale | null>(null);
  const [editInstallmentData, setEditInstallmentData] = useState({
    amount_paid: '',
    payment_method: 'cash',
    notes: ''
  });

  useEffect(() => {
    loadInstallmentSales();
    loadInstallments();
  }, []);

  const loadInstallmentSales = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers (name, phone, email),
          user:users (name, email),
          sale_items (
            *,
            product:products (*)
          )
        `)
        .eq('payment_type', 'installment')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstallmentSales(data as SaleWithItems[]);
    } catch (error) {
      console.error('Error loading installment sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInstallments = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_installments')
        .select(`
          *,
          sale:sales (
            *,
            customer:customers (name, phone, email),
            user:users (name, email),
            sale_items (
              *,
              product:products (*)
            )
          )
        `)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setInstallments(data as InstallmentWithSale[]);
    } catch (error) {
      console.error('Error loading installments:', error);
    }
  };

  const handlePayment = async () => {
    if (!selectedSale || !paymentAmount) {
      showError('Datos Incompletos', 'Debe ingresar el monto del abono');
      return;
    }

    const amount = parseFloat(paymentAmount);
    const remainingBalance = selectedSale.total_amount - (selectedSale.total_paid || 0);

    if (amount <= 0) {
      showError('Monto Inválido', 'El monto debe ser mayor a cero');
      return;
    }

    if (amount > remainingBalance) {
      showError('Monto Excesivo', `El monto no puede ser mayor al saldo pendiente (${formatCurrency(remainingBalance)})`);
      return;
    }

    try {
      // Crear el abono
      const { data: installment, error: installmentError } = await supabase
        .from('payment_installments')
        .insert([{
          sale_id: selectedSale.id,
          amount_paid: amount,
          payment_method: paymentMethod,
          notes: paymentNotes
        }])
        .select()
        .single();

      if (installmentError) throw installmentError;

      // Actualizar el total pagado de la venta
      const newTotalPaid = (selectedSale.total_paid || 0) + amount;
      const newPaymentStatus = newTotalPaid >= selectedSale.total_amount ? 'paid' : 'partial';

      const { error: saleError } = await supabase
        .from('sales')
        .update({
          total_paid: newTotalPaid,
          payment_status: newPaymentStatus
        })
        .eq('id', selectedSale.id);

      if (saleError) throw saleError;

      // Preparar datos para impresión
      const paymentForPrint = {
        ...selectedSale,
        is_installment_receipt: true,
        payment_amount: amount,
        payment_date: installment.payment_date,
        payment_method_name: paymentMethod === 'cash' ? 'Efectivo' : 
      const amountValue = parseFloat(formData.amount);
      
      // Validar que el monto no sea mayor al saldo pendiente
      if (selectedSale && amountValue > (selectedSale.total_amount - (selectedSale.total_paid || 0))) {
        const remainingBalance = selectedSale.total_amount - (selectedSale.total_paid || 0);
        showError(
          'Monto Excesivo',
          `El monto del abono (${formatCurrency(amountValue)}) no puede ser mayor al saldo pendiente (${formatCurrency(remainingBalance)})`
        );
        return;
      }
      
                            paymentMethod === 'card' ? 'Tarjeta' :
                            paymentMethod === 'transfer' ? 'Transferencia' : 'Otro',
        amount_paid: amountValue,
        total_paid_after: newTotalPaid,
        remaining_balance: selectedSale.total_amount - newTotalPaid
      };

      setCompletedPayment(paymentForPrint);
      setShowPrintModal(true);

      // Reset form
      setShowPaymentModal(false);
      setSelectedSale(null);
      setPaymentAmount('');
      setPaymentMethod('cash');
      setPaymentNotes('');

      // Reload data
      loadInstallmentSales();
      loadInstallments();

      showSuccess(
        '¡Abono Registrado!',
        `Se ha registrado el abono de ${formatCurrency(amount)} exitosamente`
      );
    } catch (error) {
      console.error('Error processing payment:', error);
      showError(
        'Error al Procesar Abono',
        'No se pudo procesar el abono: ' + (error as Error).message
      );
    }
  };

  const viewInstallmentHistory = async (sale: SaleWithItems) => {
    try {
      setLoadingHistory(true);
      setSelectedSaleHistory(sale);
      
      // Cargar todos los abonos de esta venta
      const { data, error } = await supabase
        .from('payment_installments')
        .select(`
          *,
          sale:sales (
            *,
            customer:customers (name, phone, email),
            user:users (name, email)
          )
        `)
        .eq('sale_id', sale.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      
      setSaleInstallments(data as InstallmentWithSale[]);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error loading installment history:', error);
      showError(
        'Error al Cargar Historial',
        'No se pudo cargar el historial de abonos: ' + (error as Error).message
      );
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleEditInstallment = (installment: InstallmentWithSale) => {
    setEditingInstallment(installment);
    setEditInstallmentData({
      amount_paid: installment.amount_paid.toString(),
      payment_method: installment.payment_method,
      notes: installment.notes || ''
    });
    setShowEditInstallmentModal(true);
  };

  const handleUpdateInstallment = async () => {
    if (!editingInstallment || !selectedSaleHistory) return;

    const newAmount = parseFloat(editInstallmentData.amount_paid);
    if (newAmount <= 0) {
      showError('Monto Inválido', 'El monto debe ser mayor a cero');
      return;
    }

    // Calcular el total pagado sin este abono
    const otherInstallmentsTotal = saleInstallments
      .filter(inst => inst.id !== editingInstallment.id)
      .reduce((sum, inst) => sum + inst.amount_paid, 0);

    // Verificar que el nuevo monto no exceda el total de la venta
    if (otherInstallmentsTotal + newAmount > selectedSaleHistory.total_amount) {
      const maxAllowed = selectedSaleHistory.total_amount - otherInstallmentsTotal;
      showError(
        'Monto Excesivo', 
        `El monto no puede ser mayor a ${formatCurrency(maxAllowed)} (saldo disponible)`
      );
      return;
    }

    try {
      // Actualizar el abono
      const { error: installmentError } = await supabase
        .from('payment_installments')
        .update({
          amount_paid: newAmount,
          payment_method: editInstallmentData.payment_method,
          notes: editInstallmentData.notes
        })
        .eq('id', editingInstallment.id);

      if (installmentError) throw installmentError;

      // Recalcular el total pagado de la venta
      const newTotalPaid = otherInstallmentsTotal + newAmount;
      const newPaymentStatus = newTotalPaid >= selectedSaleHistory.total_amount ? 'paid' : 
                              newTotalPaid > 0 ? 'partial' : 'pending';

      const { error: saleError } = await supabase
        .from('sales')
        .update({
          total_paid: newTotalPaid,
          payment_status: newPaymentStatus
        })
        .eq('id', selectedSaleHistory.id);

      if (saleError) throw saleError;

      // Actualizar el estado local
      setSelectedSaleHistory({
        ...selectedSaleHistory,
        total_paid: newTotalPaid,
        payment_status: newPaymentStatus
      });

      setShowEditInstallmentModal(false);
      setEditingInstallment(null);
      
      // Recargar datos
      await viewInstallmentHistory(selectedSaleHistory);
      loadInstallmentSales();
      
      showSuccess(
        '¡Abono Actualizado!',
        `El abono ha sido actualizado a ${formatCurrency(newAmount)}`
      );
    } catch (error) {
      console.error('Error updating installment:', error);
      showError(
        'Error al Actualizar Abono',
        'No se pudo actualizar el abono: ' + (error as Error).message
      );
    }
  };

  const handleDeleteInstallment = (installment: InstallmentWithSale) => {
    if (!selectedSaleHistory) return;

    const confirmMessage = `¿Estás seguro de que quieres eliminar este abono de ${formatCurrency(installment.amount_paid)}?\n\nEsta acción no se puede deshacer y afectará el saldo de la venta.`;
    
    if (window.confirm(confirmMessage)) {
      deleteInstallment(installment);
    }
  };

  const deleteInstallment = async (installment: InstallmentWithSale) => {
    if (!selectedSaleHistory) return;

    try {
      // Eliminar el abono
      const { error: deleteError } = await supabase
        .from('payment_installments')
        .delete()
        .eq('id', installment.id);

      if (deleteError) throw deleteError;

      // Recalcular el total pagado de la venta
      const newTotalPaid = (selectedSaleHistory.total_paid || 0) - installment.amount_paid;
      const newPaymentStatus = newTotalPaid >= selectedSaleHistory.total_amount ? 'paid' : 
                              newTotalPaid > 0 ? 'partial' : 'pending';

      const { error: saleError } = await supabase
        .from('sales')
        .update({
          total_paid: Math.max(0, newTotalPaid),
          payment_status: newPaymentStatus
        })
        .eq('id', selectedSaleHistory.id);

      if (saleError) throw saleError;

      // Actualizar el estado local
      setSelectedSaleHistory({
        ...selectedSaleHistory,
        total_paid: Math.max(0, newTotalPaid),
        payment_status: newPaymentStatus
      });

      // Recargar datos
      await viewInstallmentHistory(selectedSaleHistory);
      loadInstallmentSales();
      
      showSuccess(
        '¡Abono Eliminado!',
        `El abono de ${formatCurrency(installment.amount_paid)} ha sido eliminado`
      );
    } catch (error) {
      console.error('Error deleting installment:', error);
      showError(
        'Error al Eliminar Abono',
        'No se pudo eliminar el abono: ' + (error as Error).message
      );
    }
  };

  const filteredSales = installmentSales.filter(sale => {
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const saleId = sale.id.slice(-8);
      const customerName = sale.customer?.name?.toLowerCase() || '';
      
      if (!(saleId.includes(searchTerm) || customerName.includes(searchLower))) {
        return false;
      }
    }
    
    // Filter by status
    if (statusFilter !== 'all') {
      if (statusFilter !== sale.payment_status) {
        return false;
      }
    }
    
    // Filter by date
    if (dateFilter && !sale.created_at.startsWith(dateFilter)) {
      return false;
    }
    
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Pagada';
      case 'partial':
        return 'Parcial';
      case 'pending':
        return 'Pendiente';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'partial':
        return <Clock className="h-4 w-4" />;
      case 'pending':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Gestión de Abonos</h2>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ID de venta o cliente..."
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
              <option value="pending">Pendientes</option>
              <option value="partial">Parciales</option>
              <option value="paid">Pagadas</option>
            </select>
          </div>
        </div>
        {(searchTerm || statusFilter !== 'all' || dateFilter) && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredSales.length} de {installmentSales.length} ventas
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-full">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Ventas a Crédito</p>
              <p className="text-2xl font-bold text-slate-900">{installmentSales.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-yellow-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Pendientes</p>
              <p className="text-2xl font-bold text-slate-900">
                {installmentSales.filter(s => s.payment_status === 'pending').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Parciales</p>
              <p className="text-2xl font-bold text-slate-900">
                {installmentSales.filter(s => s.payment_status === 'partial').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Completadas</p>
              <p className="text-2xl font-bold text-slate-900">
                {installmentSales.filter(s => s.payment_status === 'paid').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sales List */}
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
            <CreditCard className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {installmentSales.length === 0 
                ? 'No hay ventas a crédito registradas' 
                : 'No se encontraron ventas que coincidan con los filtros aplicados'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredSales.map((sale) => {
              const remainingBalance = sale.total_amount - (sale.total_paid || 0);
              const paymentProgress = ((sale.total_paid || 0) / sale.total_amount) * 100;
              
              return (
                <div key={sale.id} className="p-6 hover:bg-slate-50 transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            Venta #{sale.id.slice(-8)}
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sale.payment_status)}`}>
                              {getStatusIcon(sale.payment_status)}
                              <span className="ml-1">{getStatusLabel(sale.payment_status)}</span>
                            </span>
                          </h3>
                          <p className="text-sm text-slate-600">
                            {new Date(sale.created_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                          {sale.customer && (
                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                              <span className="flex items-center">
                                <User className="h-4 w-4 mr-1 text-blue-600" />
                                {sale.customer.name}
                              </span>
                              {sale.customer.phone && (
                                <span>{sale.customer.phone}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900">
                            {formatCurrency(sale.total_amount)}
                          </p>
                          <p className="text-sm text-green-600">
                            Pagado: {formatCurrency(sale.total_paid || 0)}
                          </p>
                          <p className="text-sm text-red-600">
                            Saldo: {formatCurrency(remainingBalance)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-600 mb-1">
                          <span>Progreso de pago</span>
                          <span>{paymentProgress.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${paymentProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      {sale.payment_status !== 'paid' && (
                        <button
                          onClick={() => {
                            setSelectedSale(sale);
                            setPaymentAmount('');
                            setPaymentMethod('cash');
                            setPaymentNotes('');
                            setShowPaymentModal(true);
                          }}
                          className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                          title="Registrar abono"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          viewInstallmentHistory(sale);
                        }}
                        disabled={loadingHistory}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                        title="Ver historial"
                      >
                        {loadingHistory ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Installment History Modal */}
      {showHistoryModal && selectedSaleHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Historial de Abonos - Venta #{selectedSaleHistory.id.slice(-8)}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Cliente: {selectedSaleHistory.customer?.name || 'Sin cliente'} • 
                    Total: {formatCurrency(selectedSaleHistory.total_amount)}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-green-600">
                      Pagado: {formatCurrency(selectedSaleHistory.total_paid || 0)}
                    </span>
                    <span className="text-red-600">
                      Saldo: {formatCurrency(selectedSaleHistory.total_amount - (selectedSaleHistory.total_paid || 0))}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedSaleHistory.payment_status)}`}>
                      {getStatusIcon(selectedSaleHistory.payment_status)}
                      <span className="ml-1">{getStatusLabel(selectedSaleHistory.payment_status)}</span>
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedSaleHistory(null);
                    setSaleInstallments([]);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-slate-600 mb-2">
                  <span>Progreso de pago</span>
                  <span>{(((selectedSaleHistory.total_paid || 0) / selectedSaleHistory.total_amount) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div 
                    className="bg-green-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${((selectedSaleHistory.total_paid || 0) / selectedSaleHistory.total_amount) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Installments List */}
              <div>
                <h4 className="font-medium text-slate-900 mb-4 flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                  Historial de Abonos ({saleInstallments.length})
                </h4>
                
                {saleInstallments.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">No hay abonos registrados para esta venta</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Los abonos aparecerán aquí cuando se registren pagos
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {saleInstallments.map((installment, index) => (
                      <div key={installment.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-100 rounded-lg">
                                <DollarSign className="h-4 w-4 text-green-600" />
                              </div>
                              <div>
                                <h5 className="font-medium text-slate-900">
                                  Abono #{index + 1}
                                </h5>
                                <p className="text-sm text-slate-600">
                                  {new Date(installment.payment_date).toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                                  <span className="flex items-center">
                                    <CreditCard className="h-3 w-3 mr-1" />
                                    {installment.payment_method === 'cash' ? 'Efectivo' : 
                                     installment.payment_method === 'card' ? 'Tarjeta' :
                                     installment.payment_method === 'transfer' ? 'Transferencia' : 'Otro'}
                                  </span>
                                  {installment.notes && (
                                    <span className="text-slate-500">
                                      {installment.notes}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-green-600">
                              {formatCurrency(installment.amount_paid)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {index === 0 ? 'Último abono' : `Hace ${index === 1 ? '1 abono' : `${index} abonos`}`}
                            </p>
                          </div>
                          
                          {/* Botones de acción para cada abono */}
                          <div className="flex flex-col gap-1 ml-3">
                            <button
                              onClick={() => handleEditInstallment(installment)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                              title="Editar abono"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteInstallment(installment)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                              title="Eliminar abono"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="font-medium text-slate-900 mb-4">Resumen de Pagos</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-600">Total de la Venta</p>
                    <p className="text-xl font-bold text-blue-900">
                      {formatCurrency(selectedSaleHistory.total_amount)}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-sm font-medium text-green-600">Total Pagado</p>
                    <p className="text-xl font-bold text-green-900">
                      {formatCurrency(selectedSaleHistory.total_paid || 0)}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      {saleInstallments.length} abono{saleInstallments.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <p className="text-sm font-medium text-orange-600">Saldo Pendiente</p>
                    <p className="text-xl font-bold text-orange-900">
                      {formatCurrency(selectedSaleHistory.total_amount - (selectedSaleHistory.total_paid || 0))}
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      {selectedSaleHistory.payment_status === 'paid' ? 'Completado' : 'Por pagar'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sale Details */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="font-medium text-slate-900 mb-4">Detalles de la Venta Original</h4>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">Fecha de venta:</span>
                      <p className="font-medium text-slate-900">
                        {new Date(selectedSaleHistory.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-600">Vendedor:</span>
                      <p className="font-medium text-slate-900">
                        {selectedSaleHistory.user?.name || 'No especificado'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-600">Productos:</span>
                      <p className="font-medium text-slate-900">
                        {selectedSaleHistory.sale_items?.length || 0} artículos
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-600">Tipo de pago:</span>
                      <p className="font-medium text-slate-900">Venta a crédito</p>
                    </div>
                  </div>
                  
                  {selectedSaleHistory.customer && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <span className="text-slate-600 text-sm">Información del cliente:</span>
                      <div className="mt-2 space-y-1">
                        <p className="font-medium text-slate-900">{selectedSaleHistory.customer.name}</p>
                        {selectedSaleHistory.customer.phone && (
                          <p className="text-sm text-slate-600 flex items-center">
                            <Phone className="h-3 w-3 mr-1" />
                            {selectedSaleHistory.customer.phone}
                          </p>
                        )}
                        {selectedSaleHistory.customer.email && (
                          <p className="text-sm text-slate-600">{selectedSaleHistory.customer.email}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex-shrink-0">
              <div className="flex gap-3">
                {selectedSaleHistory.payment_status !== 'paid' && (
                  <button
                    onClick={() => {
                      setShowHistoryModal(false);
                      setSelectedSale(selectedSaleHistory);
                      setPaymentAmount('');
                      setPaymentMethod('cash');
                      setPaymentNotes('');
                      setShowPaymentModal(true);
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Nuevo Abono
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedSaleHistory(null);
                    setSaleInstallments([]);
                  }}
                  className="flex-1 bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Registrar Abono - Venta #{selectedSale.id.slice(-8)}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Cliente: {selectedSale.customer?.name || 'Sin cliente'}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Total venta:</span>
                    <p className="font-bold text-slate-900">{formatCurrency(selectedSale.total_amount)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Ya pagado:</span>
                    <p className="font-bold text-green-600">{formatCurrency(selectedSale.total_paid || 0)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-600">Saldo pendiente:</span>
                    <p className="font-bold text-red-600">
                      {formatCurrency(selectedSale.total_amount - (selectedSale.total_paid || 0))}
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto del Abono *
                </label>
                <FormattedNumberInput
                  value={paymentAmount}
                  onChange={setPaymentAmount}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                  max={(selectedSale.total_amount - (selectedSale.total_paid || 0)).toString()}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Método de Pago *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notas sobre este abono..."
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handlePayment}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Registrar Abono
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && completedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                ¡Abono Registrado!
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                ¿Deseas imprimir el comprobante de abono?
              </p>
            </div>
            
            <div className="p-6">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-900">Abono registrado:</span>
                    <span className="text-xl font-bold text-green-900">
                      {formatCurrency(completedPayment.payment_amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700">Saldo restante:</span>
                    <span className="text-green-800">{formatCurrency(completedPayment.remaining_balance)}</span>
                  </div>
                  {completedPayment.customer && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-700">Cliente:</span>
                      <span className="text-green-800">{completedPayment.customer.name}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3">
                <PrintService
                  sale={completedPayment}
                  settings={(() => {
                    const savedSettings = localStorage.getItem('app_settings');
                    const printSettings = localStorage.getItem('print_settings');
                    if (savedSettings || printSettings) {
                      const appSettings = savedSettings ? JSON.parse(savedSettings) : {};
                      const printConfig = printSettings ? JSON.parse(printSettings) : {};
                      return {
                        print_enabled: true,
                        auto_print: false,
                        print_copies: 1,
                        receipt_width: '80mm',
                        show_logo: true,
                        show_company_info: true,
                        show_customer_info: true,
                        show_payment_details: true,
                        show_footer_message: true,
                        footer_message: '¡Gracias por su abono!',
                        receipt_header: '',
                        receipt_footer: 'Conserve este comprobante',
                        company_name: 'VentasFULL',
                        company_address: '',
                        company_phone: '',
                        company_email: '',
                        ...appSettings,
                        ...printConfig
                      };
                    }
                    return {
                      print_enabled: true,
                      auto_print: false,
                      print_copies: 1,
                      receipt_width: '80mm',
                      show_logo: true,
                      show_company_info: true,
                      show_customer_info: true,
                      show_payment_details: true,
                      show_footer_message: true,
                      footer_message: '¡Gracias por su abono!',
                      receipt_header: '',
                      receipt_footer: 'Conserve este comprobante',
                      company_name: 'VentasFULL',
                      company_address: '',
                      company_phone: '',
                      company_email: ''
                    };
                  })()}
                  onPrint={() => {
                    setShowPrintModal(false);
                    setCompletedPayment(null);
                  }}
                />
                <button
                  onClick={() => {
                    setShowPrintModal(false);
                    setCompletedPayment(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
                >
                  Continuar sin Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Installment Modal */}
      {showEditInstallmentModal && editingInstallment && selectedSaleHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Editar Abono
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Venta #{selectedSaleHistory.id.slice(-8)} • Cliente: {selectedSaleHistory.customer?.name || 'Sin cliente'}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Total venta:</span>
                    <p className="font-bold text-slate-900">{formatCurrency(selectedSaleHistory.total_amount)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Otros abonos:</span>
                    <p className="font-bold text-blue-600">
                      {formatCurrency(
                        saleInstallments
                          .filter(inst => inst.id !== editingInstallment.id)
                          .reduce((sum, inst) => sum + inst.amount_paid, 0)
                      )}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-600">Monto máximo permitido:</span>
                    <p className="font-bold text-green-600">
                      {formatCurrency(
                        selectedSaleHistory.total_amount - 
                        saleInstallments
                          .filter(inst => inst.id !== editingInstallment.id)
                          .reduce((sum, inst) => sum + inst.amount_paid, 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto del Abono *
                </label>
                <FormattedNumberInput
                  value={editInstallmentData.amount_paid}
                  onChange={(value) => setEditInstallmentData({ ...editInstallmentData, amount_paid: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                  max={(
                    selectedSaleHistory.total_amount - 
                    saleInstallments
                      .filter(inst => inst.id !== editingInstallment.id)
                      .reduce((sum, inst) => sum + inst.amount_paid, 0)
                  ).toString()}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Método de Pago *
                </label>
                <select
                  value={editInstallmentData.payment_method}
                  onChange={(e) => setEditInstallmentData({ ...editInstallmentData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={editInstallmentData.notes}
                  onChange={(e) => setEditInstallmentData({ ...editInstallmentData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notas sobre este abono..."
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleUpdateInstallment}
                disabled={!editInstallmentData.amount_paid || parseFloat(editInstallmentData.amount_paid) <= 0}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                Actualizar Abono
              </button>
              <button
                onClick={() => {
                  setShowEditInstallmentModal(false);
                  setEditingInstallment(null);
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
    </div>
  );
}