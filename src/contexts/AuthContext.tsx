import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isDemoMode, testConnection } from '../lib/supabase';

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
  connectionStatus: 'checking' | 'connected' | 'disconnected';
  retryConnection: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

const DEFAULT_PERMISSIONS = {
  admin: [
    'view_dashboard', 'create_sales', 'manage_cash_register', 'view_sales', 'manage_installments',
    'view_products', 'manage_products', 'create_products', 'edit_products', 'delete_products',
    'view_categories', 'create_categories', 'edit_categories', 'delete_categories',
    'view_customers', 'create_customers', 'edit_customers', 'delete_customers',
    'view_suppliers', 'create_suppliers', 'edit_suppliers', 'delete_suppliers',
    'manage_users', 'view_users', 'create_users', 'edit_users', 'delete_users',
    'view_audit', 'manage_audit', 'view_compliance', 'manage_compliance', 'manage_settings'
  ],
  manager: [
    'view_dashboard', 'create_sales', 'manage_cash_register', 'view_sales', 'manage_installments',
    'view_products', 'manage_products', 'create_products', 'edit_products',
    'view_categories', 'create_categories', 'edit_categories',
    'view_customers', 'create_customers', 'edit_customers',
    'view_suppliers', 'create_suppliers', 'edit_suppliers',
    'manage_users', 'view_users', 'create_users', 'edit_users',
    'view_audit', 'view_compliance', 'manage_settings'
  ],
  employee: [
    'view_dashboard', 'create_sales', 'manage_cash_register', 'view_sales', 'manage_installments',
    'view_customers', 'create_customers', 'edit_customers'
  ]
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const checkConnectionStatus = async () => {
    if (isDemoMode) {
      setConnectionStatus('disconnected');
      return false;
    }
    try {
      const isConnected = await testConnection();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      return isConnected;
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionStatus('disconnected');
      return false;
    }
  };

  const retryConnection = async () => {
    if (retryCount >= maxRetries) return;
    setRetryCount(prev => prev + 1);
    setConnectionStatus('checking');
    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    await checkConnectionStatus();
  };

  useEffect(() => {
    let mounted = true;
    const initializeAuth = async () => {
      await checkConnectionStatus();
      if (!mounted) return;
      if (isDemoMode) {
        const demoUser: User = {
          id: 'demo-user-id',
          email: 'demo@ventasfull.com',
          name: 'Usuario Demo',
          role: 'admin',
          is_active: true,
          created_at: new Date().toISOString()
        };
        setUser(demoUser);
        loadDefaultPermissions('admin');
        setLoading(false);
        setInitialized(true);
        return;
      }
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return;
          if (event === 'SIGNED_OUT' || !session) {
            setUser(null);
            setPermissions([]);
            setLoading(false);
            setInitialized(true);
            return;
          }
          if (session.user) {
            const { data: userData } = await supabase
              .from('users')
              .select('*')
              .eq('email', session.user.email)
              .maybeSingle();
            if (userData) {
              if (!userData.is_active) {
                await supabase.auth.signOut();
                setUser(null);
                setPermissions([]);
              } else {
                setUser(userData);
                loadDefaultPermissions(userData.role);
              }
            } else if (session.user.email === 'estivenmendezr@gmail.com') {
              await createDefaultAdmin(session.user);
            }
            setLoading(false);
            setInitialized(true);
          }
        }
      );
      const timeoutId = setTimeout(() => {
        if (mounted && !initialized) {
          setLoading(false);
          setInitialized(true);
        }
      }, 3000);
      return () => {
        mounted = false;
        clearTimeout(timeoutId);
        subscription.unsubscribe();
      };
    };
    initializeAuth();
    return () => { mounted = false; };
  }, [initialized, retryCount]);

  const createDefaultAdmin = async (authUser: any) => {
    const adminData = {
      id: authUser.id,
      name: authUser.user_metadata?.name || 'Admin',
      email: authUser.email,
      role: 'admin',
      is_active: true
    };
    const { data } = await supabase.from('users').insert([adminData]).select().single();
    setUser(data);
    loadDefaultPermissions('admin');
  };

  const loadDefaultPermissions = (role: string) => {
    const perms = DEFAULT_PERMISSIONS[role as keyof typeof DEFAULT_PERMISSIONS] || [];
    setPermissions(perms.map(p => ({
      permission_name: p,
      permission_description: p.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      module: p.split('_')[0]
    })));
  };

  const signIn = async (email: string, password: string) => {
    if (isDemoMode) {
      const demoUser: User = {
        id: 'demo-user-id',
        email,
        name: email.split('@')[0],
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString()
      };
      setUser(demoUser);
      loadDefaultPermissions('admin');
      return { error: null };
    }
    const connectionOk = await testConnection();
    if (!connectionOk) return { error: { message: 'Sin conexión' } };
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authData.user) {
      const { data: userData } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
      if (userData && userData.is_active) {
        setUser(userData);
        loadDefaultPermissions(userData.role);
        return { error: null };
      } else {
        return { error: { message: 'Usuario no válido' } };
      }
    }
    return { error: authError };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPermissions([]);
    setLoading(false);
    setInitialized(true);
  };

  const hasPermission = (permissionName: string) => user?.role === 'admin' || permissions.some(p => p.permission_name === permissionName);
  const hasAnyPermission = (permissionNames: string[]) => user?.role === 'admin' || permissionNames.some(hasPermission);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        loading,
        signIn,
        signOut,
        hasPermission,
        hasAnyPermission,
        connectionStatus,
        retryConnection
      }}>
      {children}
    </AuthContext.Provider>
  );
}
