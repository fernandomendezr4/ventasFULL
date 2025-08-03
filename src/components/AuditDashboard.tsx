import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, FileText, Activity, Users, Database, Calendar, Search, Filter, Download, Eye, Bell, Settings, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';

interface AuditLog {
  id: string;
  event_id: string;
  event_type: string;
  event_timestamp: string;
  table_name: string;
  record_id: string;
  user_email: string;
  user_role: string;
  severity_level: string;
  business_context: string;
  changed_fields: string[];
  old_values: any;
  new_values: any;
  ip_address: string;
}

interface AuditAlert {
  id: string;
  alert_name: string;
  alert_type: string;
  severity: string;
  table_name: string;
  status: string;
  trigger_count: number;
  last_triggered_at: string;
  description: string;
  business_impact: string;
}

interface AuditStatistics {
  total_events: number;
  events_by_type: Record<string, number>;
  events_by_table: Record<string, number>;
  events_by_severity: Record<string, number>;
  unique_users: number;
  unique_tables: number;
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
  const [auditAlerts, setAuditAlerts] = useState<AuditAlert[]>([]);
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [suspiciousPatterns, setSuspiciousPatterns] = useState<SuspiciousPattern[]>([]);
  
  // Filtros
  const [dateFilter, setDateFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados de modales
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [showAlertConfig, setShowAlertConfig] = useState(false);

  useEffect(() => {
    loadAuditData();
  }, []);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      
      // Cargar logs de auditoría recientes
      const { data: logs, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('event_timestamp', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Cargar alertas activas
      const { data: alerts, error: alertsError } = await supabase
        .from('audit_active_alerts')
        .select('*')
        .limit(50);

      if (alertsError) throw alertsError;

      // Cargar estadísticas
      const { data: stats, error: statsError } = await supabase
        .rpc('get_audit_statistics');

      if (statsError) throw statsError;

      // Cargar patrones sospechosos
      const { data: patterns, error: patternsError } = await supabase
        .rpc('detect_suspicious_patterns');

      if (patternsError) throw patternsError;

      setAuditLogs(logs || []);
      setAuditAlerts(alerts || []);
      setStatistics(stats);
      setSuspiciousPatterns(patterns || []);
    } catch (error) {
      console.error('Error loading audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (reportType: string, dateFrom: string, dateTo: string) => {
    try {
      const { data, error } = await supabase
        .rpc('generate_audit_report', {
          p_report_type: reportType,
          p_date_from: dateFrom,
          p_date_to: dateTo
        });

      if (error) throw error;

      alert('Reporte generado exitosamente. ID: ' + data);
      loadAuditData();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar reporte: ' + (error as Error).message);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('audit_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_by: user?.id,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;
      loadAuditData();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'INSERT':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'UPDATE':
        return <Activity className="h-4 w-4 text-blue-600" />;
      case 'DELETE':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'LOGIN':
        return <Users className="h-4 w-4 text-purple-600" />;
      default:
        return <Database className="h-4 w-4 text-gray-600" />;
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesDate = !dateFilter || log.event_timestamp.startsWith(dateFilter);
    const matchesTable = !tableFilter || log.table_name === tableFilter;
    const matchesSeverity = !severityFilter || log.severity_level === severityFilter;
    const matchesUser = !userFilter || log.user_email?.toLowerCase().includes(userFilter.toLowerCase());
    const matchesSearch = !searchTerm || 
      log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.business_context?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesDate && matchesTable && matchesSeverity && matchesUser && matchesSearch;
  });

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: BarChart3 },
    { id: 'logs', label: 'Logs de Auditoría', icon: FileText },
    { id: 'alerts', label: 'Alertas', icon: Bell },
    { id: 'patterns', label: 'Patrones Sospechosos', icon: AlertTriangle },
    { id: 'reports', label: 'Reportes', icon: Download },
    { id: 'config', label: 'Configuración', icon: Settings }
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
            onClick={() => setShowReportGenerator(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Generar Reporte
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
                  {tab.id === 'alerts' && auditAlerts.filter(a => a.status === 'active').length > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                      {auditAlerts.filter(a => a.status === 'active').length}
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
                        <p className="text-sm font-medium text-green-600">Usuarios Activos</p>
                        <p className="text-2xl font-bold text-green-900">{statistics.unique_users}</p>
                      </div>
                      <Users className="h-8 w-8 text-green-600" />
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-600">Tablas Monitoreadas</p>
                        <p className="text-2xl font-bold text-purple-900">{statistics.unique_tables}</p>
                      </div>
                      <Database className="h-8 w-8 text-purple-600" />
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-600">Alertas Activas</p>
                        <p className="text-2xl font-bold text-red-900">
                          {auditAlerts.filter(a => a.status === 'active').length}
                        </p>
                      </div>
                      <Bell className="h-8 w-8 text-red-600" />
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
                          {getEventTypeIcon(type)}
                          <span className="ml-2 font-medium text-slate-900">{type}</span>
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

              {/* Alertas Críticas */}
              {auditAlerts.filter(a => a.severity === 'critical' && a.status === 'active').length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Alertas Críticas Activas
                  </h3>
                  <div className="space-y-3">
                    {auditAlerts
                      .filter(a => a.severity === 'critical' && a.status === 'active')
                      .slice(0, 5)
                      .map((alert) => (
                        <div key={alert.id} className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg">
                          <div>
                            <h4 className="font-medium text-red-900">{alert.alert_name}</h4>
                            <p className="text-sm text-red-700">{alert.description}</p>
                            <p className="text-xs text-red-600 mt-1">
                              Última activación: {new Date(alert.last_triggered_at).toLocaleString('es-ES')}
                            </p>
                          </div>
                          <button
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors duration-200"
                          >
                            Reconocer
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-6">
              {/* Filtros */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                    <option value="">Todas las tablas</option>
                    <option value="users">Usuarios</option>
                    <option value="sales">Ventas</option>
                    <option value="products">Productos</option>
                    <option value="customers">Clientes</option>
                    <option value="cash_registers">Cajas</option>
                  </select>
                  
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todas las severidades</option>
                    <option value="critical">Crítica</option>
                    <option value="high">Alta</option>
                    <option value="normal">Normal</option>
                    <option value="low">Baja</option>
                  </select>
                  
                  <input
                    type="text"
                    placeholder="Usuario..."
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Lista de Logs */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Evento</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Tabla</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Usuario</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Severidad</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Fecha</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors duration-200">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              {getEventTypeIcon(log.event_type)}
                              <div className="ml-3">
                                <p className="font-medium text-slate-900">{log.event_type}</p>
                                <p className="text-sm text-slate-600">{log.event_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-slate-900">{log.table_name}</span>
                            {log.business_context && (
                              <p className="text-sm text-slate-600">{log.business_context}</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-slate-900">{log.user_email || 'Sistema'}</p>
                              {log.user_role && (
                                <p className="text-sm text-slate-600">{log.user_role}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(log.severity_level)}`}>
                              {log.severity_level}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm text-slate-900">
                                {new Date(log.event_timestamp).toLocaleDateString('es-ES')}
                              </p>
                              <p className="text-xs text-slate-600">
                                {new Date(log.event_timestamp).toLocaleTimeString('es-ES')}
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
              </div>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Alertas de Auditoría</h3>
                <button
                  onClick={() => setShowAlertConfig(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar Alertas
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {auditAlerts.map((alert) => (
                  <div key={alert.id} className={`border rounded-lg p-6 ${
                    alert.status === 'active' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-slate-900">{alert.alert_name}</h4>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            alert.status === 'active' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {alert.status}
                          </span>
                        </div>
                        <p className="text-slate-700 mb-2">{alert.description}</p>
                        <p className="text-sm text-slate-600 mb-2">{alert.business_impact}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span>Tabla: {alert.table_name || 'Todas'}</span>
                          <span>Activaciones: {alert.trigger_count}</span>
                          {alert.last_triggered_at && (
                            <span>Última: {new Date(alert.last_triggered_at).toLocaleString('es-ES')}</span>
                          )}
                        </div>
                      </div>
                      {alert.status === 'active' && (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
                        >
                          Reconocer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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
                    <div key={index} className={`border rounded-lg p-6 ${getSeverityColor(pattern.severity).replace('text-', 'border-').replace('bg-', 'bg-')}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 mb-2">{pattern.description}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-600">Tabla afectada:</span>
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
                <button
                  onClick={() => setShowReportGenerator(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Nuevo Reporte
                </button>
              </div>

              {/* Reportes Predefinidos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h4 className="font-semibold text-slate-900 mb-2">Reporte Diario</h4>
                  <p className="text-sm text-slate-600 mb-4">Actividad de las últimas 24 horas</p>
                  <button
                    onClick={() => generateReport('daily', 
                      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                      new Date().toISOString()
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
                      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                      new Date().toISOString()
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
                      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                      new Date().toISOString()
                    )}
                    className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
                  >
                    Generar
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'config' && user?.role === 'admin' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">Configuración de Auditoría</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h4 className="font-medium text-blue-900 mb-3">Estado del Sistema</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center">
                    <Shield className="h-4 w-4 mr-2 text-green-600" />
                    <span>Auditoría automática activa</span>
                  </div>
                  <div className="flex items-center">
                    <Bell className="h-4 w-4 mr-2 text-blue-600" />
                    <span>Sistema de alertas funcionando</span>
                  </div>
                  <div className="flex items-center">
                    <Database className="h-4 w-4 mr-2 text-purple-600" />
                    <span>Mantenimiento automático programado</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h4 className="font-medium text-slate-900 mb-4">Acciones de Mantenimiento</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={async () => {
                      try {
                        const { data, error } = await supabase.rpc('audit_maintenance');
                        if (error) throw error;
                        alert('Mantenimiento ejecutado:\n' + data);
                      } catch (error) {
                        alert('Error en mantenimiento: ' + (error as Error).message);
                      }
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Ejecutar Mantenimiento
                  </button>
                  
                  <button
                    onClick={async () => {
                      try {
                        const { data, error } = await supabase.rpc('detect_suspicious_patterns');
                        if (error) throw error;
                        setSuspiciousPatterns(data || []);
                        setActiveTab('patterns');
                      } catch (error) {
                        alert('Error detectando patrones: ' + (error as Error).message);
                      }
                    }}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center justify-center"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Detectar Patrones
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
                    <p className="font-mono text-sm text-slate-900">{selectedLog.event_id}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700">Tipo de Evento:</label>
                    <div className="flex items-center mt-1">
                      {getEventTypeIcon(selectedLog.event_type)}
                      <span className="ml-2 font-medium">{selectedLog.event_type}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700">Tabla:</label>
                    <p className="font-medium text-slate-900">{selectedLog.table_name}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700">Usuario:</label>
                    <p className="font-medium text-slate-900">{selectedLog.user_email || 'Sistema'}</p>
                    {selectedLog.user_role && (
                      <p className="text-sm text-slate-600">Rol: {selectedLog.user_role}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700">Severidad:</label>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(selectedLog.severity_level)}`}>
                      {selectedLog.severity_level}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Fecha y Hora:</label>
                    <p className="font-medium text-slate-900">
                      {new Date(selectedLog.event_timestamp).toLocaleString('es-ES')}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700">IP Address:</label>
                    <p className="font-mono text-sm text-slate-900">{selectedLog.ip_address || 'N/A'}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700">Contexto de Negocio:</label>
                    <p className="font-medium text-slate-900">{selectedLog.business_context || 'N/A'}</p>
                  </div>
                  
                  {selectedLog.changed_fields && selectedLog.changed_fields.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-slate-700">Campos Modificados:</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedLog.changed_fields.map((field, index) => (
                          <span key={index} className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Datos del cambio */}
              {(selectedLog.old_values || selectedLog.new_values) && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h4 className="font-medium text-slate-900 mb-4">Datos del Cambio</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedLog.old_values && Object.keys(selectedLog.old_values).length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-2 block">Valores Anteriores:</label>
                        <pre className="bg-red-50 border border-red-200 rounded p-3 text-xs overflow-auto max-h-40">
                          {JSON.stringify(selectedLog.old_values, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {selectedLog.new_values && Object.keys(selectedLog.new_values).length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-2 block">Valores Nuevos:</label>
                        <pre className="bg-green-50 border border-green-200 rounded p-3 text-xs overflow-auto max-h-40">
                          {JSON.stringify(selectedLog.new_values, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
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