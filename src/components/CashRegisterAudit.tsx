import React, { useState, useEffect } from 'react';
import { FileText, Calendar, User, DollarSign, TrendingUp, TrendingDown, Eye, Download, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';

interface CashRegisterSession {
  id: string;
  user_id: string;
  opening_amount: number;
  closing_amount: number;
  expected_closing_amount: number;
  actual_closing_amount: number;
  discrepancy_amount: number;
  status: string;
  opened_at: string;
  closed_at: string | null;
  operator_name: string;
  total_sales_count: number;
  total_sales_amount: number;
  total_income: number;
  total_expenses: number;
  session_duration_hours: number;
}

export default function CashRegisterAudit() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<CashRegisterSession | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cash_register_history_summary')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = sessions.filter(session => {
    const matchesDate = !dateFilter || session.opened_at.startsWith(dateFilter);
    const matchesUser = !userFilter || session.operator_name?.toLowerCase().includes(userFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    
    return matchesDate && matchesUser && matchesStatus;
  });

  const exportToCSV = () => {
    const headers = [
      'Fecha Apertura',
      'Fecha Cierre',
      'Operador',
      'Monto Apertura',
      'Monto Cierre',
      'Ventas',
      'Ingresos',
      'Gastos',
      'Discrepancia',
      'Estado'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredSessions.map(session => [
        new Date(session.opened_at).toLocaleDateString('es-ES'),
        session.closed_at ? new Date(session.closed_at).toLocaleDateString('es-ES') : 'Abierta',
        session.operator_name || 'N/A',
        session.opening_amount,
        session.actual_closing_amount || 0,
        session.total_sales_amount || 0,
        session.total_income || 0,
        session.total_expenses || 0,
        session.discrepancy_amount || 0,
        session.status === 'open' ? 'Abierta' : 'Cerrada'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_cajas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1 relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por operador..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <button
            onClick={exportToCSV}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </button>
        </div>
      </div>

      {/* Sessions List */}
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
        ) : filteredSessions.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">No hay sesiones de caja registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Sesión</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Operador</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Apertura</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Cierre</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Ventas</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Discrepancia</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Estado</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50 transition-colors duration-200">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-900">
                          {new Date(session.opened_at).toLocaleDateString('es-ES')}
                        </p>
                        <p className="text-sm text-slate-600">
                          {new Date(session.opened_at).toLocaleTimeString('es-ES', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                          {session.closed_at && (
                            <> - {new Date(session.closed_at).toLocaleTimeString('es-ES', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}</>
                          )}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-blue-600 mr-2" />
                        <span className="text-sm text-slate-900">{session.operator_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">
                        {formatCurrency(session.opening_amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">
                        {session.actual_closing_amount ? formatCurrency(session.actual_closing_amount) : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {formatCurrency(session.total_sales_amount || 0)}
                        </p>
                        <p className="text-xs text-slate-600">
                          {session.total_sales_count || 0} ventas
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        Math.abs(session.discrepancy_amount || 0) > 1000
                          ? 'text-red-600'
                          : Math.abs(session.discrepancy_amount || 0) > 100
                            ? 'text-yellow-600'
                            : 'text-green-600'
                      }`}>
                        {session.discrepancy_amount ? formatCurrency(session.discrepancy_amount) : formatCurrency(0)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        session.status === 'open' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {session.status === 'open' ? 'Abierta' : 'Cerrada'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedSession(session)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">
                Detalle de Sesión - {new Date(selectedSession.opened_at).toLocaleDateString('es-ES')}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Operador: {selectedSession.operator_name}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-sm text-blue-600">Apertura</p>
                      <p className="text-xl font-bold text-blue-900">
                        {formatCurrency(selectedSession.opening_amount)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600">Ventas</p>
                      <p className="text-xl font-bold text-green-900">
                        {formatCurrency(selectedSession.total_sales_amount || 0)}
                      </p>
                      <p className="text-xs text-green-700">
                        {selectedSession.total_sales_count || 0} transacciones
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-sm text-purple-600">Cierre</p>
                      <p className="text-xl font-bold text-purple-900">
                        {selectedSession.actual_closing_amount ? formatCurrency(selectedSession.actual_closing_amount) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-lg border ${
                  Math.abs(selectedSession.discrepancy_amount || 0) > 1000
                    ? 'bg-red-50 border-red-200'
                    : Math.abs(selectedSession.discrepancy_amount || 0) > 100
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <TrendingDown className={`h-8 w-8 ${
                      Math.abs(selectedSession.discrepancy_amount || 0) > 1000
                        ? 'text-red-600'
                        : Math.abs(selectedSession.discrepancy_amount || 0) > 100
                          ? 'text-yellow-600'
                          : 'text-green-600'
                    }`} />
                    <div>
                      <p className={`text-sm ${
                        Math.abs(selectedSession.discrepancy_amount || 0) > 1000
                          ? 'text-red-600'
                          : Math.abs(selectedSession.discrepancy_amount || 0) > 100
                            ? 'text-yellow-600'
                            : 'text-green-600'
                      }`}>
                        Discrepancia
                      </p>
                      <p className={`text-xl font-bold ${
                        Math.abs(selectedSession.discrepancy_amount || 0) > 1000
                          ? 'text-red-900'
                          : Math.abs(selectedSession.discrepancy_amount || 0) > 100
                            ? 'text-yellow-900'
                            : 'text-green-900'
                      }`}>
                        {formatCurrency(selectedSession.discrepancy_amount || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Details */}
              <div className="bg-slate-50 p-6 rounded-lg">
                <h4 className="font-medium text-slate-900 mb-4">Detalles de la Sesión</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Duración:</span>
                    <p className="font-medium text-slate-900">
                      {selectedSession.session_duration_hours ? 
                        `${selectedSession.session_duration_hours.toFixed(1)} horas` : 
                        'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-600">Total de Ingresos:</span>
                    <p className="font-medium text-green-600">
                      {formatCurrency(selectedSession.total_income || 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-600">Total de Gastos:</span>
                    <p className="font-medium text-red-600">
                      {formatCurrency(selectedSession.total_expenses || 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-600">Balance Calculado:</span>
                    <p className="font-medium text-slate-900">
                      {formatCurrency(
                        selectedSession.opening_amount + 
                        (selectedSession.total_sales_amount || 0) + 
                        (selectedSession.total_income || 0) - 
                        (selectedSession.total_expenses || 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setSelectedSession(null)}
                className="w-full bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}