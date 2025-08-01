import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Database, Printer, Building, User, Palette, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import DatabaseHealthMonitor from './DatabaseHealthMonitor';

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  
  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    app_name: 'VentasFULL',
    company_name: 'Mi Empresa',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    tax_id: '',
    currency: 'COP',
    timezone: 'America/Bogota'
  });

  // Print Settings
  const [printSettings, setPrintSettings] = useState({
    print_enabled: true,
    auto_print: false,
    print_copies: 1,
    receipt_width: '80mm',
    font_size: 'medium',
    line_spacing: 'normal',
    show_logo: true,
    show_company_info: true,
    show_customer_info: true,
    show_payment_details: true,
    show_barcode: false,
    show_qr_code: false,
    show_footer_message: true,
    footer_message: '¡Gracias por su compra!',
    receipt_header: '',
    receipt_footer: 'Conserve este comprobante'
  });

  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState([
    { id: 'cash', name: 'Efectivo', icon: 'Banknote', enabled: true },
    { id: 'card', name: 'Tarjeta', icon: 'CreditCard', enabled: true },
    { id: 'transfer', name: 'Transferencia Bancaria', icon: 'Building2', enabled: true },
    { id: 'nequi', name: 'NEQUI', icon: 'Smartphone', enabled: true }
  ]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      // Load general settings
      const savedGeneral = localStorage.getItem('app_settings');
      if (savedGeneral) {
        setGeneralSettings({ ...generalSettings, ...JSON.parse(savedGeneral) });
      }

      // Load print settings
      const savedPrint = localStorage.getItem('print_settings');
      if (savedPrint) {
        setPrintSettings({ ...printSettings, ...JSON.parse(savedPrint) });
      }

      // Load payment methods
      const savedPayments = localStorage.getItem('payment_methods');
      if (savedPayments) {
        setPaymentMethods(JSON.parse(savedPayments));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      
      // Save to localStorage
      localStorage.setItem('app_settings', JSON.stringify(generalSettings));
      localStorage.setItem('print_settings', JSON.stringify(printSettings));
      localStorage.setItem('payment_methods', JSON.stringify(paymentMethods));
      
      alert('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error al guardar configuración: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resetSettings = () => {
    if (window.confirm('¿Estás seguro de que quieres restablecer toda la configuración?')) {
      localStorage.removeItem('app_settings');
      localStorage.removeItem('print_settings');
      localStorage.removeItem('payment_methods');
      loadSettings();
      alert('Configuración restablecida');
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Building },
    { id: 'print', label: 'Impresión', icon: Printer },
    { id: 'appearance', label: 'Apariencia', icon: Palette },
    { id: 'database', label: 'Base de Datos', icon: Database }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Configuración</h2>
        <div className="flex gap-2">
          <button
            onClick={resetSettings}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Restablecer
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
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-6 py-4 text-sm font-medium transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Información General</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre de la Aplicación
                    </label>
                    <input
                      type="text"
                      value={generalSettings.app_name}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, app_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre de la Empresa
                    </label>
                    <input
                      type="text"
                      value={generalSettings.company_name}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, company_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={generalSettings.company_phone}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, company_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={generalSettings.company_email}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, company_email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Dirección
                    </label>
                    <textarea
                      value={generalSettings.company_address}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, company_address: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'print' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Configuración de Impresión</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Ancho del Comprobante
                    </label>
                    <select
                      value={printSettings.receipt_width}
                      onChange={(e) => setPrintSettings({ ...printSettings, receipt_width: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="58mm">58mm (Pequeño)</option>
                      <option value="80mm">80mm (Estándar)</option>
                      <option value="110mm">110mm (Grande)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tamaño de Fuente
                    </label>
                    <select
                      value={printSettings.font_size}
                      onChange={(e) => setPrintSettings({ ...printSettings, font_size: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="small">Pequeña</option>
                      <option value="medium">Mediana</option>
                      <option value="large">Grande</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-medium text-slate-900 mb-3">Elementos a Mostrar</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'show_logo', label: 'Mostrar Logo' },
                      { key: 'show_company_info', label: 'Información de la Empresa' },
                      { key: 'show_customer_info', label: 'Información del Cliente' },
                      { key: 'show_payment_details', label: 'Detalles de Pago' },
                      { key: 'show_barcode', label: 'Código de Barras' },
                      { key: 'show_qr_code', label: 'Código QR' },
                      { key: 'show_footer_message', label: 'Mensaje de Pie' },
                      { key: 'auto_print', label: 'Impresión Automática' }
                    ].map((setting) => (
                      <div key={setting.key} className="flex items-center">
                        <input
                          type="checkbox"
                          id={setting.key}
                          checked={printSettings[setting.key as keyof typeof printSettings] as boolean}
                          onChange={(e) => setPrintSettings({ 
                            ...printSettings, 
                            [setting.key]: e.target.checked 
                          })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                        />
                        <label htmlFor={setting.key} className="ml-2 text-sm text-slate-700">
                          {setting.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Mensaje de Pie de Página
                  </label>
                  <textarea
                    value={printSettings.footer_message}
                    onChange={(e) => setPrintSettings({ ...printSettings, footer_message: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="¡Gracias por su compra!"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Apariencia</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Tema de la Aplicación
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setTheme('light')}
                        className={`p-4 border-2 rounded-lg transition-colors duration-200 ${
                          theme === 'light'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <div className="w-8 h-8 bg-white border border-slate-300 rounded mx-auto mb-2"></div>
                        <span className="text-sm font-medium">Tema Claro</span>
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`p-4 border-2 rounded-lg transition-colors duration-200 ${
                          theme === 'dark'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <div className="w-8 h-8 bg-slate-800 border border-slate-600 rounded mx-auto mb-2"></div>
                        <span className="text-sm font-medium">Tema Oscuro</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'database' && user?.role === 'admin' && (
            <div className="space-y-6">
              <DatabaseHealthMonitor />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}