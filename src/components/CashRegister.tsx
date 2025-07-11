import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, User, FileText, Calculator, TrendingUp, AlertCircle, Plus, Minus, Eye, X, Edit2, Trash2, ArrowUpCircle, ArrowDownCircle, PieChart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CashRegister as CashRegisterType, User as UserType, CashMovement } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import FormattedNumberInput from './FormattedNumberInput';

interface CashRegisterWithUser extends CashRegisterType {
  user: UserType | null;
  current_balance?: number;
  total_income?: number;
  total_expenses?: number;
}

interface CashRegisterWithMovements extends CashRegisterWithUser {
  cash_movements: CashMovement[];
}

const INCOME_CATEGORIES = [
  { value: 'ventas_efectivo', label: 'Ventas en Efectivo' },
  { value: 'ingresos_adicionales', label: 'Ingresos Adicionales' },
  { value: 'devoluciones', label: 'Devoluciones de Proveedores' },
  { value: 'otros_ingresos', label: 'Otros Ingresos' },
];

const EXPENSE_CATEGORIES = [
  { value: 'gastos_operativos', label: 'Gastos Operativos' },
  { value: 'servicios_publicos', label: 'Servicios Públicos' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'compras_inventario', label: 'Compras de Inventario' },
  { value: 'gastos_personal', label: 'Gastos de Personal' },
  { value: 'otros_gastos', label: 'Otros Gastos' },
];

