import React, { useState, useEffect } from 'react';
import { Database, AlertTriangle, CheckCircle, RefreshCw, Zap, Activity, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  runDatabaseMaintenance, 
  checkDatabaseIntegrity, 
  refreshViews,
  clearQueryCache 
} from '../lib/optimizedQueries';

interface DatabaseIssue {
  table_name: string;
  issue_type: string;
  issue_description: string;
  suggested_action: string;
}

export default function DatabaseHealthMonitor() {
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'issues' | 'error'>('checking');
  const [issues, setIssues] = useState<DatabaseIssue[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [maintenanceLog, setMaintenanceLog] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkHealth();
    
    // Verificar salud cada 5 minutos
    const interval = setInterval(checkHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      setHealthStatus('checking');
      
      const healthData = await checkDatabaseIntegrity();
      setIssues(healthData);
      setLastCheck(new Date());
      
      // Determinar estado de salud
      const hasIssues = healthData.some(issue => 
        issue.issue_type !== 'healthy' && 
        !issue.issue_description.includes('buen estado')
      );
      
      setHealthStatus(hasIssues ? 'issues' : 'healthy');
    } catch (error) {
      console.error('Error checking database health:', error);
      setHealthStatus('error');
    }
  };

  const runMaintenance = async () => {
    try {
      setLoading(true);
      const result = await runDatabaseMaintenance();
      setMaintenanceLog(result);
      
      // Verificar salud después del mantenimiento
      await checkHealth();
      
      alert('Mantenimiento completado exitosamente');
    } catch (error) {
      console.error('Error running maintenance:', error);
      alert('Error en mantenimiento: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const refreshMaterializedViews = async () => {
    try {
      setLoading(true);
      const result = await refreshViews();
      alert('Vistas actualizadas: ' + result);
    } catch (error) {
      console.error('Error refreshing views:', error);
      alert('Error al actualizar vistas: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = () => {
    clearQueryCache();
    alert('Cache limpiado exitosamente');
  };

  const getStatusColor = () => {
    switch (healthStatus) {
      case 'healthy':
        return 'text-green-600';
      case 'issues':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  const getStatusIcon = () => {
    switch (healthStatus) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'issues':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (healthStatus) {
      case 'healthy':
        return 'Base de datos saludable';
      case 'issues':
        return `${issues.length} problema(s) detectado(s)`;
      case 'error':
        return 'Error al verificar estado';
      default:
        return 'Verificando estado...';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Database className="h-6 w-6 text-blue-600 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Estado de la Base de Datos</h3>
            <div className="flex items-center mt-1">
              {getStatusIcon()}
              <span className={`ml-2 text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={checkHealth}
            disabled={loading || healthStatus === 'checking'}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center text-sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${healthStatus === 'checking' ? 'animate-spin' : ''}`} />
            Verificar
          </button>
          
          <button
            onClick={runMaintenance}
            disabled={loading}
            className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200 flex items-center text-sm"
          >
            <Zap className="h-4 w-4 mr-2" />
            Mantenimiento
          </button>
        </div>
      </div>

      {/* Estado de Salud */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`p-4 rounded-lg border-2 ${
          healthStatus === 'healthy' 
            ? 'bg-green-50 border-green-200' 
            : healthStatus === 'issues'
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Estado General</p>
              <p className={`text-lg font-bold ${getStatusColor()}`}>
                {healthStatus === 'healthy' ? 'Saludable' : 
                 healthStatus === 'issues' ? 'Con Problemas' : 
                 healthStatus === 'error' ? 'Error' : 'Verificando'}
              </p>
            </div>
            {getStatusIcon()}
          </div>
        </div>

        <div className="p-4 rounded-lg border-2 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Última Verificación</p>
              <p className="text-lg font-bold text-blue-900">
                {lastCheck ? lastCheck.toLocaleTimeString('es-ES', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                }) : 'Nunca'}
              </p>
            </div>
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
        </div>

        <div className="p-4 rounded-lg border-2 bg-purple-50 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Problemas</p>
              <p className="text-lg font-bold text-purple-900">
                {issues.filter(i => i.issue_type !== 'healthy').length}
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Problemas Detectados */}
      {issues.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-slate-900 mb-3">Detalles del Estado</h4>
          <div className="space-y-3">
            {issues.map((issue, index) => (
              <div 
                key={index} 
                className={`p-4 rounded-lg border ${
                  issue.issue_type === 'healthy' 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-slate-900 capitalize">
                      {(issue.table_name || 'Sistema').replace(/_/g, ' ')}
                    </h5>
                    <p className="text-sm text-slate-600 mt-1">
                      {issue.issue_description}
                    </p>
                    {issue.suggested_action !== 'Ninguna acción requerida' && (
                      <p className="text-xs text-slate-500 mt-2">
                        <strong>Acción sugerida:</strong> {issue.suggested_action}
                      </p>
                    )}
                  </div>
                  <div className="ml-4">
                    {issue.issue_type === 'healthy' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acciones de Mantenimiento */}
      <div className="border-t border-slate-200 pt-6">
        <h4 className="font-medium text-slate-900 mb-3">Acciones de Mantenimiento</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={refreshMaterializedViews}
            disabled={loading}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors duration-200 flex items-center justify-center text-sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar Vistas
          </button>
          
          <button
            onClick={clearCache}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center justify-center text-sm"
          >
            <Zap className="h-4 w-4 mr-2" />
            Limpiar Cache
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors duration-200 flex items-center justify-center text-sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Recargar App
          </button>
        </div>
      </div>

      {/* Log de Mantenimiento */}
      {maintenanceLog && (
        <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h5 className="font-medium text-slate-900 mb-2">Último Mantenimiento</h5>
          <p className="text-sm text-slate-600 font-mono">{maintenanceLog}</p>
        </div>
      )}

      {/* Información de Rendimiento */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h5 className="font-medium text-blue-900 mb-2">Optimizaciones Activas</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-800">
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Vistas materializadas para dashboard
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Índices compuestos optimizados
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Cache de consultas en memoria
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Limpieza automática de sesiones
          </div>
        </div>
      </div>
    </div>
  );
}