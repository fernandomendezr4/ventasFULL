import React, { useState } from 'react';
import { Download, Calendar, Filter, FileText, X, Settings, CheckCircle } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AuditReportGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onReportGenerated: () => void;
}

export default function AuditReportGenerator({ 
  isOpen, 
  onClose, 
  onReportGenerated 
}: AuditReportGeneratorProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportConfig, setReportConfig] = useState({
    report_type: 'custom',
    report_name: '',
    date_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    entities_included: [] as string[],
    action_types_included: [] as string[],
    include_user_details: true,
    include_metadata: true,
    include_ip_addresses: false,
    format: 'json'
  });

  const availableEntities = [
    { id: 'cash_register', name: 'Cajas Registradoras', description: 'Operaciones de caja' },
    { id: 'sale', name: 'Ventas', description: 'Transacciones de venta' },
    { id: 'movement', name: 'Movimientos', description: 'Ingresos y gastos' },
    { id: 'installment', name: 'Abonos', description: 'Pagos a plazos' },
    { id: 'product', name: 'Productos', description: 'Gestión de inventario' },
    { id: 'customer', name: 'Clientes', description: 'Información de clientes' }
  ];

  const actionTypes = [
    { id: 'open', name: 'Apertura', description: 'Apertura de cajas' },
    { id: 'close', name: 'Cierre', description: 'Cierre de cajas' },
    { id: 'sale', name: 'Venta', description: 'Transacciones de venta' },
    { id: 'installment', name: 'Abono', description: 'Pagos a plazos' },
    { id: 'income', name: 'Ingreso', description: 'Ingresos adicionales' },
    { id: 'expense', name: 'Gasto', description: 'Gastos registrados' },
    { id: 'edit', name: 'Edición', description: 'Modificaciones' },
    { id: 'delete', name: 'Eliminación', description: 'Registros eliminados' }
  ];

  if (!isOpen) return null;

  const handleGenerateReport = async () => {
    if (!reportConfig.report_name.trim()) {
      alert('Debe ingresar un nombre para el reporte');
      return;
    }

    if (new Date(reportConfig.date_from) > new Date(reportConfig.date_to)) {
      alert('La fecha de inicio debe ser anterior a la fecha de fin');
      return;
    }

    try {
      setLoading(true);

      if (isDemoMode) {
        // Generar reporte demo
        const reportData = {
          id: `demo-report-${Date.now()}`,
          report_name: reportConfig.report_name,
          report_type: reportConfig.report_type,
          date_from: reportConfig.date_from,
          date_to: reportConfig.date_to,
          entities_included: reportConfig.entities_included,
          action_types_included: reportConfig.action_types_included,
          total_events: 25,
          events_by_type: {
            'open': 5,
            'close': 5,
            'sale': 10,
            'income': 3,
            'expense': 2
          },
          events_by_entity: {
            'cash_register': 10,
            'sale': 10,
            'movement': 5
          },
          generated_at: new Date().toISOString(),
          generated_by: user?.name || 'Usuario Demo',
          format: reportConfig.format,
          demo_mode: true
        };

        // Descargar reporte
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
          type: reportConfig.format === 'json' ? 'application/json' : 'text/csv' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportConfig.report_name.replace(/\s+/g, '_')}_${reportConfig.date_from}_${reportConfig.date_to}.${reportConfig.format}`;
        a.click();
        URL.revokeObjectURL(url);

        alert('Reporte generado y descargado exitosamente (modo demo)');
        onReportGenerated();
        onClose();
        return;
      }

      // Intentar usar función RPC
      const { data, error } = await supabase
        .rpc('generate_audit_report', {
          p_report_type: reportConfig.report_type,
          p_date_from: reportConfig.date_from + 'T00:00:00Z',
          p_date_to: reportConfig.date_to + 'T23:59:59Z'
        });

      if (error) {
        console.error('Error with RPC, generating manual report:', error);
        await generateManualReport();
        return;
      }

      alert('Reporte generado exitosamente. ID: ' + data);
      onReportGenerated();
      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar reporte: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const generateManualReport = async () => {
    try {
      // Obtener datos de auditoría manualmente
      let query = supabase
        .from('cash_register_audit_logs')
        .select(`
          *,
          performed_by_user:users(name, email)
        `)
        .gte('performed_at', reportConfig.date_from + 'T00:00:00Z')
        .lte('performed_at', reportConfig.date_to + 'T23:59:59Z');

      // Aplicar filtros
      if (reportConfig.entities_included.length > 0) {
        query = query.in('entity_type', reportConfig.entities_included);
      }

      if (reportConfig.action_types_included.length > 0) {
        query = query.in('action_type', reportConfig.action_types_included);
      }

      const { data: auditData, error } = await query
        .order('performed_at', { ascending: false });

      if (error) throw error;

      // Procesar datos para el reporte
      const reportData = {
        report_name: reportConfig.report_name,
        report_type: reportConfig.report_type,
        date_from: reportConfig.date_from,
        date_to: reportConfig.date_to,
        total_events: auditData?.length || 0,
        events_by_type: (auditData || []).reduce((acc, log) => {
          acc[log.action_type] = (acc[log.action_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        events_by_entity: (auditData || []).reduce((acc, log) => {
          acc[log.entity_type] = (acc[log.entity_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        unique_users: new Set((auditData || []).map(log => log.performed_by)).size,
        events: reportConfig.include_metadata ? auditData : (auditData || []).map(log => ({
          id: log.id,
          action_type: log.action_type,
          entity_type: log.entity_type,
          description: log.description,
          amount: log.amount,
          performed_at: log.performed_at,
          performed_by: reportConfig.include_user_details ? log.performed_by_user?.name : 'Usuario',
          ip_address: reportConfig.include_ip_addresses ? log.ip_address : undefined
        })),
        generated_at: new Date().toISOString(),
        generated_by: user?.name || 'Sistema'
      };

      // Generar archivo según formato
      let blob: Blob;
      let filename: string;

      if (reportConfig.format === 'csv') {
        const csvContent = generateCSVContent(reportData);
        blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        filename = `${reportConfig.report_name.replace(/\s+/g, '_')}_${reportConfig.date_from}_${reportConfig.date_to}.csv`;
      } else {
        blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        filename = `${reportConfig.report_name.replace(/\s+/g, '_')}_${reportConfig.date_from}_${reportConfig.date_to}.json`;
      }

      // Descargar archivo
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      alert('Reporte generado y descargado exitosamente');
      onReportGenerated();
      onClose();
    } catch (error) {
      console.error('Error generating manual report:', error);
      alert('Error al generar reporte manual: ' + (error as Error).message);
    }
  };

  const generateCSVContent = (reportData: any): string => {
    const headers = [
      'Fecha',
      'Hora',
      'Acción',
      'Entidad',
      'Descripción',
      'Monto',
      'Usuario',
      'IP'
    ];

    const rows = reportData.events.map((event: any) => [
      new Date(event.performed_at).toLocaleDateString('es-ES'),
      new Date(event.performed_at).toLocaleTimeString('es-ES'),
      event.action_type,
      event.entity_type,
      `"${event.description}"`,
      event.amount || 0,
      event.performed_by || 'Sistema',
      event.ip_address || 'N/A'
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  const toggleEntitySelection = (entityId: string) => {
    setReportConfig(prev => ({
      ...prev,
      entities_included: prev.entities_included.includes(entityId)
        ? prev.entities_included.filter(id => id !== entityId)
        : [...prev.entities_included, entityId]
    }));
  };

  const toggleActionTypeSelection = (actionType: string) => {
    setReportConfig(prev => ({
      ...prev,
      action_types_included: prev.action_types_included.includes(actionType)
        ? prev.action_types_included.filter(type => type !== actionType)
        : [...prev.action_types_included, actionType]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900 flex items-center">
              <FileText className="h-6 w-6 mr-3 text-green-600" />
              Generador de Reportes de Auditoría
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Configuración Básica */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-4">Configuración Básica</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre del Reporte *
                  </label>
                  <input
                    type="text"
                    value={reportConfig.report_name}
                    onChange={(e) => setReportConfig({ ...reportConfig, report_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Reporte de Auditoría Semanal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo de Reporte
                  </label>
                  <select
                    value={reportConfig.report_type}
                    onChange={(e) => setReportConfig({ ...reportConfig, report_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="custom">Personalizado</option>
                    <option value="security">Seguridad</option>
                    <option value="compliance">Cumplimiento</option>
                    <option value="performance">Rendimiento</option>
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="date"
                    value={reportConfig.date_from}
                    onChange={(e) => setReportConfig({ ...reportConfig, date_from: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fecha de Fin *
                  </label>
                  <input
                    type="date"
                    value={reportConfig.date_to}
                    onChange={(e) => setReportConfig({ ...reportConfig, date_to: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Selección de Entidades */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-4">Entidades a Incluir</h4>
              <p className="text-sm text-slate-600 mb-3">
                Selecciona las entidades que deseas incluir en el reporte (vacío = todas)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableEntities.map((entity) => (
                  <div key={entity.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`entity_${entity.id}`}
                      checked={reportConfig.entities_included.includes(entity.id)}
                      onChange={() => toggleEntitySelection(entity.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <label htmlFor={`entity_${entity.id}`} className="ml-2 text-sm">
                      <span className="font-medium text-slate-900">{entity.name}</span>
                      <span className="text-slate-600 block text-xs">{entity.description}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Tipos de Acciones */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-4">Tipos de Acciones</h4>
              <p className="text-sm text-slate-600 mb-3">
                Selecciona los tipos de acciones a incluir (vacío = todas)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {actionTypes.map((actionType) => (
                  <div key={actionType.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`action_${actionType.id}`}
                      checked={reportConfig.action_types_included.includes(actionType.id)}
                      onChange={() => toggleActionTypeSelection(actionType.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <label htmlFor={`action_${actionType.id}`} className="ml-2 text-sm">
                      <span className="font-medium text-slate-900">{actionType.name}</span>
                      <span className="text-slate-600 block text-xs">{actionType.description}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Opciones Avanzadas */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-4">Opciones Avanzadas</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="include_user_details"
                    checked={reportConfig.include_user_details}
                    onChange={(e) => setReportConfig({ ...reportConfig, include_user_details: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor="include_user_details" className="ml-2 text-sm text-slate-700">
                    Incluir detalles completos del usuario
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="include_metadata"
                    checked={reportConfig.include_metadata}
                    onChange={(e) => setReportConfig({ ...reportConfig, include_metadata: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor="include_metadata" className="ml-2 text-sm text-slate-700">
                    Incluir metadatos de eventos
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="include_ip_addresses"
                    checked={reportConfig.include_ip_addresses}
                    onChange={(e) => setReportConfig({ ...reportConfig, include_ip_addresses: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor="include_ip_addresses" className="ml-2 text-sm text-slate-700">
                    Incluir direcciones IP (datos sensibles)
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Formato del Reporte
                </label>
                <select
                  value={reportConfig.format}
                  onChange={(e) => setReportConfig({ ...reportConfig, format: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="json">JSON (Datos estructurados)</option>
                  <option value="csv">CSV (Hoja de cálculo)</option>
                </select>
              </div>
            </div>

            {/* Resumen de Configuración */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3">Resumen de Configuración</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Período:</span>
                  <span className="ml-2 font-medium text-blue-900">
                    {new Date(reportConfig.date_from).toLocaleDateString('es-ES')} - 
                    {new Date(reportConfig.date_to).toLocaleDateString('es-ES')}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Entidades:</span>
                  <span className="ml-2 font-medium text-blue-900">
                    {reportConfig.entities_included.length === 0 ? 'Todas' : reportConfig.entities_included.length}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Acciones:</span>
                  <span className="ml-2 font-medium text-blue-900">
                    {reportConfig.action_types_included.length === 0 ? 'Todas' : reportConfig.action_types_included.length}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Formato:</span>
                  <span className="ml-2 font-medium text-blue-900">{reportConfig.format.toUpperCase()}</span>
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
                      El reporte se generará con datos de demostración y se descargará automáticamente.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors duration-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={loading || !reportConfig.report_name.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generar Reporte
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}