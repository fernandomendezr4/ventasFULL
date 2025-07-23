import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, TrendingUp, TrendingDown, Package, User, Clock, Eye, X, RefreshCw, AlertTriangle, CheckCircle, Activity, FileText, BarChart3, Calculator } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';

interface CashRegisterSession {
  id: string;
  user_id: string;
  user_name: string;
  opening_amount: number;
  closing_amount: number;
  actual_closing_amount: number;
  expected_closing_amount: number;
  discrepancy_amount: number;
  status: string;
  opened_at: string;
  closed_at: string | null;
  session_notes: string;
  total_sales_amount: number;
  total_sales_count: number;
  cash_sales_amount: number;
  cash_sales_count: number;
  total_installments_amount: number;
  total_installments_count: number;
  total_income: number;
  total_expenses: number;
  total_movements: number;
  calculated_balance: number;
}

interface SessionDetail {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  created_at: string;
  created_by_name: string;
  sale_details?: any;
  installment_details?: any;
}

export default function CashRegisterAudit() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<CashRegisterSession | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  // Auto-refresh cada 30 segundos cuando hay una sesión seleccionada
  useEffect(() => {
    if (selectedSession) {
      const interval = setInterval(() => {
        refreshSessionData();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedSession]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      console.log('Cargando sesiones de caja...');
      
      const { data, error } = await supabase
        .from('cash_register_history_summary')
        .select('*')
        .order('opened_at', { ascending: false });

      if (error) {
        console.error('Error loading sessions:', error);
        throw error;
      }

      console.log('Sesiones cargadas:', data?.length || 0);
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading cash register sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshSessionData = async () => {
    if (!selectedSession) return;
    
    try {
      setRefreshing(true);
      
      // Recargar datos de la sesión seleccionada
      const { data: sessionData, error: sessionError } = await supabase
        .from('cash_register_history_summary')
        .select('*')
        .eq('id', selectedSession.id)
        .single();

      if (sessionError) {
        console.error('Error refreshing session:', sessionError);
        return;
      }

      if (sessionData) {
        setSelectedSession(sessionData);
        
        // Actualizar también en la lista de sesiones
        setSessions(prev => prev.map(s => s.id === sessionData.id ? sessionData : s));
      }

      // Recargar detalles de movimientos
      await loadSessionDetails(selectedSession.id);
      
    } catch (error) {
      console.error('Error refreshing session data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    try {
      setDetailsLoading(true);
      console.log('Cargando detalles de sesión:', sessionId);
      
      const { data, error } = await supabase
        .from('cash_register_movements_detailed')
        .select('*')
        .eq('cash_register_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading session details:', error);
        throw error;
      }

      console.log('Detalles cargados:', data?.length || 0);
      setSessionDetails(data || []);
    } catch (error) {
      console.error('Error loading session details:', error);
      setSessionDetails([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSessionSelect = async (session: CashRegisterSession) => {
    setSelectedSession(session);
    await loadSessionDetails(session.id);
  };

  const handleRefresh = async () => {
    await loadSessions();
    if (selectedSession) {
      await refreshSessionData();
    }
  };

  const filteredSessions = sessions.filter(session => {
    // Filtro por fecha
    if (dateFilter && !session.opened_at.startsWith(dateFilter)) {
      return false;
    }
    
    // Filtro por estado
    if (statusFilter !== 'all' && session.status !== statusFilter) {
      return false;
    }
    
    // Filtro por usuario
    if (userFilter !== 'all' && session.user_id !== userFilter) {
      return false;
    }
    
    return true;
  });

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getDiscrepancyColor = (amount: number) => {
    if (Math.abs(amount) < 100) return 'text-green-600';
    if (Math.abs(amount) < 1000) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Obtener lista única de usuarios para el filtro
  const uniqueUsers = Array.from(new Set(sessions.map(s => s.user_id)))
    .map(userId => {
      const session = sessions.find(s => s.user_id === userId);
      return { id: userId, name: session?.user_name || 'Usuario desconocido' };
    });

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
      {/* Header con botón de actualizar */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-slate-900">Auditoría de Cajas Registradoras</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Filtrar por Fecha
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Estado
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="open">Abiertas</option>
              <option value="closed">Cerradas</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Usuario
            </label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              {uniqueUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(dateFilter || statusFilter !== 'all' || userFilter !== 'all') && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredSessions.length} de {sessions.length} sesiones
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Sesiones */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h4 className="text-lg font-semibold text-slate-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-600" />
              Sesiones de Caja ({filteredSessions.length})
            </h4>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {filteredSessions.length === 0 ? (
              <div className="p-12 text-center">
                <Calculator className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">No hay sesiones que coincidan con los filtros</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSessionSelect(session)}
                    className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors duration-200 ${
                      selectedSession?.id === session.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h5 className="font-medium text-slate-900">
                          Sesión #{session.id.slice(-8)}
                        </h5>
                        <p className="text-sm text-slate-600">
                          {session.user_name}
                        </p>
                      </div>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                        {session.status === 'open' ? 'Abierta' : 'Cerrada'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600">Apertura:</span>
                        <p className="font-bold text-slate-900">{formatCurrency(session.opening_amount)}</p>
                      </div>
                      <div>
                        <span className="text-slate-600">Ventas:</span>
                        <p className="font-bold text-green-600">{formatCurrency(session.total_sales_amount)}</p>
                      </div>
                      <div>
                        <span className="text-slate-600">Balance:</span>
                        <p className="font-bold text-purple-600">{formatCurrency(session.calculated_balance)}</p>
                      </div>
                      <div>
                        <span className="text-slate-600">Discrepancia:</span>
                        <p className={`font-bold ${getDiscrepancyColor(session.discrepancy_amount)}`}>
                          {formatCurrency(session.discrepancy_amount)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-2 text-xs text-slate-500">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date(session.opened_at).toLocaleDateString('es-ES')} - 
                          {new Date(session.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center">
                          <BarChart3 className="h-3 w-3 mr-1" />
                          {session.total_movements} movimientos
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detalles de Sesión */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-900 flex items-center">
                <Eye className="h-5 w-5 mr-2 text-green-600" />
                Detalles de Sesión
              </h4>
              {selectedSession && (
                <button
                  onClick={refreshSessionData}
                  disabled={refreshing}
                  className="text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors duration-200"
                  title="Actualizar datos de la sesión"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>
          
          {selectedSession ? (
            <div className="max-h-96 overflow-y-auto">
              {/* Resumen de la Sesión */}
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-sm text-slate-600">Estado:</span>
                    <p className="font-bold text-slate-900">
                      {selectedSession.status === 'open' ? 'Abierta' : 'Cerrada'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-600">Operador:</span>
                    <p className="font-bold text-slate-900">{selectedSession.user_name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-600">Apertura:</span>
                    <p className="font-bold text-blue-600">{formatCurrency(selectedSession.opening_amount)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-600">Ventas:</span>
                    <p className="font-bold text-green-600">
                      {formatCurrency(selectedSession.total_sales_amount)} ({selectedSession.total_sales_count})
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-600">Balance:</span>
                    <p className="font-bold text-purple-600">{formatCurrency(selectedSession.calculated_balance)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-600">Discrepancia:</span>
                    <p className={`font-bold ${getDiscrepancyColor(selectedSession.discrepancy_amount)}`}>
                      {formatCurrency(selectedSession.discrepancy_amount)}
                    </p>
                  </div>
                </div>
                
                {selectedSession.discrepancy_amount !== 0 && Math.abs(selectedSession.discrepancy_amount) > 100 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                      <span className="text-sm font-medium text-yellow-800">
                        Discrepancia Significativa Detectada
                      </span>
                    </div>
                    <p className="text-xs text-yellow-700 mt-1">
                      Se recomienda revisar los movimientos de esta sesión
                    </p>
                  </div>
                )}
              </div>

              {/* Movimientos */}
              <div className="p-6">
                <h5 className="font-medium text-slate-900 mb-4 flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  Movimientos ({sessionDetails.length})
                </h5>
                
                {detailsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : sessionDetails.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No hay movimientos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessionDetails.map((detail) => (
                      <div key={detail.id} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getMovementIcon(detail.type)}
                            <div>
                              <h6 className="font-medium text-slate-900">
                                {getMovementTypeLabel(detail.type)}
                                {detail.category && ` - ${detail.category}`}
                              </h6>
                              <p className="text-sm text-slate-600">{detail.description}</p>
                              <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                <span className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {new Date(detail.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="flex items-center">
                                  <User className="h-3 w-3 mr-1" />
                                  {detail.created_by_name || 'Sistema'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-lg ${
                              detail.type === 'expense' ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {detail.type === 'expense' ? '-' : '+'}{formatCurrency(detail.amount)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Detalles adicionales para ventas */}
                        {detail.sale_details && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs text-slate-600">
                              Venta: {detail.sale_details.items_count} productos • 
                              Cliente: {detail.sale_details.customer_name || 'Cliente genérico'}
                            </p>
                          </div>
                        )}
                        
                        {/* Detalles adicionales para abonos */}
                        {detail.installment_details && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs text-slate-600">
                              Abono: {detail.installment_details.customer_name} • 
                              Venta: #{detail.installment_details.sale_id?.slice(-8)}
                            </p>
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
              <Eye className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">Selecciona una sesión para ver los detalles</p>
            </div>
          )}
        </div>
      </div>

      {/* Resumen General */}
      {filteredSessions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4">Resumen General</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calculator className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-600">Total Sesiones</p>
                  <p className="text-xl font-bold text-blue-900">{filteredSessions.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-600">Total Ventas</p>
                  <p className="text-xl font-bold text-green-900">
                    {formatCurrency(filteredSessions.reduce((sum, s) => sum + s.total_sales_amount, 0))}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-purple-600">Total Movimientos</p>
                  <p className="text-xl font-bold text-purple-900">
                    {filteredSessions.reduce((sum, s) => sum + s.total_movements, 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-orange-600">Discrepancias</p>
                  <p className="text-xl font-bold text-orange-900">
                    {filteredSessions.filter(s => Math.abs(s.discrepancy_amount) > 100).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}