import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { authenticateEmployee, logoutEmployee, getCurrentSession, createEmployeeSession } from '../lib/employeeAuth';

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
  requiresPasswordChange: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);

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

      // Verificar sesión actual usando el sistema de empleados
      try {
        const sessionData = await getCurrentSession();
        if (sessionData && sessionData.user) {
          setUser(sessionData.user);
          setPermissions(getPermissionsForRole(sessionData.user.role));
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('connected');
        }
      } catch (error) {
        console.error('Error checking current session:', error);
        setConnectionStatus('disconnected');
      }

      setLoading(false);
    } catch (error) {
      console.error('Error initializing auth:', error);
      setConnectionStatus('disconnected');
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setConnectionStatus('checking');

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
        setConnectionStatus('disconnected');
        return;
      }

      if (!supabase) {
        setConnectionStatus('disconnected');
        throw new Error('Sistema de base de datos no disponible');
      }

      // Usar el sistema de autenticación de empleados personalizado
      const authResult = await authenticateEmployee(email.trim(), password);
      
      if (authResult.success && authResult.user) {
        setUser(authResult.user);
        setPermissions(getPermissionsForRole(authResult.user.role));
        setConnectionStatus('connected');
        setRequiresPasswordChange(authResult.requiresPasswordChange || false);
        
        // Show password change notice if required
        if (authResult.requiresPasswordChange) {
          setTimeout(() => {
            alert('Tu contraseña ha expirado o requiere cambio. Contacta al administrador para renovarla.');
          }, 1000);
        }
      } else {
        setConnectionStatus('connected'); // We can reach the database, just auth failed
        
        // Handle specific error cases
        throw new Error(authResult.error || 'Credenciales inválidas');
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

      // Crear usuario usando el sistema personalizado
      const { error: createError } = await supabase
        .from('users')
        .insert([{
          name: name.trim(),
          email: email.trim(),
          role: 'employee',
          is_active: true
        }]);

      if (createError) {
        throw createError;
      }

      // Crear sesión de empleado
      const sessionResult = await createEmployeeSession(email.trim(), password);
      if (!sessionResult.success) {
        throw new Error(sessionResult.error || 'Error creando sesión');
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
        setRequiresPasswordChange(false);
        return;
      }

      if (!supabase) return;

      try {
        // Usar el sistema de logout de empleados
        await logoutEmployee('user_logout');
      } catch (logoutError) {
        console.warn('Error during employee logout (continuing anyway):', logoutError);
      }
      
      setUser(null);
      setPermissions([]);
      setRequiresPasswordChange(false);
    } catch (error) {
      console.error('Error in signOut:', error);
      // Always clear user state even if signout fails
      setUser(null);
      setPermissions([]);
      setRequiresPasswordChange(false);
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
        'delete_sales',
        'manage_cash_register',
        'manage_installments',
        'view_users',
        'manage_users',
        'manage_settings',
        'view_audit'
      ],
      employee: [
        'view_dashboard',
        'view_products',
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
    retryConnection,
    requiresPasswordChange
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