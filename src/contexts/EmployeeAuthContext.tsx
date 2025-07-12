import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface EmployeeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface Permission {
  permission_name: string;
  permission_description: string;
  module: string;
}

interface EmployeeAuthContextType {
  user: EmployeeUser | null;
  permissions: Permission[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasPermission: (permissionName: string) => boolean;
  hasAnyPermission: (permissionNames: string[]) => boolean;
}

const EmployeeAuthContext = createContext<EmployeeAuthContextType | undefined>(undefined);

export function useEmployeeAuth() {
  const context = useContext(EmployeeAuthContext);
  if (context === undefined) {
    throw new Error('useEmployeeAuth must be used within an EmployeeAuthProvider');
  }
  return context;
}

export function EmployeeAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<EmployeeUser | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay una sesión guardada
    const sessionToken = localStorage.getItem('employee_session_token');
    if (sessionToken) {
      validateSession(sessionToken);
    } else {
      setLoading(false);
    }
  }, []);

  const validateSession = async (sessionToken: string) => {
    try {
      const { data, error } = await supabase.rpc('validate_employee_session', {
        p_session_token: sessionToken
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const userData = data[0];
        setUser(userData);
        await loadPermissions(userData.user_id);
      } else {
        localStorage.removeItem('employee_session_token');
      }
    } catch (error) {
      console.error('Error validating session:', error);
      localStorage.removeItem('employee_session_token');
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_employee_permissions', {
        p_user_id: userId
      });

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissions([]);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('authenticate_employee', {
        p_email: email,
        p_password: password
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const authData = data[0];
        
        // Guardar token de sesión
        localStorage.setItem('employee_session_token', authData.session_token);
        
        // Establecer usuario
        setUser({
          id: authData.user_id,
          name: authData.name,
          email: authData.email,
          role: authData.role,
          is_active: authData.is_active
        });

        // Cargar permisos
        await loadPermissions(authData.user_id);

        return { error: null };
      } else {
        return { error: { message: 'Credenciales inválidas' } };
      }
    } catch (error) {
      console.error('Error signing in:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const sessionToken = localStorage.getItem('employee_session_token');
      if (sessionToken) {
        await supabase.rpc('logout_employee', {
          p_session_token: sessionToken
        });
      }
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      localStorage.removeItem('employee_session_token');
      setUser(null);
      setPermissions([]);
    }
  };

  const hasPermission = (permissionName: string): boolean => {
    return permissions.some(p => p.permission_name === permissionName);
  };

  const hasAnyPermission = (permissionNames: string[]): boolean => {
    return permissionNames.some(permissionName => hasPermission(permissionName));
  };

  const value = {
    user,
    permissions,
    loading,
    signIn,
    signOut,
    hasPermission,
    hasAnyPermission,
  };

  return (
    <EmployeeAuthContext.Provider value={value}>
      {children}
    </EmployeeAuthContext.Provider>
  );
}