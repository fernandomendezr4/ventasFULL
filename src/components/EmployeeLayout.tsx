import React from 'react';
import { ShoppingCart, Package, Tag, BarChart3, Home, Plus, Truck, Users, User, Calculator, CreditCard, Shield, LogOut } from 'lucide-react';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';

interface EmployeeLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function EmployeeLayout({ children, activeTab, onTabChange }: EmployeeLayoutProps) {
  const { user, hasPermission, signOut } = useEmployeeAuth();
  const [showProfile, setShowProfile] = React.useState(false);

  const handleSignOut = async () => {
    if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      await signOut();
    }
  };

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
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: Home, 
      category: 'main',
      permission: 'view_dashboard'
    },
  ];

  const salesTabs = [
    { 
      id: 'new-sale', 
      label: 'Nueva Venta', 
      icon: Plus, 
      category: 'sales',
      permission: 'create_sales'
    },
    { 
      id: 'cash-register', 
      label: 'Caja', 
      icon: Calculator, 
      category: 'sales',
      permission: 'manage_cash_register'
    },
    { 
      id: 'sales', 
      label: 'Historial', 
      icon: BarChart3, 
      category: 'sales',
      permission: 'view_sales'
    },
    { 
      id: 'installments', 
      label: 'Abonos', 
      icon: CreditCard, 
      category: 'sales',
      permission: 'manage_installments'
    },
  ];

  const inventoryTabs = [
    { 
      id: 'products', 
      label: 'Productos', 
      icon: Package, 
      category: 'inventory',
      permission: 'view_products'
    },
    { 
      id: 'categories', 
      label: 'Categorías', 
      icon: Tag, 
      category: 'inventory',
      permission: 'view_categories'
    },
  ];

  const contactsTabs = [
    { 
      id: 'customers', 
      label: 'Clientes', 
      icon: Users, 
      category: 'contacts',
      permission: 'view_customers'
    },
    { 
      id: 'suppliers', 
      label: 'Proveedores', 
      icon: Truck, 
      category: 'contacts',
      permission: 'view_suppliers'
    },
  ];

  const adminTabs = [
    { 
      id: 'users', 
      label: 'Usuarios', 
      icon: User, 
      category: 'admin',
      permission: 'manage_users'
    },
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
                {[...mainTabs, ...salesTabs, ...inventoryTabs, ...contactsTabs, ...adminTabs]
                  .find(tab => tab.id === activeTab)?.label || 'Dashboard'}
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
                  <Shield className="h-3 w-3 inline mr-1" />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Mi Perfil
                </h3>
                <button
                  onClick={() => setShowProfile(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors duration-200"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <User className="h-8 w-8 text-blue-600" />
                  </div>
                  <h4 className="text-xl font-semibold text-slate-900">{user?.name}</h4>
                  <span className={`inline-block text-xs px-2 py-1 rounded-full mt-2 ${getRoleColor(user?.role || '')}`}>
                    <Shield className="h-3 w-3 inline mr-1" />
                    {getRoleLabel(user?.role || '')}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center text-slate-600">
                    <svg className="h-4 w-4 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                    <span>{user?.email}</span>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleSignOut}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center justify-center"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}