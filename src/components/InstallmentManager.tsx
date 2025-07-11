import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, User, CheckCircle, Clock, AlertTriangle, CreditCard, Eye, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InstallmentSale {
  id: string;
  sale_id: string;
  total_installments: number;
  installment_amount: number;
  down_payment: number;
  remaining_balance: number;
  status: string;
  created_at: string;
  sale: {
    id: string;
    total_amount: number;
    created_at: string;
    customer: {
      id: string;
      name: string;
      phone: string;
      email: string;
    } | null;
  };
}

interface InstallmentPayment {
  id: string;
  installment_sale_id: string;
  installment_number: number;
  amount_paid: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  notes: string;
}

interface InstallmentSaleWithPayments extends InstallmentSale {
  installment_payments: InstallmentPayment[];
}

export default function InstallmentManager() {
  const [installmentSales, setInstallmentSales] = useState<InstallmentSale[]>([]);
  const [selectedSale, setSelectedSale] = useState<InstallmentSaleWithPayments | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<InstallmentPayment | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadInstallmentSales();
  }, []);

  const loadInstallmentSales = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('installment_sales')
        .select(`
          *,
          sale:sales (
            id,
            total_amount,
            created_at,
            customer:customers (
              id,
              name,
              phone,
              email
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstallmentSales(data as InstallmentSale[]);
    } catch (error) {
      console.error('Error loading installment sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSaleDetails = async (saleId: string) => {
    try {
      const { data, error } = await supabase
        .from('installment_sales')
        .select(`
          *,
          sale:sales (
            id,
            total_amount,
            created_at,
            customer:customers (
              id,
              name,
              phone,
              email
            )
          ),
          installment_payments (*)
        `)
        .eq('id', saleId)
        .single();

      if (error) throw error;
      setSelectedSale(data as InstallmentSaleWithPayments);
    } catch (error) {
      console.error('Error loading sale details:', error);
    }
  };

  const handlePayment = async () => {
    if (!selectedPayment || !paymentAmount) return;

    try {
      const amount = parseFloat(paymentAmount);
      const installmentAmount = selectedSale?.installment_amount || 0;
      
      if (amount <= 0) {
        alert('El monto debe ser mayor a 0');
        return;
      }

      if (amount > installmentAmount) {
        alert(`El monto no puede ser mayor a $${installmentAmount.toFixed(2)}`);
        return;
      }

      // Update installment payment
      const { error: paymentError } = await supabase
        .from('installment_payments')
        .update({
          amount_paid: amount,
          payment_date: new Date().toISOString(),
          status: amount >= installmentAmount ? 'paid' : 'partial',
          notes: paymentNotes
        })
        .eq('id', selectedPayment.id);

      if (paymentError) throw paymentError;

      // Record payment in payments table
      const { error: recordError } = await supabase
        .from('payments')
        .insert([{
          sale_id: selectedSale?.sale_id,
          amount: amount,
          payment_method: 'cash',
          notes: `Abono #${selectedPayment.installment_number} - ${paymentNotes}`
        }]);

      if (recordError) throw recordError;

      // Update sale total paid
      const { data: saleData, error: saleSelectError } = await supabase
        .from('sales')
        .select('total_paid')
        .eq('id', selectedSale?.sale_id)
        .single();

      if (saleSelectError) throw saleSelectError;

      const newTotalPaid = (saleData.total_paid || 0) + amount;
      const saleTotal = selectedSale?.sale.total_amount || 0;

      const { error: saleUpdateError } = await supabase
        .from('sales')
        .update({
          total_paid: newTotalPaid,
          payment_status: newTotalPaid >= saleTotal ? 'paid' : 'partial'
        })
        .eq('id', selectedSale?.sale_id);

      if (saleUpdateError) throw saleUpdateError;

      // Check if all installments are paid to update installment sale status
      if (selectedSale) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('installment_payments')
          .select('status')
          .eq('installment_sale_id', selectedSale.id);

        if (!paymentsError) {
          const allPaid = paymentsData.every(p => p.status === 'paid');
          if (allPaid) {
            await supabase
              .from('installment_sales')
              .update({ status: 'completed' })
              .eq('id', selectedSale.id);
          }
        }
      }

      setShowPaymentModal(false);
      setSelectedPayment(null);
      setPaymentAmount('');
      setPaymentNotes('');
      
      if (selectedSale) {
        loadSaleDetails(selectedSale.id);
      }
      loadInstallmentSales();
      
      alert('Pago registrado exitosamente');
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Error al procesar el pago: ' + (error as Error).message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredSales = installmentSales.filter(sale => {
    if (statusFilter === 'all') return true;
    return sale.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Ventas por Abonos</h2>
        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="completed">Completados</option>
            <option value="overdue">Vencidos</option>
          </select>
        </div>
      </div>

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
        ) : filteredSales.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">No hay ventas por abonos registradas</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredSales.map((sale) => (
              <div key={sale.id} className="p-6 hover:bg-slate-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {sale.sale.customer?.name || 'Cliente no especificado'}
                        </h3>
                        <p className="text-sm text-slate-600">
                          Venta #{sale.sale_id.slice(-8)} • {new Date(sale.created_at).toLocaleDateString('es-ES')}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <span className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            Total: ${sale.sale.total_amount.toFixed(2)}
                          </span>
                          <span className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {sale.total_installments} cuotas de ${sale.installment_amount.toFixed(2)}
                          </span>
                          <span className="flex items-center">
                            <CreditCard className="h-4 w-4 mr-1" />
                            Saldo: ${sale.remaining_balance.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sale.status)}`}>
                      {sale.status === 'active' ? 'Activo' : sale.status === 'completed' ? 'Completado' : 'Vencido'}
                    </span>
                    <button
                      onClick={() => loadSaleDetails(sale.id)}
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
      {selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Plan de Pagos - {selectedSale.sale.customer?.name || 'Cliente no especificado'}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Venta #{selectedSale.sale_id.slice(-8)} • {new Date(selectedSale.created_at).toLocaleDateString('es-ES')}
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
                  <p className="text-2xl font-bold text-blue-900">${selectedSale.sale.total_amount.toFixed(2)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-600">Pago Inicial</p>
                  <p className="text-2xl font-bold text-green-900">${selectedSale.down_payment.toFixed(2)}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <p className="text-sm font-medium text-orange-600">Saldo Pendiente</p>
                  <p className="text-2xl font-bold text-orange-900">${selectedSale.remaining_balance.toFixed(2)}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-sm font-medium text-purple-600">Cuotas</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {selectedSale.total_installments} x ${selectedSale.installment_amount.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Payment Schedule */}
              <h4 className="font-medium text-slate-900 mb-4">Cronograma de Pagos</h4>
              <div className="space-y-3">
                {selectedSale.installment_payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          payment.status === 'paid' 
                            ? 'bg-green-100' 
                            : payment.status === 'partial'
                              ? 'bg-yellow-100'
                              : new Date(payment.due_date) < new Date()
                                ? 'bg-red-100'
                                : 'bg-gray-100'
                        }`}>
                          {payment.status === 'paid' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : payment.status === 'partial' ? (
                            <Clock className="h-4 w-4 text-yellow-600" />
                          ) : new Date(payment.due_date) < new Date() ? (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Calendar className="h-4 w-4 text-gray-600" />
                          )}
                        </div>
                        <div>
                          <h5 className="font-medium text-slate-900">
                            Cuota #{payment.installment_number}
                          </h5>
                          <p className="text-sm text-slate-600">
                            Vence: {new Date(payment.due_date).toLocaleDateString('es-ES')}
                          </p>
                          {payment.payment_date && (
                            <p className="text-sm text-green-600">
                              Pagado: {new Date(payment.payment_date).toLocaleDateString('es-ES')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">
                          ${payment.amount_paid.toFixed(2)} / ${selectedSale.installment_amount.toFixed(2)}
                        </p>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(payment.status)}`}>
                          {payment.status === 'paid' ? 'Pagado' : 
                           payment.status === 'partial' ? 'Parcial' : 
                           new Date(payment.due_date) < new Date() ? 'Vencido' : 'Pendiente'}
                        </span>
                      </div>
                      {payment.status !== 'paid' && (
                        <button
                          onClick={() => {
                            setSelectedPayment(payment);
                            setPaymentAmount((selectedSale.installment_amount - payment.amount_paid).toFixed(2));
                            setShowPaymentModal(true);
                          }}
                          className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm"
                        >
                          Pagar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Registrar Pago - Cuota #{selectedPayment.installment_number}
              </h3>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monto del Pago
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={selectedSale?.installment_amount}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-slate-500 mt-1">
                    Pendiente: ${((selectedSale?.installment_amount || 0) - selectedPayment.amount_paid).toFixed(2)}
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
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Registrar Pago
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedPayment(null);
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