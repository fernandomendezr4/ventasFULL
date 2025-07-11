import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
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

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <ProductManager />;
      case 'categories':
        return <CategoryManager />;
      case 'sales':
        return <SalesManager />;
      case 'new-sale':
        return <NewSale />;
      case 'installments':
        return <InstallmentManager />;
      case 'suppliers':
        return <SupplierManager />;
      case 'customers':
        return <CustomerManager />;
      case 'users':
        return <UserManager />;
      case 'cash-register':
        return <CashRegister />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <AuthProvider>
      <ProtectedRoute>
        <Layout activeTab={activeTab} onTabChange={setActiveTab}>
          {renderContent()}
        </Layout>
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;