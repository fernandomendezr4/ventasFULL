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
    'manage_users',
    'view_users',
    'create_users',
    'edit_users',
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
  const [initialized, setInitialized] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Función para verificar y actualizar el estado de conexión
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

  // Función para reintentar conexión
  const retryConnection = async () => {
    if (retryCount >= maxRetries) {
      console.warn('Max retry attempts reached');
      return;
    }

    setRetryCount(prev => prev + 1);
    setConnectionStatus('checking');
    
    // Esperar un poco antes de reintentar
    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    
    await checkConnectionStatus();
  };

  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      // Verificar conexión primero
      await checkConnectionStatus();
      
      if (!mounted) return;
      
    // Si está en modo demo, crear usuario demo inmediatamente
    if (isDemoMode) {
      const demoUser: User = {
        id: 'demo-user-id',
        email: 'demo@ventasfull.com',
        name: 'Usuario Demo',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString()
      };
      
      if (mounted) {
        setUser(demoUser);
        loadDefaultPermissions('admin');
        setLoading(false);
        setInitialized(true);
      }
      return;
    }

    if (!supabase) {
      if (mounted) {
        setLoading(false);
        setInitialized(true);
      }
      return;
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase!.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state change:', event, session?.user?.email);
        
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED' || 
            (event === 'TOKEN_REFRESHED' && !session) ||
            (event === 'INITIAL_SESSION' && !session)) {
          // Clear user state when signed out or session is invalid
          setUser(null);
          setPermissions([]);
          setLoading(false);
          setInitialized(true);
          return;
        }
        
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          try {
            console.log('Loading user data for:', session.user.email);
            
            // Buscar el usuario en la tabla users de forma más eficiente
            const { data: userData, error: userError } = await supabase!
              .from('users')
              .select('id, name, email, role, is_active, created_at')
              .eq('email', session.user.email)
              .maybeSingle();

            console.log('User data loaded:', userData, userError);

            if (userData && mounted) {
              // Verificar que el usuario esté activo
              if (!userData.is_active) {
                console.warn('User account is inactive:', userData.email);
                await supabase!.auth.signOut();
                setUser(null);
                setPermissions([]);
                setLoading(false);
                setInitialized(true);
                return;
              }
              
              setUser(userData);
              loadDefaultPermissions(userData.role);
            } else if (session.user.email === 'estivenmendezr@gmail.com' && mounted) {
              console.log('Creating default admin for:', session.user.email);
              await createDefaultAdmin(session.user);
            } else if (mounted) {
              console.warn('User not found in database:', session.user.email);
              setUser(null);
              setPermissions([]);
            }
          } catch (error) {
            console.error('Error loading user data:', error);
            if (mounted) {
              setUser(null);
              setPermissions([]);
            }
          }
        }
        
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    );

    // Timeout de seguridad reducido
    const timeoutId = setTimeout(() => {
      if (mounted && !initialized) {
        console.warn('Auth initialization timeout reached');
        setLoading(false);
        setInitialized(true);
      }
    }, 3000); // Aumentado a 3 segundos para mejor estabilidad

    // Cleanup subscription on unmount
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
    };
    
    initializeAuth();
    
    return () => {
      mounted = false;
    };
  }, [initialized, retryCount]);

  const createDefaultAdmin = async (authUser: any) => {
    try {
      console.log('Creating default admin user:', authUser.email);
      
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
        console.log('Default admin created successfully:', data);
        setUser(data);
        loadDefaultPermissions('admin');
      } else {
        console.error('Error creating default admin:', error);
      }
    } catch (error) {
      console.error('Error creating default admin:', error);
      // En caso de error, continuar sin bloquear la aplicación
      setLoading(false);
      setInitialized(true);
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
    console.log('Sign in attempt for:', email);
    
    // Modo demo - permitir cualquier login
    if (isDemoMode) {
      console.log('Demo mode login');
      const demoUser: User = {
        id: 'demo-user-id',
        email: email,
        name: email.split('@')[0] || 'Usuario Demo',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString()
      };
      setUser(demoUser);
      loadDefaultPermissions('admin');
      return { error: null };
    }

    if (!supabase) {
      console.error('Supabase client not available');
      return { error: { message: 'Supabase no configurado' } };
    }

    try {
      setLoading(true);
      
      // Verificar conexión antes de intentar autenticación
      const connectionOk = await testConnection();
      if (!connectionOk) {
        console.error('Database connection failed');
        return { error: { message: 'Error de conexión con la base de datos. Verifica tu conexión a internet.' } };
      }
      
      console.log('Attempting Supabase auth sign in');
      
      // Autenticación con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Auth result:', { user: authData?.user?.email, error: authError });

      if (!authError && authData.user) {
        console.log('Auth successful, loading user profile');
        
        // Buscar el usuario en la tabla users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        console.log('User profile result:', { userData, userError });

        if (!userError && userData) {
          // Verificar que el usuario esté activo
          if (!userData.is_active) {
            console.warn('User account is inactive');
            await supabase.auth.signOut();
            return { error: { message: 'Tu cuenta está desactivada. Contacta al administrador para reactivarla.' } };
          }
          
          setUser(userData);
          loadDefaultPermissions(userData.role);
          return { error: null };
        } else {
          // Si no existe, crear usuario admin para emails específicos
          if (email === 'estivenmendezr@gmail.com') {
            console.log('Creating default admin for authorized email');
            await createDefaultAdmin(authData.user);
            return { error: null };
          }
          
          console.error('User not found in users table');
          await supabase.auth.signOut();
          return { error: { message: 'Usuario no encontrado en el sistema' } };
        }
      }

      console.error('Authentication failed:', authError);
      return { error: authError || { message: 'Credenciales inválidas' } };
    } catch (error) {
      console.error('Error signing in:', error);
      return { error: { message: 'Error de conexión. Verifica tu internet e intenta de nuevo.' } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    console.log('Signing out user');
    
    if (isDemoMode) {
      setUser(null);
      setPermissions([]);
      setLoading(false);
      setInitialized(true);
      return;
    }

    if (!supabase) return;

    try {
      setLoading(true);
      // Cerrar sesión de Supabase Auth
      await supabase!.auth.signOut();
      console.log('Sign out successful');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setUser(null);
      setPermissions([]);
      setLoading(false);
      setInitialized(true);
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
    connectionStatus,
    retryConnection,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}