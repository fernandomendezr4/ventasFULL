import React from 'react';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';

interface PermissionGateProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  fallback?: React.ReactNode;
  requireAll?: boolean; // Si es true, requiere todos los permisos. Si es false, requiere al menos uno
}

export default function PermissionGate({ 
  children, 
  permission, 
  permissions = [], 
  fallback = null,
  requireAll = false 
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission } = useEmployeeAuth();

  // Si se especifica un permiso único
  if (permission) {
    return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
  }

  // Si se especifican múltiples permisos
  if (permissions.length > 0) {
    const hasAccess = requireAll 
      ? permissions.every(p => hasPermission(p))
      : hasAnyPermission(permissions);
    
    return hasAccess ? <>{children}</> : <>{fallback}</>;
  }

  // Si no se especifican permisos, mostrar el contenido
  return <>{children}</>;
}