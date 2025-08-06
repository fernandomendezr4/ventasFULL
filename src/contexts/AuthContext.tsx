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
  signOutWithConfirmation: () => Promise<void>;
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
    try {
      if (!isDemoMode && supabase) {
        await supabase.auth.signOut();
      }
      
      // Limpiar datos locales
      localStorage.removeItem('sb-auth-token');
      localStorage.removeItem('user_session');
      
      // Limpiar estado
      setUser(null);
      setPermissions([]);
      setLoading(false);
      setInitialized(true);
      
      console.log('Sesión cerrada exitosamente');
    } catch (error) {
      console.error('Error during sign out:', error);
      // Forzar limpieza local incluso si hay error
      setUser(null);
      setPermissions([]);
      setLoading(false);
      setInitialized(true);
    }
  };

  const signOutWithConfirmation = async () => {
    const confirmed = window.confirm('¿Estás seguro de que quieres cerrar sesión?');
    if (confirmed) {
      await signOut();
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Demo mode: simulate authentication
        const demoUsers = [
          {
            id: 'demo-user-1',
            name: 'Administrador Demo',
            email: 'admin@ventasfull.com',
            role: 'admin',
            is_active: true,
            password: 'admin123'
          },
          {
            id: 'demo-user-2',
            name: 'Gerente Demo',
            email: 'gerente@ventasfull.com',
            role: 'manager',
            is_active: true,
            password: 'gerente123'
          },
          {
            id: 'demo-user-3',
            name: 'Empleado Demo',
            email: 'empleado@ventasfull.com',
            role: 'employee',
            is_active: true,
            password: 'empleado123'
          },
          {
            id: 'demo-user-4',
            name: 'Usuario Demo',
            email: 'demo@ventasfull.com',
            role: 'admin',
            is_active: true,
            password: 'demo123'
          }
        ];

        // Permitir cualquier email/contraseña en modo demo, pero dar preferencia a credenciales específicas
        let demoUser = demoUsers.find(u => 
          u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );
        
        // Si no coincide exactamente, usar el primer usuario admin como fallback
        if (!demoUser && email.trim() && password.trim()) {
          demoUser = demoUsers[0]; // Admin demo por defecto
        }

        if (demoUser) {
          const userData = {
            id: demoUser.id,
            name: demoUser.name,
            email: demoUser.email,
            role: demoUser.role,
            is_active: demoUser.is_active,
            created_at: new Date().toISOString()
          };
          
          setUser(userData);
          loadDefaultPermissions(demoUser.role);
          
          // Guardar sesión demo en localStorage
          localStorage.setItem('user_session', JSON.stringify({
            user: userData,
            timestamp: Date.now(),
            demo_mode: true
          }));
          
          return { error: null };
        } else {
          return {
            error: { message: 'Credenciales inválidas. En modo demo puedes usar cualquier email y contraseña.' }
          };
        }
      }

      // Verificar conexión antes de intentar autenticación
      const connectionOk = await testConnection();
      if (!connectionOk) {
        return { 
          error: { 
            message: 'Sin conexión a la base de datos. Verifica tu configuración de Supabase o usa el modo demo.' 
          } 
        };
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });
      
      if (authError) {
        return { error: authError };
      }

      if (authData.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email.trim())
          .maybeSingle();

        if (userError) {
          return { error: { message: 'Error al obtener datos del usuario' } };
        }

        if (userData && userData.is_active) {
          setUser(userData);
          loadDefaultPermissions(userData.role);
          
          // Guardar información de sesión
          localStorage.setItem('user_session', JSON.stringify({
            user: userData,
            timestamp: Date.now(),
            demo_mode: false
          }));
          
          return { error: null };
        } else {
          await supabase.auth.signOut();
          return { 
            error: { 
              message: userData ? 'Tu cuenta está desactivada. Contacta al administrador.' : 'Usuario no válido o no encontrado.' 
            } 
          };
        }
      }
      
      return { error: { message: 'Error en la autenticación' } };
    } catch (error) {
      console.error('Error in signIn:', error);
      return { 
        error: { 
          message: 'Error interno del sistema. Verifica tu conexión e intenta nuevamente.' 
        } 
      };
    } finally {
      setLoading(false);
    }
  };

  // Verificar sesión guardada al inicializar
  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        await checkConnectionStatus();
        if (!mounted) return;
        
        // Verificar sesión guardada en localStorage
        const savedSession = localStorage.getItem('user_session');
        if (savedSession) {
          try {
            const sessionData = JSON.parse(savedSession);
            const sessionAge = Date.now() - sessionData.timestamp;
            
            // Sesión válida por 8 horas
            if (sessionAge < 8 * 60 * 60 * 1000) {
              if (sessionData.demo_mode || isDemoMode) {
                setUser(sessionData.user);
                loadDefaultPermissions(sessionData.user.role);
                setLoading(false);
                setInitialized(true);
                return;
              }
            } else {
              // Sesión expirada
              localStorage.removeItem('user_session');
            }
          } catch (error) {
            console.error('Error parsing saved session:', error);
            localStorage.removeItem('user_session');
          }
        }
        
        if (isDemoMode) {
          setUser(null);
          setPermissions([]);
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
              localStorage.removeItem('user_session');
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
                  localStorage.removeItem('user_session');
                } else {
                  setUser(userData);
                  loadDefaultPermissions(userData.role);
                  
                  // Actualizar sesión guardada
                  localStorage.setItem('user_session', JSON.stringify({
                    user: userData,
                    timestamp: Date.now(),
                    demo_mode: false
                  }));
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
        }, 5000);
        
        return () => {
          mounted = false;
          clearTimeout(timeoutId);
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };
    
    initializeAuth();
    return () => { mounted = false; };
  }, [initialized, retryCount]);
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
        signOutWithConfirmation,
        hasPermission,
        hasAnyPermission,
        connectionStatus,
        retryConnection
      }}>
      {children}
    </AuthContext.Provider>
  );
}
