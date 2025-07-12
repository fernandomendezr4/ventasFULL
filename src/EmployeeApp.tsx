import React, { useState } from 'react';
import { EmployeeAuthProvider } from './contexts/EmployeeAuthContext';
import EmployeeProtectedRoute from './components/EmployeeProtectedRoute';
import EmployeeLayout from './components/EmployeeLayout';
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
import PermissionGate from './components/PermissionGate';

function EmployeeAppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <EmployeeProtectedRoute requiredPermission="view_dashboard">
            <Dashboard />
          </EmployeeProtectedRoute>
        );
      case 'products':
        return (
          <EmployeeProtectedRoute requiredPermission="view_products">
            <ProductManager />
          </EmployeeProtectedRoute>
        );
      case 'categories':
        return (
          <EmployeeProtectedRoute requiredPermission="view_categories">
            <CategoryManager />
          </EmployeeProtectedRoute>
        );
      case 'sales':
        return (
          <EmployeeProtectedRoute requiredPermission="view_sales">
            <SalesManager />
          </EmployeeProtectedRoute>
        );
      case 'new-sale':
        return (
          <EmployeeProtectedRoute requiredPermission="create_sales">
            <NewSale />
          </EmployeeProtectedRoute>
        );
      case 'installments':
        return (
          <EmployeeProtectedRoute requiredPermission="manage_installments">
            <InstallmentManager />
          </EmployeeProtectedRoute>
        );
      case 'suppliers':
        return (
          <EmployeeProtectedRoute requiredPermission="view_suppliers">
            <SupplierManager />
          </EmployeeProtectedRoute>
        );
      case 'customers':
        return (
          <EmployeeProtectedRoute requiredPermission="view_customers">
            <CustomerManager />
          </EmployeeProtectedRoute>
        );
      case 'users':
        return (
          <EmployeeProtectedRoute requiredPermission="manage_users">
            <UserManager />
          </EmployeeProtectedRoute>
        );
      case 'cash-register':
        return (
          <EmployeeProtectedRoute requiredPermission="manage_cash_register">
            <CashRegister />
          </EmployeeProtectedRoute>
        );
      default:
        return (
          <EmployeeProtectedRoute requiredPermission="view_dashboard">
            <Dashboard />
          </EmployeeProtectedRoute>
        );
    }
  };

  return (
    <EmployeeProtectedRoute>
      <EmployeeLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
      </EmployeeLayout>
    </EmployeeProtectedRoute>
  );
}

export default function EmployeeApp() {
  return (
    <EmployeeAuthProvider>
      <EmployeeAppContent />
    </EmployeeAuthProvider>
  );
}