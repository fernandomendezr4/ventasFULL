import React, { useState, useEffect } from 'react';
import { Download, Database, FileText, Settings, AlertTriangle, CheckCircle, X, HardDrive, Zap } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  getTableMetadata,
  generatePostgreSQLExport,
  generateBackupScript,
  generatePostgreSQLConfig,
  type ExportConfiguration,
  type TableMetadata
} from '../lib/databaseExport';

export default function DatabaseExportManager() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tableInfo, setTableInfo] = useState<TableMetadata[]>([]);
  const [exportConfig, setExportConfig] = useState<ExportConfiguration>({
    includeSchema: true,
    includeData: true,
    includeFunctions: true,
    includeViews: true,
    includeTriggers: true,
    includeIndexes: true,
    includePolicies: true,
    selectedTables: [],
    maxRowsPerTable: 1000,
    exportFormat: 'sql'
  });
  const [exportProgress, setExportProgress] = useState<{
    isExporting: boolean;
    currentStep: string;
    progress: number;
  }>({
    isExporting: false,
    currentStep: '',
    progress: 0
  });

  useEffect(() => {
    loadTableInfo();
  }, []);

  const loadTableInfo = async () => {
    try {
      setLoading(true);
      console.log('Loading table metadata...');
      
      // Use the correct function from databaseExport.ts
      const data = await getTableMetadata();
      console.log('Table metadata loaded:', data);
      
      setTableInfo(data);
      
      // Auto-select all tables by default
      setExportConfig(prev => ({
        ...prev,
        selectedTables: data.map(table => table.table_name)
      }));
    } catch (error) {
      console.error('Error loading table info:', error);
      setTableInfo([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExportProgress({
        isExporting: true,
        currentStep: 'Iniciando exportación...',
        progress: 0
      });

      // Validar configuración
      if (exportConfig.selectedTables.length === 0) {
        alert('Debe seleccionar al menos una tabla para exportar');
        return;
      }

      setExportProgress(prev => ({
        ...prev,
        currentStep: 'Generando esquema de base de datos...',
        progress: 20
      }));

      // Generar script SQL completo
      const sqlScript = await generatePostgreSQLExport(exportConfig);

      setExportProgress(prev => ({
        ...prev,
        currentStep: 'Preparando archivo de descarga...',
        progress: 80
      }));

      // Crear archivo para descarga
      const blob = new Blob([sqlScript], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ventasfull_export_${new Date().toISOString().split('T')[0]}.sql`;
      a.click();
      URL.revokeObjectURL(url);

      setExportProgress(prev => ({
        ...prev,
        currentStep: 'Exportación completada',
        progress: 100
      }));

      setTimeout(() => {
        setExportProgress({
          isExporting: false,
          currentStep: '',
          progress: 0
        });
      }, 2000);

      alert('Base de datos exportada exitosamente');
    } catch (error) {
      console.error('Error exporting database:', error);
      alert('Error al exportar base de datos: ' + (error as Error).message);
      setExportProgress({
        isExporting: false,
        currentStep: '',
        progress: 0
      });
    }
  };

  const downloadBackupScript = () => {
    const script = generateBackupScript();
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup_ventasfull.sh';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPostgreSQLConfig = () => {
    const config = generatePostgreSQLConfig();
    const blob = new Blob([config], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'postgresql_ventasfull.conf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleTableSelection = (tableName: string) => {
    setExportConfig(prev => ({
      ...prev,
      selectedTables: prev.selectedTables.includes(tableName)
        ? prev.selectedTables.filter(name => name !== tableName)
        : [...prev.selectedTables, tableName]
    }));
  };

  const selectAllTables = () => {
    setExportConfig(prev => ({
      ...prev,
      selectedTables: tableInfo.map(table => table.table_name)
    }));
  };

  const deselectAllTables = () => {
    setExportConfig(prev => ({
      ...prev,
      selectedTables: []
    }));
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 flex items-center">
            <Database className="h-7 w-7 mr-3 text-blue-600" />
            Exportación de Base de Datos
            {isDemoMode && (
              <span className="ml-3 text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                DEMO
              </span>
            )}
          </h3>
          <p className="text-slate-600 mt-1">
            Exporta tu base de datos para instalación en PostgreSQL local
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadTableInfo}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
          >
            <Database className="h-4 w-4 mr-2" />
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Export Progress */}
      {exportProgress.isExporting && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-blue-900">Exportando Base de Datos</h4>
            <span className="text-sm text-blue-700">{exportProgress.progress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${exportProgress.progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-blue-800">{exportProgress.currentStep}</p>
        </div>
      )}

      {/* Configuration */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h4 className="text-lg font-semibold text-slate-900 mb-4">Configuración de Exportación</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Elementos a Incluir */}
          <div>
            <h5 className="font-medium text-slate-900 mb-3">Elementos a Incluir</h5>
            <div className="space-y-2">
              {[
                { key: 'includeSchema', label: 'Esquemas de Tablas', description: 'Estructura de las tablas' },
                { key: 'includeData', label: 'Datos', description: 'Contenido de las tablas' },
                { key: 'includeFunctions', label: 'Funciones', description: 'Funciones del sistema' },
                { key: 'includeViews', label: 'Vistas', description: 'Vistas y vistas materializadas' },
                { key: 'includeTriggers', label: 'Triggers', description: 'Triggers automáticos' },
                { key: 'includeIndexes', label: 'Índices', description: 'Índices de optimización' },
                { key: 'includePolicies', label: 'Políticas RLS', description: 'Seguridad a nivel de fila' }
              ].map((option) => (
                <div key={option.key} className="flex items-center">
                  <input
                    type="checkbox"
                    id={option.key}
                    checked={exportConfig[option.key as keyof ExportConfiguration] as boolean}
                    onChange={(e) => setExportConfig(prev => ({
                      ...prev,
                      [option.key]: e.target.checked
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor={option.key} className="ml-2 text-sm">
                    <span className="font-medium text-slate-900">{option.label}</span>
                    <span className="text-slate-600 block text-xs">{option.description}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Configuración Adicional */}
          <div>
            <h5 className="font-medium text-slate-900 mb-3">Configuración Adicional</h5>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Máximo de Filas por Tabla
                </label>
                <input
                  type="number"
                  value={exportConfig.maxRowsPerTable}
                  onChange={(e) => setExportConfig(prev => ({
                    ...prev,
                    maxRowsPerTable: parseInt(e.target.value) || 1000
                  }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="100"
                  max="100000"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Limita la cantidad de datos exportados por tabla
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Formato de Exportación
                </label>
                <select
                  value={exportConfig.exportFormat}
                  onChange={(e) => setExportConfig(prev => ({
                    ...prev,
                    exportFormat: e.target.value as 'sql' | 'dump'
                  }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="sql">SQL Script (.sql)</option>
                  <option value="dump">PostgreSQL Dump</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Selection */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-slate-900">Selección de Tablas</h4>
          <div className="flex gap-2">
            <button
              onClick={selectAllTables}
              className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded hover:bg-green-200 transition-colors duration-200"
            >
              Seleccionar Todas
            </button>
            <button
              onClick={deselectAllTables}
              className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 transition-colors duration-200"
            >
              Deseleccionar Todas
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Cargando información de tablas...</p>
          </div>
        ) : tableInfo.length === 0 ? (
          <div className="text-center py-8">
            <Database className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">No se pudo cargar información de las tablas</p>
            <button
              onClick={loadTableInfo}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tableInfo.map((table) => (
              <div key={table.table_name} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`table_${table.table_name}`}
                      checked={exportConfig.selectedTables.includes(table.table_name)}
                      onChange={() => toggleTableSelection(table.table_name)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <label htmlFor={`table_${table.table_name}`} className="ml-2 font-medium text-slate-900">
                      {table.table_name}
                    </label>
                  </div>
                  <span className="text-xs text-slate-500">{table.table_type}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <span className="font-medium">Columnas:</span>
                    <span className="ml-1">{table.column_count}</span>
                  </div>
                  <div>
                    <span className="font-medium">Filas:</span>
                    <span className="ml-1">{table.row_count.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="font-medium">Tamaño:</span>
                    <span className="ml-1">{formatBytes(table.size_bytes)}</span>
                  </div>
                  <div className="flex items-center">
                    {table.has_primary_key && <CheckCircle className="h-3 w-3 text-green-600 mr-1" />}
                    <span className="font-medium">PK</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Summary */}
      {exportConfig.selectedTables.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h4 className="font-medium text-blue-900 mb-3">Resumen de Exportación</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Tablas seleccionadas:</span>
              <p className="font-bold text-blue-900">{exportConfig.selectedTables.length}</p>
            </div>
            <div>
              <span className="text-blue-700">Total de filas:</span>
              <p className="font-bold text-blue-900">
                {tableInfo
                  .filter(table => exportConfig.selectedTables.includes(table.table_name))
                  .reduce((sum, table) => sum + table.row_count, 0)
                  .toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-blue-700">Tamaño estimado:</span>
              <p className="font-bold text-blue-900">
                {formatBytes(
                  tableInfo
                    .filter(table => exportConfig.selectedTables.includes(table.table_name))
                    .reduce((sum, table) => sum + table.size_bytes, 0)
                )}
              </p>
            </div>
            <div>
              <span className="text-blue-700">Formato:</span>
              <p className="font-bold text-blue-900">{exportConfig.exportFormat.toUpperCase()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h4 className="text-lg font-semibold text-slate-900 mb-4">Acciones de Exportación</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleExport}
            disabled={exportProgress.isExporting || exportConfig.selectedTables.length === 0}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
          >
            {exportProgress.isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exportar Base de Datos
              </>
            )}
          </button>

          <button
            onClick={downloadBackupScript}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center justify-center"
          >
            <FileText className="h-4 w-4 mr-2" />
            Script de Backup
          </button>

          <button
            onClick={downloadPostgreSQLConfig}
            className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center justify-center"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configuración PostgreSQL
          </button>
        </div>
      </div>

      {/* Installation Instructions */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <HardDrive className="h-5 w-5 mr-2 text-slate-600" />
          Instrucciones de Instalación
        </h4>
        <div className="space-y-4 text-sm text-slate-700">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h5 className="font-medium text-slate-900 mb-2">1. Preparar el Servidor Ubuntu</h5>
            <pre className="bg-slate-100 p-2 rounded text-xs overflow-x-auto">
{`sudo apt update && sudo apt upgrade -y
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql`}
            </pre>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h5 className="font-medium text-slate-900 mb-2">2. Crear Base de Datos</h5>
            <pre className="bg-slate-100 p-2 rounded text-xs overflow-x-auto">
{`sudo -u postgres psql
CREATE DATABASE ventasfull;
CREATE USER ventasfull_app WITH PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE ventasfull TO ventasfull_app;
\\q`}
            </pre>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h5 className="font-medium text-slate-900 mb-2">3. Importar Datos</h5>
            <pre className="bg-slate-100 p-2 rounded text-xs overflow-x-auto">
{`sudo -u postgres psql ventasfull < ventasfull_export_YYYY-MM-DD.sql`}
            </pre>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <Zap className="h-5 w-5 text-blue-600 mr-2" />
              <div>
                <h5 className="font-medium text-blue-900">Optimización Incluida</h5>
                <p className="text-sm text-blue-800 mt-1">
                  El archivo exportado incluye todas las optimizaciones de rendimiento, 
                  índices y configuraciones necesarias para un funcionamiento óptimo.
                </p>
              </div>
            </div>
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
                En modo demo se generará un archivo con datos de ejemplo. 
                Para exportar datos reales, configura las variables de entorno de Supabase.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}