import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  email: string;
  name: string;
  role_id: string | null;
  is_active: boolean;
  role?: {
    id: string;
    name: string;
    description: string;
  };
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
  isManager: () => boolean;
  isEmployee: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          role:roles (
            id,
            name,
            description
          )
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Load user permissions
      const { data: permissions } = await supabase
        .from('role_permissions')
        .select(`
          permission:permissions (
            name
          )
        `)
        .eq('role_id', data.role_id);

      const userPermissions = permissions?.map(p => p.permission.name) || [];

      setProfile({
        ...data,
        permissions: userPermissions
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: 'admin', // Por defecto crear como administrador
        },
      },
    });
    
    // Si el registro fue exitoso, crear el perfil del usuario
    if (data.user && !error) {
      try {
        // Buscar el rol de administrador
        const { data: adminRole } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'admin')
          .single();

        // Crear el perfil del usuario
        await supabase
          .from('profiles')
          .insert([{
            id: data.user.id,
            email: data.user.email!,
            name: name,
            role_id: adminRole?.id || null,
            is_active: true,
          }]);
      } catch (profileError) {
        console.error('Error creating user profile:', profileError);
      }
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasPermission = (permission: string): boolean => {
    return profile?.permissions?.includes(permission) || false;
  };

  const isAdmin = (): boolean => {
    return profile?.role?.name === 'admin';
  };

  const isManager = (): boolean => {
    return profile?.role?.name === 'manager';
  };

  const isEmployee = (): boolean => {
    return profile?.role?.name === 'employee';
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    hasPermission,
    isAdmin,
    isManager,
    isEmployee,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}