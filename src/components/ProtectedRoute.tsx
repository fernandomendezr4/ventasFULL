import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  role?: 'admin' | 'manager' | 'employee';
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({ 
  children, 
  permission, 
  role, 
  fallback 
}: ProtectedRouteProps) {
  const { profile, hasPermission, isAdmin, isManager, isEmployee } = useAuth();

  // Check if user has required permission
  if (permission && !hasPermission(permission)) {
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Acceso Denegado</h3>
          <p className="text-gray-600">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  // Check if user has required role
  if (role) {
    let hasRole = false;
    switch (role) {
      case 'admin':
        hasRole = isAdmin();
        break;
      case 'manager':
        hasRole = isManager() || isAdmin();
        break;
      case 'employee':
        hasRole = isEmployee() || isManager() || isAdmin();
        break;
    }

    if (!hasRole) {
      return fallback || (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Acceso Denegado</h3>
            <p className="text-gray-600">Tu rol no tiene acceso a esta sección.</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}