import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import { isDemoMode } from './lib/supabase';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ViewTransition from './components/ViewTransition';
import Dashboard from './components/Dashboard';
import { ProductManager } from './components/ProductManager';
import CategoryManager from './components/CategoryManager';
import SalesManager from './components/SalesManager';
import NewSale from './components/NewSale';
import SupplierManager from './components/SupplierManager';
import CustomerManager from './components/CustomerManager';
import UserManager from './components/UserManager';
import CashRegister from './components/CashRegister';
import InstallmentManager from './components/InstallmentManager';
import Settings from './components/Settings';
import PerformanceMonitor from './components/PerformanceMonitor';
import LazyLoader from './components/LazyLoader';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { user } = useAuth();
  const [appError, setAppError] = useState<string | null>(null);
  const [showDemoNotice, setShowDemoNotice] = useState(isDemoMode);

  // Reset to dashboard when user changes (login/logout)
  React.useEffect(() => {
    if (user) {
      setActiveTab('dashboard');
    }
  }, [user]);

  if (appError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <div className="text-red-600 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Error de Aplicación</h2>
          <p className="text-slate-600 mb-4">{appError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Recargar Página
          </button>
        </div>
      </div>
    );
  }
  
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
      {/* Demo Notice */}
      {showDemoNotice && isDemoMode && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-yellow-900 p-3 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">
                Modo Demo Activo - Para usar la base de datos real, configura las variables de entorno de Supabase
              </span>
            </div>
            <button
              onClick={() => setShowDemoNotice(false)}
              className="text-yellow-900 hover:text-yellow-700 transition-colors duration-200"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
      </Layout>
      <PerformanceMonitor />
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