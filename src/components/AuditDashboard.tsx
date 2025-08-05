import React, { useState, useEffect } from 'react';
import { BarChart3, Activity, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Users, Package, DollarSign, Clock, Shield, FileText, Bell, Zap, Database, Eye, Download, RefreshCw } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import AuditReportGenerator from './AuditReportGenerator';
import AuditAlertManager from './AuditAlertManager';

interface AuditStats {
  today_events: number;
  critical_events: number;
  active_alerts: number;
  pending_compliance: number;
  system_health: 'healthy' | 'warning' | 'critical';
  last_maintenance: string | null;
}

interface RecentAuditEvent {
  id: string;
  action_type: string;
  entity_type: string;
  description: string;
  severity: string;
  performed_by: string | null;
  performed_at: string;
  amount: number | null;
  user_name: string | null;
}

export default function AuditDashboard() {
  const { user } = useAuth();
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [showAlertManager, setShowAlertManager] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    loadAuditData();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(loadAuditData, 30000);
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Datos demo para auditoría
        const demoStats: AuditStats = {
          today_events: 45,
          critical_events: 2,
          active_alerts: 4,
          pending_compliance: 1,
          system_health: 'healthy',
          last_maintenance: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        };

        const demoEvents: RecentAuditEvent[] = [
          {
            id: 'demo-event-1',
            action_type: 'sale',
            entity_type: 'sale',
            description: 'Venta procesada por $1,500,000',
            severity: 'normal',
            performed_by: user?.id || 'demo-user',
            performed_at: new Date().toISOString(),
            amount: 1500000,
            user_name: user?.name || 'Usuario Demo'
          },
          {
            id: 'demo-event-2',
            action_type: 'open',
            entity_type: 'cash_register',
            description: 'Apertura de caja registradora',
            severity: 'normal',
            performed_by: user?.id || 'demo-user',
            performed_at: new Date(Date.now() - 3600000).toISOString(),
            amount: 100000,
            user_name: user?.name || 'Usuario Demo'
          },
          {
            id: 'demo-event-3',
            action_type: 'delete',
            entity_type: 'product',
            description: 'Eliminación de producto: Producto Demo',
            severity: 'high',
            performed_by: user?.id || 'demo-user',
            performed_at: new Date(Date.now() - 7200000).toISOString(),
            amount: null,
            user_name: user?.name || 'Usuario Demo'
          },
          {
            id: 'demo-event-4',
            action_type: 'edit',
            entity_type: 'customer',
            description: 'Modificación de datos de cliente',
            severity: 'normal',
            performed_by: user?.id || 'demo-user',
            performed_at: new Date(Date.now() - 10800000).toISOString(),
            amount: null,
            user_name: user?.name || 'Usuario Demo'
          },
          {
            id: 'demo-event-5',
            action_type: 'close',
            entity_type: 'cash_register',
            description: 'Cierre de caja registradora con discrepancia',
            severity: 'high',
            performed_by: user?.id || 'demo-user',
            performed_at: new Date(Date.now() - 14400000).toISOString(),
            amount: 250000,
            user_name: user?.name || 'Usuario Demo'
          }
        ];

        setAuditStats(demoStats);
        setRecentEvents(demoEvents);
        setLoading(false);
        return;
      }

      // Intentar cargar estadísticas reales
      try {
        const { data: stats, error: statsError } = await supabase.rpc('get_audit_dashboard_stats');
        
        if (statsError) {
          console.warn('RPC function not available, using fallback queries');
          await loadAuditDataFallback();
        } else {
          setAuditStats(stats);
        }
      } catch (error) {
        console.warn('Error loading audit stats, using fallback');
        await loadAuditDataFallback();
      }

      // Cargar eventos recientes
      await loadRecentEvents();

    } catch (error) {
      console.error('Error loading audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditDataFallback = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Consultas básicas como fallback
      const [todayEvents, criticalEvents, alerts] = await Promise.all([
        supabase
          .from('cash_register_enhanced_audit')
          .select('id', { count: 'exact', head: true })
          .gte('performed_at', today),
        supabase
          .from('cash_register_enhanced_audit')
          .select('id', { count: 'exact', head: true })
          .eq('severity', 'critical')
          .gte('performed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('audit_alerts')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
      ]);

      const fallbackStats: AuditStats = {
        today_events: todayEvents.count || 0,
        critical_events: criticalEvents.count || 0,
        active_alerts: alerts.count || 0,
        pending_compliance: 0,
        system_health: 'healthy',
        last_maintenance: new Date().toISOString()
      };

      setAuditStats(fallbackStats);
    } catch (error) {
      console.error('Error in fallback audit data loading:', error);
      // Usar datos por defecto
      setAuditStats({
        today_events: 0,
        critical_events: 0,
        active_alerts: 0,
        pending_compliance: 0,
        system_health: 'warning',
        last_maintenance: null
      });
    }
  };

  const loadRecentEvents = async () => {
    try {
      let dateFilter = new Date().toISOString().split('T')[0]; // Hoy
      
      if (selectedTimeRange === 'week') {
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (selectedTimeRange === 'month') {
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const { data, error } = await supabase
        .from('cash_register_enhanced_audit')
        .select(`
          id,
          action_type,
          entity_type,
          description,
          severity,
          performed_by,
          performed_at,
          amount,
          performed_by_user:users(name)
        `)
        .gte('performed_at', dateFilter)
        .order('performed_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading recent events:', error);
        setRecentEvents([]);
        return;
      }

      const formattedEvents = (data || []).map(event => ({
        ...event,
        user_name: event.performed_by_user?.name || 'Sistema'
      }));

      setRecentEvents(formattedEvents);
    } catch (error) {
      console.error('Error loading recent events:', error);
      setRecentEvents([]);
    }
  };

  const getActionTypeIcon = (actionType: string) => {
    switch (actionType) {
      case 'open':
        return <Activity className="h-4 w-4 text-green-600" />;
      case 'close':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'sale':
        return <DollarSign className="h-4 w-4 text-green-600" />;
      case 'installment':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'income':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'expense':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'edit':
        return <FileText className="h-4 w-4 text-yellow-600" />;
      case 'delete':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-slate-600" />;
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
        return 'Caja';
      case 'sale':
        return 'Venta';
      case 'movement':
        return 'Movimiento';
      case 'installment':
        return 'Abono';
      case 'product':
        return 'Producto';
      case 'customer':
        return 'Cliente';
      default:
        return entityType;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getHealthStatusColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse border">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-slate-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 flex items-center">
            <BarChart3 className="h-7 w-7 mr-3 text-blue-600" />
            Dashboard de Auditoría
            {isDemoMode && (
              <span className="ml-3 text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                DEMO
              </span>
            )}
          </h3>
          <p className="text-slate-600 mt-1">
            Monitoreo en tiempo real de la actividad del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReportGenerator(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
          >
            <FileText className="h-4 w-4 mr-2" />
            Generar Reporte
          </button>
          <button
            onClick={() => setShowAlertManager(true)}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center"
          >
            <Bell className="h-4 w-4 mr-2" />
            Gestionar Alertas
          </button>
          <button
            onClick={loadAuditData}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Estado General del Sistema */}
      {auditStats && (
        <div className={`rounded-xl border-2 p-6 ${getHealthStatusColor(auditStats.system_health)}`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xl font-bold mb-2">
                Sistema de Auditoría: {auditStats.system_health === 'healthy' ? 'Saludable' : 
                                      auditStats.system_health === 'warning' ? 'Advertencia' : 'Crítico'}
              </h4>
              <p className="text-sm opacity-80">
                Última actualización: {new Date().toLocaleTimeString('es-ES')}
              </p>
              {auditStats.last_maintenance && (
                <p className="text-sm opacity-80">
                  Último mantenimiento: {new Date(auditStats.last_maintenance).toLocaleString('es-ES')}
                </p>
              )}
            </div>
            <div className="text-right">
              {auditStats.system_health === 'healthy' ? (
                <CheckCircle className="h-12 w-12" />
              ) : (
                <AlertTriangle className="h-12 w-12" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Métricas Principales */}
      {auditStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Eventos Hoy</p>
                <p className="text-2xl font-bold text-blue-900">{auditStats.today_events}</p>
                <p className="text-xs text-slate-500 mt-1">Actividad del sistema</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Eventos Críticos</p>
                <p className={`text-2xl font-bold ${auditStats.critical_events > 0 ? 'text-red-900' : 'text-green-900'}`}>
                  {auditStats.critical_events}
                </p>
                <p className="text-xs text-slate-500 mt-1">Últimas 24 horas</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${auditStats.critical_events > 0 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Alertas Activas</p>
                <p className={`text-2xl font-bold ${auditStats.active_alerts > 0 ? 'text-orange-900' : 'text-green-900'}`}>
                  {auditStats.active_alerts}
                </p>
                <p className="text-xs text-slate-500 mt-1">Configuradas y activas</p>
              </div>
              <Bell className={`h-8 w-8 ${auditStats.active_alerts > 0 ? 'text-orange-600' : 'text-green-600'}`} />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Cumplimiento</p>
                <p className={`text-2xl font-bold ${auditStats.pending_compliance > 0 ? 'text-yellow-900' : 'text-green-900'}`}>
                  {auditStats.pending_compliance === 0 ? 'OK' : auditStats.pending_compliance}
                </p>
                <p className="text-xs text-slate-500 mt-1">Verificaciones pendientes</p>
              </div>
              <Shield className={`h-8 w-8 ${auditStats.pending_compliance > 0 ? 'text-yellow-600' : 'text-green-600'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Filtro de Tiempo */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-slate-900">Actividad Reciente</h4>
          <div className="flex gap-2">
            {[
              { key: 'today', label: 'Hoy' },
              { key: 'week', label: 'Semana' },
              { key: 'month', label: 'Mes' }
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setSelectedTimeRange(option.key as any)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors duration-200 ${
                  selectedTimeRange === option.key
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Eventos Recientes */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <h4 className="text-lg font-semibold text-slate-900">Eventos de Auditoría Recientes</h4>
        </div>
        <div className="p-6">
          {recentEvents.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No hay eventos de auditoría en el período seleccionado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentEvents.map((event) => (
                <div key={event.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getActionTypeIcon(event.action_type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h5 className="font-medium text-slate-900">
                            {getActionTypeLabel(event.action_type)} - {getEntityTypeLabel(event.entity_type)}
                          </h5>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(event.severity)}`}>
                            {event.severity}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mb-2">{event.description}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(event.performed_at).toLocaleString('es-ES')}
                          </span>
                          <span className="flex items-center">
                            <Users className="h-3 w-3 mr-1" />
                            {event.user_name || 'Sistema'}
                          </span>
                          {event.amount && (
                            <span className="flex items-center">
                              <DollarSign className="h-3 w-3 mr-1" />
                              {formatCurrency(event.amount)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Información del Sistema */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Database className="h-5 w-5 mr-2 text-blue-600" />
          Estado del Sistema de Auditoría
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Auditoría Automática</p>
                <p className="font-bold text-green-900">{isDemoMode ? 'Demo' : 'Activa'}</p>
              </div>
              <Shield className="h-6 w-6 text-green-600" />
            </div>
          </div>

          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Retención de Datos</p>
                <p className="font-bold text-blue-900">365 días</p>
              </div>
              <Database className="h-6 w-6 text-blue-600" />
            </div>
          </div>

          <div className="bg-white border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Validación</p>
                <p className="font-bold text-purple-900">Tiempo Real</p>
              </div>
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        {isDemoMode && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">Modo Demo Activo</h4>
            <p className="text-sm text-yellow-800">
              Estás viendo datos de demostración. Para usar el sistema de auditoría completo, 
              configura las variables de entorno de Supabase y conecta una base de datos real.
            </p>
          </div>
        )}
      </div>

      {/* Modales */}
      <AuditReportGenerator
        isOpen={showReportGenerator}
        onClose={() => setShowReportGenerator(false)}
        onReportGenerated={() => {
          setShowReportGenerator(false);
          loadAuditData();
        }}
      />

      <AuditAlertManager
        isOpen={showAlertManager}
        onClose={() => setShowAlertManager(false)}
        onUpdate={() => {
          loadAuditData();
        }}
      />
    </div>
  );
}