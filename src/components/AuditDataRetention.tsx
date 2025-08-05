import React, { useState, useEffect } from 'react';
import { Database, Archive, Trash2, Calendar, Settings, AlertTriangle, CheckCircle, Clock, HardDrive } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface RetentionPolicy {
  id: string;
  table_name: string;
  retention_period_days: number;
  archive_before_delete: boolean;
  archive_table_name: string | null;
  last_cleanup_at: string | null;
  records_archived: number;
  records_deleted: number;
  is_active: boolean;
  created_at: string;
}

interface CleanupResult {
  table_name: string;
  records_archived: number;
  records_deleted: number;
  cleanup_date: string;
}

export default function AuditDataRetention() {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [cleanupResults, setCleanupResults] = useState<CleanupResult[]>([]);
  const [formData, setFormData] = useState({
    table_name: '',
    retention_period_days: 365,
    archive_before_delete: true,
    archive_table_name: ''
  });

  useEffect(() => {
    loadRetentionPolicies();
  }, []);

  const loadRetentionPolicies = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Datos demo para políticas de retención
        const demoPolicies: RetentionPolicy[] = [
          {
            id: 'demo-retention-1',
            table_name: 'cash_register_audit_logs',
            retention_period_days: 365,
            archive_before_delete: true,
            archive_table_name: 'cash_register_audit_logs_archive',
            last_cleanup_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            records_archived: 1250,
            records_deleted: 0,
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: 'demo-retention-2',
            table_name: 'cash_register_enhanced_audit',
            retention_period_days: 730,
            archive_before_delete: true,
            archive_table_name: 'cash_register_enhanced_audit_archive',
            last_cleanup_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            records_archived: 2800,
            records_deleted: 0,
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: 'demo-retention-3',
            table_name: 'audit_reports',
            retention_period_days: 1095,
            archive_before_delete: false,
            archive_table_name: null,
            last_cleanup_at: null,
            records_archived: 0,
            records_deleted: 15,
            is_active: true,
            created_at: new Date().toISOString()
          }
        ];
        
        setPolicies(demoPolicies);
        setLoading(false);
        return;
      }

      // Cargar políticas reales
      const { data, error } = await supabase
        .from('audit_data_retention')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading retention policies:', error);
        setPolicies([]);
      } else {
        setPolicies(data || []);
      }
    } catch (error) {
      console.error('Error loading retention policies:', error);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.table_name.trim()) {
      alert('El nombre de la tabla es requerido');
      return;
    }

    if (formData.retention_period_days < 1) {
      alert('El período de retención debe ser al menos 1 día');
      return;
    }

    try {
      if (isDemoMode) {
        // Simular creación en modo demo
        const newPolicy: RetentionPolicy = {
          id: `demo-retention-${Date.now()}`,
          table_name: formData.table_name,
          retention_period_days: formData.retention_period_days,
          archive_before_delete: formData.archive_before_delete,
          archive_table_name: formData.archive_table_name || null,
          last_cleanup_at: null,
          records_archived: 0,
          records_deleted: 0,
          is_active: true,
          created_at: new Date().toISOString()
        };

        if (editingPolicy) {
          setPolicies(prev => prev.map(policy => 
            policy.id === editingPolicy.id ? { ...newPolicy, id: editingPolicy.id } : policy
          ));
        } else {
          setPolicies(prev => [newPolicy, ...prev]);
        }

        alert('Política de retención guardada exitosamente (modo demo)');
        setShowForm(false);
        setEditingPolicy(null);
        resetForm();
        return;
      }

      const policyData = {
        table_name: formData.table_name,
        retention_period_days: formData.retention_period_days,
        archive_before_delete: formData.archive_before_delete,
        archive_table_name: formData.archive_before_delete ? formData.archive_table_name : null,
        created_by: user?.id
      };

      if (editingPolicy) {
        const { error } = await supabase
          .from('audit_data_retention')
          .update(policyData)
          .eq('id', editingPolicy.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('audit_data_retention')
          .insert([policyData]);

        if (error) throw error;
      }

      setShowForm(false);
      setEditingPolicy(null);
      resetForm();
      loadRetentionPolicies();
    } catch (error) {
      console.error('Error saving retention policy:', error);
      alert('Error al guardar política: ' + (error as Error).message);
    }
  };

  const handleEdit = (policy: RetentionPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      table_name: policy.table_name,
      retention_period_days: policy.retention_period_days,
      archive_before_delete: policy.archive_before_delete,
      archive_table_name: policy.archive_table_name || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta política de retención?')) {
      try {
        if (isDemoMode) {
          setPolicies(prev => prev.filter(policy => policy.id !== id));
          alert('Política eliminada exitosamente (modo demo)');
          return;
        }

        const { error } = await supabase
          .from('audit_data_retention')
          .delete()
          .eq('id', id);

        if (error) throw error;
        loadRetentionPolicies();
      } catch (error) {
        console.error('Error deleting retention policy:', error);
        alert('Error al eliminar política: ' + (error as Error).message);
      }
    }
  };

  const runCleanup = async () => {
    if (!window.confirm('¿Estás seguro de que quieres ejecutar la limpieza de datos? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setRunningCleanup(true);
      
      if (isDemoMode) {
        // Simular limpieza en modo demo
        const demoResults: CleanupResult[] = [
          {
            table_name: 'cash_register_audit_logs',
            records_archived: 150,
            records_deleted: 0,
            cleanup_date: new Date().toISOString()
          },
          {
            table_name: 'cash_register_enhanced_audit',
            records_archived: 75,
            records_deleted: 0,
            cleanup_date: new Date().toISOString()
          }
        ];
        
        setCleanupResults(demoResults);
        alert('Limpieza ejecutada exitosamente (modo demo)');
        return;
      }

      // Ejecutar limpieza real
      const { data, error } = await supabase.rpc('cleanup_audit_data');
      
      if (error) throw error;
      
      setCleanupResults(data || []);
      loadRetentionPolicies();
      alert('Limpieza ejecutada exitosamente');
    } catch (error) {
      console.error('Error running cleanup:', error);
      alert('Error al ejecutar limpieza: ' + (error as Error).message);
    } finally {
      setRunningCleanup(false);
    }
  };

  const togglePolicyStatus = async (id: string, currentStatus: boolean) => {
    try {
      if (isDemoMode) {
        setPolicies(prev => prev.map(policy => 
          policy.id === id ? { ...policy, is_active: !currentStatus } : policy
        ));
        return;
      }

      const { error } = await supabase
        .from('audit_data_retention')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      loadRetentionPolicies();
    } catch (error) {
      console.error('Error toggling policy status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      table_name: '',
      retention_period_days: 365,
      archive_before_delete: true,
      archive_table_name: ''
    });
  };

  const getTableDisplayName = (tableName: string) => {
    const displayNames: Record<string, string> = {
      'cash_register_audit_logs': 'Logs de Auditoría de Caja',
      'cash_register_enhanced_audit': 'Auditoría Mejorada de Caja',
      'audit_reports': 'Reportes de Auditoría',
      'audit_alerts': 'Alertas de Auditoría',
      'employee_sessions': 'Sesiones de Empleados'
    };
    return displayNames[tableName] || tableName.replace('_', ' ').toUpperCase();
  };

  const calculateNextCleanup = (policy: RetentionPolicy) => {
    if (!policy.last_cleanup_at) {
      return 'Pendiente';
    }
    
    const lastCleanup = new Date(policy.last_cleanup_at);
    const nextCleanup = new Date(lastCleanup.getTime() + 24 * 60 * 60 * 1000); // Diario
    
    if (nextCleanup < new Date()) {
      return 'Vencida';
    }
    
    return nextCleanup.toLocaleDateString('es-ES');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 flex items-center">
            <Archive className="h-7 w-7 mr-3 text-purple-600" />
            Gestión de Retención de Datos
            {isDemoMode && (
              <span className="ml-3 text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                DEMO
              </span>
            )}
          </h3>
          <p className="text-slate-600 mt-1">
            Configuración de políticas de retención y archivado automático
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runCleanup}
            disabled={runningCleanup}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
          >
            {runningCleanup ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Ejecutando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Ejecutar Limpieza
              </>
            )}
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingPolicy(null);
              resetForm();
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
          >
            <Settings className="h-4 w-4 mr-2" />
            Nueva Política
          </button>
        </div>
      </div>

      {/* Resumen de Retención */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Políticas Activas</p>
              <p className="text-2xl font-bold text-blue-900">
                {policies.filter(p => p.is_active).length}
              </p>
            </div>
            <Settings className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Registros Archivados</p>
              <p className="text-2xl font-bold text-green-900">
                {policies.reduce((sum, p) => sum + p.records_archived, 0).toLocaleString()}
              </p>
            </div>
            <Archive className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Registros Eliminados</p>
              <p className="text-2xl font-bold text-red-900">
                {policies.reduce((sum, p) => sum + p.records_deleted, 0).toLocaleString()}
              </p>
            </div>
            <Trash2 className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Espacio Liberado</p>
              <p className="text-2xl font-bold text-purple-900">
                {((policies.reduce((sum, p) => sum + p.records_deleted, 0) * 0.5) / 1024).toFixed(1)} MB
              </p>
            </div>
            <HardDrive className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Resultados de Limpieza Reciente */}
      {cleanupResults.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-slate-200">
            <h4 className="text-lg font-semibold text-slate-900">Última Limpieza Ejecutada</h4>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cleanupResults.map((result, index) => (
                <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h5 className="font-medium text-green-900 mb-2">
                    {getTableDisplayName(result.table_name)}
                  </h5>
                  <div className="space-y-1 text-sm text-green-800">
                    <p>Archivados: {result.records_archived.toLocaleString()}</p>
                    <p>Eliminados: {result.records_deleted.toLocaleString()}</p>
                    <p>Fecha: {new Date(result.cleanup_date).toLocaleDateString('es-ES')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lista de Políticas */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <h4 className="text-lg font-semibold text-slate-900">Políticas de Retención</h4>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Cargando políticas...</p>
            </div>
          ) : policies.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No hay políticas de retención configuradas</p>
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditingPolicy(null);
                  resetForm();
                }}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Crear Primera Política
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Tabla</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Retención</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Archivado</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Estadísticas</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Última Limpieza</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Estado</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {policies.map((policy) => (
                    <tr key={policy.id} className="hover:bg-slate-50 transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900">
                            {getTableDisplayName(policy.table_name)}
                          </p>
                          <p className="text-sm text-slate-600 font-mono">{policy.table_name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-blue-600 mr-2" />
                          <span className="font-medium text-slate-900">
                            {policy.retention_period_days} días
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {policy.archive_before_delete ? (
                            <>
                              <Archive className="h-4 w-4 text-green-600 mr-2" />
                              <div>
                                <p className="text-sm font-medium text-green-900">Sí</p>
                                {policy.archive_table_name && (
                                  <p className="text-xs text-green-700 font-mono">
                                    {policy.archive_table_name}
                                  </p>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 text-red-600 mr-2" />
                              <span className="text-sm text-red-900">Eliminación directa</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="text-slate-900">
                            <span className="text-green-600">Archivados:</span> {policy.records_archived.toLocaleString()}
                          </p>
                          <p className="text-slate-900">
                            <span className="text-red-600">Eliminados:</span> {policy.records_deleted.toLocaleString()}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {policy.last_cleanup_at ? (
                            <>
                              <p className="text-slate-900">
                                {new Date(policy.last_cleanup_at).toLocaleDateString('es-ES')}
                              </p>
                              <p className="text-slate-600">
                                Próxima: {calculateNextCleanup(policy)}
                              </p>
                            </>
                          ) : (
                            <span className="text-slate-500">Nunca ejecutada</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => togglePolicyStatus(policy.id, policy.is_active)}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                            policy.is_active
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {policy.is_active ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Activa
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              Inactiva
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(policy)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="Editar política"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(policy.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Eliminar política"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Formulario de Política */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4">
            {editingPolicy ? 'Editar Política de Retención' : 'Nueva Política de Retención'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tabla de Base de Datos *
                </label>
                <select
                  value={formData.table_name}
                  onChange={(e) => setFormData({ ...formData, table_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccionar tabla</option>
                  <option value="cash_register_audit_logs">Logs de Auditoría de Caja</option>
                  <option value="cash_register_enhanced_audit">Auditoría Mejorada de Caja</option>
                  <option value="audit_reports">Reportes de Auditoría</option>
                  <option value="audit_alerts">Alertas de Auditoría</option>
                  <option value="employee_sessions">Sesiones de Empleados</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Período de Retención (días) *
                </label>
                <input
                  type="number"
                  value={formData.retention_period_days}
                  onChange={(e) => setFormData({ ...formData, retention_period_days: parseInt(e.target.value) || 365 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  max="3650"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Datos más antiguos que este período serán procesados
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="archive_before_delete"
                  checked={formData.archive_before_delete}
                  onChange={(e) => setFormData({ ...formData, archive_before_delete: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                />
                <label htmlFor="archive_before_delete" className="ml-2 text-sm text-slate-700">
                  Archivar antes de eliminar (recomendado)
                </label>
              </div>

              {formData.archive_before_delete && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre de Tabla de Archivo
                  </label>
                  <input
                    type="text"
                    value={formData.archive_table_name}
                    onChange={(e) => setFormData({ ...formData, archive_table_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`${formData.table_name}_archive`}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Si se deja vacío, se usará el nombre de la tabla + "_archive"
                  </p>
                </div>
              )}
            </div>

            {isDemoMode && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-yellow-600 mr-2" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Modo Demo</h4>
                    <p className="text-sm text-yellow-800">
                      La política se guardará localmente para demostración.
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
                  setEditingPolicy(null);
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
                {editingPolicy ? 'Actualizar' : 'Crear'} Política
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Información sobre Retención de Datos */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-slate-900 mb-4">Información sobre Retención de Datos</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="font-medium text-slate-900 mb-3">Beneficios del Archivado</h5>
            <ul className="text-sm text-slate-700 space-y-2">
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Mantiene el rendimiento de la base de datos
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Preserva datos históricos importantes
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Cumple con regulaciones de retención
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Reduce el tamaño de backups
              </li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium text-slate-900 mb-3">Recomendaciones</h5>
            <ul className="text-sm text-slate-700 space-y-2">
              <li className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                Logs de auditoría: 1-2 años
              </li>
              <li className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                Reportes: 3 años mínimo
              </li>
              <li className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                Sesiones: 30-90 días
              </li>
              <li className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                Siempre archivar antes de eliminar
              </li>
            </ul>
          </div>
        </div>
      </div>

      {isDemoMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3" />
            <div>
              <h4 className="font-medium text-yellow-900">Modo Demo Activo</h4>
              <p className="text-sm text-yellow-800 mt-1">
                Las políticas de retención se simularán. Para usar el sistema completo, 
                configura las variables de entorno de Supabase y conecta una base de datos real.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}