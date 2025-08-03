import React, { useState, useEffect } from 'react';
import { Bell, Plus, Edit2, Trash2, AlertTriangle, CheckCircle, X, Settings } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AuditAlert {
  id: string;
  alert_name: string;
  alert_type: string;
  severity: string;
  entity_type: string;
  event_types: string[];
  trigger_conditions: any;
  description: string;
  business_impact: string;
  remediation_steps: string;
  notification_channels: string[];
  is_active: boolean;
  trigger_count: number;
  last_triggered_at: string;
  status: string;
}

interface AuditAlertManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AuditAlertManager({ 
  isOpen, 
  onClose, 
  onUpdate 
}: AuditAlertManagerProps) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AuditAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AuditAlert | null>(null);
  const [formData, setFormData] = useState({
    alert_name: '',
    alert_type: 'security',
    severity: 'medium',
    entity_type: '',
    event_types: [] as string[],
    description: '',
    business_impact: '',
    remediation_steps: '',
    notification_channels: ['dashboard'] as string[],
    trigger_conditions: {},
    cooldown_minutes: 60,
    max_triggers_per_hour: 10
  });

  useEffect(() => {
    if (isOpen) {
      loadAlerts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const loadAlerts = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Datos demo para alertas
        const demoAlerts: AuditAlert[] = [
          {
            id: 'demo-alert-1',
            alert_name: 'Eliminaciones Masivas',
            alert_type: 'security',
            severity: 'high',
            entity_type: 'product',
            event_types: ['delete'],
            trigger_conditions: { max_events_per_hour: 5 },
            description: 'Detecta cuando se eliminan muchos productos en poco tiempo',
            business_impact: 'Pérdida potencial de datos críticos de inventario',
            remediation_steps: '1. Verificar autorización, 2. Revisar logs, 3. Contactar administrador',
            notification_channels: ['dashboard', 'email'],
            is_active: true,
            trigger_count: 0,
            last_triggered_at: '',
            status: 'active'
          },
          {
            id: 'demo-alert-2',
            alert_name: 'Acceso Fuera de Horario',
            alert_type: 'compliance',
            severity: 'medium',
            entity_type: 'cash_register',
            event_types: ['open', 'close'],
            trigger_conditions: { outside_business_hours: true },
            description: 'Detecta operaciones de caja fuera del horario laboral',
            business_impact: 'Posible violación de políticas de seguridad',
            remediation_steps: '1. Verificar autorización, 2. Documentar razón, 3. Notificar supervisor',
            notification_channels: ['dashboard'],
            is_active: true,
            trigger_count: 2,
            last_triggered_at: new Date(Date.now() - 86400000).toISOString(),
            status: 'active'
          }
        ];
        
        setAlerts(demoAlerts);
        setLoading(false);
        return;
      }

      // Intentar cargar alertas reales
      try {
        const { data, error } = await supabase
          .from('audit_alerts')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading alerts:', error);
          setAlerts([]);
        } else {
          setAlerts(data || []);
        }
      } catch (error) {
        console.error('Error loading alerts:', error);
        setAlerts([]);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.alert_name.trim()) {
      alert('El nombre de la alerta es requerido');
      return;
    }

    try {
      if (isDemoMode) {
        // Simular creación en modo demo
        const newAlert: AuditAlert = {
          id: `demo-alert-${Date.now()}`,
          alert_name: formData.alert_name,
          alert_type: formData.alert_type,
          severity: formData.severity,
          entity_type: formData.entity_type,
          event_types: formData.event_types,
          trigger_conditions: {
            ...formData.trigger_conditions,
            cooldown_minutes: formData.cooldown_minutes,
            max_triggers_per_hour: formData.max_triggers_per_hour
          },
          description: formData.description,
          business_impact: formData.business_impact,
          remediation_steps: formData.remediation_steps,
          notification_channels: formData.notification_channels,
          is_active: true,
          trigger_count: 0,
          last_triggered_at: '',
          status: 'active'
        };

        if (editingAlert) {
          setAlerts(prev => prev.map(alert => 
            alert.id === editingAlert.id ? { ...newAlert, id: editingAlert.id } : alert
          ));
        } else {
          setAlerts(prev => [newAlert, ...prev]);
        }

        alert('Alerta guardada exitosamente (modo demo)');
        setShowForm(false);
        setEditingAlert(null);
        resetForm();
        onUpdate();
        return;
      }

      const alertData = {
        alert_name: formData.alert_name,
        alert_type: formData.alert_type,
        severity: formData.severity,
        entity_type: formData.entity_type || null,
        event_types: formData.event_types,
        trigger_conditions: {
          ...formData.trigger_conditions,
          cooldown_minutes: formData.cooldown_minutes,
          max_triggers_per_hour: formData.max_triggers_per_hour
        },
        description: formData.description,
        business_impact: formData.business_impact,
        remediation_steps: formData.remediation_steps,
        notification_channels: formData.notification_channels,
        created_by: user?.id
      };

      if (editingAlert) {
        const { error } = await supabase
          .from('audit_alerts')
          .update(alertData)
          .eq('id', editingAlert.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('audit_alerts')
          .insert([alertData]);

        if (error) throw error;
      }

      setShowForm(false);
      setEditingAlert(null);
      resetForm();
      loadAlerts();
      onUpdate();
    } catch (error) {
      console.error('Error saving alert:', error);
      alert('Error al guardar alerta: ' + (error as Error).message);
    }
  };

  const handleEdit = (alert: AuditAlert) => {
    setEditingAlert(alert);
    setFormData({
      alert_name: alert.alert_name,
      alert_type: alert.alert_type,
      severity: alert.severity,
      entity_type: alert.entity_type || '',
      event_types: alert.event_types || [],
      description: alert.description,
      business_impact: alert.business_impact,
      remediation_steps: alert.remediation_steps,
      notification_channels: alert.notification_channels || ['dashboard'],
      trigger_conditions: alert.trigger_conditions || {},
      cooldown_minutes: alert.trigger_conditions?.cooldown_minutes || 60,
      max_triggers_per_hour: alert.trigger_conditions?.max_triggers_per_hour || 10
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta alerta?')) {
      try {
        if (isDemoMode) {
          setAlerts(prev => prev.filter(alert => alert.id !== id));
          alert('Alerta eliminada exitosamente (modo demo)');
          onUpdate();
          return;
        }

        const { error } = await supabase
          .from('audit_alerts')
          .delete()
          .eq('id', id);

        if (error) throw error;
        loadAlerts();
        onUpdate();
      } catch (error) {
        console.error('Error deleting alert:', error);
        alert('Error al eliminar alerta: ' + (error as Error).message);
      }
    }
  };

  const toggleAlertStatus = async (id: string, currentStatus: boolean) => {
    try {
      if (isDemoMode) {
        setAlerts(prev => prev.map(alert => 
          alert.id === id ? { ...alert, is_active: !currentStatus } : alert
        ));
        onUpdate();
        return;
      }

      const { error } = await supabase
        .from('audit_alerts')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      loadAlerts();
      onUpdate();
    } catch (error) {
      console.error('Error toggling alert status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      alert_name: '',
      alert_type: 'security',
      severity: 'medium',
      entity_type: '',
      event_types: [],
      description: '',
      business_impact: '',
      remediation_steps: '',
      notification_channels: ['dashboard'],
      trigger_conditions: {},
      cooldown_minutes: 60,
      max_triggers_per_hour: 10
    });
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

  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'security':
        return 'bg-red-100 text-red-800';
      case 'compliance':
        return 'bg-purple-100 text-purple-800';
      case 'performance':
        return 'bg-blue-100 text-blue-800';
      case 'data_integrity':
        return 'bg-green-100 text-green-800';
      case 'business_rule':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900 flex items-center">
              <Bell className="h-6 w-6 mr-3 text-orange-600" />
              Gestión de Alertas de Auditoría
              {isDemoMode && (
                <span className="ml-3 text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                  DEMO
                </span>
              )}
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {!showForm ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-slate-900">Alertas Configuradas</h4>
                  <button
                    onClick={() => {
                      setShowForm(true);
                      setEditingAlert(null);
                      resetForm();
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Alerta
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Cargando alertas...</p>
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">No hay alertas configuradas</p>
                    <button
                      onClick={() => {
                        setShowForm(true);
                        setEditingAlert(null);
                        resetForm();
                      }}
                      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                      Crear Primera Alerta
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="border border-slate-200 rounded-lg p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h5 className="font-semibold text-slate-900">{alert.alert_name}</h5>
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getAlertTypeColor(alert.alert_type)}`}>
                                {alert.alert_type}
                              </span>
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(alert.severity)}`}>
                                {alert.severity}
                              </span>
                              <button
                                onClick={() => toggleAlertStatus(alert.id, alert.is_active)}
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                                  alert.is_active
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                }`}
                              >
                                {alert.is_active ? (
                                  <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Activa
                                  </>
                                ) : (
                                  <>
                                    <X className="h-3 w-3 mr-1" />
                                    Inactiva
                                  </>
                                )}
                              </button>
                            </div>
                            
                            <p className="text-slate-700 mb-2">{alert.description}</p>
                            <p className="text-sm text-slate-600 mb-2">
                              <strong>Impacto:</strong> {alert.business_impact}
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                              <div>
                                <span className="font-medium">Entidad:</span>
                                <span className="ml-1">{alert.entity_type || 'Todas'}</span>
                              </div>
                              <div>
                                <span className="font-medium">Activaciones:</span>
                                <span className="ml-1">{alert.trigger_count}</span>
                              </div>
                              {alert.last_triggered_at && (
                                <div>
                                  <span className="font-medium">Última activación:</span>
                                  <span className="ml-1">
                                    {new Date(alert.last_triggered_at).toLocaleDateString('es-ES')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(alert)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                              title="Editar alerta"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(alert.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                              title="Eliminar alerta"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Formulario de Alerta */
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-slate-900">
                    {editingAlert ? 'Editar Alerta' : 'Nueva Alerta'}
                  </h4>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setEditingAlert(null);
                      resetForm();
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Información Básica */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <h5 className="font-medium text-slate-900 mb-4">Información Básica</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Nombre de la Alerta *
                        </label>
                        <input
                          type="text"
                          value={formData.alert_name}
                          onChange={(e) => setFormData({ ...formData, alert_name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Ej: Eliminación masiva de productos"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Tipo de Alerta
                        </label>
                        <select
                          value={formData.alert_type}
                          onChange={(e) => setFormData({ ...formData, alert_type: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="security">Seguridad</option>
                          <option value="compliance">Cumplimiento</option>
                          <option value="performance">Rendimiento</option>
                          <option value="data_integrity">Integridad de Datos</option>
                          <option value="business_rule">Regla de Negocio</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Severidad
                        </label>
                        <select
                          value={formData.severity}
                          onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="low">Baja</option>
                          <option value="medium">Media</option>
                          <option value="high">Alta</option>
                          <option value="critical">Crítica</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Entidad Específica (opcional)
                        </label>
                        <select
                          value={formData.entity_type}
                          onChange={(e) => setFormData({ ...formData, entity_type: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Todas las entidades</option>
                          <option value="cash_register">Cajas Registradoras</option>
                          <option value="sale">Ventas</option>
                          <option value="movement">Movimientos</option>
                          <option value="installment">Abonos</option>
                          <option value="product">Productos</option>
                          <option value="customer">Clientes</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Tipos de Eventos */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <h5 className="font-medium text-slate-900 mb-4">Tipos de Eventos a Monitorear</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {['open', 'close', 'sale', 'installment', 'income', 'expense', 'edit', 'delete'].map((eventType) => (
                        <div key={eventType} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`event_${eventType}`}
                            checked={formData.event_types.includes(eventType)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  event_types: [...formData.event_types, eventType]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  event_types: formData.event_types.filter(type => type !== eventType)
                                });
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                          />
                          <label htmlFor={`event_${eventType}`} className="ml-2 text-sm text-slate-700 capitalize">
                            {eventType}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Configuración de Notificaciones */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <h5 className="font-medium text-slate-900 mb-4">Configuración de Notificaciones</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Canales de Notificación
                        </label>
                        <div className="space-y-2">
                          {['dashboard', 'email', 'webhook'].map((channel) => (
                            <div key={channel} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`channel_${channel}`}
                                checked={formData.notification_channels.includes(channel)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({
                                      ...formData,
                                      notification_channels: [...formData.notification_channels, channel]
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      notification_channels: formData.notification_channels.filter(c => c !== channel)
                                    });
                                  }
                                }}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                              />
                              <label htmlFor={`channel_${channel}`} className="ml-2 text-sm text-slate-700 capitalize">
                                {channel}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Tiempo de Espera (minutos)
                          </label>
                          <input
                            type="number"
                            value={formData.cooldown_minutes}
                            onChange={(e) => setFormData({ ...formData, cooldown_minutes: parseInt(e.target.value) || 60 })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min="1"
                            max="1440"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Tiempo mínimo entre alertas del mismo tipo
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Máximo por Hora
                          </label>
                          <input
                            type="number"
                            value={formData.max_triggers_per_hour}
                            onChange={(e) => setFormData({ ...formData, max_triggers_per_hour: parseInt(e.target.value) || 10 })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min="1"
                            max="100"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Número máximo de alertas por hora
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Descripción y Documentación */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <h5 className="font-medium text-slate-900 mb-4">Descripción y Documentación</h5>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Descripción *
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Describe qué detecta esta alerta..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Impacto en el Negocio
                        </label>
                        <textarea
                          value={formData.business_impact}
                          onChange={(e) => setFormData({ ...formData, business_impact: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Explica el impacto potencial en el negocio..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Pasos de Remediación
                        </label>
                        <textarea
                          value={formData.remediation_steps}
                          onChange={(e) => setFormData({ ...formData, remediation_steps: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="1. Verificar..., 2. Contactar..., 3. Documentar..."
                        />
                      </div>
                    </div>
                  </div>

                  {isDemoMode && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-yellow-600 mr-2" />
                        <div>
                          <h4 className="font-medium text-yellow-900">Modo Demo</h4>
                          <p className="text-sm text-yellow-800">
                            La alerta se guardará localmente para demostración.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingAlert(null);
                        resetForm();
                      }}
                      className="px-4 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                      {editingAlert ? 'Actualizar' : 'Crear'} Alerta
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}