import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Download, Edit2, Save, Database, FileText, Package, Users, ShoppingCart, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AppSettings {
  app_name: string;
  app_version: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
}

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [settings, setSettings] = useState<AppSettings>({
    app_name: 'VentasFULL',
    app_version: '1.0.0',
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: ''
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
      alert('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error al guardar configuración');
    } finally {
      setLoading(false);
    }
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
                Esta función exportará todos los datos de la base de datos en formato JSON. 
                Incluye productos, categorías, clientes, ventas, usuarios y toda la información del sistema.
                El archivo se descargará automáticamente a tu dispositivo.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <h4 className="font-medium text-slate-900 mb-3">Exportar Datos</h4>
            <p className="text-sm text-slate-600 mb-4">
              Genera un archivo de respaldo completo de toda la información del sistema.
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
                ✓ Archivo descargado exitosamente
              </p>
            )}
            {exportStatus === 'error' && (
              <p className="text-sm text-red-600 mt-2 text-center">
                ✗ Error al generar el archivo
              </p>
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