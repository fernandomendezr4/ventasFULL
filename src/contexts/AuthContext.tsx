import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, isDemoMode } from '../lib/supabase';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'checking';
  permissions: string[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutWithConfirmation: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  retryConnection: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setLoading(true);
      setConnectionStatus('checking');

      if (isDemoMode) {
        // Modo demo: verificar si hay usuario demo guardado
        const savedDemoUser = localStorage.getItem('demo_user');
        if (savedDemoUser) {
          const demoUser = JSON.parse(savedDemoUser);
          setUser(demoUser);
          setPermissions(getDemoPermissions(demoUser.role));
        }
        setConnectionStatus('disconnected');
        setLoading(false);
        return;
      }

      if (!supabase) {
        setConnectionStatus('disconnected');
        setLoading(false);
        return;
      }

      // Verificar sesión actual
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        setConnectionStatus('disconnected');
        setLoading(false);
        return;
      }

      if (session?.user) {
        await loadUserProfile(session.user.id);
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('connected');
      }

      // Escuchar cambios de autenticación
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setUser(null);
          setPermissions([]);
        }
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    } catch (error) {
      console.error('Error initializing auth:', error);
      setConnectionStatus('disconnected');
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      if (!supabase) return;

      // Intentar cargar desde la tabla users primero
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Error loading user from users table:', userError);
        
        // Fallback: intentar cargar desde profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error('Error loading user profile:', profileError);
          // Crear usuario básico si no existe
          await createBasicUserProfile(userId);
          return;
        }

        const authUser: AuthUser = {
          id: profileData.id,
          name: profileData.name,
          email: profileData.email,
          role: 'employee', // Rol por defecto
          is_active: profileData.is_active
        };

        setUser(authUser);
        setPermissions(getPermissionsForRole('employee'));
        return;
      }

      const authUser: AuthUser = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        is_active: userData.is_active
      };

      setUser(authUser);
      setPermissions(getPermissionsForRole(userData.role));
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const createBasicUserProfile = async (userId: string) => {
    try {
      if (!supabase) return;

      // Obtener email del usuario de auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) return;

      // Crear perfil básico
      const basicUser = {
        id: userId,
        name: authUser.email?.split('@')[0] || 'Usuario',
        email: authUser.email || '',
        role: 'employee',
        is_active: true
      };

      // Intentar insertar en users
      const { error: insertError } = await supabase
        .from('users')
        .insert([basicUser]);

      if (insertError) {
        console.error('Error creating basic user profile:', insertError);
        return;
      }

      setUser(basicUser);
      setPermissions(getPermissionsForRole('employee'));
    } catch (error) {
      console.error('Error creating basic user profile:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);

      if (isDemoMode) {
        // Modo demo: autenticación simulada
        const demoUsers = [
          {
            id: 'demo-admin',
            name: 'Administrador Demo',
            email: 'admin@ventasfull.com',
            role: 'admin',
            is_active: true,
            password: 'admin123'
          },
          {
            id: 'demo-manager',
            name: 'Gerente Demo',
            email: 'gerente@ventasfull.com',
            role: 'manager',
            is_active: true,
            password: 'gerente123'
          },
          {
            id: 'demo-employee',
            name: 'Empleado Demo',
            email: 'empleado@ventasfull.com',
            role: 'employee',
            is_active: true,
            password: 'empleado123'
          }
        ];

        // En modo demo, permitir cualquier email/password O usar credenciales predefinidas
        let demoUser = demoUsers.find(u => 
          u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );

        // Si no coincide con credenciales predefinidas, crear usuario demo genérico
        if (!demoUser) {
          demoUser = {
            id: 'demo-generic',
            name: email.split('@')[0] || 'Usuario Demo',
            email: email,
            role: 'admin', // Dar permisos completos en demo
            is_active: true,
            password: password
          };
        }

        // Guardar usuario demo
        localStorage.setItem('demo_user', JSON.stringify(demoUser));
        setUser(demoUser);
        setPermissions(getDemoPermissions(demoUser.role));
        setLoading(false);
        return;
      }

      if (!supabase) {
        throw new Error('Sistema de base de datos no disponible');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        await loadUserProfile(data.user.id);
      }
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      if (isDemoMode) {
        throw new Error('Registro no disponible en modo demo');
      }

      if (!supabase) {
        throw new Error('Sistema de base de datos no disponible');
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            name: name.trim()
          }
        }
      });

      if (error) throw error;

      // Crear perfil de usuario
      if (data.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert([{
            id: data.user.id,
            name: name.trim(),
            email: email.trim(),
            role: 'employee',
            is_active: true
          }]);

        if (profileError) {
          console.error('Error creating user profile:', profileError);
        }
      }
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      if (isDemoMode) {
        localStorage.removeItem('demo_user');
        setUser(null);
        setPermissions([]);
        return;
      }

      if (!supabase) return;

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      }
      
      setUser(null);
      setPermissions([]);
    } catch (error) {
      console.error('Error in signOut:', error);
    }
  };

  const signOutWithConfirmation = async () => {
    if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      await signOut();
    }
  };

  const retryConnection = async () => {
    if (isDemoMode) return;
    
    setConnectionStatus('checking');
    try {
      if (supabase) {
        const { error } = await supabase.from('categories').select('id').limit(1);
        setConnectionStatus(error ? 'disconnected' : 'connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (isDemoMode) return true; // En demo, todos los permisos
    return permissions.includes(permission) || permissions.includes('*');
  };

  const getPermissionsForRole = (role: string): string[] => {
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'], // Todos los permisos
      manager: [
        'view_dashboard',
        'manage_products',
        'view_categories',
        'manage_categories',
        'view_suppliers',
        'manage_suppliers',
        'view_customers',
        'manage_customers',
        'create_sales',
        'view_sales',
        'manage_sales',
        'manage_cash_register',
        'manage_installments',
        'view_users',
        'manage_settings',
        'view_audit'
      ],
      employee: [
        'view_dashboard',
        'view_products',
        'view_categories',
        'view_customers',
        'create_sales',
        'view_sales',
        'manage_cash_register',
        'manage_installments'
      ],
      cashier: [
        'view_dashboard',
        'view_products',
        'view_customers',
        'create_sales',
        'manage_cash_register'
      ]
    };

    return rolePermissions[role] || rolePermissions.employee;
  };

  const getDemoPermissions = (role: string): string[] => {
    // En modo demo, dar permisos completos
    return ['*'];
  };

  const value = {
    user,
    loading,
    connectionStatus,
    permissions,
    signIn,
    signUp,
    signOut,
    signOutWithConfirmation,
    hasPermission,
    retryConnection
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}