import React, { useState, useEffect } from 'react';
import { DollarSign, User, Calendar, Plus, Eye, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
      setInstallmentSales(data as SaleWithInstallments[]);
    } catch (error) {
      console.error('Error loading installment sales:', error);
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
        alert(`El monto no puede ser mayor al saldo pendiente: $${remainingBalance.toFixed(2)}`);
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
      
      loadInstallmentSales();
      alert('Pago registrado exitosamente');
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Error al procesar el pago: ' + (error as Error).message);
    }
  };

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

  const filteredSales = installmentSales.filter(sale => {
    if (statusFilter === 'all') return true;
    return sale.payment_status === statusFilter;
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
            <option value="pending">Pendientes</option>
            <option value="partial">Parciales</option>
            <option value="paid">Pagadas</option>
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
            <DollarSign className="h-12 w-12 text-slate-400 mx-auto mb-4" />
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
                          {sale.customer?.name || 'Cliente no especificado'}
                        </h3>
                        <p className="text-sm text-slate-600">
                          Venta #{sale.id.slice(-8)} • {new Date(sale.created_at).toLocaleDateString('es-ES')}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <span className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            Total: ${sale.total_amount.toFixed(2)}
                          </span>
                          <span className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            Pagado: ${sale.total_paid.toFixed(2)}
                          </span>
                          <span className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            Saldo: ${(sale.total_amount - sale.total_paid).toFixed(2)}
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
                          setPaymentAmount((sale.total_amount - sale.total_paid).toFixed(2));
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
      {selectedSale && !showPaymentModal && (
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
                  <p className="text-2xl font-bold text-blue-900">${selectedSale.total_amount.toFixed(2)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-600">Total Pagado</p>
                  <p className="text-2xl font-bold text-green-900">${selectedSale.total_paid.toFixed(2)}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <p className="text-sm font-medium text-orange-600">Saldo Pendiente</p>
                  <p className="text-2xl font-bold text-orange-900">${(selectedSale.total_amount - selectedSale.total_paid).toFixed(2)}</p>
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
                              Abono de ${payment.amount_paid.toFixed(2)}
                            </h5>
                            <p className="text-sm text-slate-600">
                              {new Date(payment.payment_date).toLocaleDateString('es-ES')} • {payment.payment_method}
                            </p>
                            {payment.notes && (
                              <p className="text-sm text-slate-500 mt-1">{payment.notes}</p>
                            )}
                          </div>
                        </div>
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
                      <p className="font-bold">${selectedSale.total_amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Ya pagado:</span>
                      <p className="font-bold text-green-600">${selectedSale.total_paid.toFixed(2)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-600">Saldo pendiente:</span>
                      <p className="font-bold text-orange-600">${(selectedSale.total_amount - selectedSale.total_paid).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monto del Abono
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={selectedSale.total_amount - selectedSale.total_paid}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
    </div>
  );
}