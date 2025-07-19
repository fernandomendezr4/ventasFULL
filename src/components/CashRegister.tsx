import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, TrendingUp, AlertTriangle, Plus, Minus, Save, X, Eye, Clock, User, FileText, BarChart3, History, Package, Users, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';

interface CashRegister {
  id: string;
  user_id: string | null;
  opening_amount: number;
  closing_amount: number;
  total_sales: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  notes: string;
  created_at: string;
  expected_closing_amount: number;
  actual_closing_amount: number;
  discrepancy_amount: number;
  discrepancy_reason: string;
  session_notes: string;
  last_movement_at: string;
}

interface CashMovement {
  id: string;
  cash_register_id: string;
  type: 'income' | 'expense' | 'sale' | 'opening' | 'closing';
  category: string;
  amount: number;
  description: string;
  reference_id: string | null;
  created_at: string;
  created_by: string | null;
}

interface CashRegisterWithUser extends CashRegister {
  user: {
    name: string;
    email: string;
  } | null;
}

export default function CashRegister() {
  const { user } = useAuth();
  const [currentRegister, setCurrentRegister] = useState<CashRegisterWithUser | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [closedRegisters, setClosedRegisters] = useState<CashRegisterWithUser[]>([]);
  const [selectedClosedRegister, setSelectedClosedRegister] = useState<CashRegisterWithUser | null>(null);
  const [registerSales, setRegisterSales] = useState<any[]>([]);
  const [registerProducts, setRegisterProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showRegisterDetail, setShowRegisterDetail] = useState(false);
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showDiscrepancyAnalysis, setShowDiscrepancyAnalysis] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [actualClosingAmount, setActualClosingAmount] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [movementData, setMovementData] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    amount: '',
    description: '',
  });

  // Categories for movements
  const incomeCategories = [
    'ventas_efectivo',
    'ventas_tarjeta',
    'ventas_transferencia',
    'otros_ingresos',
    'devoluciones_proveedores',
    'prestamos_recibidos'
  ];

  const expenseCategories = [
    'compras_inventario',
    'gastos_operativos',
    'servicios_publicos',
    'nomina',
    'impuestos',
    'mantenimiento',
    'publicidad',
    'transporte',
    'otros_gastos'
  ];

  useEffect(() => {
    loadCurrentRegister();
    loadClosedRegisters();
  }, [user]);

  const loadCurrentRegister = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get current open register for the user
      const { data: registerData, error: registerError } = await supabase
        .from('cash_registers')
        .select(`
          *,
          user:users (name, email)
        `)
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (registerError) throw registerError;

      setCurrentRegister(registerData);

      if (registerData) {
        // Load movements for current register
        const { data: movementsData, error: movementsError } = await supabase
          .from('cash_movements')
          .select('*')
          .eq('cash_register_id', registerData.id)
          .order('created_at', { ascending: false });

        if (movementsError) throw movementsError;
        setMovements(movementsData || []);
      }
    } catch (error) {
      console.error('Error loading cash register:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClosedRegisters = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          *,
          user:users (name, email)
        `)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setClosedRegisters(data || []);
    } catch (error) {
      console.error('Error loading closed registers:', error);
    }
  };

  const loadRegisterDetails = async (registerId: string) => {
    try {
      // Cargar ventas de la caja
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers (name, phone, email),
          user:users (name),
          sale_items (
            *,
            product:products (name, sale_price)
          )
        `)
        .gte('created_at', selectedClosedRegister?.opened_at)
        .lte('created_at', selectedClosedRegister?.closed_at)
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      // Agrupar productos vendidos
      const productsSold: { [key: string]: any } = {};
      salesData?.forEach(sale => {
        sale.sale_items?.forEach((item: any) => {
          const productId = item.product_id;
          if (!productsSold[productId]) {
            productsSold[productId] = {
              product: item.product,
              total_quantity: 0,
              total_revenue: 0,
              sales_count: 0
            };
          }
          productsSold[productId].total_quantity += item.quantity;
          productsSold[productId].total_revenue += item.total_price;
          productsSold[productId].sales_count += 1;
        });
      });

      setRegisterSales(salesData || []);
      setRegisterProducts(Object.values(productsSold));
    } catch (error) {
      console.error('Error loading register details:', error);
    }
  };
  const openCashRegister = async () => {
    if (!user || !openingAmount) return;

    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .insert([{
          user_id: user.id,
          opening_amount: parseFloat(openingAmount),
          status: 'open',
          opened_at: new Date().toISOString(),
          notes: '',
          expected_closing_amount: parseFloat(openingAmount),
          actual_closing_amount: 0,
          discrepancy_amount: 0,
          discrepancy_reason: '',
          session_notes: ''
        }])
        .select(`
          *,
          user:users (name, email)
        `)
        .single();

      if (error) throw error;

      setCurrentRegister(data);
      setShowOpenForm(false);
      setOpeningAmount('');
      loadCurrentRegister();
    } catch (error) {
      console.error('Error opening cash register:', error);
      alert('Error al abrir caja: ' + (error as Error).message);
    }
  };

  const closeCashRegister = async () => {
    if (!currentRegister || !actualClosingAmount) return;

    try {
      const actualAmount = parseFloat(actualClosingAmount);
      const expectedAmount = calculateExpectedClosingAmount();
      const discrepancy = actualAmount - expectedAmount;

      const { error } = await supabase
        .from('cash_registers')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          actual_closing_amount: actualAmount,
          expected_closing_amount: expectedAmount,
          discrepancy_amount: discrepancy,
          discrepancy_reason: discrepancyReason,
          session_notes: sessionNotes
        })
        .eq('id', currentRegister.id);

      if (error) throw error;

      setCurrentRegister(null);
      setMovements([]);
      setShowCloseForm(false);
      setActualClosingAmount('');
      setDiscrepancyReason('');
      setSessionNotes('');
      loadClosedRegisters(); // Recargar historial
    } catch (error) {
      console.error('Error closing cash register:', error);
      alert('Error al cerrar caja: ' + (error as Error).message);
    }
  };

  const addMovement = async () => {
    if (!currentRegister || !movementData.amount || !movementData.description) return;

    try {
      const { error } = await supabase
        .from('cash_movements')
        .insert([{
          cash_register_id: currentRegister.id,
          type: movementData.type,
          category: movementData.category,
          amount: parseFloat(movementData.amount),
          description: movementData.description,
          created_by: user?.id
        }]);

      if (error) throw error;

      setShowMovementForm(false);
      setMovementData({
        type: 'income',
        category: '',
        amount: '',
        description: '',
      });
      loadCurrentRegister();
    } catch (error) {
      console.error('Error adding movement:', error);
      alert('Error al agregar movimiento: ' + (error as Error).message);
    }
  };

  const calculateCurrentBalance = () => {
    if (!currentRegister) return 0;
    
    const income = movements
      .filter(m => m.type === 'income' || m.type === 'sale')
      .reduce((sum, m) => sum + m.amount, 0);
    
    const expenses = movements
      .filter(m => m.type === 'expense')
      .reduce((sum, m) => sum + m.amount, 0);
    
    return currentRegister.opening_amount + income - expenses;
  };

  const calculateExpectedClosingAmount = () => {
    return calculateCurrentBalance();
  };

  const getTotalIncome = () => {
    return movements
      .filter(m => m.type === 'income' || m.type === 'sale')
      .reduce((sum, m) => sum + m.amount, 0);
  };

  const getTotalExpenses = () => {
    return movements
      .filter(m => m.type === 'expense')
      .reduce((sum, m) => sum + m.amount, 0);
  };

  const getCategoryName = (category: string) => {
    const categoryNames: { [key: string]: string } = {
      'ventas_efectivo': 'Ventas en Efectivo',
      'ventas_tarjeta': 'Ventas con Tarjeta',
      'ventas_transferencia': 'Ventas por Transferencia',
      'otros_ingresos': 'Otros Ingresos',
      'devoluciones_proveedores': 'Devoluciones de Proveedores',
      'prestamos_recibidos': 'Préstamos Recibidos',
      'compras_inventario': 'Compras de Inventario',
      'gastos_operativos': 'Gastos Operativos',
      'servicios_publicos': 'Servicios Públicos',
      'nomina': 'Nómina',
      'impuestos': 'Impuestos',
      'mantenimiento': 'Mantenimiento',
      'publicidad': 'Publicidad',
      'transporte': 'Transporte',
      'otros_gastos': 'Otros Gastos'
    };
    return categoryNames[category] || category;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Caja Registradora</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
          >
            <History className="h-4 w-4 mr-2" />
            Historial
          </button>
          {!currentRegister && (
            <button
              onClick={() => setShowOpenForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Abrir Caja
            </button>
          )}
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <History className="h-5 w-5 mr-2 text-blue-600" />
                  Historial de Cajas Cerradas
                </h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              {closedRegisters.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">No hay cajas cerradas</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {closedRegisters.map((register) => (
                    <div key={register.id} className="bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div>
                              <h4 className="font-semibold text-slate-900">
                                Caja #{register.id.slice(-8)}
                              </h4>
                              <p className="text-sm text-slate-600">
                                Operador: {register.user?.name}
                              </p>
                              <p className="text-sm text-slate-600">
                                {new Date(register.opened_at).toLocaleDateString('es-ES')} - {' '}
                                {new Date(register.closed_at!).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-slate-600">Inicial:</span>
                                <p className="font-semibold">{formatCurrency(register.opening_amount)}</p>
                              </div>
                              <div>
                                <span className="text-slate-600">Final:</span>
                                <p className="font-semibold">{formatCurrency(register.actual_closing_amount)}</p>
                              </div>
                              <div>
                                <span className="text-slate-600">Ventas:</span>
                                <p className="font-semibold text-green-600">{formatCurrency(register.total_sales)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedClosedRegister(register);
                            setShowRegisterDetail(true);
                            loadRegisterDetails(register.id);
                          }}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalles
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Register Detail Modal */}
      {showRegisterDetail && selectedClosedRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  Detalles de Caja #{selectedClosedRegister.id.slice(-8)}
                </h3>
                <button
                  onClick={() => {
                    setShowRegisterDetail(false);
                    setSelectedClosedRegister(null);
                    setRegisterSales([]);
                    setRegisterProducts([]);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">Período</h4>
                    <p className="text-sm text-blue-700">
                      {new Date(selectedClosedRegister.opened_at).toLocaleDateString('es-ES')}
                    </p>
                    <p className="text-sm text-blue-700">
                      {new Date(selectedClosedRegister.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - {' '}
                      {new Date(selectedClosedRegister.closed_at!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-900 mb-2">Total Ventas</h4>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(selectedClosedRegister.total_sales)}
                    </p>
                    <p className="text-sm text-green-700">{registerSales.length} ventas</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="font-medium text-purple-900 mb-2">Productos Vendidos</h4>
                    <p className="text-2xl font-bold text-purple-600">
                      {registerProducts.reduce((sum, p) => sum + p.total_quantity, 0)}
                    </p>
                    <p className="text-sm text-purple-700">{registerProducts.length} productos únicos</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <h4 className="font-medium text-orange-900 mb-2">Diferencia</h4>
                    <p className={`text-2xl font-bold ${
                      selectedClosedRegister.discrepancy_amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(selectedClosedRegister.discrepancy_amount)}
                    </p>
                    <p className="text-sm text-orange-700">
                      {selectedClosedRegister.discrepancy_amount >= 0 ? 'Sobrante' : 'Faltante'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Ventas */}
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h4 className="font-medium text-slate-900 mb-4 flex items-center">
                      <ShoppingCart className="h-5 w-5 mr-2 text-green-600" />
                      Ventas Realizadas ({registerSales.length})
                    </h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {registerSales.map((sale) => (
                        <div key={sale.id} className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-slate-900">
                                Venta #{sale.id.slice(-8)}
                              </p>
                              <p className="text-sm text-slate-600">
                                {sale.customer?.name || 'Cliente genérico'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {new Date(sale.created_at).toLocaleTimeString('es-ES')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-600">
                                {formatCurrency(sale.total_amount)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {sale.sale_items?.length} productos
                              </p>
                            </div>
                          </div>
                          {sale.customer?.phone && (
                            <p className="text-xs text-slate-500 mt-1">
                              Tel: {sale.customer.phone}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Productos */}
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h4 className="font-medium text-slate-900 mb-4 flex items-center">
                      <Package className="h-5 w-5 mr-2 text-purple-600" />
                      Productos Vendidos ({registerProducts.length})
                    </h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {registerProducts
                        .sort((a, b) => b.total_quantity - a.total_quantity)
                        .map((productData, index) => (
                        <div key={index} className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-slate-900">
                                {productData.product.name}
                              </p>
                              <p className="text-sm text-slate-600">
                                Precio: {formatCurrency(productData.product.sale_price)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {productData.sales_count} ventas
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-purple-600">
                                {productData.total_quantity} unidades
                              </p>
                              <p className="text-sm text-green-600">
                                {formatCurrency(productData.total_revenue)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Notas y observaciones */}
                {(selectedClosedRegister.session_notes || selectedClosedRegister.discrepancy_reason) && (
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h4 className="font-medium text-slate-900 mb-4">Notas y Observaciones</h4>
                    {selectedClosedRegister.discrepancy_reason && (
                      <div className="mb-4">
                        <h5 className="font-medium text-orange-700 mb-2">Razón de la diferencia:</h5>
                        <p className="text-slate-700 bg-white p-3 rounded border">
                          {selectedClosedRegister.discrepancy_reason}
                        </p>
                      </div>
                    )}
                    {selectedClosedRegister.session_notes && (
                      <div>
                        <h5 className="font-medium text-blue-700 mb-2">Notas de la sesión:</h5>
                        <p className="text-slate-700 bg-white p-3 rounded border">
                          {selectedClosedRegister.session_notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
          <button
            onClick={() => setShowOpenForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Abrir Caja
          </button>
        )}
      </div>

      {!currentRegister ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Calculator className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No hay caja abierta</h3>
          <p className="text-slate-600 mb-6">
            Para comenzar a trabajar, necesitas abrir una caja registradora
          </p>
          <button
            onClick={() => setShowOpenForm(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center mx-auto"
          >
            <Calculator className="h-5 w-5 mr-2" />
            Abrir Caja Registradora
          </button>
        </div>
      )}
        <>
          {/* Current Register Status */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <Calculator className="h-5 w-5 mr-2 text-green-600" />
                Caja Abierta
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDiscrepancyAnalysis(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center text-sm"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Análisis
                </button>
                <button
                  onClick={() => setShowCloseForm(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cerrar Caja
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Monto Inicial</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {formatCurrency(currentRegister.opening_amount)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Total Ingresos</p>
                    <p className="text-2xl font-bold text-green-900">
                      {formatCurrency(getTotalIncome())}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </div>

              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-600">Total Gastos</p>
                    <p className="text-2xl font-bold text-red-900">
                      {formatCurrency(getTotalExpenses())}
                    </p>
                  </div>
                  <Minus className="h-8 w-8 text-red-600" />
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Balance Actual</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {formatCurrency(calculateCurrentBalance())}
                    </p>
                  </div>
                  <Calculator className="h-8 w-8 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
              <div className="flex items-center">
                <User className="h-4 w-4 mr-2" />
                <span>Operador: {currentRegister.user?.name}</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                <span>
                  Abierta: {new Date(currentRegister.opened_at).toLocaleDateString('es-ES')} a las{' '}
                  {new Date(currentRegister.opened_at).toLocaleTimeString('es-ES', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Acciones Rápidas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setShowMovementForm(true)}
                className="flex items-center justify-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-200"
              >
                <Plus className="h-5 w-5 text-green-600 mr-2" />
                <span className="font-medium text-green-700">Registrar Ingreso</span>
              </button>
              <button
                onClick={() => {
                  setMovementData({ ...movementData, type: 'expense' });
                  setShowMovementForm(true);
                }}
                className="flex items-center justify-center p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors duration-200"
              >
                <Minus className="h-5 w-5 text-red-600 mr-2" />
                <span className="font-medium text-red-700">Registrar Gasto</span>
              </button>
            </div>
          </div>

          {/* Recent Movements */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Movimientos Recientes</h3>
            </div>
            <div className="p-6">
              {movements.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">No hay movimientos registrados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {movements.slice(0, 10).map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            movement.type === 'income' || movement.type === 'sale'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-red-100 text-red-600'
                          }`}>
                            {movement.type === 'income' || movement.type === 'sale' ? (
                              <Plus className="h-4 w-4" />
                            ) : (
                              <Minus className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{movement.description}</p>
                            <p className="text-sm text-slate-600">
                              {getCategoryName(movement.category)} • {' '}
                              {new Date(movement.created_at).toLocaleDateString('es-ES')} {' '}
                              {new Date(movement.created_at).toLocaleTimeString('es-ES', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${
                          movement.type === 'income' || movement.type === 'sale'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {movement.type === 'income' || movement.type === 'sale' ? '+' : '-'}
                          {formatCurrency(movement.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Open Cash Register Modal */}
      {showOpenForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Abrir Caja Registradora</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monto Inicial
                  </label>
                  <FormattedNumberInput
                    value={openingAmount}
                    onChange={(value) => setOpeningAmount(value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0"
                    required
                    min="0"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={openCashRegister}
                disabled={!openingAmount}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Abrir Caja
              </button>
              <button
                onClick={() => setShowOpenForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Cash Register Modal */}
      {showCloseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Cerrar Caja Registradora</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="font-medium text-slate-900 mb-2">Resumen de la Sesión</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Monto inicial:</span>
                    <p className="font-semibold">{formatCurrency(currentRegister?.opening_amount || 0)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Total ingresos:</span>
                    <p className="font-semibold text-green-600">{formatCurrency(getTotalIncome())}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Total gastos:</span>
                    <p className="font-semibold text-red-600">{formatCurrency(getTotalExpenses())}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Balance esperado:</span>
                    <p className="font-semibold text-blue-600">{formatCurrency(calculateExpectedClosingAmount())}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto Real en Caja
                </label>
                <FormattedNumberInput
                  value={actualClosingAmount}
                  onChange={(value) => setActualClosingAmount(value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="0"
                  required
                  min="0"
                />
              </div>

              {actualClosingAmount && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-800 font-medium">Diferencia:</span>
                    <span className={`font-bold ${
                      parseFloat(actualClosingAmount) - calculateExpectedClosingAmount() >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {formatCurrency(parseFloat(actualClosingAmount) - calculateExpectedClosingAmount())}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Razón de la Diferencia (opcional)
                </label>
                <textarea
                  value={discrepancyReason}
                  onChange={(e) => setDiscrepancyReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Explica cualquier diferencia encontrada..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas de la Sesión (opcional)
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Notas adicionales sobre la sesión..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={closeCashRegister}
                disabled={!actualClosingAmount}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Cerrar Caja
              </button>
              <button
                onClick={() => setShowCloseForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Movement Modal */}
      {showMovementForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {movementData.type === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de Movimiento
                </label>
                <select
                  value={movementData.type}
                  onChange={(e) => setMovementData({ ...movementData, type: e.target.value as 'income' | 'expense', category: '' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="income">Ingreso</option>
                  <option value="expense">Gasto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría
                </label>
                <select
                  value={movementData.category}
                  onChange={(e) => setMovementData({ ...movementData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {(movementData.type === 'income' ? incomeCategories : expenseCategories).map((category) => (
                    <option key={category} value={category}>
                      {getCategoryName(category)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto
                </label>
                <FormattedNumberInput
                  value={movementData.amount}
                  onChange={(value) => setMovementData({ ...movementData, amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  required
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={movementData.description}
                  onChange={(e) => setMovementData({ ...movementData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe el movimiento..."
                  required
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={addMovement}
                disabled={!movementData.amount || !movementData.description || !movementData.category}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Registrar
              </button>
              <button
                onClick={() => setShowMovementForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discrepancy Analysis Modal */}
      {showDiscrepancyAnalysis && currentRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                  Análisis de Discrepancias
                </h3>
                <button
                  onClick={() => setShowDiscrepancyAnalysis(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">Balance Esperado</h4>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(calculateExpectedClosingAmount())}
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Basado en movimientos registrados
                    </p>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-900 mb-2">Total de Ingresos</h4>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(getTotalIncome())}
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      {movements.filter(m => m.type === 'income' || m.type === 'sale').length} movimientos
                    </p>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h4 className="font-medium text-red-900 mb-2">Total de Gastos</h4>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(getTotalExpenses())}
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      {movements.filter(m => m.type === 'expense').length} movimientos
                    </p>
                  </div>
                </div>

                {/* Movements by Category */}
                <div className="bg-slate-50 p-6 rounded-lg">
                  <h4 className="font-medium text-slate-900 mb-4">Movimientos por Categoría</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Income Categories */}
                    <div>
                      <h5 className="font-medium text-green-700 mb-3">Ingresos</h5>
                      <div className="space-y-2">
                        {incomeCategories.map(category => {
                          const categoryMovements = movements.filter(m => 
                            (m.type === 'income' || m.type === 'sale') && m.category === category
                          );
                          const total = categoryMovements.reduce((sum, m) => sum + m.amount, 0);
                          
                          if (total === 0) return null;
                          
                          return (
                            <div key={category} className="flex justify-between items-center p-2 bg-white rounded">
                              <span className="text-sm text-slate-700">{getCategoryName(category)}</span>
                              <span className="font-medium text-green-600">{formatCurrency(total)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Expense Categories */}
                    <div>
                      <h5 className="font-medium text-red-700 mb-3">Gastos</h5>
                      <div className="space-y-2">
                        {expenseCategories.map(category => {
                          const categoryMovements = movements.filter(m => 
                            m.type === 'expense' && m.category === category
                          );
                          const total = categoryMovements.reduce((sum, m) => sum + m.amount, 0);
                          
                          if (total === 0) return null;
                          
                          return (
                            <div key={category} className="flex justify-between items-center p-2 bg-white rounded">
                              <span className="text-sm text-slate-700">{getCategoryName(category)}</span>
                              <span className="font-medium text-red-600">{formatCurrency(total)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session Information */}
                <div className="bg-slate-50 p-6 rounded-lg">
                  <h4 className="font-medium text-slate-900 mb-4">Información de la Sesión</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">Operador:</span>
                      <p className="font-medium">{currentRegister.user?.name}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Hora de apertura:</span>
                      <p className="font-medium">
                        {new Date(currentRegister.opened_at).toLocaleString('es-ES')}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-600">Duración:</span>
                      <p className="font-medium">
                        {Math.floor((Date.now() - new Date(currentRegister.opened_at).getTime()) / (1000 * 60 * 60))} horas
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-600">Total de movimientos:</span>
                      <p className="font-medium">{movements.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setShowDiscrepancyAnalysis(false)}
                className="w-full bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cerrar Análisis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}