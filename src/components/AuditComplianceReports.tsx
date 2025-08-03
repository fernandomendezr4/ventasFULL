import React, { useState, useEffect } from 'react';
import { Shield, FileText, Download, Calendar, Filter, Eye, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';

interface ComplianceReport {
  id: string;
  report_name: string;
  report_type: string;
  compliance_framework: string;
  date_from: string;
  date_to: string;
  total_events: number;
  critical_events: number;
  compliance_score: number;
  violations_found: number;
  recommendations: string[];
  generated_at: string;
  status: string;
}

interface ComplianceViolation {
  id: string;
  violation_type: string;
  severity: string;
  table_name: string;
  description: string;
  detected_at: string;
  user_involved: string;
  remediation_status: string;
  business_impact: string;
}

export default function AuditComplianceReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [violations, setViolations] = useState<ComplianceViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ComplianceReport | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatorConfig, setGeneratorConfig] = useState({
    framework: 'SOX',
    date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    include_recommendations: true,
    include_remediation_plan: true,
    detailed_analysis: true
  });

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    try {
      setLoading(true);
      
      // Cargar reportes de compliance existentes
      const { data: reportsData, error: reportsError } = await supabase
        .from('audit_reports')
        .select('*')
        .eq('report_type', 'compliance')
        .order('generated_at', { ascending: false })
        .limit(20);

      if (reportsError) throw reportsError;

      // Simular datos de violaciones para demo
      const mockViolations: ComplianceViolation[] = [
        {
          id: '1',
          violation_type: 'Unauthorized Data Access',
          severity: 'high',
          table_name: 'customers',
          description: 'Acceso a datos de clientes fuera del horario laboral',
          detected_at: new Date().toISOString(),
          user_involved: 'usuario@empresa.com',
          remediation_status: 'pending',
          business_impact: 'Posible violación de privacidad de datos'
        },
        {
          id: '2',
          violation_type: 'Bulk Data Modification',
          severity: 'critical',
          table_name: 'sales',
          description: 'Modificación masiva de datos de ventas sin autorización',
          detected_at: new Date(Date.now() - 86400000).toISOString(),
          user_involved: 'admin@empresa.com',
          remediation_status: 'resolved',
          business_impact: 'Integridad de datos financieros comprometida'
        }
      ];

      setReports(reportsData || []);
      setViolations(mockViolations);
    } catch (error) {
      console.error('Error loading compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateComplianceReport = async () => {
    try {
      setLoading(true);

      // Generar reporte de compliance personalizado
      const { data, error } = await supabase
        .rpc('generate_audit_report', {
          p_report_type: 'compliance',
          p_date_from: generatorConfig.date_from + 'T00:00:00Z',
          p_date_to: generatorConfig.date_to + 'T23:59:59Z'
        });

      if (error) throw error;

      // Actualizar con configuraciones específicas de compliance
      const { error: updateError } = await supabase
        .from('audit_reports')
        .update({
          report_name: `Reporte de Cumplimiento ${generatorConfig.framework} - ${new Date().toLocaleDateString('es-ES')}`,
          custom_filters: {
            compliance_framework: generatorConfig.framework,
            include_recommendations: generatorConfig.include_recommendations,
            include_remediation_plan: generatorConfig.include_remediation_plan,
            detailed_analysis: generatorConfig.detailed_analysis
          }
        })
        .eq('id', data);

      if (updateError) throw updateError;

      alert('Reporte de cumplimiento generado exitosamente');
      setShowGenerator(false);
      loadComplianceData();
    } catch (error) {
      console.error('Error generating compliance report:', error);
      alert('Error al generar reporte: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getViolationSeverityColor = (severity: string) => {
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

  const getComplianceScore = (report: ComplianceReport) => {
    // Calcular score basado en eventos críticos vs totales
    if (report.total_events === 0) return 100;
    const score = Math.max(0, 100 - (report.critical_events / report.total_events) * 100);
    return Math.round(score);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 flex items-center">
            <Shield className="h-7 w-7 mr-3 text-blue-600" />
            Reportes de Cumplimiento
          </h3>
          <p className="text-slate-600 mt-1">
            Análisis de cumplimiento normativo y detección de violaciones
          </p>
        </div>
        <button
          onClick={() => setShowGenerator(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
        >
          <FileText className="h-4 w-4 mr-2" />
          Nuevo Reporte
        </button>
      </div>

      {/* Resumen de Cumplimiento */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Score de Cumplimiento</p>
              <p className="text-2xl font-bold text-green-900">
                {reports.length > 0 ? getComplianceScore(reports[0]) : 95}%
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Violaciones Activas</p>
              <p className="text-2xl font-bold text-red-900">
                {violations.filter(v => v.remediation_status === 'pending').length}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Reportes Generados</p>
              <p className="text-2xl font-bold text-blue-900">{reports.length}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Frameworks</p>
              <p className="text-2xl font-bold text-purple-900">3</p>
              <p className="text-xs text-purple-700">SOX, GDPR, ISO27001</p>
            </div>
            <Shield className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Violaciones Recientes */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <h4 className="text-lg font-semibold text-slate-900">Violaciones de Cumplimiento</h4>
        </div>
        <div className="p-6">
          {violations.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <p className="text-green-600 font-medium">No se detectaron violaciones</p>
              <p className="text-sm text-slate-600 mt-1">El sistema cumple con las políticas establecidas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {violations.map((violation) => (
                <div key={violation.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h5 className="font-semibold text-slate-900">{violation.violation_type}</h5>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getViolationSeverityColor(violation.severity)}`}>
                          {violation.severity}
                        </span>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          violation.remediation_status === 'resolved' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {violation.remediation_status === 'resolved' ? 'Resuelto' : 'Pendiente'}
                        </span>
                      </div>
                      
                      <p className="text-slate-700 mb-2">{violation.description}</p>
                      <p className="text-sm text-slate-600 mb-2">
                        <strong>Impacto:</strong> {violation.business_impact}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span>Tabla: {violation.table_name}</span>
                        <span>Usuario: {violation.user_involved}</span>
                        <span>Detectado: {new Date(violation.detected_at).toLocaleDateString('es-ES')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reportes Históricos */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <h4 className="text-lg font-semibold text-slate-900">Reportes de Cumplimiento Históricos</h4>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Cargando reportes...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No hay reportes de cumplimiento generados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Reporte</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Framework</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Período</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Score</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Eventos</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Estado</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900">{report.report_name}</p>
                          <p className="text-sm text-slate-600">
                            {new Date(report.generated_at).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {report.compliance_framework || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p>{new Date(report.date_from).toLocaleDateString('es-ES')}</p>
                          <p className="text-slate-500">a {new Date(report.date_to).toLocaleDateString('es-ES')}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className={`text-lg font-bold ${getScoreColor(getComplianceScore(report))}`}>
                            {getComplianceScore(report)}%
                          </span>
                          {getComplianceScore(report) >= 90 ? (
                            <CheckCircle className="h-4 w-4 ml-2 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 ml-2 text-yellow-600" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="font-medium">{report.total_events} total</p>
                          <p className="text-red-600">{report.critical_events} críticos</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          report.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {report.status === 'completed' ? 'Completado' : 'Procesando'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedReport(report)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              // Simular descarga del reporte
                              const reportData = {
                                ...report,
                                generated_by: user?.name,
                                compliance_details: {
                                  framework: report.compliance_framework || 'General',
                                  score: getComplianceScore(report),
                                  violations: violations.filter(v => v.remediation_status === 'pending').length,
                                  recommendations: [
                                    'Implementar controles adicionales de acceso',
                                    'Revisar políticas de retención de datos',
                                    'Capacitar usuarios en mejores prácticas'
                                  ]
                                }
                              };
                              
                              const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `compliance_report_${report.id}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                            title="Descargar reporte"
                          >
                            <Download className="h-4 w-4" />
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

      {/* Generador de Reportes Modal */}
      {showGenerator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Generar Reporte de Cumplimiento</h3>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Framework de Cumplimiento
                  </label>
                  <select
                    value={generatorConfig.framework}
                    onChange={(e) => setGeneratorConfig({ ...generatorConfig, framework: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="SOX">Sarbanes-Oxley (SOX)</option>
                    <option value="GDPR">GDPR - Protección de Datos</option>
                    <option value="ISO27001">ISO 27001 - Seguridad</option>
                    <option value="PCI_DSS">PCI DSS - Pagos</option>
                    <option value="HIPAA">HIPAA - Salud</option>
                    <option value="Custom">Personalizado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    value={generatorConfig.date_from}
                    onChange={(e) => setGeneratorConfig({ ...generatorConfig, date_from: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fecha de Fin
                  </label>
                  <input
                    type="date"
                    value={generatorConfig.date_to}
                    onChange={(e) => setGeneratorConfig({ ...generatorConfig, date_to: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="include_recommendations"
                    checked={generatorConfig.include_recommendations}
                    onChange={(e) => setGeneratorConfig({ ...generatorConfig, include_recommendations: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor="include_recommendations" className="ml-2 text-sm text-slate-700">
                    Incluir recomendaciones de mejora
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="include_remediation_plan"
                    checked={generatorConfig.include_remediation_plan}
                    onChange={(e) => setGeneratorConfig({ ...generatorConfig, include_remediation_plan: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor="include_remediation_plan" className="ml-2 text-sm text-slate-700">
                    Incluir plan de remediación
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="detailed_analysis"
                    checked={generatorConfig.detailed_analysis}
                    onChange={(e) => setGeneratorConfig({ ...generatorConfig, detailed_analysis: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor="detailed_analysis" className="ml-2 text-sm text-slate-700">
                    Análisis detallado por categoría
                  </label>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowGenerator(false)}
                className="px-4 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={generateComplianceReport}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generando...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generar Reporte
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalles del Reporte */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  Detalles del Reporte de Cumplimiento
                </h3>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
                >
                  <Eye className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Información General */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-slate-900 mb-3">Información General</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Nombre:</span>
                        <span className="font-medium">{selectedReport.report_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Framework:</span>
                        <span className="font-medium">{selectedReport.compliance_framework || 'General'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Generado:</span>
                        <span className="font-medium">
                          {new Date(selectedReport.generated_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-900 mb-3">Métricas de Cumplimiento</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Score de Cumplimiento:</span>
                        <span className={`font-bold ${getScoreColor(getComplianceScore(selectedReport))}`}>
                          {getComplianceScore(selectedReport)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Total de Eventos:</span>
                        <span className="font-medium">{selectedReport.total_events}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Eventos Críticos:</span>
                        <span className="font-medium text-red-600">{selectedReport.critical_events}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Violaciones:</span>
                        <span className="font-medium text-orange-600">{selectedReport.violations_found || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recomendaciones */}
                {selectedReport.recommendations && selectedReport.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-slate-900 mb-3">Recomendaciones</h4>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <ul className="space-y-2">
                        {selectedReport.recommendations.map((recommendation, index) => (
                          <li key={index} className="flex items-start">
                            <CheckCircle className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-blue-800">{recommendation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setSelectedReport(null)}
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