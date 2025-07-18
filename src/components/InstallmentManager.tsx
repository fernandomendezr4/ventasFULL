import React, { useState, useEffect } from 'react';
import { DollarSign, User, Calendar, Plus, Eye, X, Edit2, Trash2, Clock, Search, Filter, Printer, Phone, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import FormattedNumberInput from './FormattedNumberInput';
import PrintService from './PrintService';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';

interface SaleWithInstallments {
  id: string;
  total_amount: number;
  subtotal: number;
  discount_amount: number;
  total_paid: number;
  payment_status: string;
  created_at: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string;
    cedula: string;
  } | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  payment_installments: PaymentInstallment[];
}

interface PaymentInstallment {
  id: string;
  sale_id: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  notes: string;
  created_at: string;
}

export default function InstallmentManager() {
  const { notification, showSuccess, showError, showWarning, hideNotification } = useNotification();
  const { confirmation, showConfirmation, hideConfirmation, handleConfirm } = useConfirmation();
  const [installmentSales, setInstallmentSales] = useState<SaleWithInstallments[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleWithInstallments | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentInstallment | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'customer_name' | 'total_amount'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadInstallmentSales();
  }, []);

  const loadInstallmentSales = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers (
            id,
            name,
            phone,
            email,
            cedula
          ),
          user:users (
            id,
            name,
            email
          ),
          payment_installments (*)
        `)
        .eq('payment_type', 'installment')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Sort payment installments by date and recalculate totals
      const salesWithCalculatedTotals = data.map(sale => {
        const sortedPayments = sale.payment_installments.sort((a: PaymentInstallment, b: PaymentInstallment) => 
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        );
        
        // Recalcular total pagado basado en los abonos
        const calculatedTotalPaid = sortedPayments.reduce((sum: number, payment: PaymentInstallment) => 
          sum + payment.amount_paid, 0
        );
        
        // Determinar estado de pago correcto
        let paymentStatus = 'pending';
        if (calculatedTotalPaid >= sale.total_amount) {
          paymentStatus = 'paid';
        } else if (calculatedTotalPaid > 0) {
          paymentStatus = 'partial';
        }
        
        return {
          ...sale,
          payment_installments: sortedPayments,
          total_paid: calculatedTotalPaid,
          payment_status: paymentStatus
        };
      });
      
      setInstallmentSales(salesWithCalculatedTotals as SaleWithInstallments[]);
      return salesWithCalculatedTotals as SaleWithInstallments[];
    } catch (error) {
      console.error('Error loading installment sales:', error);
      showError(
        'Error al Cargar Ventas',
        'No se pudieron cargar las ventas por abonos. ' + (error as Error).message
      );
      return [];
    } finally {
      setLoading(false);
    }
  };

  const recalculateSaleTotal = async (saleId: string) => {
    try {
      // Obtener todos los abonos de la venta
      const { data: payments, error } = await supabase
        .from('payment_installments')
        .select('amount_paid')
        .eq('sale_id', saleId);

      if (error) throw error;

      const totalPaid = payments.reduce((sum, payment) => sum + payment.amount_paid, 0);
      
      // Obtener el total de la venta
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      // Determinar estado de pago
      let paymentStatus = 'pending';
      if (totalPaid >= sale.total_amount) {
        paymentStatus = 'paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'partial';
      }

      // Actualizar la venta
      const { error: updateError } = await supabase
        .from('sales')
        .update({
          total_paid: totalPaid,
          payment_status: paymentStatus
        })
        .eq('id', saleId);

      if (updateError) throw updateError;

      return { totalPaid, paymentStatus };
    } catch (error) {
      console.error('Error recalculating sale total:', error);
      throw error;
    }
  };

  const handlePayment = async () => {
    if (!selectedSale || !paymentAmount) return;

    try {
      const amount = parseFloat(paymentAmount);
      
      if (amount <= 0) {
        showWarning(
          'Monto Inválido',
          'El monto debe ser mayor a 0'
        );
        return;
      }

      const remainingBalance = selectedSale.total_amount - selectedSale.total_paid;
      if (amount > remainingBalance) {
        showWarning(
          'Monto Excesivo',
          `El monto no puede ser mayor al saldo pendiente: ${formatCurrency(remainingBalance)}`
        );
        return;
      }

      // Record payment installment
      const { error: installmentError } = await supabase
        .from('payment_installments')
        .insert([{
          sale_id: selectedSale.id,
          amount_paid: amount,
          payment_method: 'cash',
          notes: paymentNotes || 'Abono en efectivo'
        }]);

      if (installmentError) throw installmentError;

      // Record payment in payments table
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          sale_id: selectedSale.id,
          amount: amount,
          payment_method: 'cash',
          notes: `Abono - ${paymentNotes || 'Pago en efectivo'}`
        }]);

      if (paymentError) throw paymentError;

      // Recalcular totales de la venta
      await recalculateSaleTotal(selectedSale.id);

      // Register payment in current cash register if open
      try {
        const { data: currentRegister } = await supabase
          .from('cash_registers')
          .select('*')
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (currentRegister) {
          // Register as sale movement in cash register
          await supabase
            .from('cash_movements')
            .insert([{
              cash_register_id: currentRegister.id,
              type: 'sale',
              category: 'ventas_efectivo',
              amount: amount,
              description: `Abono venta #${selectedSale.id.slice(-8)} - ${selectedSale.customer?.name || 'Cliente'} - ${paymentNotes || 'Pago en efectivo'}`,
              reference_id: selectedSale.id,
              created_by: currentRegister.user_id
            }]);

          // Update cash register total sales
          await supabase
            .from('cash_registers')
            .update({
              total_sales: (currentRegister.total_sales || 0) + amount
            })
            .eq('id', currentRegister.id);
        }
      } catch (error) {
        console.error('Error updating cash register with installment payment:', error);
      }

      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');
      
      // Recargar datos y actualizar venta seleccionada
      const updatedSales = await loadInstallmentSales();
      const updatedSale = updatedSales.find(s => s.id === selectedSale.id);
      if (updatedSale) {
        setSelectedSale(updatedSale);
      }
      
      // Preparar datos para impresión del abono
      const paymentForPrint = {
        id: `payment-${Date.now()}`,
        payment_amount: amount,
        payment_date: new Date().toISOString(),
        payment_notes: paymentNotes || 'Abono en efectivo',
        sale: selectedSale,
        customer: selectedSale.customer,
        remaining_balance: selectedSale.total_amount - (selectedSale.total_paid + amount),
        total_paid_after: selectedSale.total_paid + amount
      };
      
      setCompletedPayment(paymentForPrint);
      setShowPrintModal(true);
      
      showSuccess(
        '¡Abono Registrado!',
        `Se ha registrado un abono de ${formatCurrency(amount)} exitosamente`
      );
    } catch (error) {
      console.error('Error processing payment:', error);
      showError(
        'Error al Procesar Abono',
        'No se pudo procesar el abono. ' + (error as Error).message
      );
    }
  };

  const handleEditPayment = async () => {
    if (!editingPayment || !paymentAmount || !selectedSale) return;

    try {
      const newAmount = parseFloat(paymentAmount);
      
      if (newAmount <= 0) {
        showWarning(
          'Monto Inválido',
          'El monto debe ser mayor a 0'
        );
        return;
      }

      const oldAmount = editingPayment.amount_paid;
      const currentTotalPaid = selectedSale.total_paid - oldAmount;
      const newTotalPaid = currentTotalPaid + newAmount;

      if (newTotalPaid > selectedSale.total_amount) {
        showWarning(
          'Monto Excesivo',
          `El monto total no puede exceder el valor de la venta: ${formatCurrency(selectedSale.total_amount)}`
        );
        return;
      }

      // Update payment installment
      const { error: installmentError } = await supabase
        .from('payment_installments')
        .update({
          amount_paid: newAmount,
          notes: paymentNotes || 'Abono editado'
        })
        .eq('id', editingPayment.id);

      if (installmentError) throw installmentError;

      // Update corresponding payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          amount: newAmount,
          notes: `Abono - ${paymentNotes || 'Abono editado'}`
        })
        .eq('sale_id', selectedSale.id)
        .eq('amount', oldAmount)
        .order('created_at', { ascending: false })
        .limit(1);

      if (paymentError) console.error('Error updating payment record:', paymentError);

      // Recalcular totales de la venta
      await recalculateSaleTotal(selectedSale.id);

      setShowEditModal(false);
      setEditingPayment(null);
      setPaymentAmount('');
      setPaymentNotes('');
      
      // Recargar datos y actualizar venta seleccionada
      const updatedSales = await loadInstallmentSales();
      const updatedSale = updatedSales.find(s => s.id === selectedSale.id);
      if (updatedSale) {
        setSelectedSale(updatedSale);
      }
      
      showSuccess(
        '¡Abono Actualizado!',
        `El abono ha sido actualizado a ${formatCurrency(newAmount)} exitosamente`
      );
    } catch (error) {
      console.error('Error updating payment:', error);
      showError(
        'Error al Actualizar Abono',
        'No se pudo actualizar el abono. ' + (error as Error).message
      );
    }
  };

  const handleDeletePayment = async (payment: PaymentInstallment) => {
    if (!selectedSale) return;

    showConfirmation(
      'Eliminar Abono',
      `¿Estás seguro de que quieres eliminar este abono de ${formatCurrency(payment.amount_paid)}? Esta acción no se puede deshacer.`,
      async () => {
        try {
          // Delete payment installment
          const { error: installmentError } = await supabase
            .from('payment_installments')
            .delete()
            .eq('id', payment.id);

          if (installmentError) throw installmentError;

          // Delete corresponding payment record
          const { error: paymentError } = await supabase
            .from('payments')
            .delete()
            .eq('sale_id', selectedSale.id)
            .eq('amount', payment.amount_paid)
            .order('created_at', { ascending: false })
            .limit(1);

          if (paymentError) console.error('Error deleting payment record:', paymentError);

          // Recalcular totales de la venta
          await recalculateSaleTotal(selectedSale.id);

          // Recargar datos y actualizar venta seleccionada
          const updatedSales = await loadInstallmentSales();
          const updatedSale = updatedSales.find(s => s.id === selectedSale.id);
          if (updatedSale) {
            setSelectedSale(updatedSale);
          }
          
          showSuccess(
            '¡Abono Eliminado!',
            `El abono de ${formatCurrency(payment.amount_paid)} ha sido eliminado exitosamente`
          );
        } catch (error) {
          console.error('Error deleting payment:', error);
          showError(
            'Error al Eliminar Abono',
            'No se pudo eliminar el abono. ' + (error as Error).message
          );
        }
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      }
    );
  };

  const openEditModal = (payment: PaymentInstallment) => {
    setEditingPayment(payment);
    setPaymentAmount(payment.amount_paid.toString());
    setPaymentNotes(payment.notes);
    setShowEditModal(true);
  };

  const filteredAndSortedSales = installmentSales.filter(sale => {
    // Filter by status
    if (statusFilter !== 'all' && sale.payment_status !== statusFilter) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const customerName = sale.customer?.name?.toLowerCase() || '';
      const customerPhone = sale.customer?.phone || '';
      const customerEmail = sale.customer?.email?.toLowerCase() || '';
      const saleId = sale.id.slice(-8);
      
      return (
        customerName.includes(searchLower) ||
        customerPhone.includes(searchTerm) ||
        customerEmail.includes(searchLower) ||
        saleId.includes(searchTerm)
      );
    }
    
    return true;
  }).sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    switch (sortBy) {
      case 'customer_name':
        aValue = a.customer?.name || '';
        bValue = b.customer?.name || '';
        break;
      case 'total_amount':
        aValue = a.total_amount;
        bValue = b.total_amount;
        break;
      case 'created_at':
      default:
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
    }
    
    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Pagada';
      case 'partial':
        return 'Parcial';
      default:
        return 'Pendiente';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Ventas por Abonos</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, teléfono o ID de venta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'created_at' | 'customer_name' | 'total_amount')}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="created_at">Ordenar por Fecha</option>
              <option value="customer_name">Ordenar por Cliente</option>
              <option value="total_amount">Ordenar por Monto</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              title={`Orden ${sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}`}
            >
              <Filter className={`h-4 w-4 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform duration-200`} />
            </button>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="partial">Parciales</option>
            <option value="paid">Pagadas</option>
          </select>
        </div>
      </div>

      {/* Search Results Info */}
      {(searchTerm || statusFilter !== 'all') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            Mostrando {filteredAndSortedSales.length} de {installmentSales.length} ventas
            {searchTerm && ` que coinciden con "${searchTerm}"`}
            {statusFilter !== 'all' && ` con estado "${getStatusLabel(statusFilter)}"`}
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {filteredAndSortedSales.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-600">Total Ventas</p>
            <p className="text-2xl font-bold text-blue-900">{filteredAndSortedSales.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm font-medium text-green-600">Monto Total</p>
            <p className="text-2xl font-bold text-green-900">
              {formatCurrency(filteredAndSortedSales.reduce((sum, sale) => sum + sale.total_amount, 0))}
            </p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
            <p className="text-sm font-medium text-emerald-600">Total Pagado</p>
            <p className="text-2xl font-bold text-emerald-900">
              {formatCurrency(filteredAndSortedSales.reduce((sum, sale) => sum + sale.total_paid, 0))}
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <p className="text-sm font-medium text-orange-600">Saldo Pendiente</p>
            <p className="text-2xl font-bold text-orange-900">
              {formatCurrency(filteredAndSortedSales.reduce((sum, sale) => sum + (sale.total_amount - sale.total_paid), 0))}
            </p>
          </div>
        </div>
      )}

      {/* Installment Sales List */}
      <div className="bg-white rounded-xl shadow-sm border">
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
        ) : filteredAndSortedSales.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {installmentSales.length === 0 
                ? 'No hay ventas por abonos registradas' 
                : 'No se encontraron ventas que coincidan con los filtros aplicados'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredAndSortedSales.map((sale) => (
              <div key={sale.id} className="p-6 hover:bg-slate-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {sale.customer?.name || 'Cliente no especificado'}
                        </h3>
                        <p className="text-sm text-slate-600">
                          Venta #{sale.id.slice(-8)} • {new Date(sale.created_at).toLocaleDateString('es-ES')}
                        </p>
                        {/* Información adicional del cliente */}
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                          {sale.customer?.phone && (
                            <span className="flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {sale.customer.phone}
                            </span>
                          )}
                          {sale.customer?.email && (
                            <span className="flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {sale.customer.email}
                            </span>
                          )}
                          {sale.customer?.cedula && (
                            <span>CC: {sale.customer.cedula}</span>
                          )}
                        </div>
                        {/* Información financiera */}
                        <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                          <div>
                            <span className="text-slate-500">Total:</span>
                            <p className="font-semibold text-slate-900">{formatCurrency(sale.total_amount)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Pagado:</span>
                            <p className="font-semibold text-green-600">{formatCurrency(sale.total_paid)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Saldo:</span>
                            <p className="font-semibold text-orange-600">{formatCurrency(sale.total_amount - sale.total_paid)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Abonos:</span>
                            <p className="font-semibold text-blue-600">{sale.payment_installments.length}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(sale.payment_status)}`}>
                      {getStatusLabel(sale.payment_status)}
                    </span>
                    {sale.payment_status !== 'paid' && (
                      <button
                        onClick={() => {
                          setSelectedSale(sale);
                          setPaymentAmount((sale.total_amount - sale.total_paid).toString());
                          setPaymentNotes('');
                          setShowPaymentModal(true);
                        }}
                        className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm flex items-center"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Abonar
                      </button>
                    )}
                    <PrintService
                      sale={sale}
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
                            footer_message: '¡Gracias por su compra!',
                            receipt_header: 'FACTURA DE VENTA',
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
                          footer_message: '¡Gracias por su compra!',
                          receipt_header: 'FACTURA DE VENTA',
                          receipt_footer: 'Conserve este comprobante',
                          company_name: 'VentasFULL',
                          company_address: '',
                          company_phone: '',
                          company_email: ''
                        };
                      })()}
                    />
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                      title="Ver historial de abonos"
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

      {/* Sale Detail Modal */}
      {selectedSale && !showPaymentModal && !showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Historial de Abonos - {selectedSale.customer?.name || 'Cliente no especificado'}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Venta #{selectedSale.id.slice(-8)} • {new Date(selectedSale.created_at).toLocaleDateString('es-ES')}
                  </p>
                  {selectedSale.customer && (
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                      {selectedSale.customer.phone && (
                        <span className="flex items-center">
                          <Phone className="h-4 w-4 mr-1" />
                          {selectedSale.customer.phone}
                        </span>
                      )}
                      {selectedSale.customer.email && (
                        <span className="flex items-center">
                          <Mail className="h-4 w-4 mr-1" />
                          {selectedSale.customer.email}
                        </span>
                      )}
                      {selectedSale.customer.cedula && (
                        <span>CC: {selectedSale.customer.cedula}</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Sale Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-600">Total de la Venta</p>
                  <p className="text-2xl font-bold text-blue-900">{formatCurrency(selectedSale.total_amount)}</p>
                  {selectedSale.discount_amount > 0 && (
                    <p className="text-xs text-blue-700 mt-1">
                      Subtotal: {formatCurrency(selectedSale.subtotal || selectedSale.total_amount)}
                      <br />Descuento: -{formatCurrency(selectedSale.discount_amount)}
                    </p>
                  )}
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-600">Total Pagado</p>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(selectedSale.total_paid)}</p>
                  <p className="text-xs text-green-700 mt-1">
                    {((selectedSale.total_paid / selectedSale.total_amount) * 100).toFixed(1)}% del total
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <p className="text-sm font-medium text-orange-600">Saldo Pendiente</p>
                  <p className="text-2xl font-bold text-orange-900">{formatCurrency(selectedSale.total_amount - selectedSale.total_paid)}</p>
                  <p className="text-xs text-orange-700 mt-1">
                    {(((selectedSale.total_amount - selectedSale.total_paid) / selectedSale.total_amount) * 100).toFixed(1)}% restante
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-sm font-medium text-purple-600">Estado</p>
                  <p className="text-lg font-bold text-purple-900">{getStatusLabel(selectedSale.payment_status)}</p>
                  <p className="text-xs text-purple-700 mt-1">
                    {selectedSale.payment_installments.length} abono{selectedSale.payment_installments.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              {selectedSale.payment_status !== 'paid' && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900">Acciones Rápidas</h4>
                      <p className="text-sm text-slate-600">Gestiona los abonos de esta venta</p>
                    </div>
                    <button
                      onClick={() => {
                        setPaymentAmount((selectedSale.total_amount - selectedSale.total_paid).toString());
                        setPaymentNotes('');
                        setShowPaymentModal(true);
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Registrar Nuevo Abono
                    </button>
                  </div>
                </div>
              )}

              {/* Payment History */}
              <h4 className="font-medium text-slate-900 mb-4">Historial de Abonos</h4>
              <div className="space-y-3">
                {selectedSale.payment_installments.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <DollarSign className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">No hay abonos registrados para esta venta</p>
                    <button
                      onClick={() => {
                        setPaymentAmount(selectedSale.total_amount.toString());
                        setPaymentNotes('');
                        setShowPaymentModal(true);
                      }}
                      className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center mx-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Registrar Primer Abono
                    </button>
                  </div>
                ) : (
                  selectedSale.payment_installments.map((payment, index) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors duration-200">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <DollarSign className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <h5 className="font-medium text-slate-900">
                              Abono #{selectedSale.payment_installments.length - index} - {formatCurrency(payment.amount_paid)}
                            </h5>
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {new Date(payment.payment_date).toLocaleDateString('es-ES')}
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                {new Date(payment.payment_date).toLocaleTimeString('es-ES', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                              <span>• {payment.payment_method}</span>
                            </div>
                            {payment.notes && (
                              <p className="text-sm text-slate-500 mt-1 italic">"{payment.notes}"</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(payment)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                          title="Editar abono"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePayment(payment)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          title="Eliminar abono"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Registrar Abono
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {selectedSale.customer?.name || 'Cliente no especificado'}
              </p>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">Total venta:</span>
                      <p className="font-bold">{formatCurrency(selectedSale.total_amount)}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Ya pagado:</span>
                      <p className="font-bold text-green-600">{formatCurrency(selectedSale.total_paid)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-600">Saldo pendiente:</span>
                      <p className="font-bold text-orange-600">{formatCurrency(selectedSale.total_amount - selectedSale.total_paid)}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monto del Abono *
                  </label>
                  <FormattedNumberInput
                    value={paymentAmount}
                    onChange={(value) => setPaymentAmount(value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    max={(selectedSale.total_amount - selectedSale.total_paid).toString()}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Máximo: {formatCurrency(selectedSale.total_amount - selectedSale.total_paid)}
                  </p>
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
                    placeholder="Observaciones del pago..."
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handlePayment}
                disabled={
                  !paymentAmount || 
                  parseFloat(paymentAmount) <= 0 || 
                  parseFloat(paymentAmount) > (selectedSale.total_amount - selectedSale.total_paid)
                }
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Registrar Abono
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                  setPaymentNotes('');
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {showEditModal && editingPayment && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Editar Abono
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {selectedSale.customer?.name || 'Cliente no especificado'}
              </p>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Información del Abono</h4>
                  <div className="text-sm text-blue-800">
                    <p>Fecha: {new Date(editingPayment.payment_date).toLocaleDateString('es-ES')}</p>
                    <p>Hora: {new Date(editingPayment.payment_date).toLocaleTimeString('es-ES', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}</p>
                    <p>Monto original: {formatCurrency(editingPayment.amount_paid)}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nuevo Monto del Abono *
                  </label>
                  <FormattedNumberInput
                    value={paymentAmount}
                    onChange={(value) => setPaymentAmount(value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    max={(selectedSale.total_amount - (selectedSale.total_paid - editingPayment.amount_paid)).toString()}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Máximo permitido: {formatCurrency(selectedSale.total_amount - (selectedSale.total_paid - editingPayment.amount_paid))}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Observaciones del pago..."
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleEditPayment}
                disabled={
                  !paymentAmount || 
                  parseFloat(paymentAmount) <= 0 || 
                  parseFloat(paymentAmount) > (selectedSale.total_amount - (selectedSale.total_paid - editingPayment.amount_paid))
                }
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Actualizar Abono
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingPayment(null);
                  setPaymentAmount('');
                  setPaymentNotes('');
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal for Payment */}
      {showPrintModal && completedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {completedPayment.is_edit ? '¡Abono Actualizado!' : '¡Abono Registrado!'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                ¿Deseas imprimir el comprobante de abono?
              </p>
            </div>
            
            <div className="p-6">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-900">Abono realizado:</span>
                    <span className="text-xl font-bold text-green-900">
                      {formatCurrency(completedPayment.payment_amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700">Cliente:</span>
                    <span className="text-green-800">{completedPayment.customer?.name || 'Sin especificar'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700">Saldo restante:</span>
                    <span className="text-green-800">{formatCurrency(completedPayment.remaining_balance)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <PrintService
                  sale={{
                    ...completedPayment.sale,
                    payment_amount: completedPayment.payment_amount,
                    payment_date: completedPayment.payment_date,
                    payment_notes: completedPayment.payment_notes,
                    remaining_balance: completedPayment.remaining_balance,
                    total_paid_after: completedPayment.total_paid_after,
                    is_installment_receipt: true
                  }}
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
                        receipt_header: 'COMPROBANTE DE ABONO',
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
                      receipt_header: 'COMPROBANTE DE ABONO',
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