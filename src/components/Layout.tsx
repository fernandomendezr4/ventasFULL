import React from 'react';
import { ShoppingCart, Package, Tag, BarChart3, Home, Plus, Truck, Users, User, Calculator, CreditCard } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const mainTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, category: 'main' },
    { id: 'new-sale', label: 'Nueva Venta', icon: Plus, category: 'sales' },
    { id: 'cash-register', label: 'Caja', icon: Calculator, category: 'sales' },
  ];

  const salesTabs = [
    { id: 'sales', label: 'Historial', icon: BarChart3, category: 'sales' },
    { id: 'installments', label: 'Abonos', icon: CreditCard, category: 'sales' },
  ];

  const inventoryTabs = [
    { id: 'products', label: 'Productos', icon: Package, category: 'inventory' },
    { id: 'categories', label: 'Categorías', icon: Tag, category: 'inventory' },
  ];

  const contactsTabs = [
    { id: 'customers', label: 'Clientes', icon: Users, category: 'contacts' },
    { id: 'suppliers', label: 'Proveedores', icon: Truck, category: 'contacts' },
  ];

  const adminTabs = [
    { id: 'users', label: 'Usuarios', icon: User, category: 'admin' },
  ];

  const renderTabGroup = (title: string, tabs: typeof mainTabs, bgColor: string) => (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">
        {title}
      </h3>
      <nav className="space-y-1">
        {tabs.map((tab) => {
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
          <div className="text-center">
            <p className="text-xs text-slate-500">Modo Libre</p>
            <p className="text-xs text-slate-400 mt-1">Sin autenticación</p>
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
                <p className="text-sm font-medium text-slate-900">Sistema Activo</p>
                <p className="text-xs text-green-600">● En línea</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}