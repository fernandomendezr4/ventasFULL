import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-key';

// Modo demo si no hay configuración de Supabase
const isDemoMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

if (isDemoMode) {
  console.warn('Ejecutando en modo demo - configura las variables de entorno de Supabase para usar la base de datos real');
}

let supabaseClient: any = null;

if (!isDemoMode) {
  try {
    supabaseClient = createClient<Database>(supabaseUrl, supabaseKey, {
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
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    supabaseClient = null;
  }
}

export const supabase = supabaseClient;

// Función para verificar si Supabase está disponible
export const isSupabaseAvailable = (): boolean => {
  return !isDemoMode && supabase !== null;
};

// Función para manejar errores de conexión de manera elegante
export const handleSupabaseError = (error: any): string => {
  if (!error) return 'Error desconocido';
  
  // Errores comunes de conexión
  if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
    return 'Error de conexión. Verifica tu internet y vuelve a intentar.';
  }
  
  if (error.message?.includes('Invalid API key') || error.message?.includes('unauthorized')) {
    return 'Error de autenticación. Verifica la configuración de Supabase.';
  }
  
  if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
    return 'Error de base de datos. La tabla no existe o no tienes permisos.';
  }
  
  if (error.message?.includes('duplicate key')) {
    return 'Ya existe un registro con esos datos. Verifica la información.';
  }
  
  if (error.message?.includes('violates foreign key constraint')) {
    return 'Error de referencia. Verifica que los datos relacionados existan.';
  }
  
  if (error.message?.includes('violates check constraint')) {
    return 'Los datos no cumplen con las validaciones requeridas.';
  }
  
  // Devolver el mensaje original si no es un error conocido
  return error.message || 'Error en la operación de base de datos';
};

// Función para ejecutar consultas con manejo de errores
export const safeQuery = async <T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  fallbackData: T
): Promise<{ data: T; error: string | null }> => {
  if (isDemoMode || !supabase) {
    return { data: fallbackData, error: null };
  }
  
  try {
    const result = await queryFn();
    
    if (result.error) {
      const errorMessage = handleSupabaseError(result.error);
      console.error('Database query error:', result.error);
      return { data: fallbackData, error: errorMessage };
    }
    
    return { data: result.data || fallbackData, error: null };
  } catch (error) {
    const errorMessage = handleSupabaseError(error);
    console.error('Query execution error:', error);
    return { data: fallbackData, error: errorMessage };
  }
};

// Función para insertar datos con manejo de errores
export const safeInsert = async <T>(
  tableName: string,
  data: any
): Promise<{ success: boolean; data: T | null; error: string | null }> => {
  if (isDemoMode || !supabase) {
    return { 
      success: true, 
      data: { ...data, id: `demo-${Date.now()}`, created_at: new Date().toISOString() } as T, 
      error: null 
    };
  }
  
  try {
    const { data: result, error } = await supabase
      .from(tableName)
      .insert([data])
      .select()
      .single();
    
    if (error) {
      const errorMessage = handleSupabaseError(error);
      return { success: false, data: null, error: errorMessage };
    }
    
    return { success: true, data: result, error: null };
  } catch (error) {
    const errorMessage = handleSupabaseError(error);
    return { success: false, data: null, error: errorMessage };
  }
};

// Función para actualizar datos con manejo de errores
export const safeUpdate = async (
  tableName: string,
  data: any,
  id: string
): Promise<{ success: boolean; error: string | null }> => {
  if (isDemoMode || !supabase) {
    return { success: true, error: null };
  }
  
  try {
    const { error } = await supabase
      .from(tableName)
      .update(data)
      .eq('id', id);
    
    if (error) {
      const errorMessage = handleSupabaseError(error);
      return { success: false, error: errorMessage };
    }
    
    return { success: true, error: null };
  } catch (error) {
    const errorMessage = handleSupabaseError(error);
    return { success: false, error: errorMessage };
  }
};

// Función para eliminar datos con manejo de errores
export const safeDelete = async (
  tableName: string,
  id: string
): Promise<{ success: boolean; error: string | null }> => {
  if (isDemoMode || !supabase) {
    return { success: true, error: null };
  }
  
  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);
    
    if (error) {
      const errorMessage = handleSupabaseError(error);
      return { success: false, error: errorMessage };
    }
    
    return { success: true, error: null };
  } catch (error) {
    const errorMessage = handleSupabaseError(error);
    return { success: false, error: errorMessage };
  }
};

export { isDemoMode };

// Función para verificar la conexión
export const testConnection = async () => {
  if (isDemoMode || !supabase) return false;
  
  try {
    const { data, error } = await supabase
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

// Función para reintentar operaciones fallidas
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
};