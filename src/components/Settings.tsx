import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Download, Edit2, Save, Database, FileText, Package, Users, ShoppingCart, AlertCircle, CheckCircle, Sun, Moon, Monitor, Printer, Receipt } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface AppSettings {
  app_name: string;
  app_version: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  // Configuración de impresión
  print_enabled: boolean;
  auto_print: boolean;
  print_copies: number;
  receipt_width: string;
  show_logo: boolean;
  show_company_info: boolean;
  show_customer_info: boolean;
  show_payment_details: boolean;
  show_footer_message: boolean;
  footer_message: string;
  receipt_header: string;
  receipt_footer: string;
}

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [sqlExportLoading, setSqlExportLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [sqlExportStatus, setSqlExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [settings, setSettings] = useState<AppSettings>({
    app_name: 'VentasFULL',
    app_version: '1.0.0',
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    // Configuración de impresión por defecto
    print_enabled: true,
    auto_print: false,
    print_copies: 1,
    receipt_width: '80mm',
    show_logo: true,
    show_company_info: true,
    show_customer_info: true,
    show_payment_details: true,
    show_footer_message: true,
    footer_message: '¡Gracias por su compra!',
    receipt_header: '',
    receipt_footer: 'Conserve este comprobante'
  });
  const [editingSettings, setEditingSettings] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Por ahora usamos valores por defecto, pero se puede implementar
      // una tabla de configuración en la base de datos
      const savedSettings = localStorage.getItem('app_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      // Guardar en localStorage por ahora
      localStorage.setItem('app_settings', JSON.stringify(settings));
      setEditingSettings(false);
      
      // Mostrar notificación de éxito
      const event = new CustomEvent('showNotification', {
        detail: {
          type: 'success',
          title: '¡Configuración Guardada!',
          message: 'Todas las configuraciones han sido guardadas exitosamente'
        }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error saving settings:', error);
      
      // Mostrar notificación de error
      const event = new CustomEvent('showNotification', {
        detail: {
          type: 'error',
          title: 'Error al Guardar',
          message: 'No se pudo guardar la configuración'
        }
      });
      window.dispatchEvent(event);
    } finally {
      setLoading(false);
    }
  };

  const testPrint = () => {
    // Simular impresión de prueba
    const event = new CustomEvent('showNotification', {
      detail: {
        type: 'info',
        title: 'Impresión de Prueba',
        message: 'Se ha enviado un comprobante de prueba a la impresora configurada'
      }
    });
    window.dispatchEvent(event);
  };
  const exportDatabase = async () => {
    try {
      setExportLoading(true);
      setExportStatus('idle');

      // Obtener datos de todas las tablas principales
      const [
        productsResult,
        categoriesResult,
        suppliersResult,
        customersResult,
        usersResult,
        salesResult,
        saleItemsResult,
        cashRegistersResult,
        paymentsResult,
        installmentsResult
      ] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('categories').select('*'),
        supabase.from('suppliers').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('users').select('*'),
        supabase.from('sales').select('*'),
        supabase.from('sale_items').select('*'),
        supabase.from('cash_registers').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('payment_installments').select('*')
      ]);

      // Verificar errores
      const results = [
        productsResult, categoriesResult, suppliersResult, customersResult,
        usersResult, salesResult, saleItemsResult, cashRegistersResult,
        paymentsResult, installmentsResult
      ];

      for (const result of results) {
        if (result.error) {
          throw result.error;
        }
      }

      // Crear objeto con todos los datos
      const exportData = {
        metadata: {
          export_date: new Date().toISOString(),
          app_name: settings.app_name,
          app_version: settings.app_version,
          exported_by: user?.name || 'Usuario desconocido',
          total_records: {
            products: productsResult.data?.length || 0,
            categories: categoriesResult.data?.length || 0,
            suppliers: suppliersResult.data?.length || 0,
            customers: customersResult.data?.length || 0,
            users: usersResult.data?.length || 0,
            sales: salesResult.data?.length || 0,
            sale_items: saleItemsResult.data?.length || 0,
            cash_registers: cashRegistersResult.data?.length || 0,
            payments: paymentsResult.data?.length || 0,
            payment_installments: installmentsResult.data?.length || 0
          }
        },
        data: {
          products: productsResult.data || [],
          categories: categoriesResult.data || [],
          suppliers: suppliersResult.data || [],
          customers: customersResult.data || [],
          users: usersResult.data || [],
          sales: salesResult.data || [],
          sale_items: saleItemsResult.data || [],
          cash_registers: cashRegistersResult.data || [],
          payments: paymentsResult.data || [],
          payment_installments: installmentsResult.data || []
        }
      };

      // Crear y descargar archivo JSON
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${settings.app_name.toLowerCase().replace(/\s+/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus('success');
    } catch (error) {
      console.error('Error exporting database:', error);
      setExportStatus('error');
      alert('Error al exportar la base de datos: ' + (error as Error).message);
    } finally {
      setExportLoading(false);
    }
  };

  const exportDatabaseSQL = async () => {
    try {
      setSqlExportLoading(true);
      setSqlExportStatus('idle');

      // Obtener datos de todas las tablas principales
      const [
        categoriesResult,
        suppliersResult,
        customersResult,
        usersResult,
        productsResult,
        salesResult,
        saleItemsResult,
        cashRegistersResult,
        cashMovementsResult,
        paymentsResult,
        installmentsResult
      ] = await Promise.all([
        supabase.from('categories').select('*').order('created_at'),
        supabase.from('suppliers').select('*').order('created_at'),
        supabase.from('customers').select('*').order('created_at'),
        supabase.from('users').select('*').order('created_at'),
        supabase.from('products').select('*').order('created_at'),
        supabase.from('sales').select('*').order('created_at'),
        supabase.from('sale_items').select('*'),
        supabase.from('cash_registers').select('*').order('created_at'),
        supabase.from('cash_movements').select('*').order('created_at'),
        supabase.from('payments').select('*').order('created_at'),
        supabase.from('payment_installments').select('*').order('created_at')
      ]);

      // Verificar errores
      const results = [
        categoriesResult, suppliersResult, customersResult, usersResult,
        productsResult, salesResult, saleItemsResult, cashRegistersResult,
        cashMovementsResult, paymentsResult, installmentsResult
      ];

      for (const result of results) {
        if (result.error) {
          throw result.error;
        }
      }

      // Función para escapar valores SQL
      const escapeSqlValue = (value: any): string => {
        if (value === null || value === undefined) {
          return 'NULL';
        }
        if (typeof value === 'string') {
          return `'${value.replace(/'/g, "''")}'`;
        }
        if (typeof value === 'boolean') {
          return value ? 'true' : 'false';
        }
        if (value instanceof Date) {
          return `'${value.toISOString()}'`;
        }
        return String(value);
      };

      // Función para generar INSERT statements
      const generateInserts = (tableName: string, data: any[]): string => {
        if (!data || data.length === 0) {
          return `-- No hay datos para la tabla ${tableName}\n\n`;
        }

        const columns = Object.keys(data[0]);
        let sql = `-- Datos para la tabla ${tableName}\n`;
        sql += `-- Total de registros: ${data.length}\n\n`;

        // Generar INSERTs en lotes de 100 para mejor rendimiento
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          
          sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n`;
          
          const values = batch.map(row => {
            const rowValues = columns.map(col => escapeSqlValue(row[col]));
            return `  (${rowValues.join(', ')})`;
          });
          
          sql += values.join(',\n');
          sql += ';\n\n';
        }

        return sql;
      };

      // Construir el archivo SQL completo
      let sqlContent = '';
      
      // Header del archivo
      sqlContent += `-- =====================================================\n`;
      sqlContent += `-- EXPORTACIÓN COMPLETA DE BASE DE DATOS - ${settings.app_name}\n`;
      sqlContent += `-- =====================================================\n`;
      sqlContent += `-- Fecha de exportación: ${new Date().toLocaleString('es-ES')}\n`;
      sqlContent += `-- Exportado por: ${user?.name || 'Usuario desconocido'}\n`;
      sqlContent += `-- Versión del sistema: ${settings.app_version}\n`;
      sqlContent += `-- =====================================================\n\n`;

      // Configuraciones iniciales
      sqlContent += `-- Configuraciones para la importación\n`;
      sqlContent += `SET client_encoding = 'UTF8';\n`;
      sqlContent += `SET standard_conforming_strings = on;\n`;
      sqlContent += `SET check_function_bodies = false;\n`;
      sqlContent += `SET xmloption = content;\n`;
      sqlContent += `SET client_min_messages = warning;\n`;
      sqlContent += `SET row_security = off;\n\n`;

      // Deshabilitar triggers temporalmente
      sqlContent += `-- Deshabilitar triggers durante la importación\n`;
      sqlContent += `SET session_replication_role = replica;\n\n`;

      // Limpiar datos existentes (comentado por seguridad)
      sqlContent += `-- ADVERTENCIA: Descomenta las siguientes líneas solo si quieres limpiar los datos existentes\n`;
      sqlContent += `-- TRUNCATE TABLE payment_installments CASCADE;\n`;
      sqlContent += `-- TRUNCATE TABLE payments CASCADE;\n`;
      sqlContent += `-- TRUNCATE TABLE cash_movements CASCADE;\n`;
      sqlContent += `-- TRUNCATE TABLE sale_items CASCADE;\n`;
      sqlContent += `-- TRUNCATE TABLE sales CASCADE;\n`;
      sqlContent += `-- TRUNCATE TABLE cash_registers CASCADE;\n`;
      sqlContent += `-- TRUNCATE TABLE products CASCADE;\n`;
      sqlContent += `-- TRUNCATE TABLE customers CASCADE;\n`;
      sqlContent += `-- TRUNCATE TABLE users CASCADE;\n`;
      sqlContent += `-- TRUNCATE TABLE suppliers CASCADE;\n`;
      sqlContent += `-- TRUNCATE TABLE categories CASCADE;\n\n`;

      // Insertar datos en orden de dependencias
      sqlContent += `-- =====================================================\n`;
      sqlContent += `-- INSERCIÓN DE DATOS\n`;
      sqlContent += `-- =====================================================\n\n`;

      // 1. Categorías (sin dependencias)
      sqlContent += generateInserts('categories', categoriesResult.data || []);

      // 2. Proveedores (sin dependencias)
      sqlContent += generateInserts('suppliers', suppliersResult.data || []);

      // 3. Clientes (sin dependencias)
      sqlContent += generateInserts('customers', customersResult.data || []);

      // 4. Usuarios (sin dependencias)
      sqlContent += generateInserts('users', usersResult.data || []);

      // 5. Productos (depende de categorías y proveedores)
      sqlContent += generateInserts('products', productsResult.data || []);

      // 6. Cajas registradoras (depende de usuarios)
      sqlContent += generateInserts('cash_registers', cashRegistersResult.data || []);

      // 7. Ventas (depende de clientes y usuarios)
      sqlContent += generateInserts('sales', salesResult.data || []);

      // 8. Items de venta (depende de ventas y productos)
      sqlContent += generateInserts('sale_items', saleItemsResult.data || []);

      // 9. Movimientos de caja (depende de cajas registradoras)
      sqlContent += generateInserts('cash_movements', cashMovementsResult.data || []);

      // 10. Pagos (depende de ventas)
      sqlContent += generateInserts('payments', paymentsResult.data || []);

      // 11. Abonos (depende de ventas)
      sqlContent += generateInserts('payment_installments', installmentsResult.data || []);

      // Rehabilitar triggers
      sqlContent += `-- Rehabilitar triggers\n`;
      sqlContent += `SET session_replication_role = DEFAULT;\n\n`;

      // Actualizar secuencias (si las hay)
      sqlContent += `-- Actualizar secuencias de IDs (si es necesario)\n`;
      sqlContent += `-- SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));\n`;
      sqlContent += `-- Repite para otras tablas con secuencias...\n\n`;

      // Footer
      sqlContent += `-- =====================================================\n`;
      sqlContent += `-- FIN DE LA EXPORTACIÓN\n`;
      sqlContent += `-- =====================================================\n`;
      sqlContent += `-- Total de registros exportados:\n`;
      sqlContent += `-- - Categorías: ${categoriesResult.data?.length || 0}\n`;
      sqlContent += `-- - Proveedores: ${suppliersResult.data?.length || 0}\n`;
      sqlContent += `-- - Clientes: ${customersResult.data?.length || 0}\n`;
      sqlContent += `-- - Usuarios: ${usersResult.data?.length || 0}\n`;
      sqlContent += `-- - Productos: ${productsResult.data?.length || 0}\n`;
      sqlContent += `-- - Cajas registradoras: ${cashRegistersResult.data?.length || 0}\n`;
      sqlContent += `-- - Ventas: ${salesResult.data?.length || 0}\n`;
      sqlContent += `-- - Items de venta: ${saleItemsResult.data?.length || 0}\n`;
      sqlContent += `-- - Movimientos de caja: ${cashMovementsResult.data?.length || 0}\n`;
      sqlContent += `-- - Pagos: ${paymentsResult.data?.length || 0}\n`;
      sqlContent += `-- - Abonos: ${installmentsResult.data?.length || 0}\n`;
      sqlContent += `-- =====================================================\n`;

      // Crear y descargar archivo SQL
      const sqlBlob = new Blob([sqlContent], { type: 'application/sql; charset=utf-8' });
      const url = URL.createObjectURL(sqlBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${settings.app_name.toLowerCase().replace(/\s+/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSqlExportStatus('success');
    } catch (error) {
      console.error('Error exporting database to SQL:', error);
      setSqlExportStatus('error');
      alert('Error al exportar la base de datos a SQL: ' + (error as Error).message);
    } finally {
      setSqlExportLoading(false);
    }
  };

  const getExportStatusIcon = () => {
    switch (exportStatus) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Download className="h-4 w-4" />;
    }
  };

  const getExportStatusText = () => {
    switch (exportStatus) {
      case 'success':
        return 'Exportación completada';
      case 'error':
        return 'Error en la exportación';
      default:
        return 'Exportar Base de Datos';
    }
  };

  const getSqlExportStatusIcon = () => {
    switch (sqlExportStatus) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  const getSqlExportStatusText = () => {
    switch (sqlExportStatus) {
      case 'success':
        return 'Exportación SQL completada';
      case 'error':
        return 'Error en la exportación SQL';
      default:
        return 'Exportar a SQL';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Configuración</h2>
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-slate-600" />
        </div>
      </div>

      {/* Configuración General */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <Edit2 className="h-5 w-5 mr-2 text-blue-600" />
            Configuración General
          </h3>
          {!editingSettings ? (
            <button
              onClick={() => setEditingSettings(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={saveSettings}
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => {
                  setEditingSettings(false);
                  loadSettings();
                }}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Configuración de Tema */}
          <div>
            <h4 className="font-medium text-slate-900 mb-4 flex items-center">
              <Sun className="h-4 w-4 mr-2 text-yellow-600" />
              Apariencia
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setTheme('light')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  theme === 'light'
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <Sun className="h-6 w-6" />
                  <span className="font-medium">Claro</span>
                  <span className="text-xs opacity-75">Tema claro</span>
                </div>
              </button>
              
              <button
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  theme === 'dark'
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <Moon className="h-6 w-6" />
                  <span className="font-medium">Oscuro</span>
                  <span className="text-xs opacity-75">Tema oscuro</span>
                </div>
              </button>
              
              <button
                onClick={() => {
                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  setTheme(systemTheme);
                }}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  !localStorage.getItem('app_theme') || localStorage.getItem('app_theme') === 'system'
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <Monitor className="h-6 w-6" />
                  <span className="font-medium">Sistema</span>
                  <span className="text-xs opacity-75">Automático</span>
                </div>
              </button>
            </div>
            <p className="text-sm text-slate-600 mt-3">
              Selecciona el tema de la aplicación. El tema del sistema se ajustará automáticamente según la configuración de tu dispositivo.
            </p>
          </div>

          {/* Configuración de la Empresa */}
          <div>
            <h4 className="font-medium text-slate-900 mb-4 flex items-center">
              <Edit2 className="h-4 w-4 mr-2 text-blue-600" />
              Información de la Empresa
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nombre del Software
            </label>
            {editingSettings ? (
              <input
                type="text"
                value={settings.app_name}
                onChange={(e) => setSettings({ ...settings, app_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nombre de la aplicación"
              />
            ) : (
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {settings.app_name}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Versión
            </label>
            {editingSettings ? (
              <input
                type="text"
                value={settings.app_version}
                onChange={(e) => setSettings({ ...settings, app_version: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Versión de la aplicación"
              />
            ) : (
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {settings.app_version}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nombre de la Empresa
            </label>
            {editingSettings ? (
              <input
                type="text"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nombre de tu empresa"
              />
            ) : (
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {settings.company_name || 'No configurado'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Teléfono de la Empresa
            </label>
            {editingSettings ? (
              <input
                type="tel"
                value={settings.company_phone}
                onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Teléfono de contacto"
              />
            ) : (
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {settings.company_phone || 'No configurado'}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Dirección de la Empresa
            </label>
            {editingSettings ? (
              <textarea
                value={settings.company_address}
                onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Dirección completa de la empresa"
              />
            ) : (
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 min-h-[80px]">
                {settings.company_address || 'No configurado'}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email de la Empresa
            </label>
            {editingSettings ? (
              <input
                type="email"
                value={settings.company_email}
                onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="email@empresa.com"
              />
            ) : (
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {settings.company_email || 'No configurado'}
              </div>
            )}
          </div>
          </div>
        </div>
        </div>
      </div>

      {/* Exportar Base de Datos */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center">
          <Database className="h-5 w-5 mr-2 text-green-600" />
          Respaldo de Datos
        </h3>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Información sobre la exportación</h4>
              <p className="text-blue-800 text-sm">
                Estas funciones exportarán todos los datos de la base de datos. Puedes elegir entre formato JSON (para respaldo) 
                o formato SQL (para migración/importación). Incluye productos, categorías, clientes, ventas, usuarios y toda la información del sistema.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-slate-900 mb-3">¿Qué se incluye en la exportación?</h4>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center">
                <Package className="h-4 w-4 mr-2 text-purple-600" />
                <span>Productos y categorías</span>
              </div>
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2 text-blue-600" />
                <span>Clientes y proveedores</span>
              </div>
              <div className="flex items-center">
                <ShoppingCart className="h-4 w-4 mr-2 text-green-600" />
                <span>Ventas y pagos</span>
              </div>
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-2 text-orange-600" />
                <span>Registros de caja</span>
              </div>
              <div className="flex items-center">
                <SettingsIcon className="h-4 w-4 mr-2 text-slate-600" />
                <span>Usuarios y configuración</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-slate-900 mb-3">Exportar a JSON</h4>
            <p className="text-sm text-slate-600 mb-4">
              Genera un archivo JSON de respaldo completo para análisis o migración.
            </p>
            <button
              onClick={exportDatabase}
              disabled={exportLoading}
              className={`w-full px-4 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center ${
                exportStatus === 'success'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : exportStatus === 'error'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
              } ${exportLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {exportLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exportando...
                </>
              ) : (
                <>
                  {getExportStatusIcon()}
                  <span className="ml-2">{getExportStatusText()}</span>
                </>
              )}
            </button>
            {exportStatus === 'success' && (
              <p className="text-sm text-green-600 mt-2 text-center">
                ✓ Archivo JSON descargado exitosamente
              </p>
            )}
            {exportStatus === 'error' && (
              <p className="text-sm text-red-600 mt-2 text-center">
                ✗ Error al generar el archivo JSON
              </p>
            )}
          </div>

          <div>
            <h4 className="font-medium text-slate-900 mb-3">Exportar a SQL</h4>
            <p className="text-sm text-slate-600 mb-4">
              Genera un archivo SQL completo con INSERT statements para importación directa.
            </p>
            <button
              onClick={exportDatabaseSQL}
              disabled={sqlExportLoading}
              className={`w-full px-4 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center ${
                sqlExportStatus === 'success'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : sqlExportStatus === 'error'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
              } ${sqlExportLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {sqlExportLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exportando SQL...
                </>
              ) : (
                <>
                  {getSqlExportStatusIcon()}
                  <span className="ml-2">{getSqlExportStatusText()}</span>
                </>
              )}
            </button>
            {sqlExportStatus === 'success' && (
              <p className="text-sm text-green-600 mt-2 text-center">
                ✓ Archivo SQL descargado exitosamente
              </p>
            )}
            {sqlExportStatus === 'error' && (
              <p className="text-sm text-red-600 mt-2 text-center">
                ✗ Error al generar el archivo SQL
              </p>
            )}
          </div>
        </div>
        <div className="space-y-6">
          {/* Configuración General de Impresión */}
          <div>
            <h4 className="font-medium text-slate-900 mb-4 flex items-center">
              <SettingsIcon className="h-4 w-4 mr-2 text-blue-600" />
              Configuración General
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <label className="font-medium text-slate-900">Habilitar Impresión</label>
                    <p className="text-sm text-slate-600">Activar/desactivar la impresión de comprobantes</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.print_enabled}
                      onChange={(e) => setSettings({ ...settings, print_enabled: e.target.checked })}
                      disabled={!editingSettings}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
      </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <label className="font-medium text-slate-900">Impresión Automática</label>
                    <p className="text-sm text-slate-600">Imprimir automáticamente al completar una venta</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.auto_print}
                      onChange={(e) => setSettings({ ...settings, auto_print: e.target.checked })}
                      disabled={!editingSettings || !settings.print_enabled}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número de Copias
                  </label>
                  {editingSettings ? (
                    <select
                      value={settings.print_copies}
                      onChange={(e) => setSettings({ ...settings, print_copies: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={1}>1 copia</option>
                      <option value={2}>2 copias</option>
                      <option value={3}>3 copias</option>
                    </select>
                  ) : (
                    <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                      {settings.print_copies} {settings.print_copies === 1 ? 'copia' : 'copias'}
                    </div>
                  )}
                </div>
      {/* Configuración de Impresión */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ancho del Comprobante
                  </label>
                  {editingSettings ? (
                    <select
                      value={settings.receipt_width}
                      onChange={(e) => setSettings({ ...settings, receipt_width: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="58mm">58mm (Pequeño)</option>
                      <option value="80mm">80mm (Estándar)</option>
                      <option value="110mm">110mm (Grande)</option>
                    </select>
                  ) : (
                    <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                      {settings.receipt_width}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
      <div className="bg-white rounded-xl shadow-sm p-6">
          {/* Contenido del Comprobante */}
          <div>
            <h4 className="font-medium text-slate-900 mb-4 flex items-center">
              <Receipt className="h-4 w-4 mr-2 text-purple-600" />
              Contenido del Comprobante
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <label className="font-medium text-slate-900">Mostrar Logo</label>
                  <input
                    type="checkbox"
                    checked={settings.show_logo}
                    onChange={(e) => setSettings({ ...settings, show_logo: e.target.checked })}
                    disabled={!editingSettings}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
        <div className="flex items-center justify-between mb-6">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <label className="font-medium text-slate-900">Información de la Empresa</label>
                  <input
                    type="checkbox"
                    checked={settings.show_company_info}
                    onChange={(e) => setSettings({ ...settings, show_company_info: e.target.checked })}
                    disabled={!editingSettings}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <label className="font-medium text-slate-900">Información del Cliente</label>
                  <input
                    type="checkbox"
                    checked={settings.show_customer_info}
                    onChange={(e) => setSettings({ ...settings, show_customer_info: e.target.checked })}
                    disabled={!editingSettings}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
            <Printer className="h-5 w-5 mr-2 text-green-600" />
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <label className="font-medium text-slate-900">Detalles de Pago</label>
                  <input
                    type="checkbox"
                    checked={settings.show_payment_details}
                    onChange={(e) => setSettings({ ...settings, show_payment_details: e.target.checked })}
                    disabled={!editingSettings}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
            Configuración de Impresión de Comprobantes
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <label className="font-medium text-slate-900">Mensaje de Pie</label>
                  <input
                    type="checkbox"
                    checked={settings.show_footer_message}
                    onChange={(e) => setSettings({ ...settings, show_footer_message: e.target.checked })}
                    disabled={!editingSettings}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              </div>
          </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Encabezado Personalizado
                  </label>
                  {editingSettings ? (
                    <textarea
                      value={settings.receipt_header}
                      onChange={(e) => setSettings({ ...settings, receipt_header: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Texto adicional para el encabezado..."
                    />
                  ) : (
                    <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 min-h-[60px]">
                      {settings.receipt_header || 'Sin encabezado personalizado'}
                    </div>
                  )}
                </div>
          {!editingSettings ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Mensaje de Agradecimiento
                  </label>
                  {editingSettings ? (
                    <input
                      type="text"
                      value={settings.footer_message}
                      onChange={(e) => setSettings({ ...settings, footer_message: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="¡Gracias por su compra!"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                      {settings.footer_message}
                    </div>
                  )}
                </div>
            <div className="flex gap-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Pie de Página
                  </label>
                  {editingSettings ? (
                    <textarea
                      value={settings.receipt_footer}
                      onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Información adicional del pie..."
                    />
                  ) : (
                    <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 min-h-[60px]">
                      {settings.receipt_footer}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
              <button
          {/* Vista Previa del Comprobante */}
          {settings.print_enabled && (
            <div>
              <h4 className="font-medium text-slate-900 mb-4 flex items-center">
                <FileText className="h-4 w-4 mr-2 text-orange-600" />
                Vista Previa del Comprobante
              </h4>
              <div className="bg-slate-50 p-6 rounded-lg border-2 border-dashed border-slate-300">
                <div className={`bg-white p-4 rounded-lg shadow-sm mx-auto ${
                  settings.receipt_width === '58mm' ? 'max-w-xs' : 
                  settings.receipt_width === '80mm' ? 'max-w-sm' : 'max-w-md'
                }`} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {/* Header */}
                  {settings.show_logo && (
                    <div className="text-center mb-2">
                      <div className="w-12 h-12 bg-blue-600 rounded-full mx-auto mb-2 flex items-center justify-center">
                        <span className="text-white font-bold">LOGO</span>
                      </div>
                    </div>
                  )}
                  
                  {settings.show_company_info && (
                    <div className="text-center mb-3">
                      <div className="font-bold">{settings.company_name || 'NOMBRE DE LA EMPRESA'}</div>
                      {settings.company_address && <div className="text-xs">{settings.company_address}</div>}
                      {settings.company_phone && <div className="text-xs">Tel: {settings.company_phone}</div>}
                      {settings.company_email && <div className="text-xs">{settings.company_email}</div>}
                    </div>
                  )}
                onClick={testPrint}
                  {settings.receipt_header && (
                    <div className="text-center text-xs mb-3 border-b pb-2">
                      {settings.receipt_header}
                    </div>
                  )}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center text-sm"
                  <div className="border-b pb-2 mb-2">
                    <div className="flex justify-between text-xs">
                      <span>COMPROBANTE DE VENTA</span>
                      <span>#00001</span>
                    </div>
                    <div className="text-xs">Fecha: {new Date().toLocaleDateString('es-ES')}</div>
                    <div className="text-xs">Hora: {new Date().toLocaleTimeString('es-ES')}</div>
                  </div>
              >
                  {settings.show_customer_info && (
                    <div className="border-b pb-2 mb-2 text-xs">
                      <div>Cliente: Juan Pérez</div>
                      <div>CC: 12345678</div>
                    </div>
                  )}
                <Receipt className="h-4 w-4 mr-2" />
                  <div className="border-b pb-2 mb-2">
                    <div className="text-xs">
                      <div className="flex justify-between">
                        <span>Producto Ejemplo</span>
                        <span>$10,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cant: 2 x $5,000</span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                Prueba de Impresión
                  <div className="border-b pb-2 mb-2">
                    <div className="flex justify-between text-xs">
                      <span>SUBTOTAL:</span>
                      <span>$10,000</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>TOTAL:</span>
                      <span>$10,000</span>
                    </div>
                  </div>
              </button>
                  {settings.show_payment_details && (
                    <div className="border-b pb-2 mb-2 text-xs">
                      <div>Método de pago: Efectivo</div>
                      <div>Recibido: $10,000</div>
                      <div>Cambio: $0</div>
                    </div>
                  )}
            </div>
                  {settings.show_footer_message && settings.footer_message && (
                    <div className="text-center text-xs mb-2">
                      {settings.footer_message}
                    </div>
                  )}
          ) : null}
                  {settings.receipt_footer && (
                    <div className="text-center text-xs border-t pt-2">
                      {settings.receipt_footer}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
        </div>
      {/* Información del Sistema */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 text-slate-600" />
          Información del Sistema
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-medium text-slate-900 mb-2">Usuario Actual</h4>
            <p className="text-slate-600">{user?.name}</p>
            <p className="text-slate-500">{user?.email}</p>
            <p className="text-slate-500 capitalize">{user?.role}</p>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-medium text-slate-900 mb-2">Aplicación</h4>
            <p className="text-slate-600">{settings.app_name}</p>
            <p className="text-slate-500">Versión {settings.app_version}</p>
            <p className="text-slate-500">React + Supabase</p>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-medium text-slate-900 mb-2">Última Sesión</h4>
            <p className="text-slate-600">{new Date().toLocaleDateString('es-ES')}</p>
            <p className="text-slate-500">{new Date().toLocaleTimeString('es-ES')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}