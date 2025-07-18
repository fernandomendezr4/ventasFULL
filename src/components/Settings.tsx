import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Building2, Printer, Palette, Shield, Bell, Database, Smartphone, CreditCard, Plus, Edit2, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import FormattedNumberInput from './FormattedNumberInput';
import NotificationModal from './NotificationModal';
import { useNotification } from '../hooks/useNotification';

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  image_url?: string;
}

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'cash', name: 'Efectivo', icon: 'Banknote' },
  { id: 'card', name: 'Tarjeta', icon: 'CreditCard' },
  { id: 'transfer', name: 'Transferencia Bancaria', icon: 'Building2' },
  { id: 'nequi', name: 'NEQUI', icon: 'Smartphone' }
];

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notification, showSuccess, showError, showWarning, hideNotification } = useNotification();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);

  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    app_name: 'VentasFULL',
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    tax_id: '',
    logo_url: '',
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
    logo_size: 'medium',
    show_logo: true,
    show_company_info: true,
    show_customer_info: true,
    show_payment_details: true,
    show_barcode: false,
    show_qr_code: false,
    qr_content: 'sale_details',
    qr_custom_text: '',
    show_footer_message: true,
    footer_message: '¡Gracias por su compra!',
    receipt_header: '',
    receipt_footer: 'Conserve este comprobante',
    custom_css: ''
  });

  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DEFAULT_PAYMENT_METHODS);
  const [showPaymentMethodForm, setShowPaymentMethodForm] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    name: '',
    icon: 'CreditCard',
    image_url: ''
  });

  // Security Settings
  const [securitySettings, setSecuritySettings] = useState({
    session_timeout: 480, // 8 hours in minutes
    require_password_change: false,
    password_min_length: 6,
    enable_two_factor: false,
    login_attempts_limit: 5,
    auto_logout_inactive: true
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    low_stock_alerts: true,
    daily_reports: false,
    sale_notifications: true,
    backup_reminders: true,
    stock_threshold: 10
  });

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
      const savedPaymentMethods = localStorage.getItem('payment_methods');
      if (savedPaymentMethods) {
        setPaymentMethods(JSON.parse(savedPaymentMethods));
      }

      // Load security settings
      const savedSecurity = localStorage.getItem('security_settings');
      if (savedSecurity) {
        setSecuritySettings({ ...securitySettings, ...JSON.parse(savedSecurity) });
      }

      // Load notification settings
      const savedNotifications = localStorage.getItem('notification_settings');
      if (savedNotifications) {
        setNotificationSettings({ ...notificationSettings, ...JSON.parse(savedNotifications) });
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
      localStorage.setItem('security_settings', JSON.stringify(securitySettings));
      localStorage.setItem('notification_settings', JSON.stringify(notificationSettings));

      // Update document title
      document.title = generalSettings.app_name || 'VentasFULL';

      showSuccess(
        '¡Configuración Guardada!',
        'Todos los cambios han sido guardados exitosamente'
      );
    } catch (error) {
      console.error('Error saving settings:', error);
      showError(
        'Error al Guardar',
        'No se pudieron guardar los cambios. Intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = () => {
    if (!paymentMethodForm.name.trim()) {
      showWarning('Campo Requerido', 'El nombre del método de pago es requerido');
      return;
    }

    const newMethod: PaymentMethod = {
      id: Date.now().toString(),
      name: paymentMethodForm.name,
      icon: paymentMethodForm.icon,
      image_url: paymentMethodForm.image_url || undefined
    };

    if (editingPaymentMethod) {
      setPaymentMethods(paymentMethods.map(method => 
        method.id === editingPaymentMethod.id ? { ...newMethod, id: editingPaymentMethod.id } : method
      ));
    } else {
      setPaymentMethods([...paymentMethods, newMethod]);
    }

    setShowPaymentMethodForm(false);
    setEditingPaymentMethod(null);
    setPaymentMethodForm({ name: '', icon: 'CreditCard', image_url: '' });
  };

  const handleEditPaymentMethod = (method: PaymentMethod) => {
    setEditingPaymentMethod(method);
    setPaymentMethodForm({
      name: method.name,
      icon: method.icon,
      image_url: method.image_url || ''
    });
    setShowPaymentMethodForm(true);
  };

  const handleDeletePaymentMethod = (methodId: string) => {
    if (paymentMethods.length <= 1) {
      showWarning('No se puede eliminar', 'Debe haber al menos un método de pago disponible');
      return;
    }

    if (window.confirm('¿Estás seguro de que quieres eliminar este método de pago?')) {
      setPaymentMethods(paymentMethods.filter(method => method.id !== methodId));
    }
  };

  const resetToDefaults = () => {
    if (window.confirm('¿Estás seguro de que quieres restaurar la configuración por defecto? Esto eliminará todos los cambios personalizados.')) {
      localStorage.removeItem('app_settings');
      localStorage.removeItem('print_settings');
      localStorage.removeItem('payment_methods');
      localStorage.removeItem('security_settings');
      localStorage.removeItem('notification_settings');
      
      setGeneralSettings({
        app_name: 'VentasFULL',
        company_name: '',
        company_address: '',
        company_phone: '',
        company_email: '',
        company_website: '',
        tax_id: '',
        logo_url: '',
        currency: 'COP',
        timezone: 'America/Bogota'
      });
      
      setPaymentMethods(DEFAULT_PAYMENT_METHODS);
      
      showSuccess(
        'Configuración Restaurada',
        'Se ha restaurado la configuración por defecto'
      );
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'print', label: 'Impresión', icon: Printer },
    { id: 'payments', label: 'Métodos de Pago', icon: CreditCard },
    { id: 'security', label: 'Seguridad', icon: Shield },
    { id: 'notifications', label: 'Notificaciones', icon: Bell },
    { id: 'advanced', label: 'Avanzado', icon: Database }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <SettingsIcon className="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Configuración</h2>
            <p className="text-slate-600">Personaliza tu sistema de ventas</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200 text-sm"
          >
            Restaurar Defaults
          </button>
          <button
            onClick={saveSettings}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border">
        {/* Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
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

        {/* Tab Content */}
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Sitio Web
                    </label>
                    <input
                      type="url"
                      value={generalSettings.company_website}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, company_website: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      NIT/RUT
                    </label>
                    <input
                      type="text"
                      value={generalSettings.tax_id}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, tax_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="mt-4">
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
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    URL del Logo
                  </label>
                  <input
                    type="url"
                    value={generalSettings.logo_url}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, logo_url: e.target.value })}
                    placeholder="https://ejemplo.com/logo.png"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    URL de una imagen para usar como logo en los comprobantes
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Preferencias</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tema
                    </label>
                    <button
                      onClick={toggleTheme}
                      className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
                    >
                      <span>{theme === 'light' ? 'Claro' : 'Oscuro'}</span>
                      <Palette className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Moneda
                    </label>
                    <select
                      value={generalSettings.currency}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="COP">Peso Colombiano (COP)</option>
                      <option value="USD">Dólar Americano (USD)</option>
                      <option value="EUR">Euro (EUR)</option>
                    </select>
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Copias a Imprimir
                    </label>
                    <FormattedNumberInput
                      value={printSettings.print_copies.toString()}
                      onChange={(value) => setPrintSettings({ ...printSettings, print_copies: parseInt(value) || 1 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                      max="5"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Elementos del Comprobante</h3>
                <div className="space-y-3">
                  {[
                    { key: 'show_logo', label: 'Mostrar Logo' },
                    { key: 'show_company_info', label: 'Mostrar Información de la Empresa' },
                    { key: 'show_customer_info', label: 'Mostrar Información del Cliente' },
                    { key: 'show_payment_details', label: 'Mostrar Detalles de Pago' },
                    { key: 'show_barcode', label: 'Mostrar Código de Barras' },
                    { key: 'show_qr_code', label: 'Mostrar Código QR' },
                    { key: 'show_footer_message', label: 'Mostrar Mensaje de Pie' },
                    { key: 'auto_print', label: 'Impresión Automática' }
                  ].map((item) => (
                    <label key={item.key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={printSettings[item.key as keyof typeof printSettings] as boolean}
                        onChange={(e) => setPrintSettings({ ...printSettings, [item.key]: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Mensajes Personalizados</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Encabezado del Comprobante
                    </label>
                    <input
                      type="text"
                      value={printSettings.receipt_header}
                      onChange={(e) => setPrintSettings({ ...printSettings, receipt_header: e.target.value })}
                      placeholder="Texto que aparece al inicio del comprobante"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Mensaje de Pie
                    </label>
                    <input
                      type="text"
                      value={printSettings.footer_message}
                      onChange={(e) => setPrintSettings({ ...printSettings, footer_message: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Pie del Comprobante
                    </label>
                    <input
                      type="text"
                      value={printSettings.receipt_footer}
                      onChange={(e) => setPrintSettings({ ...printSettings, receipt_footer: e.target.value })}
                      placeholder="Texto que aparece al final del comprobante"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Métodos de Pago</h3>
                <button
                  onClick={() => {
                    setEditingPaymentMethod(null);
                    setPaymentMethodForm({ name: '', icon: 'CreditCard', image_url: '' });
                    setShowPaymentMethodForm(true);
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center text-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Método
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        {method.image_url ? (
                          <img 
                            src={method.image_url} 
                            alt={method.name}
                            className="h-6 w-6 object-contain mr-3"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="h-6 w-6 mr-3 flex items-center justify-center">
                            {method.icon === 'Banknote' && <span>💵</span>}
                            {method.icon === 'CreditCard' && <CreditCard className="h-5 w-5" />}
                            {method.icon === 'Building2' && <Building2 className="h-5 w-5" />}
                            {method.icon === 'Smartphone' && <Smartphone className="h-5 w-5" />}
                          </div>
                        )}
                        <span className="font-medium text-slate-900">{method.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditPaymentMethod(method)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePaymentMethod(method.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment Method Form Modal */}
              {showPaymentMethodForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
                  <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto animate-scale-in">
                    <div className="p-6 border-b border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {editingPaymentMethod ? 'Editar Método de Pago' : 'Agregar Método de Pago'}
                      </h3>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Nombre *
                        </label>
                        <input
                          type="text"
                          value={paymentMethodForm.name}
                          onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Ej: PayPal, Daviplata, etc."
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Icono
                        </label>
                        <select
                          value={paymentMethodForm.icon}
                          onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, icon: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="CreditCard">Tarjeta</option>
                          <option value="Banknote">Efectivo</option>
                          <option value="Building2">Banco</option>
                          <option value="Smartphone">Móvil</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          URL de Imagen (opcional)
                        </label>
                        <input
                          type="url"
                          value={paymentMethodForm.image_url}
                          onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, image_url: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="https://ejemplo.com/icono.png"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Si se proporciona, se usará en lugar del icono por defecto
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-6 border-t border-slate-200 flex gap-3">
                      <button
                        onClick={handleAddPaymentMethod}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                      >
                        {editingPaymentMethod ? 'Actualizar' : 'Agregar'}
                      </button>
                      <button
                        onClick={() => {
                          setShowPaymentMethodForm(false);
                          setEditingPaymentMethod(null);
                          setPaymentMethodForm({ name: '', icon: 'CreditCard', image_url: '' });
                        }}
                        className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Configuración de Seguridad</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tiempo de Sesión (minutos)
                    </label>
                    <FormattedNumberInput
                      value={securitySettings.session_timeout.toString()}
                      onChange={(value) => setSecuritySettings({ ...securitySettings, session_timeout: parseInt(value) || 480 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="30"
                      max="1440"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Longitud Mínima de Contraseña
                    </label>
                    <FormattedNumberInput
                      value={securitySettings.password_min_length.toString()}
                      onChange={(value) => setSecuritySettings({ ...securitySettings, password_min_length: parseInt(value) || 6 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="4"
                      max="20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Límite de Intentos de Login
                    </label>
                    <FormattedNumberInput
                      value={securitySettings.login_attempts_limit.toString()}
                      onChange={(value) => setSecuritySettings({ ...securitySettings, login_attempts_limit: parseInt(value) || 5 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="3"
                      max="10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Opciones de Seguridad</h3>
                <div className="space-y-3">
                  {[
                    { key: 'auto_logout_inactive', label: 'Cerrar sesión automáticamente por inactividad' },
                    { key: 'require_password_change', label: 'Requerir cambio de contraseña periódico' },
                    { key: 'enable_two_factor', label: 'Habilitar autenticación de dos factores (próximamente)' }
                  ].map((item) => (
                    <label key={item.key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={securitySettings[item.key as keyof typeof securitySettings] as boolean}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, [item.key]: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        disabled={item.key === 'enable_two_factor'}
                      />
                      <span className={`ml-2 text-sm ${item.key === 'enable_two_factor' ? 'text-slate-400' : 'text-slate-700'}`}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Configuración de Notificaciones</h3>
                <div className="space-y-3">
                  {[
                    { key: 'email_notifications', label: 'Notificaciones por Email' },
                    { key: 'low_stock_alerts', label: 'Alertas de Stock Bajo' },
                    { key: 'daily_reports', label: 'Reportes Diarios' },
                    { key: 'sale_notifications', label: 'Notificaciones de Ventas' },
                    { key: 'backup_reminders', label: 'Recordatorios de Respaldo' }
                  ].map((item) => (
                    <label key={item.key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={notificationSettings[item.key as keyof typeof notificationSettings] as boolean}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, [item.key]: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Umbrales de Alerta</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Umbral de Stock Bajo
                    </label>
                    <FormattedNumberInput
                      value={notificationSettings.stock_threshold.toString()}
                      onChange={(value) => setNotificationSettings({ ...notificationSettings, stock_threshold: parseInt(value) || 10 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                      max="100"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Se enviará alerta cuando el stock sea menor o igual a este valor
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Configuración Avanzada</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <Bell className="h-5 w-5 text-yellow-600 mr-3" />
                    <div>
                      <h4 className="text-yellow-900 font-medium">Configuración Avanzada</h4>
                      <p className="text-yellow-800 text-sm mt-1">
                        Estas configuraciones son para usuarios avanzados. Cambios incorrectos pueden afectar el funcionamiento del sistema.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      CSS Personalizado para Impresión
                    </label>
                    <textarea
                      value={printSettings.custom_css}
                      onChange={(e) => setPrintSettings({ ...printSettings, custom_css: e.target.value })}
                      rows={6}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder="/* CSS personalizado para comprobantes */
.custom-header {
  color: #333;
  font-weight: bold;
}"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      CSS que se aplicará a los comprobantes impresos
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg">
                    <h4 className="font-medium text-slate-900 mb-2">Información del Sistema</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>Versión: 1.0.0</p>
                      <p>Usuario actual: {user?.name} ({user?.role})</p>
                      <p>Última actualización: {new Date().toLocaleDateString('es-ES')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
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