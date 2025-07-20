import React, { useState, useEffect } from 'react';
import { Plus, Minus, DollarSign, Clock, TrendingUp, TrendingDown, Calculator, Save, X, AlertTriangle, CheckCircle, Eye, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/currency';
import FormattedNumberInput from './FormattedNumberInput';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';

interface CashRegister {
  id: string;
  user_id: string;
  opening_amount: number;
  closing_amount: number;
  total_sales: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  notes: string;
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
  created_by: string | null;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface CashRegisterWithUser extends CashRegister {
  user: User | null;
}

export default function CashRegister() {
  const { user } = useAuth();
  const { notification, showSuccess, showError, showWarning, hideNotification } = useNotification();
  const { confirmation, showConfirmation, hideConfirmation, handleConfirm } = useConfirmation();
  
  const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [registers, setRegisters] = useState<CashRegisterWithUser[]>([]);
  
  // Form states
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  
  // Movement form states
  const [movementType, setMovementType] = useState<'income' | 'expense'>('income');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementCategory, setMovementCategory] = useState('');
  const [movementDescription, setMovementDescription] = useState('');

  useEffect(() => {
    loadCurrentRegister();
    loadRegistersHistory();
  }, [user]);

  const loadCurrentRegister = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Obtener caja abierta actual del usuario
      const { data: register, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setCurrentRegister(register);

      if (register) {
        loadMovements(register.id);
      }
    } catch (error) {
      console.error('Error loading cash register:', error);
      showError('Error al Cargar Caja', 'No se pudo cargar la información de la caja registradora');
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async (registerId: string) => {
    try {
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (error) {
      console.error('Error loading movements:', error);
      showError('Error al Cargar Movimientos', 'No se pudieron cargar los movimientos de caja');
    }
  };

  const loadRegistersHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          *,
          user:users (id, name, email)
        `)
        .eq('user_id', user.id)
        .order('opened_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRegisters(data as CashRegisterWithUser[] || []);
    } catch (error) {
      console.error('Error loading registers history:', error);
    }
  };

  const openRegister = async () => {
    if (!user || !openingAmount) {
      showWarning('Datos Incompletos', 'Debe ingresar el monto de apertura');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .insert({
          user_id: user.id,
          opening_amount: parseFloat(openingAmount),
          status: 'open',
          session_notes: sessionNotes
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentRegister(data);
      setShowOpenModal(false);
      setOpeningAmount('');
      setSessionNotes('');
      showSuccess('¡Caja Abierta!', 'La caja registradora se ha abierto exitosamente');
      loadMovements(data.id);
      loadRegistersHistory();
    } catch (error) {
      console.error('Error opening register:', error);
      showError('Error al Abrir Caja', 'No se pudo abrir la caja registradora: ' + (error as Error).message);
    }
  };

  const closeRegister = async () => {
    if (!currentRegister || !closingAmount) {
      showWarning('Datos Incompletos', 'Debe ingresar el monto de cierre');
      return;
    }

    try {
      const actualAmount = parseFloat(closingAmount);
      const expectedAmount = calculateExpectedAmount();
      const discrepancy = actualAmount - expectedAmount;

      const { error } = await supabase
        .from('cash_registers')
        .update({
          status: 'closed',
          actual_closing_amount: actualAmount,
          expected_closing_amount: expectedAmount,
          discrepancy_amount: discrepancy,
          discrepancy_reason: discrepancyReason,
          closed_at: new Date().toISOString(),
          session_notes: sessionNotes
        })
        .eq('id', currentRegister.id);

      if (error) throw error;

      setCurrentRegister(null);
      setMovements([]);
      setShowCloseModal(false);
      setClosingAmount('');
      setSessionNotes('');
      setDiscrepancyReason('');
      
      if (Math.abs(discrepancy) > 0) {
        showWarning(
          'Caja Cerrada con Diferencia', 
          `La caja se cerró con una diferencia de ${formatCurrency(Math.abs(discrepancy))} ${discrepancy > 0 ? 'a favor' : 'en contra'}`
        );
      } else {
        showSuccess('¡Caja Cerrada!', 'La caja registradora se ha cerrado exitosamente');
      }
      
      loadRegistersHistory();
    } catch (error) {
      console.error('Error closing register:', error);
      showError('Error al Cerrar Caja', 'No se pudo cerrar la caja registradora: ' + (error as Error).message);
    }
  };

  const addMovement = async () => {
    if (!currentRegister || !movementAmount || !movementCategory || !movementDescription) {
      showWarning('Datos Incompletos', 'Debe completar todos los campos del movimiento');
      return;
    }

    try {
      const { error } = await supabase
        .from('cash_movements')
        .insert({
          cash_register_id: currentRegister.id,
          type: movementType,
          category: movementCategory,
          amount: parseFloat(movementAmount),
          description: movementDescription,
          created_by: user?.id
        });

      if (error) throw error;

      setShowMovementModal(false);
      setMovementAmount('');
      setMovementCategory('');
      setMovementDescription('');
      loadMovements(currentRegister.id);
      showSuccess(
        'Movimiento Registrado', 
        `Se ha registrado el ${movementType === 'income' ? 'ingreso' : 'egreso'} exitosamente`
      );
    } catch (error) {
      console.error('Error adding movement:', error);
      showError('Error al Registrar Movimiento', 'No se pudo registrar el movimiento: ' + (error as Error).message);
    }
  };

  const deleteMovement = async (movementId: string) => {
    showConfirmation(
      'Eliminar Movimiento',
      '¿Está seguro de que desea eliminar este movimiento? Esta acción no se puede deshacer.',
      async () => {
        try {
          const { error } = await supabase
            .from('cash_movements')
            .delete()
            .eq('id', movementId);

          if (error) throw error;

          if (currentRegister) {
            loadMovements(currentRegister.id);
          }
          showSuccess('Movimiento Eliminado', 'El movimiento se ha eliminado exitosamente');
        } catch (error) {
          console.error('Error deleting movement:', error);
          showError('Error al Eliminar', 'No se pudo eliminar el movimiento: ' + (error as Error).message);
        }
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      }
    );
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

  const calculateExpectedAmount = () => {
    if (!currentRegister) return 0;
    return currentRegister.opening_amount + (currentRegister.total_sales || 0);
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
      case 'income':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'expense':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'sale':
        return <DollarSign className="h-4 w-4 text-blue-600" />;
      case 'opening':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'closing':
        return <X className="h-4 w-4 text-gray-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'income':
        return 'Ingreso';
      case 'expense':
        return 'Egreso';
      case 'sale':
        return 'Venta';
      case 'opening':
        return 'Apertura';
      case 'closing':
        return 'Cierre';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Caja Registradora</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors duration-200 flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Historial
          </button>
          {!currentRegister ? (
            <button
              onClick={() => setShowOpenModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Abrir Caja
            </button>
          ) : (
            <button
              onClick={() => setShowCloseModal(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cerrar Caja
            </button>
          )}
        </div>
      </div>

      {currentRegister ? (
        <>
          {/* Estado Actual de la Caja */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-green-200">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Monto Apertura</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(currentRegister.opening_amount)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Calculator className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Balance Actual</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(calculateCurrentBalance())}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-200">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-full">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total Ventas</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(currentRegister.total_sales || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-200">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-full">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Abierta Desde</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {new Date(currentRegister.opened_at).toLocaleTimeString('es-ES', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(currentRegister.opened_at).toLocaleDateString('es-ES')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Resumen de Movimientos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                Ingresos Adicionales
              </h3>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(getTotalIncome())}</p>
              <p className="text-sm text-slate-600 mt-1">
                {movements.filter(m => m.type === 'income').length} movimientos
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                <TrendingDown className="h-5 w-5 mr-2 text-red-600" />
                Egresos
              </h3>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(getTotalExpenses())}</p>
              <p className="text-sm text-slate-600 mt-1">
                {movements.filter(m => m.type === 'expense').length} movimientos
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Acciones</h3>
              <button
                onClick={() => setShowMovementModal(true)}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Registrar Movimiento
              </button>
            </div>
          </div>

          {/* Lista de Movimientos */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Movimientos de Caja</h3>
            </div>
            <div className="p-6">
              {movements.length === 0 ? (
                <div className="text-center py-8">
                  <Calculator className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">No hay movimientos registrados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {movements.map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        {getMovementIcon(movement.type)}
                        <div>
                          <h4 className="font-medium text-slate-900">{movement.description}</h4>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="bg-slate-200 px-2 py-1 rounded text-xs">
                              {getMovementTypeLabel(movement.type)}
                            </span>
                            <span>•</span>
                            <span>{movement.category}</span>
                            <span>•</span>
                            <span>{new Date(movement.created_at).toLocaleString('es-ES')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${
                          movement.type === 'income' || movement.type === 'sale' 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {movement.type === 'income' || movement.type === 'sale' ? '+' : '-'}
                          {formatCurrency(movement.amount)}
                        </span>
                        {movement.type !== 'sale' && movement.type !== 'opening' && movement.type !== 'closing' && (
                          <button
                            onClick={() => deleteMovement(movement.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Eliminar movimiento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-slate-50 p-12 rounded-xl text-center">
          <DollarSign className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No hay caja abierta</h3>
          <p className="text-slate-600 mb-6">Abra una caja registradora para comenzar a procesar transacciones</p>
          <button
            onClick={() => setShowOpenModal(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2 mx-auto"
          >
            <DollarSign className="h-5 w-5" />
            Abrir Caja Registradora
          </button>
        </div>
      )}

      {/* Modal Abrir Caja */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Abrir Caja Registradora</h3>
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas de Sesión (Opcional)
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Notas sobre esta sesión de caja..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={openRegister}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                Abrir Caja
              </button>
              <button
                onClick={() => setShowOpenModal(false)}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cerrar Caja */}
      {showCloseModal && currentRegister && (
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
                    <span className="text-slate-600">Apertura:</span>
                    <p className="font-semibold">{formatCurrency(currentRegister.opening_amount)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Ventas:</span>
                    <p className="font-semibold">{formatCurrency(currentRegister.total_sales || 0)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Ingresos:</span>
                    <p className="font-semibold text-green-600">+{formatCurrency(getTotalIncome())}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Egresos:</span>
                    <p className="font-semibold text-red-600">-{formatCurrency(getTotalExpenses())}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-900">Monto Esperado:</span>
                    <span className="text-lg font-bold text-slate-900">{formatCurrency(calculateExpectedAmount())}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto Real de Cierre *
                </label>
                <FormattedNumberInput
                  value={closingAmount}
                  onChange={setClosingAmount}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={calculateExpectedAmount().toString()}
                  min="0"
                />
              </div>

              {closingAmount && Math.abs(parseFloat(closingAmount) - calculateExpectedAmount()) > 0 && (
                <div className={`p-3 rounded-lg border ${
                  parseFloat(closingAmount) - calculateExpectedAmount() > 0 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${
                      parseFloat(closingAmount) - calculateExpectedAmount() > 0 
                        ? 'text-yellow-600' 
                        : 'text-red-600'
                    }`} />
                    <span className={`text-sm font-medium ${
                      parseFloat(closingAmount) - calculateExpectedAmount() > 0 
                        ? 'text-yellow-900' 
                        : 'text-red-900'
                    }`}>
                      Diferencia: {formatCurrency(Math.abs(parseFloat(closingAmount) - calculateExpectedAmount()))} 
                      {parseFloat(closingAmount) - calculateExpectedAmount() > 0 ? ' a favor' : ' en contra'}
                    </span>
                  </div>
                </div>
              )}

              {closingAmount && Math.abs(parseFloat(closingAmount) - calculateExpectedAmount()) > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Razón de la Diferencia
                  </label>
                  <textarea
                    value={discrepancyReason}
                    onChange={(e) => setDiscrepancyReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                    placeholder="Explique la razón de la diferencia..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas de Cierre (Opcional)
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Notas sobre el cierre de esta sesión..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={closeRegister}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                Cerrar Caja
              </button>
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar Movimiento */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Registrar Movimiento</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de Movimiento *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMovementType('income')}
                    className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                      movementType === 'income'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <TrendingUp className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Ingreso</span>
                  </button>
                  <button
                    onClick={() => setMovementType('expense')}
                    className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                      movementType === 'expense'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <TrendingDown className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Egreso</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto *
                </label>
                <FormattedNumberInput
                  value={movementAmount}
                  onChange={setMovementAmount}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría *
                </label>
                <select
                  value={movementCategory}
                  onChange={(e) => setMovementCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar categoría</option>
                  {movementType === 'income' ? (
                    <>
                      <option value="ingresos_adicionales">Ingresos Adicionales</option>
                      <option value="prestamos">Préstamos</option>
                      <option value="devoluciones">Devoluciones</option>
                      <option value="otros_ingresos">Otros Ingresos</option>
                    </>
                  ) : (
                    <>
                      <option value="gastos_operativos">Gastos Operativos</option>
                      <option value="compras">Compras</option>
                      <option value="servicios">Servicios</option>
                      <option value="prestamos_pagos">Pagos de Préstamos</option>
                      <option value="otros_gastos">Otros Gastos</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripción *
                </label>
                <textarea
                  value={movementDescription}
                  onChange={(e) => setMovementDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Descripción del movimiento..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={addMovement}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                Registrar
              </button>
              <button
                onClick={() => setShowMovementModal(false)}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Historial de Cajas</h3>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {registers.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">No hay historial de cajas disponible</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {registers.map((register) => (
                    <div key={register.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            register.status === 'open' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {register.status === 'open' ? 'Abierta' : 'Cerrada'}
                          </span>
                          <span className="text-sm text-slate-600">
                            {new Date(register.opened_at).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(register.actual_closing_amount || register.opening_amount)}
                          </p>
                          {register.discrepancy_amount !== 0 && (
                            <p className={`text-xs ${
                              register.discrepancy_amount > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {register.discrepancy_amount > 0 ? '+' : ''}{formatCurrency(register.discrepancy_amount)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600">Apertura:</span>
                          <p className="font-medium">{formatCurrency(register.opening_amount)}</p>
                        </div>
                        <div>
                          <span className="text-slate-600">Ventas:</span>
                          <p className="font-medium">{formatCurrency(register.total_sales || 0)}</p>
                        </div>
                        <div>
                          <span className="text-slate-600">Duración:</span>
                          <p className="font-medium">
                            {register.closed_at 
                              ? `${Math.round((new Date(register.closed_at).getTime() - new Date(register.opened_at).getTime()) / (1000 * 60 * 60))}h`
                              : 'En curso'
                            }
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-600">Estado:</span>
                          <p className="font-medium">
                            {register.status === 'open' ? 'Activa' : 'Cerrada'}
                          </p>
                        </div>
                      </div>
                      {register.session_notes && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-sm text-slate-600">{register.session_notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cerrar
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