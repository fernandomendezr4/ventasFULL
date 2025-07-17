import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ViewTransition from './components/ViewTransition';
import Dashboard from './components/Dashboard';
import ProductManager from './components/ProductManager';
import CategoryManager from './components/CategoryManager';
import SalesManager from './components/SalesManager';
import NewSale from './components/NewSale';
import SupplierManager from './components/SupplierManager';
import CustomerManager from './components/CustomerManager';
import UserManager from './components/UserManager';
import CashRegister from './components/CashRegister';
import InstallmentManager from './components/InstallmentManager';
import Settings from './components/Settings';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { user } = useAuth();

  // Reset to dashboard when user changes (login/logout)
  React.useEffect(() => {
    if (user) {
      setActiveTab('dashboard');
    }
  }, [user]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <ViewTransition transitionKey="dashboard" type="dashboard">
            <Dashboard onTabChange={setActiveTab} />
          </ViewTransition>
        );
      case 'products':
        return (
          <ViewTransition transitionKey="products" type="slide-left">
            <ProductManager />
          </ViewTransition>
        );
      case 'categories':
        return (
          <ViewTransition transitionKey="categories" type="slide-left">
            <CategoryManager />
          </ViewTransition>
        );
      case 'sales':
        return (
          <ViewTransition transitionKey="sales" type="slide-left">
            <SalesManager />
          </ViewTransition>
        );
      case 'new-sale':
        return (
          <ViewTransition transitionKey="new-sale" type="form">
            <NewSale />
          </ViewTransition>
        );
      case 'installments':
        return (
          <ViewTransition transitionKey="installments" type="slide-left">
            <InstallmentManager />
          </ViewTransition>
        );
      case 'suppliers':
        return (
          <ViewTransition transitionKey="suppliers" type="slide-left">
            <SupplierManager />
          </ViewTransition>
        );
      case 'customers':
        return (
          <ViewTransition transitionKey="customers" type="slide-left">
            <CustomerManager />
          </ViewTransition>
        );
      case 'users':
        return (
          <ViewTransition transitionKey="users" type="slide-left">
            <UserManager />
          </ViewTransition>
        );
      case 'cash-register':
        return (
          <ViewTransition transitionKey="cash-register" type="slide-up">
            <CashRegister />
          </ViewTransition>
        );
      case 'settings':
        return (
          <ViewTransition transitionKey="settings" type="fade">
            <Settings />
          </ViewTransition>
        );
      default:
        return (
          <ViewTransition transitionKey="dashboard" type="dashboard">
            <Dashboard onTabChange={setActiveTab} />
          </ViewTransition>
        );
    }
  };

  return (
    <ProtectedRoute>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
      </Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;