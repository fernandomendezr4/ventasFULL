import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, DollarSign, Calendar, User, Search, Filter, Eye, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SaleWithItems, PaymentInstallment, Customer } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import PrintService from './PrintService';

export default function InstallmentManager() {
  const { user } = useAuth();
  const [installmentSales, setInstallmentSales] = useState<SaleWithItems[]>([]);
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentCashRegister, setCurrentCashRegister] = useState<any>(null);
  const [completedPayment, setCompletedPayment] = useState<any>(null);

  useEffect(() => {
    loadInstallmentSales();
    loadInstallments();
    checkCashRegister();
  }, []);

  const checkCashRegister = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();

      if (error) {
        console.error('Error checking cash register:', error);
        return;
      }

      setCurrentCashRegister(data);
    } catch (error) {
      console.error('Error checking cash register:', error);
    }
  };

  const loadInstallmentSales = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers (id, name, phone, email, cedula),
          user:users (id, name, email)
        `)
        .eq('payment_type', 'installment')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const salesFormatted = (data || []).map(sale => ({
        ...sale,
        sale_items: []
      }));
      
      setInstallmentSales(salesFormatted as SaleWithItems[]);
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
        .select('*')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setInstallments(data);
    } catch (error) {
      console.error('Error loading installments:', error);
    }
  };

  const handlePayment = async () => {
    if (!selectedSale || !paymentAmount) {
      alert('Complete todos los campos requeridos');
      return;
    }

    const amount = parseFloat(paymentAmount);
    const remainingBalance = selectedSale.total_amount - (selectedSale.total_paid || 0);

    if (amount <= 0) {
      alert('El monto debe ser mayor a cero');
      return;
    }

    if (amount > remainingBalance) {
      alert('El monto no puede ser mayor al saldo pendiente');
      return;
    }

    try {
      // Crear el abono
      const { data: installment, error: installmentError } = await supabase
        .from('payment_installments')
        .insert([{
          sale_id: selectedSale.id,
          amount_paid: amount,
          payment_method: 'cash',
          notes: paymentNotes
        }])
        .select()
        .single();

      if (installmentError) throw installmentError;

      // Actualizar el total pagado en la venta
      const newTotalPaid = (selectedSale.total_paid || 0) + amount;
      const newStatus = newTotalPaid >= selectedSale.total_amount ? 'paid' : 'partial';

      const { error: saleError } = await supabase
        .from('sales')
        .update({
          total_paid: newTotalPaid,
          payment_status: newStatus
        })
        .eq('id', selectedSale.id);

      if (saleError) throw saleError;

      // Registrar en caja si está abierta
      if (currentCashRegister) {
        const { error: cashRegisterError } = await supabase
          .from('cash_register_installments')
          .insert([{
            cash_register_id: currentCashRegister.id,
            sale_id: selectedSale.id,
            installment_id: installment.id,
            amount_paid: amount,
            payment_method: 'cash',
            payment_notes: paymentNotes,
            created_by: user?.id
          }]);

        if (cashRegisterError) {
          console.error('Error registering installment in cash register:', cashRegisterError);
        }
      }

      // Preparar datos para el comprobante de abono
      const paymentReceipt = {
        ...selectedSale,
        is_installment_receipt: true,
        payment_amount: amount,
        payment_date: new Date().toISOString(),
        payment_notes: paymentNotes,
        total_paid_after: newTotalPaid,
        remaining_balance: selectedSale.total_amount - newTotalPaid
      };

      setCompletedPayment(paymentReceipt);

      // Limpiar formulario
      setShowPaymentForm(false);
      setSelectedSale(null);
      setPaymentAmount('');
      setPaymentNotes('');

      // Recargar datos
      loadInstallmentSales();
      loadInstallments();

    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Error al procesar el pago: ' + (error as Error).message);
    }
  };

  const filteredSales = installmentSales.filter(sale => {
    const matchesSearch = !searchTerm || 
      sale.id.includes(searchTerm) ||
      sale.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customer?.phone.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || sale.payment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (completedPayment) {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-900 mb-2">¡Abono Registrado!</h2>
          <p className="text-green-700 mb-4">
            Abono de {formatCurrency(completedPayment.payment_amount)} para la venta #{completedPayment.id.slice(-8)}
          </p>
          <p className="text-sm text-green-600 mb-6">
            Saldo restante: {formatCurrency(completedPayment.remaining_balance)}
          </p>
          
          <div className="flex justify-center gap-4">
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
                    company_name: 'VentasFULL',
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
                  company_name: 'VentasFULL'
                };
              })()}
            />
            <button
              onClick={() => setCompletedPayment(null)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Gestión de Abonos</h2>
        {!currentCashRegister && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-yellow-800 text-sm">
              ⚠️ No hay caja abierta. Los abonos no se registrarán en caja.
            </p>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ID de venta, cliente o teléfono..."
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
            <option value="pending">Pendientes</option>
            <option value="partial">Parciales</option>
            <option value="paid">Pagadas</option>
          </select>
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
            <p className="text-slate-500">No hay ventas a crédito registradas</p>
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
                          <h3 className="font-semibold text-slate-900">
                            Venta #{sale.id.slice(-8)}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {new Date(sale.created_at).toLocaleDateString('es-ES')}
                          </p>
                          {sale.customer && (
                            <div className="flex items-center gap-2 mt-1">
                              <User className="h-4 w-4 text-blue-600" />
                              <span className="text-sm text-slate-600">{sale.customer.name}</span>
                              {sale.customer.phone && (
                                <span className="text-sm text-slate-500">• {sale.customer.phone}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Payment Progress */}
                      <div className="mt-3">
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                          <span>Progreso: {formatCurrency(sale.total_paid || 0)} / {formatCurrency(sale.total_amount)}</span>
                          <span>{paymentProgress.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              sale.payment_status === 'paid' ? 'bg-green-600' : 'bg-blue-600'
                            }`}
                            style={{ width: `${paymentProgress}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-green-600">Pagado: {formatCurrency(sale.total_paid || 0)}</span>
                          <span className="text-orange-600">Saldo: {formatCurrency(remainingBalance)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        sale.payment_status === 'paid' 
                          ? 'bg-green-100 text-green-800' 
                          : sale.payment_status === 'partial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}>
                        {sale.payment_status === 'paid' ? 'Pagada' : 
                         sale.payment_status === 'partial' ? 'Parcial' : 'Pendiente'}
                      </span>
                      
                      {sale.payment_status !== 'paid' && (
                        <button
                          onClick={() => {
                            setSelectedSale(sale);
                            setPaymentAmount(remainingBalance.toString());
                            setShowPaymentForm(true);
                          }}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center text-sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Abonar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Registrar Abono - Venta #{selectedSale.id.slice(-8)}
              </h3>
              <div className="mt-2 text-sm text-slate-600">
                <p>Cliente: {selectedSale.customer?.name}</p>
                <p>Total: {formatCurrency(selectedSale.total_amount)}</p>
                <p>Pagado: {formatCurrency(selectedSale.total_paid || 0)}</p>
                <p className="font-medium text-orange-600">
                  Saldo: {formatCurrency(selectedSale.total_amount - (selectedSale.total_paid || 0))}
                </p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
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
                <p className="text-xs text-slate-500 mt-1">
                  Máximo: {formatCurrency(selectedSale.total_amount - (selectedSale.total_paid || 0))}
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
                  placeholder="Notas sobre este abono..."
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handlePayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Registrar Abono
              </button>
              <button
                onClick={() => {
                  setShowPaymentForm(false);
                  setSelectedSale(null);
                  setPaymentAmount('');
                  setPaymentNotes('');
                }}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
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