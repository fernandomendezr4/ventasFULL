import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, TrendingUp, TrendingDown, Plus, Minus, Save, X, Eye, Clock, User, Package, CreditCard, AlertTriangle, CheckCircle, Activity, FileText, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import { CashRegisterWithUser, CashMovement } from '../lib/types';
import FormattedNumberInput from './FormattedNumberInput';
import CashRegisterAudit from './CashRegisterAudit';

export default function CashRegister() {
  const { user } = useAuth();
  const [currentRegister, setCurrentRegister] = useState<CashRegisterWithUser | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showAuditView, setShowAuditView] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [movementData, setMovementData] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    amount: '',
    description: '',
  });
  const [sessionNotes, setSessionNotes] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');

  useEffect(() => {
    if (user) {
      loadCurrentRegister();
    }
  }, [user]);

  const loadCurrentRegister = async () => {
    if (!user) return;
    
    if (!supabase) {
      // Modo demo
      setCurrentRegister({
        id: 'demo-cash-register',
        user_id: user.id,
        opening_amount: 100000,
        closing_amount: 0,
        expected_closing_amount: 0,
        actual_closing_amount: 0,
        discrepancy_amount: 0,
        discrepancy_reason: '',
        session_notes: '',
        last_movement_at: new Date().toISOString(),
        total_sales: 0,
        status: 'open',
        opened_at: new Date().toISOString(),
        closed_at: null,
        notes: '',
        created_at: new Date().toISOString(),
        user: { id: user.id, name: user.name, email: user.email, role: user.role, is_active: user.is_active, created_at: new Date().toISOString() }
      });
      setMovements([
        {
          id: 'demo-movement-1',
          cash_register_id: 'demo-cash-register',
          type: 'opening',
          category: 'apertura',
          amount: 100000,
          description: 'Apertura de caja demo',
          reference_id: null,
          created_at: new Date().toISOString(),
          created_by: user.id
        }
      ]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Buscar caja abierta del usuario actual
      const { data: register, error: registerError } = await supabase
        .from('cash_registers')
        .select(`
          *,
          user:users (id, name, email)
        `)
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (registerError) {
        console.error('Error loading register:', registerError);
        // No lanzar error, solo loggearlo
        setCurrentRegister(null);
        setMovements([]);
        return;
      }

      if (register) {
        setCurrentRegister(register);
        await loadMovements(register.id);
      } else {
        setCurrentRegister(null);
        setMovements([]);
      }
    } catch (error) {
      console.error('Error loading cash register:', error);
      setCurrentRegister(null);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async (registerId: string) => {
    if (!supabase) {
      // En modo demo, ya se cargan los movimientos en loadCurrentRegister
      return;
    }
    
    try {
      console.log('Cargando movimientos para caja:', registerId);
      
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading movements:', error);
        setMovements([]);
        return;
      }
      
      console.log('Movimientos cargados:', data?.length || 0);
      setMovements(data || []);
    } catch (error) {
      console.error('Error loading movements:', error);
      setMovements([]);
    }
  };

  const openRegister = async () => {
    if (!user || !openingAmount) {
      alert('Debe ingresar el monto de apertura');
      return;
    }

    if (!supabase) {
      // Modo demo
      const demoRegister = {
        id: `demo-cash-register-${Date.now()}`,
        user_id: user.id,
        opening_amount: parseFloat(openingAmount),
        closing_amount: 0,
        expected_closing_amount: 0,
        actual_closing_amount: 0,
        discrepancy_amount: 0,
        discrepancy_reason: '',
        session_notes: sessionNotes || '',
        last_movement_at: new Date().toISOString(),
        total_sales: 0,
        status: 'open',
        opened_at: new Date().toISOString(),
        closed_at: null,
        notes: '',
        created_at: new Date().toISOString(),
        user: { id: user.id, name: user.name, email: user.email }
      };
      
      setCurrentRegister(demoRegister);
      setMovements([
        {
          id: `demo-movement-${Date.now()}`,
          cash_register_id: demoRegister.id,
          type: 'opening',
          category: 'apertura',
          amount: parseFloat(openingAmount),
          description: 'Apertura de caja demo',
          reference_id: null,
          created_at: new Date().toISOString(),
          created_by: user.id
        }
      ]);
      
      setShowOpenForm(false);
      setOpeningAmount('');
      setSessionNotes('');
      alert('Caja abierta exitosamente en modo demo');
      return;
    }

    try {
      const amount = parseFloat(openingAmount);
      if (amount < 0) {
        alert('El monto de apertura no puede ser negativo');
        return;
      }

      if (amount > 9999999.99) {
        alert('El monto de apertura es demasiado grande. Máximo permitido: $9,999,999.99');
        return;
      }

      console.log('Intentando abrir caja con monto:', amount);

      // Verificar que no haya otra caja abierta para este usuario
      const { data: existingRegister, error: checkError } = await supabase
        .from('cash_registers')
        .select('id, opened_at, status')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .limit(1)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing register:', checkError);
      }

      if (existingRegister) {
        alert(`Ya tienes una caja abierta desde ${new Date(existingRegister.opened_at).toLocaleDateString()}. Debes cerrarla antes de abrir una nueva.`);
        return;
      }

      const insertData = {
        user_id: user.id,
        opening_amount: amount,
        status: 'open' as const,
        session_notes: sessionNotes || '',
        opened_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      console.log('Datos para insertar:', insertData);

      const { data, error } = await supabase
        .from('cash_registers')
        .insert([insertData])
        .select(`
          *,
          user:users (name, email)
        `)
        .single();

      if (error) {
        console.error('Error inserting register:', error);
        throw error;
      }

      console.log('Caja creada exitosamente:', data);
      setCurrentRegister(data);
      setShowOpenForm(false);
      setOpeningAmount('');
      setSessionNotes('');
      
      // Cargar movimientos inmediatamente (debería incluir el movimiento de apertura)
      await loadMovements(data.id);
      alert('Caja abierta exitosamente');
      
    } catch (error) {
      console.error('Error opening register:', error);
      
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('single_open_register') || errorMessage.includes('duplicate')) {
        alert('Ya tienes una caja abierta. Debes cerrarla antes de abrir una nueva.');
      } else {
        alert('Error al abrir caja: ' + errorMessage);
      }
    }
  };

  const closeRegister = async () => {
    if (!currentRegister) {
      alert('No hay caja abierta para cerrar');
      return;
    }

    if (!closingAmount) {
      alert('Debe ingresar el monto de cierre');
      return;
    }

    try {
      const amount = parseFloat(closingAmount);
      if (amount < 0) {
        alert('El monto de cierre no puede ser negativo');
        return;
      }

      // Calcular balance esperado
      const expectedAmount = calculateExpectedBalance();
      const discrepancy = amount - expectedAmount;

      // Validar que los montos no excedan los límites de la base de datos
      if (amount > 9999999.99) {
        alert('El monto de cierre es demasiado grande. Máximo permitido: $9,999,999.99');
        return;
      }

      console.log('Cerrando caja:', {
        registerId: currentRegister.id,
        closingAmount: amount,
        expectedAmount,
        discrepancy
      });

      const updateData = {
        actual_closing_amount: amount,
        expected_closing_amount: expectedAmount,
        discrepancy_amount: discrepancy,
        discrepancy_reason: discrepancyReason || '',
        session_notes: sessionNotes || '',
        status: 'closed' as const,
        closed_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('cash_registers')
        .update(updateData)
        .eq('id', currentRegister.id);

      if (error) {
        console.error('Error updating register:', error);
        throw error;
      }

      // Si hay discrepancia significativa, registrarla
      if (Math.abs(discrepancy) > 1) {
        try {
          const { error: discrepancyError } = await supabase
            .from('cash_register_discrepancies')
            .insert([{
              cash_register_id: currentRegister.id,
              discrepancy_type: discrepancy > 0 ? 'overage' : 'shortage',
              expected_amount: expectedAmount,
              actual_amount: amount,
              difference_amount: Math.abs(discrepancy),
              reason: discrepancyReason || 'Sin razón especificada',
              created_by: user?.id
            }]);
          
          if (discrepancyError) {
            console.error('Error creating discrepancy record:', discrepancyError);
          }
        } catch (discrepancyErr) {
          console.error('Error al registrar discrepancia:', discrepancyErr);
        }
      }

      console.log('Caja cerrada exitosamente');
      setCurrentRegister(null);
      setMovements([]);
      setShowCloseForm(false);
      setClosingAmount('');
      setSessionNotes('');
      setDiscrepancyReason('');
      
      alert('Caja cerrada exitosamente');
    } catch (error) {
      console.error('Error closing register:', error);
      
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('trigger') || errorMessage.includes('function')) {
        alert('Error en el sistema al cerrar la caja. Por favor, contacta al administrador.');
      } else {
        alert('Error al cerrar caja: ' + errorMessage);
      }
    }
  };

  const addMovement = async () => {
    if (!currentRegister) {
      alert('No hay caja abierta');
      return;
    }

    if (!movementData.amount || !movementData.description) {
      alert('Debe completar todos los campos requeridos');
      return;
    }

    try {
      const amount = parseFloat(movementData.amount);
      if (amount <= 0) {
        alert('El monto debe ser mayor a cero');
        return;
      }

      if (amount > 9999999.99) {
        alert('El monto es demasiado grande. Máximo permitido: $9,999,999.99');
        return;
      }

      console.log('Agregando movimiento:', {
        registerId: currentRegister.id,
        type: movementData.type,
        amount,
        description: movementData.description
      });

      const movementInsertData = {
        cash_register_id: currentRegister.id,
        type: movementData.type,
        category: movementData.category || (movementData.type === 'income' ? 'otros_ingresos' : 'otros_gastos'),
        amount: amount,
        description: movementData.description.trim(),
        created_by: user?.id,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('cash_movements')
        .insert([movementInsertData]);

      if (error) {
        console.error('Error inserting movement:', error);
        throw error;
      }

      console.log('Movimiento agregado exitosamente');
      setShowMovementForm(false);
      setMovementData({ type: 'income', category: '', amount: '', description: '' });
      
      // Recargar movimientos inmediatamente
      await loadMovements(currentRegister.id);
      alert(`Movimiento de ${movementData.type === 'income' ? 'ingreso' : 'gasto'} registrado exitosamente`);
      
    } catch (error) {
      console.error('Error adding movement:', error);
      
      const errorMessage = (error as Error).message;
      alert('Error al agregar movimiento: ' + errorMessage);
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

  const calculateExpectedBalance = () => {
    if (!currentRegister) return 0;
    return calculateCurrentBalance();
  };

  const getTotalSales = () => {
    return movements
      .filter(m => m.type === 'sale')
      .reduce((sum, m) => sum + m.amount, 0);
  };

  const getTotalIncome = () => {
    return movements
      .filter(m => m.type === 'income')
      .reduce((sum, m) => sum + m.amount, 0);
  };

  const getTotalExpenses = () => {
    return movements
      .filter(m => m.type === 'expense')
      .reduce((sum, m) => sum + m.amount, 0);
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return <Package className="h-4 w-4 text-green-600" />;
      case 'income':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'expense':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'opening':
        return <Activity className="h-4 w-4 text-purple-600" />;
      case 'closing':
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
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

  const getUserName = (createdBy: string | null | undefined) => {
    if (!createdBy) return 'Sistema';
    if (createdBy === user?.id) return user.name || 'Tú';
    return 'Usuario';
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

  if (showAuditView) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-slate-900">Auditoría de Cajas</h2>
          <button
            onClick={() => setShowAuditView(false)}
            className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200 flex items-center"
          >
            <X className="h-4 w-4 mr-2" />
            Volver a Caja
          </button>
        </div>
        <CashRegisterAudit />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Caja Registradora</h2>
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAuditView(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center"
            >
              <FileText className="h-4 w-4 mr-2" />
              Ver Auditoría
            </button>
          )}
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

      {currentRegister ? (
        <>
          {/* Current Register Status */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                  <Activity className="h-6 w-6 mr-2 text-green-600" />
                  Caja Abierta
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Abierta el {new Date(currentRegister.opened_at).toLocaleDateString('es-ES')} a las{' '}
                  {new Date(currentRegister.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-sm text-slate-600">
                  Operador: {currentRegister.user?.name || 'Usuario desconocido'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowMovementForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Movimiento
                </button>
                <button
                  onClick={() => setShowCloseForm(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Cerrar Caja
                </button>
              </div>
            </div>

            {/* Balance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">Apertura</p>
                    <p className="text-xl font-bold text-blue-900">
                      {formatCurrency(currentRegister.opening_amount)}
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
                      {formatCurrency(getTotalSales() + getTotalIncome())}
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
                      {formatCurrency(getTotalExpenses())}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Calculator className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-purple-600">Balance Actual</p>
                    <p className="text-xl font-bold text-purple-900">
                      {formatCurrency(calculateCurrentBalance())}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Movements List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                Movimientos de Caja ({movements.length})
              </h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {movements.length === 0 ? (
                <div className="p-12 text-center">
                  <Activity className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">No hay movimientos registrados</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Los movimientos aparecerán aquí cuando realices ventas o agregues ingresos/gastos
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {movements.map((movement) => (
                    <div key={movement.id} className="p-4 hover:bg-slate-50 transition-colors duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getMovementIcon(movement.type)}
                          <div>
                            <h4 className="font-medium text-slate-900">
                              {getMovementTypeLabel(movement.type)}
                              {movement.category && ` - ${movement.category}`}
                            </h4>
                            <p className="text-sm text-slate-600">{movement.description}</p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {new Date(movement.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="flex items-center">
                                <User className="h-3 w-3 mr-1" />
                                {getUserName(movement.created_by)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-lg ${
                            movement.type === 'expense' ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {movement.type === 'expense' ? '-' : '+'}{formatCurrency(movement.amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* No Register Open */
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Calculator className="h-16 w-16 text-slate-400 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No hay caja abierta</h3>
          <p className="text-slate-600 mb-6">
            Para comenzar a registrar ventas y movimientos, primero debes abrir una caja registradora.
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

      {/* Open Register Modal */}
      {showOpenForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Abrir Caja Registradora</h3>
              <p className="text-sm text-slate-600 mt-1">
                Ingresa el monto inicial con el que abres la caja
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto de Apertura *
                </label>
                <FormattedNumberInput
                  value={openingAmount}
                  onChange={setOpeningAmount}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                  max="9999999"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Ingresa el dinero en efectivo con el que inicias la caja
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas de Sesión (opcional)
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notas sobre esta sesión de caja..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={openRegister}
                disabled={!openingAmount || parseFloat(openingAmount) < 0}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Abrir Caja
              </button>
              <button
                onClick={() => {
                  setShowOpenForm(false);
                  setOpeningAmount('');
                  setSessionNotes('');
                }}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Register Modal */}
      {showCloseForm && currentRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Cerrar Caja Registradora</h3>
              <p className="text-sm text-slate-600 mt-1">
                Cuenta el dinero físico en la caja y registra el monto real
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="font-medium text-slate-900 mb-3">Resumen de Sesión</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Apertura:</span>
                    <p className="font-bold text-slate-900">{formatCurrency(currentRegister.opening_amount)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Ventas:</span>
                    <p className="font-bold text-green-600">{formatCurrency(getTotalSales())}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Ingresos:</span>
                    <p className="font-bold text-blue-600">{formatCurrency(getTotalIncome())}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Gastos:</span>
                    <p className="font-bold text-red-600">{formatCurrency(getTotalExpenses())}</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-600">Balance Esperado:</span>
                    <p className="font-bold text-purple-600 text-lg">{formatCurrency(calculateExpectedBalance())}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto Real en Caja *
                </label>
                <FormattedNumberInput
                  value={closingAmount}
                  onChange={setClosingAmount}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={calculateExpectedBalance().toString()}
                  min="0"
                  max="9999999"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Cuenta físicamente el dinero en la caja e ingresa el monto real
                </p>
                {closingAmount && (
                  <div className="mt-2 text-sm">
                    <span className={`font-medium ${
                      parseFloat(closingAmount) === calculateExpectedBalance() 
                        ? 'text-green-600' 
                        : 'text-orange-600'
                    }`}>
                      Diferencia: {formatCurrency(parseFloat(closingAmount) - calculateExpectedBalance())}
                    </span>
                  </div>
                )}
              </div>
              
              {closingAmount && Math.abs(parseFloat(closingAmount) - calculateExpectedBalance()) > 100 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Razón de la Discrepancia *
                  </label>
                  <textarea
                    value={discrepancyReason}
                    onChange={(e) => setDiscrepancyReason(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Explica la razón de la diferencia..."
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas de Cierre (opcional)
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notas sobre el cierre de esta sesión..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={closeRegister}
                disabled={!closingAmount || (Math.abs(parseFloat(closingAmount) - calculateExpectedBalance()) > 100 && !discrepancyReason)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Cerrar Caja
              </button>
              <button
                onClick={() => {
                  setShowCloseForm(false);
                  setClosingAmount('');
                  setDiscrepancyReason('');
                  setSessionNotes('');
                }}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Agregar Movimiento</h3>
              <p className="text-sm text-slate-600 mt-1">
                Registra ingresos o gastos adicionales en la caja
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de Movimiento *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMovementData({ ...movementData, type: 'income' })}
                    className={`p-3 rounded-lg border-2 transition-colors duration-200 ${
                      movementData.type === 'income'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <TrendingUp className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Ingreso</span>
                  </button>
                  <button
                    onClick={() => setMovementData({ ...movementData, type: 'expense' })}
                    className={`p-3 rounded-lg border-2 transition-colors duration-200 ${
                      movementData.type === 'expense'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <TrendingDown className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Gasto</span>
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría
                </label>
                <select
                  value={movementData.category}
                  onChange={(e) => setMovementData({ ...movementData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar categoría</option>
                  {movementData.type === 'income' ? (
                    <>
                      <option value="otros_ingresos">Otros Ingresos</option>
                      <option value="devolucion_proveedor">Devolución Proveedor</option>
                      <option value="ajuste_inventario">Ajuste Inventario</option>
                      <option value="prestamo">Préstamo</option>
                    </>
                  ) : (
                    <>
                      <option value="otros_gastos">Otros Gastos</option>
                      <option value="compra_productos">Compra Productos</option>
                      <option value="servicios">Servicios</option>
                      <option value="transporte">Transporte</option>
                      <option value="mantenimiento">Mantenimiento</option>
                      <option value="devolucion_cliente">Devolución Cliente</option>
                    </>
                  )}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto *
                </label>
                <FormattedNumberInput
                  value={movementData.amount}
                  onChange={(value) => setMovementData({ ...movementData, amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                  max="9999999"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripción *
                </label>
                <textarea
                  value={movementData.description}
                  onChange={(e) => setMovementData({ ...movementData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe el motivo del movimiento..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={addMovement}
                disabled={!movementData.amount || !movementData.description}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Agregar Movimiento
              </button>
              <button
                onClick={() => {
                  setShowMovementForm(false);
                  setMovementData({ type: 'income', category: '', amount: '', description: '' });
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