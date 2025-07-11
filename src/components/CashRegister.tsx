import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, User, FileText, Calculator, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CashRegister as CashRegisterType, User as UserType } from '../lib/types';
import { formatCurrency } from '../lib/currency';

interface CashRegisterWithUser extends CashRegisterType {
  user: UserType | null;
}

export default function CashRegister() {
  const [currentRegister, setCurrentRegister] = useState<CashRegisterWithUser | null>(null);
  const [registers, setRegisters] = useState<CashRegisterWithUser[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [openFormData, setOpenFormData] = useState({
    user_id: '',
    opening_amount: '',
    notes: '',
  });
  const [closeFormData, setCloseFormData] = useState({
    closing_amount: '',
    notes: '',
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
      console.log('Cargando caja actual...');
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          *,
          user:users(*)
        `)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      console.log('Caja actual:', data);
      setCurrentRegister(data as CashRegisterWithUser || null);
    } catch (error) {
      console.error('Error loading current register:', error);
      setCurrentRegister(null);
    }
  };

  const loadRegisters = async () => {
    try {
      console.log('Cargando historial de cajas...');
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          *,
          user:users(*)
        `)
        .order('opened_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      console.log('Historial de cajas:', data);
      setRegisters(data as CashRegisterWithUser[]);
    } catch (error) {
      console.error('Error loading registers:', error);
      setRegisters([]);
    }
  };

  const loadUsers = async () => {
    try {
      console.log('Cargando usuarios...');
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      console.log('Usuarios cargados:', data);
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    }
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Abriendo caja con datos:', openFormData);
      
      const registerData = {
        user_id: openFormData.user_id || null,
        opening_amount: parseFloat(openFormData.opening_amount),
        notes: openFormData.notes,
        status: 'open' as const,
        total_sales: 0,
        closing_amount: 0,
      };

      console.log('Datos a insertar:', registerData);
      
      const { error } = await supabase
        .from('cash_registers')
        .insert([registerData]);

      if (error) throw error;

      console.log('Caja abierta exitosamente');
      setShowOpenForm(false);
      setOpenFormData({ user_id: '', opening_amount: '', notes: '' });
      loadData();
      alert('Caja abierta exitosamente');
    } catch (error) {
      console.error('Error opening register:', error);
      alert('Error al abrir la caja');
    }
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRegister) return;

    try {
      console.log('Cerrando caja:', currentRegister.id);
      
      // Calculate total sales for this register session
      const { data: salesData } = await supabase
        .from('sales')
        .select('total_amount')
        .gte('created_at', currentRegister.opened_at);

      const totalSales = salesData?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
      console.log('Ventas calculadas:', totalSales);

      const { error } = await supabase
        .from('cash_registers')
        .update({
          closing_amount: parseFloat(closeFormData.closing_amount),
          total_sales: totalSales,
          status: 'closed',
          closed_at: new Date().toISOString(),
          notes: currentRegister.notes + (closeFormData.notes ? `\n\nCierre: ${closeFormData.notes}` : ''),
        })
        .eq('id', currentRegister.id);

      if (error) throw error;

      console.log('Caja cerrada exitosamente');
      setShowCloseForm(false);
      setCloseFormData({ closing_amount: '', notes: '' });
      loadData();
      alert('Caja cerrada exitosamente');
    } catch (error) {
      console.error('Error closing register:', error);
      alert('Error al cerrar la caja');
    }
  };

  const calculateDifference = () => {
    if (!currentRegister || !closeFormData.closing_amount) return 0;
    
    // Calcular ventas desde que se abrió la caja
    const expected = (currentRegister.opening_amount || 0) + (currentRegister.total_sales || 0);
    const actual = parseFloat(closeFormData.closing_amount);
    return actual - expected;
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
            <button
              onClick={() => setShowCloseForm(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center"
            >
              <Clock className="h-4 w-4 mr-2" />
              Cerrar Caja
            </button>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Estado</p>
                  <p className="text-lg font-bold text-green-900">ABIERTA</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Monto Inicial</p>
                  <p className="text-lg font-bold text-blue-900">{formatCurrency(currentRegister.opening_amount || 0)}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Operador</p>
                  <p className="text-lg font-bold text-purple-900">
                    {currentRegister.user?.name || 'Sin asignar'}
                  </p>
                </div>
                <div className="p-2 bg-purple-100 rounded-full">
                  <User className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
            
            <div className="md:col-span-3 bg-slate-50 p-4 rounded-lg">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Abierta el: {new Date(currentRegister.opened_at).toLocaleString('es-ES')}</span>
                {currentRegister.notes && currentRegister.notes.trim() && (
                  <span className="flex items-center">
                    <FileText className="h-4 w-4 mr-1" />
                    Notas disponibles
                  </span>
                )}
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
                <input
                  type="number"
                  step="0.01"
                  required
                  value={openFormData.opening_amount}
                  onChange={(e) => setOpenFormData({ ...openFormData, opening_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    <span>${(currentRegister.opening_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ventas del día:</span>
                    <span>${(currentRegister.total_sales || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>Esperado:</span>
                    <span>${((currentRegister.opening_amount || 0) + (currentRegister.total_sales || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto Final (conteo físico)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={closeFormData.closing_amount}
                  onChange={(e) => setCloseFormData({ ...closeFormData, closing_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
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
                            Inicial: {formatCurrency(register.opening_amount || 0)}
                          Inicial: ${(register.opening_amount || 0).toFixed(2)}
                        </span>
                          <span>{formatCurrency(currentRegister.opening_amount || 0)}</span>
                          <>
                                Final: {formatCurrency(register.closing_amount || 0)}
                              Final: ${(register.closing_amount || 0).toFixed(2)}
                          <span>{formatCurrency(currentRegister.total_sales || 0)}</span>
                                Ventas: {formatCurrency(register.total_sales || 0)}
                              Ventas: ${(register.total_sales || 0).toFixed(2)}
                            </span>
                          <span>{formatCurrency((currentRegister.opening_amount || 0) + (currentRegister.total_sales || 0))}</span>
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