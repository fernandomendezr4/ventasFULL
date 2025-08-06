import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-key';

// Modo demo si no hay configuración de Supabase
const isDemoMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

if (isDemoMode) {
  console.log('🎯 MODO DEMO ACTIVO - Acceso completo sin restricciones');
  console.log('📧 Credenciales rápidas:');
  console.log('   Admin: admin@ventasfull.com / admin123');
  console.log('   Gerente: gerente@ventasfull.com / gerente123');
  console.log('   Empleado: empleado@ventasfull.com / empleado123');
  console.log('💡 También puedes usar cualquier email/contraseña');
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

// Función para verificar la conexión
export const testConnection = async () => {
  if (isDemoMode || !supabase) return false;
  
  try {
    console.log('Verificando conexión a la base de datos...');
    
    // Hacer una consulta simple para verificar conectividad
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Error de conexión a la base de datos:', error);
      return false;
    }
    
    console.log('✅ Conexión a la base de datos exitosa');
    return true;
  } catch (error) {
    console.error('❌ Prueba de conexión falló:', error);
    return false;
  }
};

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

// Connection status management
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ConnectionStats {
  isDemoMode: boolean;
  hasClient: boolean;
  retryCount: number;
  maxRetries: number;
  timeSinceLastAttempt: number | null;
  lastError: string | null;
}

let connectionStatus: ConnectionStatus = isDemoMode ? 'disconnected' : 'connecting';
let connectionListeners: ((status: ConnectionStatus) => void)[] = [];
let connectionStats: ConnectionStats = {
  isDemoMode,
  hasClient: !!supabaseClient,
  retryCount: 0,
  maxRetries: 5,
  timeSinceLastAttempt: null,
  lastError: null
};

// Función para notificar cambios de estado a los listeners
const notifyConnectionListeners = (status: ConnectionStatus) => {
  connectionStatus = status;
  connectionListeners.forEach(listener => {
    try {
      listener(status);
    } catch (error) {
      console.error('Error in connection listener:', error);
    }
  });
};

// Función para agregar listeners de estado de conexión
export const addConnectionListener = (listener: (status: ConnectionStatus) => void) => {
  connectionListeners.push(listener);
  
  // Notificar el estado actual inmediatamente
  listener(connectionStatus);
  
  // Retornar función para remover el listener
  return () => {
    connectionListeners = connectionListeners.filter(l => l !== listener);
  };
};

// Función para obtener estadísticas de conexión
export const getConnectionStats = (): ConnectionStats => {
  return { ...connectionStats };
};

// Función para forzar reconexión
export const forceReconnection = async (): Promise<void> => {
  if (isDemoMode || !supabaseClient) {
    console.warn('Cannot reconnect in demo mode or without client');
    return;
  }

  connectionStats.retryCount++;
  connectionStats.timeSinceLastAttempt = Date.now();
  
  notifyConnectionListeners('connecting');
  
  try {
    // Intentar una consulta simple para verificar la conexión
    const { error } = await supabaseClient
      .from('categories')
      .select('id')
      .limit(1);
    
    if (error) {
      connectionStats.lastError = error.message;
      notifyConnectionListeners('error');
      throw error;
    }
    
    connectionStats.lastError = null;
    connectionStats.retryCount = 0;
    notifyConnectionListeners('connected');
  } catch (error) {
    connectionStats.lastError = (error as Error).message;
    notifyConnectionListeners('error');
    throw error;
  }
};

// Hook para monitorear el estado de conexión
export const useConnectionStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus>(connectionStatus);
  const [stats, setStats] = useState(getConnectionStats());

  useEffect(() => {
    const unsubscribe = addConnectionListener((newStatus) => {
      setStatus(newStatus);
      setStats(getConnectionStats());
    });

    return unsubscribe;
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    stats,
    forceReconnect: forceReconnection
  };
};

// Inicializar el estado de conexión
if (!isDemoMode && supabaseClient) {
  // Verificar conexión inicial
  testConnection().then(isConnected => {
    notifyConnectionListeners(isConnected ? 'connected' : 'error');
  });
} else {
  // En modo demo, marcar como desconectado
  notifyConnectionListeners('disconnected');
}

// Función mejorada para verificar el estado completo de Supabase
export const checkSupabaseHealth = async () => {
  if (isDemoMode || !supabase) {
    return {
      isHealthy: false,
      mode: 'demo',
      message: 'Ejecutando en modo demo'
    };
  }
  
  try {
    // Verificar autenticación
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // Verificar base de datos
    const { data, error: dbError } = await supabase
      .from('categories')
      .select('count')
      .limit(1);
    
    const isHealthy = !sessionError && !dbError;
    
    return {
      isHealthy,
      mode: 'production',
      session: !!session,
      database: !dbError,
      message: isHealthy ? 'Sistema funcionando correctamente' : 'Problemas de conectividad detectados'
    };
  } catch (error) {
    console.error('Health check failed:', error);
    return {
      isHealthy: false,
      mode: 'production',
      session: false,
      database: false,
      message: 'Error de conexión con Supabase'
    };
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
      console.log(`Attempting operation (try ${i + 1}/${maxRetries})`);
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(`Operation failed (try ${i + 1}/${maxRetries}):`, error);
      
      if (i < maxRetries - 1) {
        const waitTime = delay * (i + 1);
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  console.error('All retry attempts failed');
  throw lastError;
};