export default function CashRegister() {
  const [currentRegister, setCurrentRegister] = useState<CashRegisterWithMovements | null>(null);
  const [registers, setRegisters] = useState<CashRegisterWithUser[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [movementType, setMovementType] = useState<'income' | 'expense'>('income');
  
  const [openFormData, setOpenFormData] = useState({
    user_id: '',
    opening_amount: '',
    notes: '',
  });
  
  const [closeFormData, setCloseFormData] = useState({
    closing_amount: '',
    notes: '',
  });

  const [movementFormData, setMovementFormData] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCurrentRegister(),
        loadRegisters(),
        loadUsers(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentRegister = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          *,
          user:users(*),
          cash_movements(*)
        `)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Ordenar movimientos por fecha
        const sortedMovements = (data.cash_movements || []).sort((a: CashMovement, b: CashMovement) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setCurrentRegister({ ...data, cash_movements: sortedMovements } as CashRegisterWithMovements);
        setMovements(sortedMovements);
      } else {
        setCurrentRegister(null);
        setMovements([]);
      }
    } catch (error) {
      console.error('Error loading current register:', error);
      setCurrentRegister(null);
      setMovements([]);
    }
  };

  const loadRegisters = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          *,
          user:users(*)
        `)
        .order('opened_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRegisters(data as CashRegisterWithUser[]);
    } catch (error) {
      console.error('Error loading registers:', error);
      setRegisters([]);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    }
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const registerData = {
        user_id: openFormData.user_id || null,
        opening_amount: parseFloat(openFormData.opening_amount),
        notes: openFormData.notes,
        status: 'open' as const,
        total_sales: 0,
        closing_amount: 0,
        current_balance: parseFloat(openFormData.opening_amount),
        total_income: 0,
        total_expenses: 0,
      };

      const { data: newRegister, error } = await supabase
        .from('cash_registers')
        .insert([registerData])
        .select()
        .single();

      if (error) throw error;

      // Registrar movimiento de apertura
      await supabase
        .from('cash_movements')
        .insert([{
          cash_register_id: newRegister.id,
          type: 'opening',
          category: 'apertura',
          amount: parseFloat(openFormData.opening_amount),
          description: `Apertura de caja - ${openFormData.notes || 'Sin observaciones'}`,
          created_by: openFormData.user_id || null,
        }]);

      setShowOpenForm(false);
      setOpenFormData({ user_id: '', opening_amount: '', notes: '' });
      loadData();
      alert('Caja abierta exitosamente');
    } catch (error) {
      console.error('Error opening register:', error);
      alert('Error al abrir la caja: ' + (error as Error).message);
    }
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRegister) return;

    try {
      const closingAmount = parseFloat(closeFormData.closing_amount);
      
      // Registrar movimiento de cierre
      await supabase
        .from('cash_movements')
        .insert([{
          cash_register_id: currentRegister.id,
          type: 'closing',
          category: 'cierre',
          amount: Math.abs((currentRegister.current_balance || 0) - closingAmount),
          description: `Cierre de caja - Diferencia: ${formatCurrency((currentRegister.current_balance || 0) - closingAmount)} - ${closeFormData.notes || 'Sin observaciones'}`,
          created_by: currentRegister.user_id,
        }]);

      const { error } = await supabase
        .from('cash_registers')
        .update({
          closing_amount: closingAmount,
          status: 'closed',
          closed_at: new Date().toISOString(),
          notes: currentRegister.notes + (closeFormData.notes ? `\n\nCierre: ${closeFormData.notes}` : ''),
        })
        .eq('id', currentRegister.id);

      if (error) throw error;

      setShowCloseForm(false);
      setCloseFormData({ closing_amount: '', notes: '' });
      loadData();
      alert('Caja cerrada exitosamente');
    } catch (error) {
      console.error('Error closing register:', error);
      alert('Error al cerrar la caja: ' + (error as Error).message);
    }
  };

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRegister) return;

    try {
      const { error } = await supabase
        .from('cash_movements')
        .insert([{
          cash_register_id: currentRegister.id,
          type: movementFormData.type,
          category: movementFormData.category,
          amount: parseFloat(movementFormData.amount),
          description: movementFormData.description,
          created_by: currentRegister.user_id,
        }]);

      if (error) throw error;

      setShowMovementForm(false);
      setMovementFormData({ type: 'income', category: '', amount: '', description: '' });
      loadCurrentRegister();
      alert(`${movementFormData.type === 'income' ? 'Ingreso' : 'Egreso'} registrado exitosamente`);
    } catch (error) {
      console.error('Error adding movement:', error);
      alert('Error al registrar el movimiento: ' + (error as Error).message);
    }
  };

  const handleDeleteMovement = async (movementId: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este movimiento?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('cash_movements')
        .delete()
        .eq('id', movementId);

      if (error) throw error;

      loadCurrentRegister();
      alert('Movimiento eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting movement:', error);
      alert('Error al eliminar el movimiento: ' + (error as Error).message);
    }
  };

  const calculateDifference = () => {
    if (!currentRegister || !closeFormData.closing_amount) return 0;
    const expected = currentRegister.current_balance || 0;
    const actual = parseFloat(closeFormData.closing_amount);
    return actual - expected;
  };

  const getCategoryLabel = (category: string, type: string) => {
    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const found = categories.find(cat => cat.value === category);
    return found ? found.label : category;
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'income':
      case 'sale':
      case 'opening':
        return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
      case 'expense':
      case 'closing':
        return <ArrowDownCircle className="h-4 w-4 text-red-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-slate-600" />;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'income':
      case 'sale':
      case 'opening':
        return 'text-green-600';
      case 'expense':
      case 'closing':
        return 'text-red-600';
      default:
        return 'text-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Caja Registradora</h2>
        <div className="flex gap-2">
          {!currentRegister ? (
            <button
              onClick={() => setShowOpenForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Abrir Caja
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setMovementType('income');
                  setMovementFormData({ ...movementFormData, type: 'income' });
                  setShowMovementForm(true);
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ingreso
              </button>
              <button
                onClick={() => {
                  setMovementType('expense');
                  setMovementFormData({ ...movementFormData, type: 'expense' });
                  setShowMovementForm(true);
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center"
              >
                <Minus className="h-4 w-4 mr-2" />
                Egreso
              </button>
              <button
                onClick={() => setShowMovementsModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Movimientos
              </button>
              <button
                onClick={() => setShowCloseForm(true)}
                className="bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors duration-200 flex items-center"
              >
                <Clock className="h-4 w-4 mr-2" />
                Cerrar Caja
              </button>
            </>
          )}
        </div>
      </div>

      {/* Current Register Status */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Calculator className="h-5 w-5 mr-2 text-blue-600" />
          Estado Actual de la Caja
        </h3>
        
        {currentRegister ? (
          <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Balance Actual</p>
                    <p className="text-2xl font-bold text-green-900">
                      {formatCurrency(currentRegister.current_balance || 0)}
                    </p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-full">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Monto Inicial</p>
                    <p className="text-xl font-bold text-blue-900">
                      {formatCurrency(currentRegister.opening_amount || 0)}
                    </p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-full">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-600">Total Ingresos</p>
                    <p className="text-xl font-bold text-emerald-900">
                      {formatCurrency(currentRegister.total_income || 0)}
                    </p>
                  </div>
                  <div className="p-2 bg-emerald-100 rounded-full">
                    <ArrowUpCircle className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-600">Total Egresos</p>
                    <p className="text-xl font-bold text-red-900">
                      {formatCurrency(currentRegister.total_expenses || 0)}
                    </p>
                  </div>
                  <div className="p-2 bg-red-100 rounded-full">
                    <ArrowDownCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Movements */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-slate-900">Últimos Movimientos</h4>
                <button
                  onClick={() => setShowMovementsModal(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver todos
                </button>
              </div>
              <div className="space-y-2">
                {movements.slice(0, 5).map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getMovementIcon(movement.type)}
                      <div>
                        <p className="font-medium text-slate-900">{movement.description}</p>
                        <p className="text-sm text-slate-600">
                          {getCategoryLabel(movement.category, movement.type)} • 
                          {new Date(movement.created_at).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </div>
                    <div className={`font-bold ${getMovementColor(movement.type)}`}>
                      {movement.type === 'expense' || movement.type === 'closing' ? '-' : '+'}
                      {formatCurrency(movement.amount)}
                    </div>
                  </div>
                ))}
                {movements.length === 0 && (
                  <p className="text-slate-500 text-center py-4">No hay movimientos registrados</p>
                )}
              </div>
            </div>

            {/* Operator Info */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  <span>Operador: {currentRegister.user?.name || 'Sin asignar'}</span>
                </div>
                <span>Abierta: {new Date(currentRegister.opened_at).toLocaleString('es-ES')}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">No hay caja abierta actualmente</p>
            <p className="text-sm text-slate-400 mt-1">Abre una caja para comenzar las operaciones del día</p>
          </div>
        )}
      </div>

      {/* Open Register Form */}
      {showOpenForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Abrir Caja</h3>
          <form onSubmit={handleOpenRegister} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Operador
                </label>
                <select
                  value={openFormData.user_id}
                  onChange={(e) => setOpenFormData({ ...openFormData, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar operador</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto Inicial
                </label>
                <FormattedNumberInput
                  value={openFormData.opening_amount}
                  onChange={(value) => setOpenFormData({ ...openFormData, opening_amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notas (opcional)
              </label>
              <textarea
                value={openFormData.notes}
                onChange={(e) => setOpenFormData({ ...openFormData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                Abrir Caja
              </button>
              <button
                type="button"
                onClick={() => setShowOpenForm(false)}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Movement Form */}
      {showMovementForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Registrar {movementFormData.type === 'income' ? 'Ingreso' : 'Egreso'}
          </h3>
          <form onSubmit={handleAddMovement} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría
                </label>
                <select
                  value={movementFormData.category}
                  onChange={(e) => setMovementFormData({ ...movementFormData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {(movementFormData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto
                </label>
                <FormattedNumberInput
                  value={movementFormData.amount}
                  onChange={(value) => setMovementFormData({ ...movementFormData, amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Descripción
              </label>
              <textarea
                value={movementFormData.description}
                onChange={(e) => setMovementFormData({ ...movementFormData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                placeholder="Describe el motivo del movimiento..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className={`px-4 py-2 rounded-lg text-white transition-colors duration-200 ${
                  movementFormData.type === 'income' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Registrar {movementFormData.type === 'income' ? 'Ingreso' : 'Egreso'}
              </button>
              <button
                type="button"
                onClick={() => setShowMovementForm(false)}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Close Register Form */}
      {showCloseForm && currentRegister && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Cerrar Caja</h3>
          <form onSubmit={handleCloseRegister} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="font-medium text-slate-900 mb-2">Resumen del Turno</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Monto inicial:</span>
                    <span>{formatCurrency(currentRegister.opening_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total ingresos:</span>
                    <span className="text-green-600">+{formatCurrency(currentRegister.total_income || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total egresos:</span>
                    <span className="text-red-600">-{formatCurrency(currentRegister.total_expenses || 0)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>Balance esperado:</span>
                    <span>{formatCurrency(currentRegister.current_balance || 0)}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto Final (conteo físico)
                </label>
                <FormattedNumberInput
                  value={closeFormData.closing_amount}
                  onChange={(value) => setCloseFormData({ ...closeFormData, closing_amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="0"
                />
                {closeFormData.closing_amount && (
                  <div className={`mt-2 text-sm ${
                    calculateDifference() === 0 
                      ? 'text-green-600' 
                      : calculateDifference() > 0 
                        ? 'text-blue-600' 
                        : 'text-red-600'
                  }`}>
                    Diferencia: {formatCurrency(calculateDifference())}
                    {calculateDifference() > 0 && ' (sobrante)'}
                    {calculateDifference() < 0 && ' (faltante)'}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notas de cierre (opcional)
              </label>
              <textarea
                value={closeFormData.notes}
                onChange={(e) => setCloseFormData({ ...closeFormData, notes: e.target.value })}
                rows={3}
                placeholder="Observaciones, incidencias, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors duration-200"
              >
                Cerrar Caja
              </button>
              <button
                type="button"
                onClick={() => setShowCloseForm(false)}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Movements Modal */}
      {showMovementsModal && currentRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  Movimientos de Caja
                </h3>
                <button
                  onClick={() => setShowMovementsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-3">
                {movements.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No hay movimientos registrados</p>
                ) : (
                  movements.map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                      <div className="flex items-center gap-3 flex-1">
                        {getMovementIcon(movement.type)}
                        <div className="flex-1">
                          <h5 className="font-medium text-slate-900">{movement.description}</h5>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>{getCategoryLabel(movement.category, movement.type)}</span>
                            <span>•</span>
                            <span>{new Date(movement.created_at).toLocaleString('es-ES')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`font-bold ${getMovementColor(movement.type)}`}>
                          {movement.type === 'expense' || movement.type === 'closing' ? '-' : '+'}
                          {formatCurrency(movement.amount)}
                        </div>
                        {movement.type !== 'opening' && movement.type !== 'sale' && (
                          <button
                            onClick={() => handleDeleteMovement(movement.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                            title="Eliminar movimiento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register History */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Historial de Cajas</h3>
        </div>
        <div className="p-6">
          {registers.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No hay registros de caja</p>
          ) : (
            <div className="space-y-4">
              {registers.map((register) => (
                <div key={register.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium text-slate-900">
                          {register.user?.name || 'Sin operador'}
                        </p>
                        <p className="text-sm text-slate-600">
                          {new Date(register.opened_at).toLocaleDateString('es-ES')} • 
                          {register.status === 'open' ? ' Abierta' : ` Cerrada a las ${new Date(register.closed_at!).toLocaleTimeString('es-ES')}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Inicial: {formatCurrency(register.opening_amount || 0)}</span>
                        {register.status === 'closed' && (
                          <>
                            <span>Final: {formatCurrency(register.closing_amount || 0)}</span>
                            <span>Balance: {formatCurrency(register.current_balance || 0)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      register.status === 'open' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {register.status === 'open' ? 'Abierta' : 'Cerrada'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}