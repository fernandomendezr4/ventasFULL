import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './components/Dashboard';
import ProductManager from './components/ProductManager';
import CategoryManager from './components/CategoryManager';
import SalesManager from './components/SalesManager';
import NewSale from './components/NewSale';
import SupplierManager from './components/SupplierManager';
import CustomerManager from './components/CustomerManager';
import UserManager from './components/UserManager';
import CashRegister from './components/CashRegister';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <ProtectedRoute permission="dashboard_read">
            <Dashboard />
          </ProtectedRoute>
        );
      case 'products':
        return (
          <ProtectedRoute permission="products_read">
            <ProductManager />
          </ProtectedRoute>
        );
      case 'categories':
        return (
          <ProtectedRoute permission="categories_read">
            <CategoryManager />
          </ProtectedRoute>
        );
      case 'sales':
        return (
          <ProtectedRoute permission="sales_read">
            <SalesManager />
          </ProtectedRoute>
        );
      case 'new-sale':
        return (
          <ProtectedRoute permission="sales_create">
            <NewSale />
          </ProtectedRoute>
        );
      case 'suppliers':
        return (
          <ProtectedRoute permission="suppliers_read">
            <SupplierManager />
          </ProtectedRoute>
        );
      case 'customers':
        return (
          <ProtectedRoute permission="customers_read">
            <CustomerManager />
          </ProtectedRoute>
        );
      case 'users':
        return (
          <ProtectedRoute permission="users_read">
            <UserManager />
          </ProtectedRoute>
        );
      case 'cash-register':
        return (
          <ProtectedRoute permission="cash_register_read">
            <CashRegister />
          </ProtectedRoute>
        );
      default:
        return (
          <ProtectedRoute permission="dashboard_read">
            <Dashboard />
          </ProtectedRoute>
        );
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;