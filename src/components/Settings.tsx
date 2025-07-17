import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Printer, Save, Eye, RefreshCw, FileText, Image, Info, Type, Layout, Download, Database, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import PrintService from './PrintService';
import NotificationModal from './NotificationModal';
import { useNotification } from '../hooks/useNotification';
import { supabase } from '../lib/supabase';

interface PrintSettings {
  print_enabled: boolean;
  auto_print: boolean;
  print_copies: number;
  receipt_width: '58mm' | '80mm' | '110mm';
  show_logo: boolean;
  logo_url: string;
  logo_size: 'small' | 'medium' | 'large';
  show_company_info: boolean;
  show_customer_info: boolean;
  show_payment_details: boolean;
  show_footer_message: boolean;
  footer_message: string;
  receipt_header: string;
  receipt_footer: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  tax_id: string;
  font_size: 'small' | 'medium' | 'large';
  line_spacing: 'compact' | 'normal' | 'relaxed';
  show_barcode: boolean;
  show_qr_code: boolean;
  qr_content: 'sale_id' | 'company_info' | 'custom';
  qr_custom_text: string;
  custom_css: string;
}

const DEFAULT_SETTINGS: PrintSettings = {
  print_enabled: true,
  auto_print: false,
  print_copies: 1,
  receipt_width: '80mm',
  show_logo: true,
  logo_url: '',
  logo_size: 'medium',
  show_company_info: true,
  show_customer_info: true,
  show_payment_details: true,
  show_footer_message: true,
  footer_message: '¡Gracias por su compra!',
  receipt_header: '',
  receipt_footer: 'Conserve este comprobante',
  company_name: 'VentasFULL',
  company_address: '',
  company_phone: '',
  company_email: '',
  company_website: '',
  tax_id: '',
  font_size: 'medium',
  line_spacing: 'normal',
  show_barcode: false,
  qr_content: 'sale_id',
  qr_custom_text: '',
  show_qr_code: false,
  custom_css: ''
};

// Datos de ejemplo para la vista previa
const SAMPLE_SALE = {
  id: 'sample-sale-12345678',
  total_amount: 45000,
  subtotal: 45000,
  discount_amount: 0,
  created_at: new Date().toISOString(),
  payment_type: 'cash',
  total_paid: 45000,
  payment_status: 'paid',
  customer: {
    name: 'Juan Pérez',
    cedula: '12345678',
    phone: '300-123-4567',
    email: 'juan@email.com'
  },
  user: {
    name: 'María González'
  },
  sale_items: [
    {
      product: { name: 'Producto de Ejemplo 1' },
      quantity: 2,
      unit_price: 15000,
      total_price: 30000
    },
    {
      product: { name: 'Producto de Ejemplo 2' },
      quantity: 1,
      unit_price: 15000,
      total_price: 15000
    }
  ]
};

