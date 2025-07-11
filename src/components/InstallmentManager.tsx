import React, { useState, useEffect } from 'react';
import { DollarSign, User, Calendar, Plus, Eye, X, Edit2, Trash2, Clock, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import FormattedNumberInput from './FormattedNumberInput';

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
  const [installmentSales, setInstallmentSales] = useState<SaleWithInstallments[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleWithInstallments | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentInstallment | null>(null);
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
            email
          ),
          payment_installments (*)
        `)
        .eq('payment_type', 'installment')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Sort payment installments by date
      const salesWithSortedPayments = data.map(sale => ({
        ...sale,
        payment_installments: sale.payment_installments.sort((a: PaymentInstallment, b: PaymentInstallment) => 
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        )
      }));
      
      setInstallmentSales(salesWithSortedPayments as SaleWithInstallments[]);
      return salesWithSortedPayments as SaleWithInstallments[];
    } catch (error) {
      console.error('Error loading installment sales:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedSale || !paymentAmount) return;

    try {
      const amount = parseFloat(paymentAmount);
      
      if (amount <= 0) {
        alert('El monto debe ser mayor a 0');
        return;
      }

      const remainingBalance = selectedSale.total_amount - selectedSale.total_paid;
      if (amount > remainingBalance) {
        alert(`El monto no puede ser mayor al saldo pendiente: ${formatCurrency(remainingBalance)}`);
        return;
      }

      // Record payment installment
      const { error: installmentError } = await supabase
        .from('payment_installments')
        .insert([{
          sale_id: selectedSale.id,
          amount_paid: amount,
          payment_method: 'cash',
          notes: paymentNotes
        }]);

      if (installmentError) throw installmentError;

      // Record payment in payments table
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          sale_id: selectedSale.id,
          amount: amount,
          payment_method: 'cash',
          notes: `Abono - ${paymentNotes}`
        }]);

      if (paymentError) throw paymentError;

      // Update sale total paid
      const newTotalPaid = selectedSale.total_paid + amount;
      const { error: saleUpdateError } = await supabase
        .from('sales')
        .update({
          total_paid: newTotalPaid,
          payment_status: newTotalPaid >= selectedSale.total_amount ? 'paid' : 'partial'
        })
        .eq('id', selectedSale.id);

      if (saleUpdateError) throw saleUpdateError;

      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');
      
      await loadInstallmentSales();
      // Update the selected sale with fresh data
      const updatedSales = await loadInstallmentSales();
      const updatedSale = updatedSales.find(s => s.id === selectedSale.id);
      if (updatedSale) {
        setSelectedSale(updatedSale);
      }
      alert('Pago registrado exitosamente');
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Error al procesar el pago: ' + (error as Error).message);
    }
  };

  const handleEditPayment = async () => {
    if (!editingPayment || !paymentAmount || !selectedSale) return;

    try {
      const newAmount = parseFloat(paymentAmount);
      
      if (newAmount <= 0) {
        alert('El monto debe ser mayor a 0');
        return;
      }

      const oldAmount = editingPayment.amount_paid;
      const currentTotalPaid = selectedSale.total_paid - oldAmount;
      const newTotalPaid = currentTotalPaid + newAmount;

      if (newTotalPaid > selectedSale.total_amount) {
        alert(`El monto total no puede exceder el valor de la venta: ${formatCurrency(selectedSale.total_amount)}`);
        return;
      }

      // Update payment installment
      const { error: installmentError } = await supabase
        .from('payment_installments')
        .update({
          amount_paid: newAmount,
          notes: paymentNotes
        })
        .eq('id', editingPayment.id);

      if (installmentError) throw installmentError;

      // Update corresponding payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          amount: newAmount,
          notes: `Abono - ${paymentNotes}`
        })
        .eq('sale_id', selectedSale.id)
        .eq('amount', oldAmount);

      if (paymentError) console.error('Error updating payment record:', paymentError);

      // Update sale total paid
      const { error: saleUpdateError } = await supabase
        .from('sales')
        .update({
          total_paid: newTotalPaid,
          payment_status: newTotalPaid >= selectedSale.total_amount ? 'paid' : newTotalPaid > 0 ? 'partial' : 'pending'
        })
        .eq('id', selectedSale.id);

      if (saleUpdateError) throw saleUpdateError;

      setShowEditModal(false);
      setEditingPayment(null);
      setPaymentAmount('');
      setPaymentNotes('');
      
      await loadInstallmentSales();
      // Update the selected sale with fresh data
      const updatedSales = await loadInstallmentSales();
      const updatedSale = updatedSales.find(s => s.id === selectedSale.id);
      if (updatedSale) {
        setSelectedSale(updatedSale);
      }
      alert('Abono actualizado exitosamente');
    } catch (error) {
      console.error('Error updating payment:', error);
      alert('Error al actualizar el abono: ' + (error as Error).message);
    }
  };

  const handleDeletePayment = async (payment: PaymentInstallment) => {
    if (!selectedSale) return;

    if (!window.confirm('¿Estás seguro de que quieres eliminar este abono?')) {
      return;
    }

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
        .eq('amount', payment.amount_paid);

      if (paymentError) console.error('Error deleting payment record:', paymentError);

      // Update sale total paid
      const newTotalPaid = selectedSale.total_paid - payment.amount_paid;
      const { error: saleUpdateError } = await supabase
        .from('sales')
        .update({
          total_paid: newTotalPaid,
          payment_status: newTotalPaid >= selectedSale.total_amount ? 'paid' : newTotalPaid > 0 ? 'partial' : 'pending'
        })
        .eq('id', selectedSale.id);

      if (saleUpdateError) throw saleUpdateError;

      await loadInstallmentSales();
      // Update the selected sale with fresh data
      const updatedSales = await loadInstallmentSales();
      const updatedSale = updatedSales.find(s => s.id === selectedSale.id);
      if (updatedSale) {
        setSelectedSale(updatedSale);
      }
      alert('Abono eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Error al eliminar el abono: ' + (error as Error).message);
    }
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
            {statusFilter !== 'all' && ` con estado "${statusFilter === 'paid' ? 'Pagadas' : statusFilter === 'partial' ? 'Parciales' : 'Pendientes'}"`}
          </p>
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
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <span className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            Total: {formatCurrency(sale.total_amount)}
                          </span>
                          <span className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            Pagado: {formatCurrency(sale.total_paid)}
                          </span>
                          <span className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            Saldo: {formatCurrency(sale.total_amount - sale.total_paid)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sale.payment_status)}`}>
                      {sale.payment_status === 'paid' ? 'Pagada' : 
                       sale.payment_status === 'partial' ? 'Parcial' : 'Pendiente'}
                    </span>
                    {sale.payment_status !== 'paid' && (
                      <button
                        onClick={() => {
                          setSelectedSale(sale);
                          setPaymentAmount((sale.total_amount - sale.total_paid).toString());
                          setShowPaymentModal(true);
                        }}
                        className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm flex items-center"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Abonar
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
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
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-600">Total Pagado</p>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(selectedSale.total_paid)}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <p className="text-sm font-medium text-orange-600">Saldo Pendiente</p>
                  <p className="text-2xl font-bold text-orange-900">{formatCurrency(selectedSale.total_amount - selectedSale.total_paid)}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-sm font-medium text-purple-600">Estado</p>
                  <p className="text-lg font-bold text-purple-900">
                    {selectedSale.payment_status === 'paid' ? 'Pagada' : 
                     selectedSale.payment_status === 'partial' ? 'Parcial' : 'Pendiente'}
                  </p>
                </div>
              </div>

              {/* Payment History */}
              <h4 className="font-medium text-slate-900 mb-4">Historial de Abonos</h4>
              <div className="space-y-3">
                {selectedSale.payment_installments.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No hay abonos registrados</p>
                ) : (
                  selectedSale.payment_installments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <DollarSign className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <h5 className="font-medium text-slate-900">
                              Abono de {formatCurrency(payment.amount_paid)}
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
                              <p className="text-sm text-slate-500 mt-1">{payment.notes}</p>
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
                    Monto del Abono
                  </label>
                  <FormattedNumberInput
                    value={paymentAmount}
                    onChange={(value) => setPaymentAmount(value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    max={(selectedSale.total_amount - selectedSale.total_paid).toString()}
                  />
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
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
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
                    Nuevo Monto del Abono
                  </label>
                  <FormattedNumberInput
                    value={paymentAmount}
                    onChange={(value) => setPaymentAmount(value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
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
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
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
    </div>
  );
}