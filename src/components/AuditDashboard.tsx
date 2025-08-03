import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, FileText, Activity, Users, Database, Calendar, Search, Filter, Download, Eye, Bell, Settings, TrendingUp, BarChart3, CheckCircle, Clock } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';

interface AuditLog {
  id: string;
  cash_register_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  amount: number;
  previous_balance: number | null;
  new_balance: number | null;
  description: string;
  metadata: any;
  performed_by: string | null;
  performed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  performed_by_name?: string;
  register_opened_at?: string;
  register_status?: string;
}

interface AuditStatistics {
  total_events: number;
  events_by_type: Record<string, number>;
  events_by_table: Record<string, number>;
  events_by_severity: Record<string, number>;
  unique_users: number;
  unique_tables: number;
  today_events: number;
  critical_events: number;
}

interface SuspiciousPattern {
  pattern_type: string;
  description: string;
  severity: string;
  affected_table: string;
  user_involved: string;
  event_count: number;
  first_occurrence: string;
  last_occurrence: string;
  recommendation: string;
}

export default function AuditDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [suspiciousPatterns, setSuspiciousPatterns] = useState<SuspiciousPattern[]>([]);
  
  // Filtros
  const [dateFilter, setDateFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados de modales
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadAuditData();
  }, []);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Datos demo para auditoría
        const demoLogs: AuditLog[] = [
          {
            id: 'demo-audit-1',
            cash_register_id: 'demo-register-1',
            action_type: 'open',
            entity_type: 'cash_register',
            entity_id: 'demo-register-1',
            amount: 100000,
            previous_balance: 0,
            new_balance: 100000,
            description: 'Apertura de caja registradora',
            metadata: { opening_amount: 100000 },
            performed_by: user?.id || 'demo-user',
            performed_at: new Date().toISOString(),
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Demo Browser)',
            performed_by_name: user?.name || 'Usuario Demo',
            register_opened_at: new Date().toISOString(),
            register_status: 'open'
          },
          {
            id: 'demo-audit-2',
            cash_register_id: 'demo-register-1',
            action_type: 'sale',
            entity_type: 'sale',
            entity_id: 'demo-sale-1',
            amount: 150000,
            previous_balance: 100000,
            new_balance: 250000,
            description: 'Venta registrada - iPhone 15 Pro',
            metadata: { 
              sale_id: 'demo-sale-1',
              customer_name: 'Juan Pérez',
              products: [{ name: 'iPhone 15 Pro', quantity: 1, price: 150000 }]
            },
            performed_by: user?.id || 'demo-user',
            performed_at: new Date(Date.now() - 3600000).toISOString(),
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Demo Browser)',
            performed_by_name: user?.name || 'Usuario Demo',
            register_opened_at: new Date().toISOString(),
            register_status: 'open'
          },
          {
            id: 'demo-audit-3',
            cash_register_id: 'demo-register-1',
            action_type: 'expense',
            entity_type: 'movement',
            entity_id: 'demo-movement-1',
            amount: 25000,
            previous_balance: 250000,
            new_balance: 225000,
            description: 'Gasto registrado - Compra de suministros',
            metadata: { 
              movement_type: 'expense',
              category: 'suministros',
              description: 'Compra de suministros de oficina'
            },
            performed_by: user?.id || 'demo-user',
            performed_at: new Date(Date.now() - 7200000).toISOString(),
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Demo Browser)',
            performed_by_name: user?.name || 'Usuario Demo',
            register_opened_at: new Date().toISOString(),
            register_status: 'open'
          }
        ];

        const demoStats: AuditStatistics = {
          total_events: 3,
          events_by_type: {
            'open': 1,
            'sale': 1,
            'expense': 1
          },
          events_by_table: {
            'cash_register': 1,
            'sale': 1,
            'movement': 1
          },
          events_by_severity: {
            'normal': 3,
            'high': 0,
            'critical': 0
          },
          unique_users: 1,
          unique_tables: 3,
          today_events: 3,
          critical_events: 0
        };

        setAuditLogs(demoLogs);
        setStatistics(demoStats);
        setSuspiciousPatterns([]);
        setLoading(false);
        return;
      }

      // Cargar logs de auditoría desde la vista optimizada
      const { data: logs, error: logsError } = await supabase
        .from('cash_register_audit_view')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(100);

      if (logsError) {
        console.error('Error loading audit logs:', logsError);
        // Fallback: cargar desde tabla básica
        const { data: basicLogs, error: basicError } = await supabase
          .from('cash_register_audit_logs')
          .select(`
            *,
            performed_by_user:users(name)
          `)
          .order('performed_at', { ascending: false })
          .limit(100);

        if (basicError) throw basicError;
        
        const formattedLogs = (basicLogs || []).map(log => ({
          ...log,
          performed_by_name: log.performed_by_user?.name || 'Sistema'
        }));
        
        setAuditLogs(formattedLogs);
      } else {
        setAuditLogs(logs || []);
      }

      // Calcular estadísticas básicas
      const totalEvents = logs?.length || 0;
      const todayStart = new Date().toISOString().split('T')[0];
      const todayEvents = logs?.filter(log => log.performed_at.startsWith(todayStart)).length || 0;
      
      const eventsByType: Record<string, number> = {};
      const eventsByTable: Record<string, number> = {};
      const uniqueUsers = new Set<string>();
      const uniqueTables = new Set<string>();

      logs?.forEach(log => {
        eventsByType[log.action_type] = (eventsByType[log.action_type] || 0) + 1;
        eventsByTable[log.entity_type] = (eventsByTable[log.entity_type] || 0) + 1;
        if (log.performed_by) uniqueUsers.add(log.performed_by);
        uniqueTables.add(log.entity_type);
      });

      const calculatedStats: AuditStatistics = {
        total_events: totalEvents,
        events_by_type: eventsByType,
        events_by_table: eventsByTable,
        events_by_severity: {
          'normal': totalEvents,
          'high': 0,
          'critical': 0
        },
        unique_users: uniqueUsers.size,
        unique_tables: uniqueTables.size,
        today_events: todayEvents,
        critical_events: 0
      };

      setStatistics(calculatedStats);

      // Detectar patrones sospechosos básicos
      const patterns = detectBasicSuspiciousPatterns(logs || []);
      setSuspiciousPatterns(patterns);

    } catch (error) {
      console.error('Error loading audit data:', error);
      setAuditLogs([]);
      setStatistics(null);
      setSuspiciousPatterns([]);
    } finally {
      setLoading(false);
    }
  };

  const detectBasicSuspiciousPatterns = (logs: AuditLog[]): SuspiciousPattern[] => {
    const patterns: SuspiciousPattern[] = [];
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Detectar múltiples eliminaciones en poco tiempo
    const recentDeletes = logs.filter(log => 
      log.action_type === 'delete' && 
      new Date(log.performed_at).getTime() > oneHourAgo
    );

    if (recentDeletes.length > 5) {
      patterns.push({
        pattern_type: 'bulk_deletion',
        description: `${recentDeletes.length} eliminaciones en la última hora`,
        severity: 'high',
        affected_table: 'multiple',
        user_involved: recentDeletes[0]?.performed_by_name || 'Desconocido',
        event_count: recentDeletes.length,
        first_occurrence: recentDeletes[recentDeletes.length - 1]?.performed_at || '',
        last_occurrence: recentDeletes[0]?.performed_at || '',
        recommendation: 'Verificar si estas eliminaciones son autorizadas y documentar la razón'
      });
    }

    // Detectar actividad fuera de horario laboral
    const afterHoursLogs = logs.filter(log => {
      const hour = new Date(log.performed_at).getHours();
      return hour < 8 || hour > 18; // Fuera de 8 AM - 6 PM
    });

    if (afterHoursLogs.length > 0) {
      patterns.push({
        pattern_type: 'after_hours_activity',
        description: `${afterHoursLogs.length} actividades fuera del horario laboral`,
        severity: 'medium',
        affected_table: 'multiple',
        user_involved: afterHoursLogs[0]?.performed_by_name || 'Desconocido',
        event_count: afterHoursLogs.length,
        first_occurrence: afterHoursLogs[afterHoursLogs.length - 1]?.performed_at || '',
        last_occurrence: afterHoursLogs[0]?.performed_at || '',
        recommendation: 'Revisar si el acceso fuera de horario está autorizado'
      });
    }

    return patterns;
  };

  const generateReport = async (reportType: string, dateFrom: string, dateTo: string) => {
    try {
      if (isDemoMode) {
        const reportData = {
          report_type: reportType,
          date_from: dateFrom,
          date_to: dateTo,
          total_events: auditLogs.length,
          events_by_type: statistics?.events_by_type || {},
          generated_at: new Date().toISOString(),
          generated_by: user?.name || 'Usuario Demo'
        };

        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_report_${reportType}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        alert('Reporte generado y descargado exitosamente (modo demo)');
        return;
      }

      // Intentar usar función RPC si existe
      // Since generate_audit_report function doesn't exist, use manual generation
      console.log('generate_audit_report function not found, using manual generation');
      await generateManualReport(reportType, dateFrom, dateTo);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar reporte: ' + (error as Error).message);
    }
  };

  const generateManualReport = async (reportType: string, dateFrom: string, dateTo: string) => {
    try {
      // Filtrar logs por fecha
      const filteredLogs = auditLogs.filter(log => {
        const logDate = log.performed_at.split('T')[0];
        return logDate >= dateFrom && logDate <= dateTo;
      });

      const reportData = {
        report_type: reportType,
        date_from: dateFrom,
        date_to: dateTo,
        total_events: filteredLogs.length,
        events_by_type: filteredLogs.reduce((acc, log) => {
          acc[log.action_type] = (acc[log.action_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        events_by_entity: filteredLogs.reduce((acc, log) => {
          acc[log.entity_type] = (acc[log.entity_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        suspicious_patterns: suspiciousPatterns,
        logs: filteredLogs,
        generated_at: new Date().toISOString(),
        generated_by: user?.name || 'Sistema'
      };

      // Descargar como JSON
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_report_${reportType}_${dateFrom}_${dateTo}.json`;
      a.click();
      URL.revokeObjectURL(url);

      alert('Reporte generado y descargado exitosamente');
    } catch (error) {
      console.error('Error generating manual report:', error);
      alert('Error al generar reporte manual: ' + (error as Error).message);
    }
  };

  const getActionTypeIcon = (actionType: string) => {
    switch (actionType) {
      case 'open':
        return <Activity className="h-4 w-4 text-green-600" />;
      case 'close':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'sale':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'installment':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'income':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'expense':
        return <TrendingUp className="h-4 w-4 text-red-600" />;
      case 'edit':
        return <Settings className="h-4 w-4 text-yellow-600" />;
      case 'delete':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Database className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionTypeLabel = (actionType: string) => {
    switch (actionType) {
      case 'open':
        return 'Apertura';
      case 'close':
        return 'Cierre';
      case 'sale':
        return 'Venta';
      case 'installment':
        return 'Abono';
      case 'income':
        return 'Ingreso';
      case 'expense':
        return 'Gasto';
      case 'edit':
        return 'Edición';
      case 'delete':
        return 'Eliminación';
      default:
        return actionType;
    }
  };

  const getEntityTypeLabel = (entityType: string) => {
    switch (entityType) {
      case 'cash_register':
        return 'Caja Registradora';
      case 'sale':
        return 'Venta';
      case 'installment':
        return 'Abono';
      case 'movement':
        return 'Movimiento';
      case 'product':
        return 'Producto';
      case 'customer':
        return 'Cliente';
      default:
        return entityType;
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesDate = !dateFilter || log.performed_at.startsWith(dateFilter);
    const matchesTable = !tableFilter || log.entity_type === tableFilter;
    const matchesAction = !actionFilter || log.action_type === actionFilter;
    const matchesUser = !userFilter || log.performed_by_name?.toLowerCase().includes(userFilter.toLowerCase());
    const matchesSearch = !searchTerm || 
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.performed_by_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesDate && matchesTable && matchesAction && matchesUser && matchesSearch;
  });

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: BarChart3 },
    { id: 'logs', label: 'Logs de Auditoría', icon: FileText },
    { id: 'patterns', label: 'Patrones Sospechosos', icon: AlertTriangle },
    { id: 'reports', label: 'Reportes', icon: Download }
  ];

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center">
            <Shield className="h-8 w-8 mr-3 text-blue-600" />
            Sistema de Auditoría
          </h2>
          <p className="text-slate-600 mt-1">
            Monitoreo completo y análisis de actividad del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generateReport('daily', 
              new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              new Date().toISOString().split('T')[0]
            )}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Reporte Diario
          </button>
          <button
            onClick={loadAuditData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
          >
            <Activity className="h-4 w-4 mr-2" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-6 py-4 text-sm font-medium transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                  {tab.id === 'patterns' && suspiciousPatterns.length > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                      {suspiciousPatterns.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Estadísticas Principales */}
              {statistics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">Total de Eventos</p>
                        <p className="text-2xl font-bold text-blue-900">{statistics.total_events}</p>
                      </div>
                      <Activity className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-600">Eventos Hoy</p>
                        <p className="text-2xl font-bold text-green-900">{statistics.today_events}</p>
                      </div>
                      <Calendar className="h-8 w-8 text-green-600" />
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-600">Usuarios Activos</p>
                        <p className="text-2xl font-bold text-purple-900">{statistics.unique_users}</p>
                      </div>
                      <Users className="h-8 w-8 text-purple-600" />
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-600">Eventos Críticos</p>
                        <p className="text-2xl font-bold text-red-900">{statistics.critical_events}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                  </div>
                </div>
              )}

              {/* Gráfico de Actividad por Tipo */}
              {statistics && (
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Actividad por Tipo de Evento</h3>
                  <div className="space-y-3">
                    {Object.entries(statistics.events_by_type).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center">
                          {getActionTypeIcon(type)}
                          <span className="ml-2 font-medium text-slate-900">{getActionTypeLabel(type)}</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-32 bg-slate-200 rounded-full h-2 mr-3">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(count / statistics.total_events) * 100}%` }}
                            ></div>
                          </div>
                          <span className="font-bold text-slate-900">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actividad Reciente */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Actividad Reciente</h3>
                <div className="space-y-3">
                  {auditLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center">
                        {getActionTypeIcon(log.action_type)}
                        <div className="ml-3">
                          <p className="font-medium text-slate-900">
                            {getActionTypeLabel(log.action_type)} - {getEntityTypeLabel(log.entity_type)}
                          </p>
                          <p className="text-sm text-slate-600">{log.description}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(log.performed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="flex items-center">
                              <Users className="h-3 w-3 mr-1" />
                              {log.performed_by_name || 'Sistema'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {log.amount > 0 && (
                        <div className="text-right">
                          <p className="font-bold text-slate-900">
                            {formatCurrency(log.amount)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-6">
              {/* Filtros */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <select
                    value={tableFilter}
                    onChange={(e) => setTableFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todas las entidades</option>
                    <option value="cash_register">Caja Registradora</option>
                    <option value="sale">Ventas</option>
                    <option value="movement">Movimientos</option>
                    <option value="installment">Abonos</option>
                    <option value="product">Productos</option>
                    <option value="customer">Clientes</option>
                  </select>
                  
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todas las acciones</option>
                    <option value="open">Apertura</option>
                    <option value="close">Cierre</option>
                    <option value="sale">Venta</option>
                    <option value="installment">Abono</option>
                    <option value="income">Ingreso</option>
                    <option value="expense">Gasto</option>
                    <option value="edit">Edición</option>
                    <option value="delete">Eliminación</option>
                  </select>
                  
                  <input
                    type="text"
                    placeholder="Usuario..."
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setDateFilter('');
                      setTableFilter('');
                      setActionFilter('');
                      setUserFilter('');
                    }}
                    className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                  >
                    Limpiar
                  </button>
                </div>
                {(searchTerm || dateFilter || tableFilter || actionFilter || userFilter) && (
                  <div className="mt-3 text-sm text-slate-600">
                    Mostrando {filteredLogs.length} de {auditLogs.length} eventos
                  </div>
                )}
              </div>

              {/* Lista de Logs */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                {filteredLogs.length === 0 ? (
                  <div className="p-12 text-center">
                    <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">
                      {auditLogs.length === 0 
                        ? 'No hay eventos de auditoría registrados'
                        : 'No se encontraron eventos que coincidan con los filtros'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Evento</th>
                          <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Entidad</th>
                          <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Usuario</th>
                          <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Monto</th>
                          <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Fecha</th>
                          <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors duration-200">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                {getActionTypeIcon(log.action_type)}
                                <div className="ml-3">
                                  <p className="font-medium text-slate-900">{getActionTypeLabel(log.action_type)}</p>
                                  <p className="text-sm text-slate-600">{log.description}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-medium text-slate-900">{getEntityTypeLabel(log.entity_type)}</span>
                              {log.entity_id && (
                                <p className="text-sm text-slate-600">ID: {log.entity_id.slice(-8)}</p>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="font-medium text-slate-900">{log.performed_by_name || 'Sistema'}</p>
                                {log.ip_address && (
                                  <p className="text-sm text-slate-600">IP: {log.ip_address}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {log.amount > 0 ? (
                                <span className="font-medium text-slate-900">
                                  {formatCurrency(log.amount)}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm text-slate-900">
                                  {new Date(log.performed_at).toLocaleDateString('es-ES')}
                                </p>
                                <p className="text-xs text-slate-600">
                                  {new Date(log.performed_at).toLocaleTimeString('es-ES')}
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => setSelectedLog(log)}
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
            </div>
          )}

          {activeTab === 'patterns' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">Patrones Sospechosos Detectados</h3>
              
              {suspiciousPatterns.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <p className="text-green-600 font-medium">No se detectaron patrones sospechosos</p>
                  <p className="text-sm text-slate-600 mt-1">El sistema está funcionando normalmente</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {suspiciousPatterns.map((pattern, index) => (
                    <div key={index} className={`border rounded-lg p-6 ${
                      pattern.severity === 'high' ? 'border-red-200 bg-red-50' :
                      pattern.severity === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                      'border-blue-200 bg-blue-50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 mb-2">{pattern.description}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-600">Entidad afectada:</span>
                              <span className="ml-2 font-medium">{pattern.affected_table}</span>
                            </div>
                            <div>
                              <span className="text-slate-600">Usuario:</span>
                              <span className="ml-2 font-medium">{pattern.user_involved}</span>
                            </div>
                            <div>
                              <span className="text-slate-600">Eventos:</span>
                              <span className="ml-2 font-medium">{pattern.event_count}</span>
                            </div>
                            <div>
                              <span className="text-slate-600">Período:</span>
                              <span className="ml-2 font-medium">
                                {new Date(pattern.first_occurrence).toLocaleString('es-ES')} - 
                                {new Date(pattern.last_occurrence).toLocaleString('es-ES')}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-sm text-blue-800">
                              <strong>Recomendación:</strong> {pattern.recommendation}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Reportes de Auditoría</h3>
              </div>

              {/* Reportes Predefinidos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h4 className="font-semibold text-slate-900 mb-2">Reporte Diario</h4>
                  <p className="text-sm text-slate-600 mb-4">Actividad de las últimas 24 horas</p>
                  <button
                    onClick={() => generateReport('daily', 
                      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      new Date().toISOString().split('T')[0]
                    )}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Generar
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h4 className="font-semibold text-slate-900 mb-2">Reporte Semanal</h4>
                  <p className="text-sm text-slate-600 mb-4">Actividad de los últimos 7 días</p>
                  <button
                    onClick={() => generateReport('weekly',
                      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      new Date().toISOString().split('T')[0]
                    )}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Generar
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h4 className="font-semibold text-slate-900 mb-2">Reporte de Seguridad</h4>
                  <p className="text-sm text-slate-600 mb-4">Eventos críticos y de alta severidad</p>
                  <button
                    onClick={() => generateReport('security',
                      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      new Date().toISOString().split('T')[0]
                    )}
                    className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
                  >
                    Generar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalles del Log */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  Detalles del Evento de Auditoría
                </h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
                >
                  <Eye className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">ID del Evento:</label>
                    <p className="font-mono text-sm text-slate-900">{selectedLog.id}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700">Tipo de Acción:</label>
                    <div className="flex items-center mt-1">
                      {getActionTypeIcon(selectedLog.action_type)}
                      <span className="ml-2 font-medium">{getActionTypeLabel(selectedLog.action_type)}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700">Entidad:</label>
                    <p className="font-medium text-slate-900">{getEntityTypeLabel(selectedLog.entity_type)}</p>
                    {selectedLog.entity_id && (
                      <p className="text-sm text-slate-600">ID: {selectedLog.entity_id}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700">Usuario:</label>
                    <p className="font-medium text-slate-900">{selectedLog.performed_by_name || 'Sistema'}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700">Descripción:</label>
                    <p className="text-slate-900">{selectedLog.description}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Fecha y Hora:</label>
                    <p className="font-medium text-slate-900">
                      {new Date(selectedLog.performed_at).toLocaleString('es-ES')}
                    </p>
                  </div>
                  
                  {selectedLog.amount > 0 && (
                    <div>
                      <label className="text-sm font-medium text-slate-700">Monto:</label>
                      <p className="font-medium text-slate-900">{formatCurrency(selectedLog.amount)}</p>
                    </div>
                  )}
                  
                  {selectedLog.previous_balance !== null && selectedLog.new_balance !== null && (
                    <div>
                      <label className="text-sm font-medium text-slate-700">Balance:</label>
                      <div className="text-sm">
                        <p>Anterior: {formatCurrency(selectedLog.previous_balance)}</p>
                        <p>Nuevo: {formatCurrency(selectedLog.new_balance)}</p>
                        <p className={`font-medium ${
                          selectedLog.new_balance > selectedLog.previous_balance 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          Cambio: {formatCurrency(selectedLog.new_balance - selectedLog.previous_balance)}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedLog.ip_address && (
                    <div>
                      <label className="text-sm font-medium text-slate-700">IP Address:</label>
                      <p className="font-mono text-sm text-slate-900">{selectedLog.ip_address}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Metadatos */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h4 className="font-medium text-slate-900 mb-4">Metadatos del Evento</h4>
                  <pre className="bg-slate-50 border border-slate-200 rounded p-3 text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setSelectedLog(null)}
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