import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Printer, Save, Eye, RefreshCw, FileText, Image, Info, Type, Layout, Download, Database, AlertCircle, CreditCard, Upload, Trash2 } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import PrintService from './PrintService';
import NotificationModal from './NotificationModal';
import { useNotification } from '../hooks/useNotification';
import { supabase } from '../lib/supabase';
import { TabTransition } from './ViewTransition';

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
  const [activeTab, setActiveTab] = useState<'general' | 'company' | 'layout' | 'payment' | 'advanced' | 'database'>('general');
  const [paymentMethods, setPaymentMethods] = useState([
    { id: 'cash', name: 'Efectivo', icon: 'Banknote', image_url: '' },
    { id: 'card', name: 'Tarjeta', icon: 'CreditCard', image_url: '' },
    { id: 'transfer', name: 'Transferencia Bancaria', icon: 'Building2', image_url: '' },
    { id: 'nequi', name: 'NEQUI', icon: 'Smartphone', image_url: '' }
  ]);

  useEffect(() => {
    loadSettings();
    loadPaymentMethods();
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

  const loadPaymentMethods = () => {
    try {
      const savedMethods = localStorage.getItem('payment_methods');
      if (savedMethods) {
        const methods = JSON.parse(savedMethods);
        setPaymentMethods(methods);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
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

  const savePaymentMethods = () => {
    try {
      localStorage.setItem('payment_methods', JSON.stringify(paymentMethods));
      showSuccess(
        '¡Métodos de Pago Guardados!',
        'Los métodos de pago han sido actualizados exitosamente.'
      );
    } catch (error) {
      console.error('Error saving payment methods:', error);
      showError(
        'Error al Guardar',
        'No se pudieron guardar los métodos de pago. ' + (error as Error).message
      );
    }
  };

  const handleImageUpload = (methodId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 100KB)
    if (file.size > 100 * 1024) {
      showWarning(
        'Archivo Muy Grande',
        'La imagen debe ser menor a 100KB. Por favor, reduce el tamaño de la imagen.'
      );
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showWarning(
        'Tipo de Archivo Inválido',
        'Solo se permiten archivos de imagen (PNG, JPG, GIF, etc.).'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setPaymentMethods(prev => 
        prev.map(method => 
          method.id === methodId 
            ? { ...method, image_url: imageUrl }
            : method
        )
      );
    };
    reader.readAsDataURL(file);
  };

  const removePaymentMethodImage = (methodId: string) => {
    setPaymentMethods(prev => 
      prev.map(method => 
        method.id === methodId 
          ? { ...method, image_url: '' }
          : method
      )
    );
  };

  const updatePaymentMethodName = (methodId: string, newName: string) => {
    setPaymentMethods(prev => 
      prev.map(method => 
        method.id === methodId 
          ? { ...method, name: newName }
          : method
      )
    );
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
                  <option value="sale_details">Detalles completos de la venta</option>
                  <option value="company_info">Información de la empresa</option>
                  <option value="verification_url">URL de verificación</option>
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

  const renderPaymentTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <CreditCard className="h-5 w-5 mr-2 text-indigo-600" />
          Métodos de Pago
        </h3>
        
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Personalización de Métodos de Pago</h4>
                <p className="text-sm text-blue-800 mt-1">
                  Puedes personalizar los nombres y agregar imágenes para cada método de pago. 
                  Las imágenes deben ser menores a 100KB y preferiblemente cuadradas para mejor visualización.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paymentMethods.map((method) => (
              <div key={method.id} className="border border-slate-200 rounded-lg p-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre del Método
                    </label>
                    <input
                      type="text"
                      value={method.name}
                      onChange={(e) => updatePaymentMethodName(method.id, e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-