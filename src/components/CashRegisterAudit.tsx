import React, { useState, useEffect } from 'react';
import { Calendar, Search, Eye, Edit2, Save, X, Calculator, DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, User, Clock, Package, Activity, FileText, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';

interface CashRegisterSession {
  id: string;
  user_id: string;
  opening_amount: number;
  closing_amount: number;
  expected_closing_amount: number;
  actual_closing_amount: number;
  discrepancy_amount: number;
  discrepancy_reason: string;
  session_notes: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  user: {
    name: string;
    email: string;
  } | null;
  total_sales_amount?: number;
  total_sales_count?: number;
  total_income?: number;
  total_expenses?: number;
  calculated_balance?: number;
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
  created_by_user?: { name: string } | null;
}

export default function CashRegisterAudit() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [selectedSession, setSelectedSession] = useState<CashRegisterSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMovement, setEditingMovement] = useState<CashMovement | null>(null);
  const [editFormData, setEditFormData] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadMovements(selectedSession.id);
    }
  }, [selectedSession]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cash_register_history_summary')
        .select('*')
        .order('opened_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async (registerId: string) => {
    try {
      setMovementsLoading(true);
      const { data, error } = await supabase
        .from('cash_movements')
        .select(`
          *,
          created_by_user:users!created_by (name)
        `)
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (error) {
      console.error('Error loading movements:', error);
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  };

  const refreshSessionDetails = async (registerId: string) => {
    try {
      // Recargar los detalles de la sesión específica
      const { data: sessionData, error: sessionError } = await supabase
        .from('cash_register_history_summary')
        .select('*')
        .eq('id', registerId)
        .single();

      if (sessionError) throw sessionError;

      // Actualizar la sesión en el estado
      setSessions(prevSessions => 
        prevSessions.map(session => 
          session.id === registerId ? sessionData : session
        )
      );

      // Actualizar la sesión seleccionada si es la misma
      if (selectedSession && selectedSession.id === registerId) {
        setSelectedSession(sessionData);
      }

      // Recargar movimientos para reflejar cambios
      await loadMovements(registerId);
    } catch (error) {
      console.error('Error refreshing session details:', error);
    }
  };

  const handleEditMovement = (movement: CashMovement) => {
    // No permitir editar movimientos de apertura, cierre o ventas
    if (['opening', 'closing', 'sale'].includes(movement.type)) {
      alert('No se pueden editar movimientos de apertura, cierre o ventas automáticas.');
      return;
    }

    setEditingMovement(movement);
    setEditFormData({
      type: movement.type as 'income' | 'expense',
      category: movement.category,
      amount: movement.amount.toString(),
      description: movement.description,
    });
  };

  const handleSaveMovement = async () => {
    if (!editingMovement || !selectedSession) return;

    try {
      const amount = parseFloat(editFormData.amount);
      if (amount <= 0) {
        alert('El monto debe ser mayor a cero');
        return;
      }

      if (amount > 9999999.99) {
        alert('El monto es demasiado grande. Máximo permitido: $9,999,999.99');
        return;
      }

      const updateData = {
        type: editFormData.type,
        category: editFormData.category || (editFormData.type === 'income' ? 'otros_ingresos' : 'otros_gastos'),
        amount: amount,
        description: editFormData.description.trim(),
      };

      const { error } = await supabase
        .from('cash_movements')
        .update(updateData)
        .eq('id', editingMovement.id);

      if (error) throw error;

      // Cerrar el formulario de edición
      setEditingMovement(null);
      setEditFormData({ type: 'income', category: '', amount: '', description: '' });

      // Refrescar los detalles de la sesión y movimientos
      await refreshSessionDetails(selectedSession.id);

      alert('Movimiento actualizado exitosamente');
    } catch (error) {
      console.error('Error updating movement:', error);
      alert('Error al actualizar movimiento: ' + (error as Error).message);
    }
  };

  const handleDeleteMovement = async (movementId: string) => {
    if (!selectedSession) return;

    const movement = movements.find(m => m.id === movementId);
    if (!movement) return;

    // No permitir eliminar movimientos de apertura, cierre o ventas
    if (['opening', 'closing', 'sale'].includes(movement.type)) {
      alert('No se pueden eliminar movimientos de apertura, cierre o ventas automáticas.');
      return;
    }

    if (window.confirm('¿Estás seguro de que quieres eliminar este movimiento? Esta acción no se puede deshacer.')) {
      try {
        const { error } = await supabase
          .from('cash_movements')
          .delete()
          .eq('id', movementId);

        if (error) throw error;

        // Refrescar los detalles de la sesión y movimientos
        await refreshSessionDetails(selectedSession.id);

        alert('Movimiento eliminado exitosamente');
      } catch (error) {
        console.error('Error deleting movement:', error);
        alert('Error al eliminar movimiento: ' + (error as Error).message);
      }
    }
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

  const getUserName = (createdBy: string | null | undefined, createdByUser: any) => {
    if (!createdBy) return 'Sistema';
    if (createdByUser?.name) return createdByUser.name;
    if (createdBy === user?.id) return user.name || 'Tú';
    return 'Usuario';
  };

  const filteredSessions = sessions.filter(session => {
    // Filter by date
    if (dateFilter && !session.opened_at.startsWith(dateFilter)) {
      return false;
    }
    
    // Filter by status
    if (statusFilter !== 'all' && session.status !== statusFilter) {
      return false;
    }
    
    // Filter by user
    if (userFilter !== 'all' && session.user_id !== userFilter) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const sessionId = session.id.slice(-8);
      const userName = session.user?.name?.toLowerCase() || '';
      
      return (
        sessionId.includes(searchTerm) ||
        userName.includes(searchLower) ||
        session.session_notes.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  const uniqueUsers = Array.from(new Set(sessions.map(s => s.user_id)))
    .map(userId => sessions.find(s => s.user_id === userId))
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ID de sesión, usuario o notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="open">Abiertas</option>
              <option value="closed">Cerradas</option>
            </select>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los usuarios</option>
              {uniqueUsers.map((session) => (
                <option key={session?.user_id} value={session?.user_id}>
                  {session?.user?.name || 'Usuario desconocido'}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(searchTerm || dateFilter || statusFilter !== 'all' || userFilter !== 'all') && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredSessions.length} de {sessions.length} sesiones
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-600" />
              Sesiones de Caja ({filteredSessions.length})
            </h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
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
            ) : filteredSessions.length === 0 ? (
              <div className="p-12 text-center">
                <Calculator className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">No se encontraron sesiones de caja</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors duration-200 ${
                      selectedSession?.id === session.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            session.status === 'open' ? 'bg-green-100' : 'bg-slate-100'
                          }`}>
                            <Calculator className={`h-4 w-4 ${
                              session.status === 'open' ? 'text-green-600' : 'text-slate-600'
                            }`} />
                          </div>
                          <div>
                            <h4 className="font-medium text-slate-900">
                              Sesión #{session.id.slice(-8)}
                            </h4>
                            <p className="text-sm text-slate-600">
                              {session.user?.name || 'Usuario desconocido'}
                            </p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {new Date(session.opened_at).toLocaleDateString('es-ES')}
                              </span>
                              <span className={`px-2 py-1 rounded-full ${
                                session.status === 'open' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-slate-100 text-slate-800'
                              }`}>
                                {session.status === 'open' ? 'Abierta' : 'Cerrada'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">
                          {formatCurrency(session.calculated_balance || 0)}
                        </p>
                        <p className="text-xs text-slate-500">Balance</p>
                        {Math.abs(session.discrepancy_amount || 0) > 1 && (
                          <div className="flex items-center text-xs text-orange-600 mt-1">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Discrepancia
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Session Details */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Eye className="h-5 w-5 mr-2 text-green-600" />
              {selectedSession ? `Detalles de Sesión #${selectedSession.id.slice(-8)}` : 'Selecciona una Sesión'}
            </h3>
          </div>
          
          {selectedSession ? (
            <div className="max-h-96 overflow-y-auto">
              {/* Session Summary */}
              <div className="p-6 border-b border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Operador:</span>
                    <p className="font-medium text-slate-900">{selectedSession.user?.name || 'Usuario desconocido'}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Estado:</span>
                    <p className={`font-medium ${
                      selectedSession.status === 'open' ? 'text-green-600' : 'text-slate-900'
                    }`}>
                      {selectedSession.status === 'open' ? 'Abierta' : 'Cerrada'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-600">Apertura:</span>
                    <p className="font-bold text-blue-600">{formatCurrency(selectedSession.opening_amount)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Ventas:</span>
                    <p className="font-bold text-green-600">{formatCurrency(selectedSession.cash_sales_amount || 0)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Balance:</span>
                    <p className="font-bold text-purple-600">{formatCurrency(selectedSession.calculated_balance || 0)}</p>
                  </div>
                  {selectedSession.status === 'closed' && (
                    <div>
                      <span className="text-slate-600">Discrepancia:</span>
                      <p className={`font-bold ${
                        Math.abs(selectedSession.discrepancy_amount || 0) > 1 
                          ? 'text-orange-600' 
                          : 'text-green-600'
                      }`}>
                        {formatCurrency(selectedSession.discrepancy_amount || 0)}
                      </p>
                    </div>
                  )}
                </div>
                
                {selectedSession.session_notes && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-700">{selectedSession.session_notes}</p>
                  </div>
                )}
              </div>

              {/* Movements */}
              <div className="p-6">
                <h4 className="font-medium text-slate-900 mb-4 flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  Movimientos ({movements.length})
                </h4>
                
                {movementsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : movements.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No hay movimientos registrados</p>
                ) : (
                  <div className="space-y-3">
                    {movements.map((movement) => (
                      <div key={movement.id} className="p-3 bg-slate-50 rounded-lg">
                        {editingMovement?.id === movement.id ? (
                          /* Edit Form */
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setEditFormData({ ...editFormData, type: 'income' })}
                                className={`p-2 rounded border-2 transition-colors duration-200 ${
                                  editFormData.type === 'income'
                                    ? 'border-green-500 bg-green-50 text-green-700'
                                    : 'border-slate-300 hover:border-slate-400'
                                }`}
                              >
                                <TrendingUp className="h-4 w-4 mx-auto mb-1" />
                                <span className="text-xs">Ingreso</span>
                              </button>
                              <button
                                onClick={() => setEditFormData({ ...editFormData, type: 'expense' })}
                                className={`p-2 rounded border-2 transition-colors duration-200 ${
                                  editFormData.type === 'expense'
                                    ? 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-slate-300 hover:border-slate-400'
                                }`}
                              >
                                <TrendingDown className="h-4 w-4 mx-auto mb-1" />
                                <span className="text-xs">Gasto</span>
                              </button>
                            </div>
                            
                            <select
                              value={editFormData.category}
                              onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Seleccionar categoría</option>
                              {editFormData.type === 'income' ? (
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
                            
                            <FormattedNumberInput
                              value={editFormData.amount}
                              onChange={(value) => setEditFormData({ ...editFormData, amount: value })}
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Monto"
                              min="0"
                              max="9999999"
                            />
                            
                            <textarea
                              value={editFormData.description}
                              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                              rows={2}
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Descripción"
                            />
                            
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveMovement}
                                disabled={!editFormData.amount || !editFormData.description}
                                className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Guardar
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMovement(null);
                                  setEditFormData({ type: 'income', category: '', amount: '', description: '' });
                                }}
                                className="flex-1 bg-slate-200 text-slate-700 px-3 py-1 rounded text-sm hover:bg-slate-300 transition-colors duration-200 flex items-center justify-center"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Display Mode */
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {getMovementIcon(movement.type)}
                              <div>
                                <h5 className="font-medium text-slate-900 text-sm">
                                  {getMovementTypeLabel(movement.type)}
                                  {movement.category && ` - ${movement.category}`}
                                </h5>
                                <p className="text-xs text-slate-600">{movement.description}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                  <span className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {new Date(movement.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="flex items-center">
                                    <User className="h-3 w-3 mr-1" />
                                    {getUserName(movement.created_by, movement.created_by_user)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <p className={`font-bold text-sm ${
                                  movement.type === 'expense' ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {movement.type === 'expense' ? '-' : '+'}{formatCurrency(movement.amount)}
                                </p>
                              </div>
                              {/* Solo mostrar botones de edición para movimientos editables */}
                              {!['opening', 'closing', 'sale'].includes(movement.type) && user?.role === 'admin' && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEditMovement(movement)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                                    title="Editar movimiento"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMovement(movement.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                                    title="Eliminar movimiento"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Calculator className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">Selecciona una sesión para ver los detalles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}