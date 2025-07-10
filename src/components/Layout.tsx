import React from 'react';
import { ShoppingCart, Package, Tag, BarChart3, Home, Plus, Truck, Users, User, Calculator, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from './ProtectedRoute';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { profile, signOut, hasPermission } = useAuth();

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, permission: 'dashboard_read' },
    { id: 'sales', label: 'Ventas', icon: BarChart3, permission: 'sales_read' },
    { id: 'new-sale', label: 'Nueva Venta', icon: Plus, permission: 'sales_create' },
    { id: 'products', label: 'Productos', icon: Package, permission: 'products_read' },
    { id: 'categories', label: 'Categorías', icon: Tag, permission: 'categories_read' },
    { id: 'suppliers', label: 'Proveedores', icon: Truck, permission: 'suppliers_read' },
    { id: 'customers', label: 'Clientes', icon: Users, permission: 'customers_read' },
    { id: 'users', label: 'Usuarios', icon: User, permission: 'users_read' },
    { id: 'cash-register', label: 'Caja', icon: Calculator, permission: 'cash_register_read' },
  ].filter(tab => hasPermission(tab.permission));

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <ShoppingCart className="h-8 w-8 text-blue-600" />
              <h1 className="ml-3 text-xl font-bold text-slate-900">Sistema de Ventas</h1>
            </div>
            <div className="flex items-center space-x-4">
              <nav className="flex space-x-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange(tab.id)}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-blue-100 text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
              
              <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{profile?.name}</p>
                  <p className="text-xs text-slate-600 capitalize">{profile?.role?.name}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                  title="Cerrar Sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}