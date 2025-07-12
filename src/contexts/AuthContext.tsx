import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
}

interface Permission {
  permission_name: string;
  permission_description: string;
  module: string;
}

interface AuthContextType {
  user: User | null;
  permissions: Permission[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasPermission: (permissionName: string) => boolean;
  hasAnyPermission: (permissionNames: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay una sesión guardada
    const sessionToken = localStorage.getItem('session_token');
    if (sessionToken) {
      validateSession(sessionToken);
    } else {
      setLoading(false);
    }
  }, []);

  const validateSession = async (sessionToken: string) => {
    try {
      // Primero intentar validar como empleado
      const { data: employeeData, error: employeeError } = await supabase.rpc('validate_employee_session', {
        p_session_token: sessionToken
      });

      if (!employeeError && employeeData && employeeData.length > 0) {
        const userData = employeeData[0];
        setUser(userData);
        await loadPermissions(userData.user_id);
        setLoading(false);
        return;
      }

      // Si no es empleado, intentar validar como usuario de Supabase Auth
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (!authError && session?.user) {
        const { data: profileData, error: profileError } = await supabase
          .rpc('get_current_user_profile');

        if (!profileError && profileData && profileData.length > 0) {
          const profile = profileData[0];
          setUser({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role_name,
            is_active: profile.is_active
          });
          await loadPermissions(profile.id);
        }
      } else {
        localStorage.removeItem('session_token');
      }
    } catch (error) {
      console.error('Error validating session:', error);
      localStorage.removeItem('session_token');
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
      
      // Primero intentar autenticación como empleado
      const { data: employeeData, error: employeeError } = await supabase.rpc('authenticate_employee', {
        p_email: email,
        p_password: password
      });

      if (!employeeError && employeeData && employeeData.length > 0) {
        const authData = employeeData[0];
        
        // Guardar token de sesión
        localStorage.setItem('session_token', authData.session_token);
        
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
      }

      // Si no es empleado, intentar autenticación con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!authError && authData.user) {
        // Cargar perfil del usuario
        const { data: profileData, error: profileError } = await supabase
          .rpc('get_current_user_profile');

        if (!profileError && profileData && profileData.length > 0) {
          const profile = profileData[0];
          setUser({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role_name,
            is_active: profile.is_active
          });
          await loadPermissions(profile.id);
          return { error: null };
        }
      }

      return { error: authError || { message: 'Credenciales inválidas' } };
    } catch (error) {
      console.error('Error signing in:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      if (sessionToken) {
        // Intentar cerrar sesión de empleado
        await supabase.rpc('logout_employee', {
          p_session_token: sessionToken
        });
      }
      // También cerrar sesión de Supabase Auth por si acaso
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      localStorage.removeItem('session_token');
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}