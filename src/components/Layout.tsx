import React from 'react';
import { ShoppingCart, Package, Tag, BarChart3, Home, Plus, Truck, Users, User, Calculator, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UserProfile from './UserProfile';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { user, hasPermission } = useAuth();
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
    { id: 'new-sale', label: 'Nueva Venta', icon: Plus, category: 'sales', permission: 'create_sales' },
    { id: 'cash-register', label: 'Caja', icon: Calculator, category: 'sales', permission: 'manage_cash_register' },
    { id: 'sales', label: 'Historial', icon: BarChart3, category: 'sales', permission: 'view_sales' },
    { id: 'installments', label: 'Abonos', icon: CreditCard, category: 'sales', permission: 'manage_installments' },
  ];

  const inventoryTabs = [
    { id: 'products', label: 'Productos', icon: Package, category: 'inventory', permission: 'view_products' },
    { id: 'categories', label: 'Categorías', icon: Tag, category: 'inventory', permission: 'view_categories' },
  ];

  const contactsTabs = [
    { id: 'customers', label: 'Clientes', icon: Users, category: 'contacts', permission: 'view_customers' },
    { id: 'suppliers', label: 'Proveedores', icon: Truck, category: 'contacts', permission: 'view_suppliers' },
  ];

  const adminTabs = [
    { id: 'users', label: 'Usuarios', icon: User, category: 'admin', permission: 'manage_users' },
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
              className={`w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? `${bgColor} text-white shadow-sm`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg border-r border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-600 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-bold text-slate-900">VentasFULL</h1>
              <p className="text-xs text-slate-500">Sistema de Ventas</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4 overflow-y-auto">
          {renderTabGroup('Principal', mainTabs, 'bg-blue-600')}
          {renderTabGroup('Ventas', salesTabs, 'bg-green-600')}
          {renderTabGroup('Inventario', inventoryTabs, 'bg-purple-600')}
          {renderTabGroup('Contactos', contactsTabs, 'bg-orange-600')}
          {renderTabGroup('Administración', adminTabs, 'bg-red-600')}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200">
          <div className="text-center space-y-2">
            <button
              onClick={() => setShowProfile(true)}
              className="w-full p-2 text-left hover:bg-slate-50 rounded-lg transition-colors duration-200"
            >
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{getRoleLabel(user?.role || '')}</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white shadow-sm border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {mainTabs.find(tab => tab.id === activeTab)?.label ||
                 salesTabs.find(tab => tab.id === activeTab)?.label ||
                 inventoryTabs.find(tab => tab.id === activeTab)?.label ||
                 contactsTabs.find(tab => tab.id === activeTab)?.label ||
                 adminTabs.find(tab => tab.id === activeTab)?.label ||
                 'Dashboard'}
              </h2>
              <p className="text-sm text-slate-600">
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
                <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                <span className={`inline-block text-xs px-2 py-1 rounded-full ${getRoleColor(user?.role || '')}`}>
                  {getRoleLabel(user?.role || '')}
                </span>
              </div>
              <button
                onClick={() => setShowProfile(true)}
                className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center hover:bg-blue-200 transition-colors duration-200"
              >
                <User className="h-4 w-4 text-blue-600" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto">
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