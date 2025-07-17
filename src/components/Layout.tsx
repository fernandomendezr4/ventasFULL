import React from 'react';
import { ShoppingCart, Package, Tag, BarChart3, Home, Plus, Truck, Users, User, Calculator, CreditCard, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import UserProfile from './UserProfile';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { user, hasPermission, permissions } = useAuth();
  const { theme } = useTheme();
  const [showProfile, setShowProfile] = React.useState(false);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-purple-100 text-purple-800';
      case 'employee':
        return 'bg-blue-100 text-blue-800';
      case 'cashier':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'manager':
        return 'Gerente';
      case 'employee':
        return 'Empleado';
      case 'cashier':
        return 'Cajero';
      default:
        return role;
    }
  };

  const mainTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, category: 'main', permission: 'view_dashboard' },
  ];

  const salesTabs = [
    { id: 'cash-register', label: 'Caja', icon: Calculator, category: 'sales', permission: 'manage_cash_register' },
    { id: 'new-sale', label: 'Nueva Venta', icon: Plus, category: 'sales', permission: 'create_sales' },
    { id: 'sales', label: 'Historial', icon: BarChart3, category: 'sales', permission: 'view_sales' },
    { id: 'installments', label: 'Abonos', icon: CreditCard, category: 'sales', permission: 'manage_installments' },
  ];

  const inventoryTabs = [
    { id: 'products', label: 'Productos', icon: Package, category: 'inventory', permission: 'manage_products' },
    { id: 'categories', label: 'Categorías', icon: Tag, category: 'inventory', permission: 'view_categories' },
  ];

  const contactsTabs = [
    { id: 'customers', label: 'Clientes', icon: Users, category: 'contacts', permission: 'view_customers' },
    { id: 'suppliers', label: 'Proveedores', icon: Truck, category: 'contacts', permission: 'view_suppliers' },
  ];

  const adminTabs = [
    { id: 'users', label: 'Usuarios', icon: User, category: 'admin', permission: 'manage_users' },
    { id: 'settings', label: 'Configuración', icon: Settings, category: 'admin', permission: 'manage_settings' },
  ];

  const renderTabGroup = (title: string, tabs: typeof mainTabs, bgColor: string) => {
    const visibleTabs = tabs.filter(tab => hasPermission(tab.permission));
    
    if (visibleTabs.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">
        {title}
      </h3>
        <nav className="space-y-1">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`sidebar-item ${
                activeTab === tab.id
                  ? `${bgColor} sidebar-item-active`
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 mr-3" />
              {tab.label}
            </button>
          );
        })}
        </nav>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex transition-all duration-300 ease-smooth page-transition">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-800 shadow-lg border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 ease-smooth animate-slide-in-left">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          {React.useEffect(() => {
            // Actualizar el título de la página con el nombre configurado
            const savedSettings = localStorage.getItem('app_settings');
            if (savedSettings) {
              const settings = JSON.parse(savedSettings);
              document.title = settings.app_name || 'VentasFULL';
            }
          }, [])}
          <div className="flex items-center animate-fade-in">
            <div className="p-2 bg-blue-600 dark:bg-blue-500 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                {(() => {
                  const savedSettings = localStorage.getItem('app_settings');
                  if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    return settings.app_name || 'VentasFULL';
                  }
                  return 'VentasFULL';
                })()}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sistema de Ventas</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4 overflow-y-auto scrollbar-hide space-y-6">
          {/* Debug info - solo para desarrollo */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
              <p>Usuario: {user?.name}</p>
              <p>Rol: {user?.role}</p>
              <p>Permisos: {permissions.length}</p>
            </div>
          )}
          {renderTabGroup('Principal', mainTabs, 'bg-blue-600')}
          {renderTabGroup('Ventas', salesTabs, 'bg-green-600')}
          {renderTabGroup('Inventario', inventoryTabs, 'bg-purple-600')}
          {renderTabGroup('Contactos', contactsTabs, 'bg-orange-600')}
          {renderTabGroup('Administración', adminTabs, 'bg-red-600')}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-center space-y-2">
            <button
              onClick={() => setShowProfile(true)}
              className="w-full p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all duration-200 ease-smooth hover:scale-105"
            >
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mr-3">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{getRoleLabel(user?.role || '')}</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 px-6 py-4 transition-all duration-300 ease-smooth animate-slide-in-down">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {mainTabs.find(tab => tab.id === activeTab)?.label ||
                 salesTabs.find(tab => tab.id === activeTab)?.label ||
                 inventoryTabs.find(tab => tab.id === activeTab)?.label ||
                 contactsTabs.find(tab => tab.id === activeTab)?.label ||
                 adminTabs.find(tab => tab.id === activeTab)?.label ||
                 'Dashboard'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {new Date().toLocaleDateString('es-ES', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.name}</p>
                <span className={`inline-block text-xs px-2 py-1 rounded-full ${getRoleColor(user?.role || '')}`}>
                  {getRoleLabel(user?.role || '')}
                </span>
              </div>
              <button
                onClick={() => setShowProfile(true)}
                className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-800 transition-all duration-200 ease-smooth hover:scale-110 active:scale-95"
              >
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto view-container">
          {children}
        </main>
      </div>

      {/* User Profile Modal */}
      {showProfile && (
        <UserProfile onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}