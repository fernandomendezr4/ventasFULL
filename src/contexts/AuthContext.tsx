import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
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

// Permisos por defecto para cada rol
const DEFAULT_PERMISSIONS = {
  admin: [
    'view_dashboard',
    'create_sales',
    'manage_cash_register',
    'view_sales',
    'manage_installments',
    'view_products',
    'manage_products',
    'create_products',
    'edit_products',
    'delete_products',
    'view_categories',
    'create_categories',
    'edit_categories',
    'delete_categories',
    'view_customers',
    'create_customers',
    'edit_customers',
    'delete_customers',
    'view_suppliers',
    'create_suppliers',
    'edit_suppliers',
    'delete_suppliers',
    'manage_users',
    'view_users',
    'create_users',
    'edit_users',
    'delete_users',
    'manage_settings'
  ],
  manager: [
    'view_dashboard',
    'create_sales',
    'manage_cash_register',
    'view_sales',
    'manage_installments',
    'view_products',
    'manage_products',
    'create_products',
    'edit_products',
    'view_categories',
    'create_categories',
    'edit_categories',
    'view_customers',
    'create_customers',
    'edit_customers',
    'view_suppliers',
    'create_suppliers',
    'edit_suppliers',
    'manage_settings'
  ],
  employee: [
    'view_dashboard',
    'create_sales',
    'manage_cash_register',
    'view_sales',
    'manage_installments',
    'view_customers',
    'create_customers',
    'edit_customers'
  ]
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sesión de Supabase Auth
    checkSupabaseSession();
  }, []);

  const checkSupabaseSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // If there's an error with the session (like invalid refresh token), clear it
      if (error) {
        console.warn('Session error, clearing auth state:', error.message);
        await supabase.auth.signOut();
        setUser(null);
        setPermissions([]);
        setLoading(false);
        return;
      }
      
      if (!error && session?.user) {
        // Buscar el usuario en la tabla users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (!userError && userData) {
          setUser(userData);
          loadDefaultPermissions(userData.role);
        } else {
          // Si no existe en users, crear un usuario admin por defecto
          if (session.user.email === 'estivenmendezr@gmail.com') {
            await createDefaultAdmin(session.user);
          }
        }
      }
    } catch (error) {
      console.error('Error checking Supabase session:', error);
      // Clear auth state on any session check error
      await supabase.auth.signOut();
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultAdmin = async (authUser: any) => {
    try {
      const adminData = {
        id: authUser.id,
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Administrador',
        email: authUser.email,
        role: 'admin',
        is_active: true
      };

      const { data, error } = await supabase
        .from('users')
        .insert([adminData])
        .select()
        .single();

      if (!error && data) {
        setUser(data);
        loadDefaultPermissions('admin');
      }
    } catch (error) {
      console.error('Error creating default admin:', error);
    }
  };

  const loadDefaultPermissions = (role: string) => {
    const rolePermissions = DEFAULT_PERMISSIONS[role as keyof typeof DEFAULT_PERMISSIONS] || [];
    const permissionObjects = rolePermissions.map(permission => ({
      permission_name: permission,
      permission_description: permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      module: permission.split('_')[0]
    }));
    setPermissions(permissionObjects);
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      // Autenticación con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!authError && authData.user) {
        // Buscar el usuario en la tabla users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (!userError && userData) {
          setUser(userData);
          loadDefaultPermissions(userData.role);
          return { error: null };
        } else {
          // Si no existe, crear usuario admin para emails específicos
          if (email === 'estivenmendezr@gmail.com') {
            await createDefaultAdmin(authData.user);
            return { error: null };
          }
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
      // Cerrar sesión de Supabase Auth
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setUser(null);
      setPermissions([]);
    }
  };

  const hasPermission = (permissionName: string): boolean => {
    // Los administradores tienen todos los permisos
    if (user?.role === 'admin') {
      return true;
    }
    
    return permissions.some(p => p.permission_name === permissionName);
  };

  const hasAnyPermission = (permissionNames: string[]): boolean => {
    // Los administradores tienen todos los permisos
    if (user?.role === 'admin') {
      return true;
    }
    
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