export default function Settings() {
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'company' | 'layout' | 'advanced' | 'database'>('general');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      // Cargar configuración de impresión
      const printSettings = localStorage.getItem('print_settings');
      const appSettings = localStorage.getItem('app_settings');
      
      let mergedSettings = { ...DEFAULT_SETTINGS };
      
      if (appSettings) {
        const appConfig = JSON.parse(appSettings);
        mergedSettings = { ...mergedSettings, ...appConfig };
      }
      
      if (printSettings) {
        const printConfig = JSON.parse(printSettings);
        mergedSettings = { ...mergedSettings, ...printConfig };
      }
      
      setSettings(mergedSettings);
    } catch (error) {
      console.error('Error loading print settings:', error);
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      
      // Guardar en configuración de impresión
      localStorage.setItem('print_settings', JSON.stringify(settings));
      
      // Guardar también en configuración general para compatibilidad
      const currentAppSettings = localStorage.getItem('app_settings');
      const appConfig = currentAppSettings ? JSON.parse(currentAppSettings) : {};
      
      const updatedAppSettings = {
        ...appConfig,
        // Solo guardar configuraciones relevantes para la app
        company_name: settings.company_name,
        company_address: settings.company_address,
        company_phone: settings.company_phone,
        company_email: settings.company_email,
        company_website: settings.company_website,
        tax_id: settings.tax_id,
        logo_url: settings.logo_url,
        app_name: settings.company_name || 'VentasFULL'
      };
      
      localStorage.setItem('app_settings', JSON.stringify(updatedAppSettings));
      
      // Actualizar título de la página
      document.title = settings.company_name || 'VentasFULL';

      showSuccess(
        '¡Configuración Guardada!',
        'La configuración de impresión ha sido guardada exitosamente. Los cambios se aplicarán en las próximas impresiones.'
      );
    } catch (error) {
      console.error('Error saving settings:', error);
      showError(
        'Error al Guardar',
        'No se pudo guardar la configuración de impresión. ' + (error as Error).message
      );
    } finally {
      setLoading(false);
    }
  };

  const resetSettings = () => {
    if (window.confirm('¿Estás seguro de que quieres restaurar la configuración por defecto?')) {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const exportDatabase = async () => {
    try {
      setExportLoading(true);
      
      // Obtener todas las tablas y sus datos
      const tables = [
        'categories',
        'suppliers', 
        'customers',
        'users',
        'products',
        'sales',
        'sale_items',
        'cash_registers',
        'cash_movements',
        'payment_installments',
        'payments'
      ];
      
      let sqlExport = `-- Exportación completa de la base de datos VentasFULL\n`;
      sqlExport += `-- Fecha de exportación: ${new Date().toLocaleString('es-ES')}\n\n`;
      
      for (const tableName of tables) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*');
          
          if (error) {
            console.warn(`Error al exportar tabla ${tableName}:`, error);
            continue;
          }
          
          if (data && data.length > 0) {
            sqlExport += `-- Tabla: ${tableName}\n`;
            sqlExport += `-- Registros: ${data.length}\n\n`;
            
            // Obtener las columnas del primer registro
            const columns = Object.keys(data[0]);
            
            for (const row of data) {
              const values = columns.map(col => {
                const value = row[col];
                if (value === null) return 'NULL';
                if (typeof value === 'string') {
                  // Escapar comillas simples
                  return `'${value.replace(/'/g, "''")}'`;
                }
                if (typeof value === 'boolean') return value ? 'true' : 'false';
                if (value instanceof Date) return `'${value.toISOString()}'`;
                return value;
              });
              
              sqlExport += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            }
            
            sqlExport += `\n`;
          }
        } catch (tableError) {
          console.warn(`Error procesando tabla ${tableName}:`, tableError);
        }
      }
      
      // Crear y descargar el archivo
      const blob = new Blob([sqlExport], { type: 'text/sql;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ventasfull_backup_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showSuccess(
        '¡Exportación Completada!',
        'La base de datos ha sido exportada exitosamente. El archivo SQL se ha descargado automáticamente.'
      );
      
      // Guardar fecha de última exportación
      localStorage.setItem('last_export_date', new Date().toLocaleString('es-ES'));
    } catch (error) {
      console.error('Error exporting database:', error);
      showError(
        'Error en la Exportación',
        'No se pudo exportar la base de datos. ' + (error as Error).message
      );
    } finally {
      setExportLoading(false);
    }
  };

  const handleSettingChange = (key: keyof PrintSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const renderGeneralTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Printer className="h-5 w-5 mr-2 text-blue-600" />
          Configuración General de Impresión
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Habilitar impresión
              </label>
              <input
                type="checkbox"
                checked={settings.print_enabled}
                onChange={(e) => handleSettingChange('print_enabled', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Impresión automática
              </label>
              <input
                type="checkbox"
                checked={settings.auto_print}
                onChange={(e) => handleSettingChange('auto_print', e.target.checked)}
                disabled={!settings.print_enabled}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Número de copias
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={settings.print_copies}
                onChange={(e) => handleSettingChange('print_copies', parseInt(e.target.value))}
                disabled={!settings.print_enabled}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ancho del comprobante
              </label>
              <select
                value={settings.receipt_width}
                onChange={(e) => handleSettingChange('receipt_width', e.target.value)}
                disabled={!settings.print_enabled}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="58mm">58mm (Compacto)</option>
                <option value="80mm">80mm (Estándar)</option>
                <option value="110mm">110mm (Amplio)</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tamaño de fuente
              </label>
              <select
                value={settings.font_size}
                onChange={(e) => handleSettingChange('font_size', e.target.value)}
                disabled={!settings.print_enabled}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="small">Pequeño</option>
                <option value="medium">Mediano</option>
                <option value="large">Grande</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Espaciado entre líneas
              </label>
              <select
                value={settings.line_spacing}
                onChange={(e) => handleSettingChange('line_spacing', e.target.value)}
                disabled={!settings.print_enabled}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="compact">Compacto</option>
                <option value="normal">Normal</option>
                <option value="relaxed">Relajado</option>
              </select>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Mostrar código de barras
              </label>
              <input
                type="checkbox"
                checked={settings.show_barcode}
                onChange={(e) => handleSettingChange('show_barcode', e.target.checked)}
                disabled={!settings.print_enabled}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Mostrar código QR
              </label>
              <input
                type="checkbox"
                checked={settings.show_qr_code}
                onChange={(e) => handleSettingChange('show_qr_code', e.target.checked)}
                disabled={!settings.print_enabled}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            
            {settings.show_qr_code && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Contenido del código QR
                </label>
                <select
                  value={settings.qr_content}
                  onChange={(e) => handleSettingChange('qr_content', e.target.value)}
                  disabled={!settings.print_enabled}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="sale_id">ID de la venta</option>
                  <option value="company_info">Información de la empresa</option>
                  <option value="custom">Texto personalizado</option>
                </select>
                
                {settings.qr_content === 'custom' && (
                  <input
                    type="text"
                    value={settings.qr_custom_text}
                    onChange={(e) => handleSettingChange('qr_custom_text', e.target.value)}
                    placeholder="Texto para el código QR"
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderCompanyTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2 text-green-600" />
          Información de la Empresa
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre de la empresa
              </label>
              <input
                type="text"
                value={settings.company_name}
                onChange={(e) => handleSettingChange('company_name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nombre de tu empresa"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Dirección
              </label>
              <textarea
                value={settings.company_address}
                onChange={(e) => handleSettingChange('company_address', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Dirección completa de la empresa"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={settings.company_phone}
                onChange={(e) => handleSettingChange('company_phone', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Teléfono de contacto"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={settings.company_email}
                onChange={(e) => handleSettingChange('company_email', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="email@empresa.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Sitio web
              </label>
              <input
                type="url"
                value={settings.company_website}
                onChange={(e) => handleSettingChange('company_website', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="www.empresa.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                NIT / RUT
              </label>
              <input
                type="text"
                value={settings.tax_id}
                onChange={(e) => handleSettingChange('tax_id', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Número de identificación tributaria"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLayoutTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Layout className="h-5 w-5 mr-2 text-purple-600" />
          Diseño del Comprobante
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium text-slate-900">Elementos a mostrar</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Logo de la empresa
                </label>
                <input
                  type="checkbox"
                  checked={settings.show_logo}
                  onChange={(e) => handleSettingChange('show_logo', e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              
              {settings.show_logo && (
                <div className="ml-6 space-y-3 border-l-2 border-blue-200 pl-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      URL del logo
                    </label>
                    <input
                      type="url"
                      value={settings.logo_url}
                      onChange={(e) => handleSettingChange('logo_url', e.target.value)}
                      placeholder="https://ejemplo.com/logo.png"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Recomendado: imagen cuadrada, máximo 200x200px, formato PNG o JPG
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tamaño del logo
                    </label>
                    <select
                      value={settings.logo_size}
                      onChange={(e) => handleSettingChange('logo_size', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="small">Pequeño (30px)</option>
                      <option value="medium">Mediano (50px)</option>
                      <option value="large">Grande (70px)</option>
                    </select>
                  </div>
                  
                  {settings.logo_url && (
                    <div className="bg-slate-50 p-3 rounded-lg border">
                      <p className="text-xs text-slate-600 mb-2">Vista previa:</p>
                      <img 
                        src={settings.logo_url} 
                        alt="Logo preview"
                        className={`mx-auto ${
                          settings.logo_size === 'small' ? 'w-8 h-8' :
                          settings.logo_size === 'large' ? 'w-16 h-16' : 'w-12 h-12'
                        } object-contain`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling!.textContent = 'Error al cargar la imagen';
                        }}
                      />
                      <p className="text-xs text-red-500 text-center mt-1 hidden">Error al cargar la imagen</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Información de la empresa
                </label>
                <input
                  type="checkbox"
                  checked={settings.show_company_info}
                  onChange={(e) => handleSettingChange('show_company_info', e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Información del cliente
                </label>
                <input
                  type="checkbox"
                  checked={settings.show_customer_info}
                  onChange={(e) => handleSettingChange('show_customer_info', e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Detalles de pago
                </label>
                <input
                  type="checkbox"
                  checked={settings.show_payment_details}
                  onChange={(e) => handleSettingChange('show_payment_details', e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Mensaje de pie de página
                </label>
                <input
                  type="checkbox"
                  checked={settings.show_footer_message}
                  onChange={(e) => handleSettingChange('show_footer_message', e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium text-slate-900">Mensajes personalizados</h4>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Encabezado personalizado
              </label>
              <textarea
                value={settings.receipt_header}
                onChange={(e) => handleSettingChange('receipt_header', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Mensaje que aparece al inicio del comprobante"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mensaje de agradecimiento
              </label>
              <input
                type="text"
                value={settings.footer_message}
                onChange={(e) => handleSettingChange('footer_message', e.target.value)}
                disabled={!settings.show_footer_message}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                placeholder="¡Gracias por su compra!"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Pie de página
              </label>
              <textarea
                value={settings.receipt_footer}
                onChange={(e) => handleSettingChange('receipt_footer', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Mensaje que aparece al final del comprobante"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdvancedTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Type className="h-5 w-5 mr-2 text-orange-600" />
          Configuración Avanzada
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              CSS Personalizado
            </label>
            <textarea
              value={settings.custom_css}
              onChange={(e) => handleSettingChange('custom_css', e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="/* Agrega tu CSS personalizado aquí */
body {
  font-family: 'Courier New', monospace;
}

.header {
  text-align: center;
  font-weight: bold;
}

.total {
  font-size: 16px;
  font-weight: bold;
}"
            />
            <p className="text-xs text-slate-500 mt-1">
              Puedes personalizar completamente el diseño del comprobante usando CSS
            </p>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-yellow-800">Advertencia</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  El CSS personalizado puede afectar la apariencia del comprobante. Asegúrate de probar la vista previa antes de guardar los cambios.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDatabaseTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Database className="h-5 w-5 mr-2 text-indigo-600" />
          Gestión de Base de Datos
        </h3>
        
        <div className="space-y-6">
          {/* Exportación de Base de Datos */}
          <div className="border border-slate-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-lg font-medium text-slate-900 mb-2 flex items-center">
                  <Download className="h-5 w-5 mr-2 text-blue-600" />
                  Exportar Base de Datos Completa
                </h4>
                <p className="text-slate-600 mb-4">
                  Descarga un archivo SQL con todos los datos de tu sistema, incluyendo productos, ventas, clientes, usuarios y configuraciones.
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                    <div>
                      <h5 className="text-sm font-medium text-blue-900">¿Qué incluye la exportación?</h5>
                      <ul className="text-sm text-blue-800 mt-1 space-y-1">
                        <li>• Todos los productos y categorías</li>
                        <li>• Historial completo de ventas</li>
                        <li>• Información de clientes y proveedores</li>
                        <li>• Usuarios y configuraciones</li>
                        <li>• Movimientos de caja registradora</li>
                        <li>• Pagos e instalments</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
                    <div>
                      <h5 className="text-sm font-medium text-yellow-900">Recomendaciones</h5>
                      <ul className="text-sm text-yellow-800 mt-1 space-y-1">
                        <li>• Realiza exportaciones periódicas como respaldo</li>
                        <li>• Guarda los archivos en un lugar seguro</li>
                        <li>• El archivo puede ser grande si tienes muchos datos</li>
                        <li>• La exportación puede tomar varios minutos</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={exportDatabase}
                disabled={exportLoading}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center font-medium"
              >
                {exportLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 mr-2" />
                    Exportar Base de Datos
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Información del Sistema */}
          <div className="border border-slate-200 rounded-lg p-6">
            <h4 className="text-lg font-medium text-slate-900 mb-4 flex items-center">
              <Info className="h-5 w-5 mr-2 text-green-600" />
              Información del Sistema
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Versión del Sistema:</span>
                  <span className="font-medium">VentasFULL v2.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Base de Datos:</span>
                  <span className="font-medium">PostgreSQL (Supabase)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Última Exportación:</span>
                  <span className="font-medium">
                    {localStorage.getItem('last_export_date') || 'Nunca'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Entorno:</span>
                  <span className="font-medium">Producción</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Región:</span>
                  <span className="font-medium">América del Sur</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Zona Horaria:</span>
                  <span className="font-medium">GMT-5 (Colombia)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900 flex items-center">
          <SettingsIcon className="h-8 w-8 mr-3 text-blue-600" />
          Configuración de Impresión
        </h2>
        <div className="flex gap-2">
          <PrintService
            sale={SAMPLE_SALE}
            settings={settings}
            onPrint={() => {}}
          />
          <button
            onClick={resetSettings}
            className="bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors duration-200 flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Restaurar
          </button>
          <button
            onClick={saveSettings}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'general', label: 'General', icon: Printer },
              { id: 'company', label: 'Empresa', icon: Info },
              { id: 'layout', label: 'Diseño', icon: Layout },
              { id: 'advanced', label: 'Avanzado', icon: Type },
              { id: 'database', label: 'Base de Datos', icon: Database }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="p-6">
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'company' && renderCompanyTab()}
          {activeTab === 'layout' && renderLayoutTab()}
          {activeTab === 'advanced' && renderAdvancedTab()}
          {activeTab === 'database' && renderDatabaseTab()}
        </div>
      </div>

      {/* Vista previa */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Eye className="h-5 w-5 mr-2 text-green-600" />
          Vista Previa del Comprobante
        </h3>
        
        <div className="bg-slate-50 p-4 rounded-lg">
          <div className="bg-white p-4 rounded border-2 border-dashed border-slate-300 max-w-sm mx-auto">
            <div className="font-mono text-xs space-y-1">
              {settings.show_logo && (
                <div className="text-center mb-2">
                  {settings.logo_url ? (
                    <img 
                      src={settings.logo_url} 
                      alt="Logo"
                      className={`mx-auto mb-1 object-contain ${
                        settings.logo_size === 'small' ? 'w-6 h-6' :
                        settings.logo_size === 'large' ? 'w-10 h-10' : 'w-8 h-8'
                      }`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className={`bg-slate-300 rounded-full mx-auto mb-1 flex items-center justify-center text-slate-600 text-xs ${
                      settings.logo_size === 'small' ? 'w-6 h-6' :
                      settings.logo_size === 'large' ? 'w-10 h-10' : 'w-8 h-8'
                    }`}>
                      LOGO
                    </div>
                  )}
                </div>
              )}
              
              {settings.show_company_info && (
                <div className="text-center border-b border-slate-300 pb-2 mb-2">
                  <div className="font-bold">{settings.company_name || 'NOMBRE DE LA EMPRESA'}</div>
                  {settings.company_address && <div>{settings.company_address}</div>}
                  {settings.company_phone && <div>Tel: {settings.company_phone}</div>}
                  {settings.company_email && <div>{settings.company_email}</div>}
                  {settings.tax_id && <div>NIT: {settings.tax_id}</div>}
                </div>
              )}
              
              {settings.receipt_header && (
                <div className="text-center border-b border-slate-300 pb-2 mb-2">
                  {settings.receipt_header}
                </div>
              )}
              
              <div className="border-b border-slate-300 pb-2 mb-2">
                <div className="flex justify-between">
                  <span>COMPROBANTE DE VENTA</span>
                  <span>#12345678</span>
                </div>
                <div>Fecha: {new Date().toLocaleDateString('es-ES')}</div>
                <div>Hora: {new Date().toLocaleTimeString('es-ES')}</div>
                <div>Vendedor: María González</div>
              </div>
              
              {settings.show_customer_info && (
                <div className="border-b border-slate-300 pb-2 mb-2">
                  <div>Cliente: Juan Pérez</div>
                  <div>CC: 12345678</div>
                  <div>Tel: 300-123-4567</div>
                </div>
              )}
              
              <div className="border-b border-slate-300 pb-2 mb-2">
                <div className="flex justify-between">
                  <span>Producto de Ejemplo 1</span>
                  <span>{formatCurrency(30000)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cant: 2 x {formatCurrency(15000)}</span>
                  <span></span>
                </div>
                <div className="flex justify-between">
                  <span>Producto de Ejemplo 2</span>
                  <span>{formatCurrency(15000)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cant: 1 x {formatCurrency(15000)}</span>
                  <span></span>
                </div>
              </div>
              
              <div className="border-b border-slate-300 pb-2 mb-2">
                <div className="flex justify-between font-bold">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(45000)}</span>
                </div>
              </div>
              
              {settings.show_payment_details && (
                <div className="border-b border-slate-300 pb-2 mb-2">
                  <div>Método de pago: Efectivo</div>
                  <div>Recibido: {formatCurrency(45000)}</div>
                  <div>Cambio: {formatCurrency(0)}</div>
                </div>
              )}
              
              {settings.show_footer_message && settings.footer_message && (
                <div className="text-center">
                  {settings.footer_message}
                </div>
              )}
              
              {settings.receipt_footer && (
                <div className="text-center border-t border-slate-300 pt-2 mt-2">
                  {settings.receipt_footer}
                </div>
              )}
              
              {(settings.show_barcode || settings.show_qr_code) && (
                <div className="text-center mt-2">
                  {settings.show_barcode && (
                    <div>
                      <div className="bg-slate-100 p-3 rounded border mx-auto mb-2 inline-block">
                        <div className="text-slate-800 text-xs font-mono mb-1">|||||| |||| |||||| ||||</div>
                        <div className="text-slate-600 text-xs font-mono">SALE12345678901</div>
                      </div>
                      <div className="text-xs text-slate-600">Código de Barras</div>
                    </div>
                  )}
                  {settings.show_qr_code && (
                    <div className="mt-2">
                      <div className="bg-slate-100 h-16 w-16 mx-auto mb-2 flex items-center justify-center border rounded relative">
                        <div className="absolute inset-1 border-2 border-slate-400"></div>
                        <div className="absolute top-1 left-1 w-2 h-2 bg-slate-600"></div>
                        <div className="absolute top-1 right-1 w-2 h-2 bg-slate-600"></div>
                        <div className="absolute bottom-1 left-1 w-2 h-2 bg-slate-600"></div>
                        <div className="text-slate-600 text-xs font-bold">QR</div>
                      </div>
                      <div className="text-xs text-slate-600">
                        {settings.qr_content === 'sale_id' ? 'ID Venta' :
                         settings.qr_content === 'company_info' ? 'Info Empresa' :
                         settings.qr_content === 'custom' ? 'Personalizado' :
                         'Código QR'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <p className="text-sm text-slate-600 text-center mt-4">
          Esta es una vista previa de cómo se verá el comprobante con la configuración actual
        </p>
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={hideNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />
    </div>
  );
}