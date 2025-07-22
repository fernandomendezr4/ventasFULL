import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Eye, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Search,
  Filter,
  Printer,
  BarChart3,
  Package,
  CreditCard,
  Activity
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';

interface AuditReport {
  session_info: {
    cash_register_id: string;
    opened_at: string;
    closed_at: string | null;
    status: string;
    operator_name: string;
    opening_amount: number;
    closing_amount: number;
    calculated_balance: number;
    discrepancy_amount: number;
    session_duration_minutes: number;
    total_sales_count: number;
    total_sales_amount: number;
    total_installments_count: number;
    total_installments_amount: number;
    total_income: number;
    total_expenses: number;
  };
  sales_detail: any[];
  installments_detail: any[];
  movements_detail: any[];
  audit_trail: any[];
  generated_at: string;
}

interface CashRegisterSession {
  id: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  operator_name: string;
  opening_amount: number;
  closing_amount: number;
  calculated_balance: number;
  discrepancy_amount: number;
  session_duration_minutes: number;
  total_sales_count: number;
  total_sales_amount: number;
  total_installments_count: number;
  total_installments_amount: number;
  total_income: number;
  total_expenses: number;
}

export default function CashRegisterAudit() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [operatorFilter, setOperatorFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [operators, setOperators] = useState<any[]>([]);

  useEffect(() => {
    loadSessions();
    loadOperators();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      
      // Query cash registers with calculated data since the view doesn't exist
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          id,
          user_id,
          opening_amount,
          closing_amount,
          expected_closing_amount,
          actual_closing_amount,
          discrepancy_amount,
          status,
          opened_at,
          closed_at,
          session_notes,
          user:users(name, email)
        `)
        .order('opened_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match expected interface
      const transformedSessions = await Promise.all((data || []).map(async (register) => {
        let totalSalesCount = 0;
        let totalSalesAmount = 0;
        let totalInstallmentsCount = 0;
        let totalInstallmentsAmount = 0;
        let totalIncome = 0;
        let totalExpenses = 0;
        
        try {
          // Get movements for income and expenses
          const { data: movementsData, error: movementsError } = await supabase
            .from('cash_movements')
            .select('type, amount')
            .eq('cash_register_id', register.id);
          
          if (!movementsError && movementsData) {
            const movements = movementsData;
            totalSalesAmount = movements.filter(m => m.type === 'sale').reduce((sum, m) => sum + m.amount, 0);
            totalSalesCount = movements.filter(m => m.type === 'sale').length;
            totalIncome = movements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0);
            totalExpenses = movements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0);
          }
        } catch (error) {
          console.warn('Could not load movements data for register:', register.id);
        }
        
        // Calculate session duration
        const openedAt = new Date(register.opened_at);
        const closedAt = register.closed_at ? new Date(register.closed_at) : new Date();
        const sessionDurationMinutes = Math.round((closedAt.getTime() - openedAt.getTime()) / (1000 * 60));
        
        // Calculate balance
        const calculatedBalance = register.opening_amount + totalSalesAmount + totalIncome - totalExpenses;
        
        return {
          id: register.id,
          cash_register_id: register.id,
          opened_at: register.opened_at,
          closed_at: register.closed_at,
          status: register.status,
          operator_name: register.user?.name || 'Usuario desconocido',
          operator_email: register.user?.email || '',
          opening_amount: register.opening_amount,
          closing_amount: register.actual_closing_amount || register.closing_amount || 0,
          expected_closing_amount: register.expected_closing_amount || calculatedBalance,
          actual_closing_amount: register.actual_closing_amount || 0,
          discrepancy_amount: register.discrepancy_amount || 0,
          session_duration_minutes: sessionDurationMinutes,
          total_sales_count: totalSalesCount,
          total_sales_amount: totalSalesAmount,
          total_installments_count: 0,
          total_installments_amount: 0,
          total_income: totalIncome,
          total_expenses: totalExpenses,
          calculated_balance: calculatedBalance
        };
      }));
      
      setSessions(transformedSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadOperators = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setOperators(data || []);
    } catch (error) {
      console.error('Error loading operators:', error);
    }
  };

  const generateAuditReport = async (cashRegisterId: string) => {
    try {
      setLoadingReport(true);
      
      // Since the RPC function doesn't exist, build the report manually
      const { data: registerData, error: registerError } = await supabase
        .from('cash_registers')
        .select(`
          *,
          user:users!cash_registers_user_id_fkey(name, email)
        `)
        .eq('id', cashRegisterId)
        .single();
      
      if (registerError) throw registerError;
      
      // Get movements detail
      const { data: movementsDetail } = await supabase
        .from('cash_movements')
        .select(`
          *,
          created_by_user:users(name)
        `)
        .eq('cash_register_id', cashRegisterId)
        .order('created_at', { ascending: false });
      
      // Calculate totals
      const salesMovements = movementsDetail?.filter(m => m.type === 'sale') || [];
      const totalSalesAmount = salesMovements.reduce((sum, m) => sum + m.amount, 0);
      const totalIncome = movementsDetail?.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0) || 0;
      const totalExpenses = movementsDetail?.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0) || 0;
      
      const calculatedBalance = registerData.opening_amount + totalSalesAmount + totalIncome - totalExpenses;
      
      // Calculate session duration
      const openedAt = new Date(registerData.opened_at);
      const closedAt = registerData.closed_at ? new Date(registerData.closed_at) : new Date();
      const sessionDurationMinutes = Math.round((closedAt.getTime() - openedAt.getTime()) / (1000 * 60));
      
      const auditData = {
        session_info: {
          cash_register_id: registerData.id,
          opened_at: registerData.opened_at,
          closed_at: registerData.closed_at,
          status: registerData.status,
          operator_name: registerData.user?.name || 'Usuario desconocido',
          opening_amount: registerData.opening_amount,
          closing_amount: registerData.actual_closing_amount || 0,
          calculated_balance: calculatedBalance,
          discrepancy_amount: registerData.discrepancy_amount || 0,
          session_duration_minutes: sessionDurationMinutes,
          total_sales_count: salesMovements.length,
          total_sales_amount: totalSalesAmount,
          total_installments_count: 0,
          total_installments_amount: 0,
          total_income: totalIncome,
          total_expenses: totalExpenses
        },
        sales_detail: salesMovements.map(movement => ({
          sale_number: movement.reference_id?.slice(-8) || 'N/A',
          customer_name: 'Cliente',
          payment_type: 'cash',
          items_count: 1,
          total_amount: movement.amount,
          created_at: movement.created_at
        })),
        installments_detail: [],
        movements_detail: movementsDetail?.map(movement => ({
          type: movement.type,
          category: movement.category,
          description: movement.description,
          amount: movement.amount,
          created_by_name: 'Usuario',
          created_at: movement.created_at
        })).filter(m => m.type !== 'sale') || [],
        audit_trail: [],
        generated_at: new Date().toISOString()
      };

      setAuditReport(auditData);
      setSelectedSession(cashRegisterId);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error generating audit report:', error);
      alert('Error al generar reporte de auditoría: ' + (error as Error).message);
    } finally {
      setLoadingReport(false);
    }
  };

  const exportAuditReport = (session: CashRegisterSession) => {
    const reportData = {
      session_info: session,
      exported_at: new Date().toISOString(),
      exported_by: user?.name
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_caja_${session.id?.slice(-8) || 'unknown'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printAuditReport = () => {
    if (!auditReport) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const { session_info } = auditReport;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte de Auditoría - Caja ${session_info.cash_register_id?.slice(-8) || 'N/A'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 20px; }
            .section h3 { border-bottom: 2px solid #333; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
            .discrepancy { color: red; font-weight: bold; }
            .positive { color: green; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>REPORTE DE AUDITORÍA - CAJA REGISTRADORA</h1>
            <p>Caja ID: ${session_info.cash_register_id?.slice(-8) || 'N/A'}</p>
            <p>Operador: ${session_info.operator_name}</p>
            <p>Fecha: ${new Date(session_info.opened_at).toLocaleDateString('es-ES')}</p>
          </div>

          <div class="section">
            <h3>Resumen de Sesión</h3>
            <div class="summary">
              <table>
                <tr><td><strong>Apertura:</strong></td><td>${new Date(session_info.opened_at).toLocaleString('es-ES')}</td></tr>
                <tr><td><strong>Cierre:</strong></td><td>${session_info.closed_at ? new Date(session_info.closed_at).toLocaleString('es-ES') : 'Aún abierta'}</td></tr>
                <tr><td><strong>Duración:</strong></td><td>${Math.round(session_info.session_duration_minutes)} minutos</td></tr>
                <tr><td><strong>Monto Apertura:</strong></td><td>${formatCurrency(session_info.opening_amount)}</td></tr>
                <tr><td><strong>Monto Cierre:</strong></td><td>${formatCurrency(session_info.closing_amount)}</td></tr>
                <tr><td><strong>Balance Calculado:</strong></td><td>${formatCurrency(session_info.calculated_balance)}</td></tr>
                <tr><td><strong>Discrepancia:</strong></td><td class="${session_info.discrepancy_amount !== 0 ? 'discrepancy' : 'positive'}">${formatCurrency(session_info.discrepancy_amount)}</td></tr>
              </table>
            </div>
          </div>

          <div class="section">
            <h3>Resumen de Transacciones</h3>
            <table>
              <tr><th>Tipo</th><th>Cantidad</th><th>Monto Total</th></tr>
              <tr><td>Ventas en Efectivo</td><td>${session_info.total_sales_count}</td><td>${formatCurrency(session_info.total_sales_amount)}</td></tr>
              <tr><td>Abonos Recibidos</td><td>${session_info.total_installments_count}</td><td>${formatCurrency(session_info.total_installments_amount)}</td></tr>
              <tr><td>Ingresos Adicionales</td><td>-</td><td>${formatCurrency(session_info.total_income)}</td></tr>
              <tr><td>Gastos</td><td>-</td><td>${formatCurrency(session_info.total_expenses)}</td></tr>
            </table>
          </div>

          <div class="no-print" style="text-align: center; margin-top: 30px;">
            <button onclick="window.print()">Imprimir</button>
            <button onclick="window.close()">Cerrar</button>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
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
    
    // Filter by operator
    if (operatorFilter !== 'all' && !session.operator_name?.toLowerCase().includes(operatorFilter.toLowerCase())) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const sessionId = String(session.id || '').slice(-8);
      const operatorName = session.operator_name?.toLowerCase() || '';
      
      return sessionId.includes(searchTerm) || operatorName.includes(searchLower);
    }
    
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getDiscrepancyColor = (amount: number) => {
    if (amount === 0) return 'text-green-600';
    if (Math.abs(amount) < 1000) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Auditoría de Cajas</h2>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
          >
            <Activity className="h-4 w-4 mr-2" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ID de caja u operador..."
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
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los operadores</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.name}>
                  {operator.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(searchTerm || dateFilter || statusFilter !== 'all' || operatorFilter !== 'all') && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredSessions.length} de {sessions.length} sesiones
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-full">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Sesiones</p>
              <p className="text-2xl font-bold text-slate-900">{filteredSessions.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Recaudado</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(filteredSessions.reduce((sum, s) => sum + s.total_sales_amount + s.total_installments_amount, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Con Discrepancias</p>
              <p className="text-2xl font-bold text-slate-900">
                {filteredSessions.filter(s => s.discrepancy_amount !== 0).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-full">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Promedio Duración</p>
              <p className="text-2xl font-bold text-slate-900">
                {Math.round(filteredSessions.reduce((sum, s) => sum + s.session_duration_minutes, 0) / filteredSessions.length || 0)}m
              </p>
            </div>
          </div>
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
            <p className="text-slate-500">
              {sessions.length === 0 
                ? 'No hay sesiones de caja registradas' 
                : 'No se encontraron sesiones que coincidan con los filtros aplicados'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredSessions.filter(session => session && session.id).map((session) => (
              <div key={session.id} className="p-6 hover:bg-slate-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          Caja #{session.id?.slice(-8) || 'N/A'}
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                            {session.status === 'open' ? (
                              <>
                                <Activity className="h-3 w-3 mr-1" />
                                Abierta
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Cerrada
                              </>
                            )}
                          </span>
                        </h3>
                        <p className="text-sm text-slate-600">
                          {new Date(session.opened_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                          <span className="flex items-center">
                            <Users className="h-4 w-4 mr-1 text-blue-600" />
                            {session.operator_name}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1 text-purple-600" />
                            {Math.round(session.session_duration_minutes)} min
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-slate-600">Ventas</p>
                          <p className="font-bold text-slate-900">{session.total_sales_count}</p>
                          <p className="text-xs text-green-600">{formatCurrency(session.total_sales_amount)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-slate-600">Abonos</p>
                          <p className="font-bold text-slate-900">{session.total_installments_count}</p>
                          <p className="text-xs text-blue-600">{formatCurrency(session.total_installments_amount)}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">
                          {formatCurrency(session.calculated_balance)}
                        </p>
                        <p className="text-sm text-slate-600">Balance Final</p>
                        {session.discrepancy_amount !== 0 && (
                          <p className={`text-sm font-medium ${getDiscrepancyColor(session.discrepancy_amount)}`}>
                            Discrepancia: {formatCurrency(session.discrepancy_amount)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => generateAuditReport(session.id)}
                      disabled={loadingReport}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
                      title="Ver reporte detallado"
                    >
                      {loadingReport ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => exportAuditReport(session)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                      title="Exportar datos"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detailed Audit Report Modal */}
      {showDetailModal && auditReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Reporte de Auditoría - Caja #{auditReport.session_info.cash_register_id?.slice(-8) || 'N/A'}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Operador: {auditReport.session_info.operator_name} • 
                    {new Date(auditReport.session_info.opened_at).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={printAuditReport}
                    className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                    title="Imprimir reporte"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              {/* Session Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3">Información de Sesión</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Apertura:</span>
                      <span>{formatCurrency(auditReport.session_info.opening_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cierre:</span>
                      <span>{formatCurrency(auditReport.session_info.closing_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duración:</span>
                      <span>{Math.round(auditReport.session_info.session_duration_minutes)} min</span>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-3">Ingresos</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Ventas ({auditReport.session_info.total_sales_count}):</span>
                      <span>{formatCurrency(auditReport.session_info.total_sales_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Abonos ({auditReport.session_info.total_installments_count}):</span>
                      <span>{formatCurrency(auditReport.session_info.total_installments_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Otros ingresos:</span>
                      <span>{formatCurrency(auditReport.session_info.total_income)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <h4 className="font-medium text-red-900 mb-3">Balance Final</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Calculado:</span>
                      <span>{formatCurrency(auditReport.session_info.calculated_balance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gastos:</span>
                      <span>{formatCurrency(auditReport.session_info.total_expenses)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Discrepancia:</span>
                      <span className={getDiscrepancyColor(auditReport.session_info.discrepancy_amount)}>
                        {formatCurrency(auditReport.session_info.discrepancy_amount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Tables */}
              <div className="space-y-6">
                {/* Sales Detail */}
                {auditReport.sales_detail && auditReport.sales_detail.length > 0 && (
                  <div>
                    <h4 className="font-medium text-slate-900 mb-3 flex items-center">
                      <Package className="h-5 w-5 mr-2 text-green-600" />
                      Detalle de Ventas ({auditReport.sales_detail.length})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left p-3 border">Venta</th>
                            <th className="text-left p-3 border">Cliente</th>
                            <th className="text-left p-3 border">Tipo</th>
                            <th className="text-left p-3 border">Productos</th>
                            <th className="text-right p-3 border">Monto</th>
                            <th className="text-left p-3 border">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditReport.sales_detail.map((sale, index) => (
                            <tr key={index} className="hover:bg-slate-50">
                              <td className="p-3 border">#{sale.sale_number}</td>
                              <td className="p-3 border">{sale.customer_name || 'Sin cliente'}</td>
                              <td className="p-3 border">{sale.payment_type === 'cash' ? 'Efectivo' : 'Abonos'}</td>
                              <td className="p-3 border">{sale.items_count}</td>
                              <td className="p-3 border text-right">{formatCurrency(sale.total_amount)}</td>
                              <td className="p-3 border">{new Date(sale.created_at).toLocaleTimeString('es-ES')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Installments Detail */}
                {auditReport.installments_detail && auditReport.installments_detail.length > 0 && (
                  <div>
                    <h4 className="font-medium text-slate-900 mb-3 flex items-center">
                      <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                      Detalle de Abonos ({auditReport.installments_detail.length})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left p-3 border">Venta</th>
                            <th className="text-left p-3 border">Cliente</th>
                            <th className="text-left p-3 border">Método</th>
                            <th className="text-right p-3 border">Monto</th>
                            <th className="text-left p-3 border">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditReport.installments_detail.map((installment, index) => (
                            <tr key={index} className="hover:bg-slate-50">
                              <td className="p-3 border">#{installment.sale_number}</td>
                              <td className="p-3 border">{installment.customer_name || 'Sin cliente'}</td>
                              <td className="p-3 border">{installment.payment_method}</td>
                              <td className="p-3 border text-right">{formatCurrency(installment.amount_paid)}</td>
                              <td className="p-3 border">{new Date(installment.payment_date).toLocaleTimeString('es-ES')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Movements Detail */}
                {auditReport.movements_detail && auditReport.movements_detail.length > 0 && (
                  <div>
                    <h4 className="font-medium text-slate-900 mb-3 flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2 text-purple-600" />
                      Otros Movimientos ({auditReport.movements_detail.length})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left p-3 border">Tipo</th>
                            <th className="text-left p-3 border">Categoría</th>
                            <th className="text-left p-3 border">Descripción</th>
                            <th className="text-right p-3 border">Monto</th>
                            <th className="text-left p-3 border">Usuario</th>
                            <th className="text-left p-3 border">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditReport.movements_detail.map((movement, index) => (
                            <tr key={index} className="hover:bg-slate-50">
                              <td className="p-3 border">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  movement.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {movement.type === 'income' ? 'Ingreso' : 'Gasto'}
                                </span>
                              </td>
                              <td className="p-3 border">{movement.category}</td>
                              <td className="p-3 border">{movement.description}</td>
                              <td className="p-3 border text-right">{formatCurrency(movement.amount)}</td>
                              <td className="p-3 border">{movement.created_by_name || 'Sistema'}</td>
                              <td className="p-3 border">{new Date(movement.created_at).toLocaleTimeString('es-ES')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex-shrink-0">
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cerrar Reporte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}