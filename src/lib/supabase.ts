import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-key';

// Modo demo si no hay configuración de Supabase
const isDemoMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

if (isDemoMode) {
  console.warn('Ejecutando en modo demo - configura las variables de entorno de Supabase para usar la base de datos real');
}

export const supabase = isDemoMode ? null : createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storageKey: 'sb-auth-token',
    debug: false
  },
  global: {
    headers: {
      'X-Client-Info': 'cash-register-app',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export { isDemoMode };

// Función para verificar la conexión
export const testConnection = async () => {
  if (isDemoMode) return false;
  
  try {
    const { data, error } = await supabase!
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Database connection error:', error);
      return false;
    }
    
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
};