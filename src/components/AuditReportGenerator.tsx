import React, { useState } from 'react';
import { Download, Calendar, Filter, FileText, X, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
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
    tables_included: [] as string[],
    event_types_included: [] as string[],
    severity_filter: [] as string[],
    include_user_details: true,
    include_change_details: true,
    include_ip_addresses: false,
    format: 'json'
  });

  const availableTables = [
    { id: 'users', name: 'Usuarios', description: 'Gestión de usuarios y roles' },
    { id: 'sales', name: 'Ventas', description: 'Transacciones de venta' },
    { id: 'products', name: 'Productos', description: 'Inventario y productos' },
    { id: 'customers', name: 'Clientes', description: 'Información de clientes' },
    { id: 'cash_registers', name: 'Cajas', description: 'Cajas registradoras' },
    { id: 'categories', name: 'Categorías', description: 'Categorías de productos' },
    { id: 'suppliers', name: 'Proveedores', description: 'Información de proveedores' },
    { id: 'payment_installments', name: 'Abonos', description: 'Pagos a plazos' }
  ];

  const eventTypes = [
    { id: 'INSERT', name: 'Creación', description: 'Nuevos registros' },
    { id: 'UPDATE', name: 'Modificación', description: 'Cambios en registros' },
    { id: 'DELETE', name: 'Eliminación', description: 'Registros eliminados' },
    { id: 'LOGIN', name: 'Inicio de Sesión', description: 'Accesos al sistema' },
    { id: 'LOGOUT', name: 'Cierre de Sesión', description: 'Salidas del sistema' }
  ];

  const severityLevels = [
    { id: 'critical', name: 'Crítica', color: 'text-red-600' },
    { id: 'high', name: 'Alta', color: 'text-orange-600' },
    { id: 'normal', name: 'Normal', color: 'text-blue-600' },
    { id: 'low', name: 'Baja', color: 'text-gray-600' }
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

      const { data, error } = await supabase
        .rpc('generate_audit_report', {
          p_report_type: reportConfig.report_type,
          p_date_from: reportConfig.date_from + 'T00:00:00Z',
          p_date_to: reportConfig.date_to + 'T23:59:59Z',
          p_tables: reportConfig.tables_included.length > 0 ? reportConfig.tables_included : null,
          p_event_types: reportConfig.event_types_included.length > 0 ? reportConfig.event_types_included : null
        });

      if (error) throw error;

      // Actualizar el reporte con configuraciones adicionales
      const { error: updateError } = await supabase
        .from('audit_reports')
        .update({
          report_name: reportConfig.report_name,
          report_format: reportConfig.format,
          severity_filter: reportConfig.severity_filter,
          custom_filters: {
            include_user_details: reportConfig.include_user_details,
            include_change_details: reportConfig.include_change_details,
            include_ip_addresses: reportConfig.include_ip_addresses
          }
        })
        .eq('id', data);

      if (updateError) throw updateError;

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

  const toggleTableSelection = (tableId: string) => {
    setReportConfig(prev => ({
      ...prev,
      tables_included: prev.tables_included.includes(tableId)
        ? prev.tables_included.filter(id => id !== tableId)
        : [...prev.tables_included, tableId]
    }));
  };

  const toggleEventTypeSelection = (eventType: string) => {
    setReportConfig(prev => ({
      ...prev,
      event_types_included: prev.event_types_included.includes(eventType)
        ? prev.event_types_included.filter(type => type !== eventType)
        : [...prev.event_types_included, eventType]
    }));
  };

  const toggleSeveritySelection = (severity: string) => {
    setReportConfig(prev => ({
      ...prev,
      severity_filter: prev.severity_filter.includes(severity)
        ? prev.severity_filter.filter(s => s !== severity)
        : [...prev.severity_filter, severity]
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
                    placeholder="Ej: Reporte de Seguridad Semanal"
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

            {/* Selección de Tablas */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-4">Tablas a Incluir</h4>
              <p className="text-sm text-slate-600 mb-3">
                Selecciona las tablas que deseas incluir en el reporte (vacío = todas)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableTables.map((table) => (
                  <div key={table.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`table_${table.id}`}
                      checked={reportConfig.tables_included.includes(table.id)}
                      onChange={() => toggleTableSelection(table.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <label htmlFor={`table_${table.id}`} className="ml-2 text-sm">
                      <span className="font-medium text-slate-900">{table.name}</span>
                      <span className="text-slate-600 block text-xs">{table.description}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Tipos de Eventos */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-4">Tipos de Eventos</h4>
              <p className="text-sm text-slate-600 mb-3">
                Selecciona los tipos de eventos a incluir (vacío = todos)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {eventTypes.map((eventType) => (
                  <div key={eventType.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`event_${eventType.id}`}
                      checked={reportConfig.event_types_included.includes(eventType.id)}
                      onChange={() => toggleEventTypeSelection(eventType.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <label htmlFor={`event_${eventType.id}`} className="ml-2 text-sm">
                      <span className="font-medium text-slate-900">{eventType.name}</span>
                      <span className="text-slate-600 block text-xs">{eventType.description}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Niveles de Severidad */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-4">Niveles de Severidad</h4>
              <p className="text-sm text-slate-600 mb-3">
                Filtra por nivel de severidad (vacío = todos)
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {severityLevels.map((severity) => (
                  <div key={severity.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`severity_${severity.id}`}
                      checked={reportConfig.severity_filter.includes(severity.id)}
                      onChange={() => toggleSeveritySelection(severity.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <label htmlFor={`severity_${severity.id}`} className={`ml-2 text-sm font-medium ${severity.color}`}>
                      {severity.name}
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
                    id="include_change_details"
                    checked={reportConfig.include_change_details}
                    onChange={(e) => setReportConfig({ ...reportConfig, include_change_details: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor="include_change_details" className="ml-2 text-sm text-slate-700">
                    Incluir valores anteriores y nuevos
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
                  <option value="html">HTML (Reporte visual)</option>
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
                  <span className="text-blue-700">Tablas:</span>
                  <span className="ml-2 font-medium text-blue-900">
                    {reportConfig.tables_included.length === 0 ? 'Todas' : reportConfig.tables_included.length}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Eventos:</span>
                  <span className="ml-2 font-medium text-blue-900">
                    {reportConfig.event_types_included.length === 0 ? 'Todos' : reportConfig.event_types_included.length}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Formato:</span>
                  <span className="ml-2 font-medium text-blue-900">{reportConfig.format.toUpperCase()}</span>
                </div>
              </div>
            </div>
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