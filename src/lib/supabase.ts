import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-key';

// Modo demo si no hay configuración de Supabase
const isDemoMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

if (isDemoMode) {
  console.warn('Ejecutando en modo demo - configura las variables de entorno de Supabase para usar la base de datos real');
}

// Estado de conexión global
let connectionState = {
  isConnected: false,
  isConnecting: false,
  lastConnectionAttempt: 0,
  retryCount: 0,
  maxRetries: 5,
  retryDelay: 1000,
  healthCheckInterval: null as NodeJS.Timeout | null,
  listeners: new Set<(status: ConnectionStatus) => void>()
};

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

let supabaseClient: any = null;

// Configuración optimizada de Supabase
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
          'X-Client-Info': 'ventasfull-app',
          'X-Client-Version': '1.0.0'
        },
        fetch: (url, options = {}) => {
          // Agregar timeout personalizado
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout

          return fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
              ...options.headers,
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          }).finally(() => {
            clearTimeout(timeoutId);
          });
        }
      },
      db: {
        schema: 'public'
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });

    // Inicializar monitoreo de conexión
    initializeConnectionMonitoring();
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    supabaseClient = null;
  }
}

export const supabase = supabaseClient;

// Sistema de listeners para cambios de estado de conexión
export const addConnectionListener = (callback: (status: ConnectionStatus) => void) => {
  connectionState.listeners.add(callback);
  
  // Enviar estado actual inmediatamente
  const currentStatus = connectionState.isConnected ? 'connected' : 
                       connectionState.isConnecting ? 'connecting' : 'disconnected';
  callback(currentStatus);
  
  return () => {
    connectionState.listeners.delete(callback);
  };
};

function notifyConnectionListeners(status: ConnectionStatus) {
  connectionState.listeners.forEach(listener => {
    try {
      listener(status);
    } catch (error) {
      console.error('Error in connection listener:', error);
    }
  });
}

// Función para programar reconexión automática
function scheduleReconnection() {
  const delay = Math.min(
    connectionState.retryDelay * Math.pow(2, connectionState.retryCount),
    30000 // Máximo 30 segundos
  );

  console.log(`🔄 Programando reconexión en ${delay}ms (intento ${connectionState.retryCount + 1}/${connectionState.maxRetries})`);

  setTimeout(async () => {
    connectionState.retryCount++;
    await checkConnectionHealth();
  }, delay);
}

// Función mejorada para verificar la salud de la conexión
export const checkConnectionHealth = async (): Promise<boolean> => {
  if (isDemoMode || !supabaseClient) {
    notifyConnectionListeners('disconnected');
    return false;
  }

  if (connectionState.isConnecting) {
    return connectionState.isConnected;
  }

  try {
    connectionState.isConnecting = true;
    notifyConnectionListeners('connecting');

    console.log('Verificando salud de la conexión...');

    // Realizar múltiples verificaciones en paralelo
    const healthChecks = await Promise.allSettled([
      // 1. Verificar conectividad básica
      supabaseClient.from('categories').select('count').limit(1),
      
      // 2. Verificar estado de autenticación
      supabaseClient.auth.getSession(),
      
      // 3. Verificar acceso a funciones RPC (si existen)
      supabaseClient.rpc('ping').catch(() => ({ data: null, error: null }))
    ]);

    const [dbCheck, authCheck, rpcCheck] = healthChecks;

    // Evaluar resultados
    const dbHealthy = dbCheck.status === 'fulfilled' && !dbCheck.value.error;
    const authHealthy = authCheck.status === 'fulfilled' && !authCheck.value.error;

    const isHealthy = dbHealthy && authHealthy;

    if (isHealthy) {
      connectionState.isConnected = true;
      connectionState.retryCount = 0;
      connectionState.lastConnectionAttempt = Date.now();
      notifyConnectionListeners('connected');
      console.log('✅ Conexión a Supabase saludable');
      return true;
    } else {
      throw new Error('Health checks failed');
    }

  } catch (error) {
    console.error('❌ Error en verificación de salud:', error);
    connectionState.isConnected = false;
    notifyConnectionListeners('error');
    
    // Intentar reconexión automática
    if (connectionState.retryCount < connectionState.maxRetries) {
      scheduleReconnection();
    }
    
    return false;
  } finally {
    connectionState.isConnecting = false;
  }
};

// Función para inicializar el monitoreo de conexión
function initializeConnectionMonitoring() {
  if (!supabaseClient) return;

  // Verificar conexión cada 30 segundos
  connectionState.healthCheckInterval = setInterval(async () => {
    await checkConnectionHealth();
  }, 30000);

  // Limpiar interval al cerrar la aplicación
  window.addEventListener('beforeunload', () => {
    if (connectionState.healthCheckInterval) {
      clearInterval(connectionState.healthCheckInterval);
    }
  });

  // Verificar conexión inicial
  checkConnectionHealth();
}

// Función para forzar reconexión manual
export const forceReconnection = async (): Promise<boolean> => {
  console.log('🔄 Forzando reconexión...');
  connectionState.retryCount = 0;
  return await checkConnectionHealth();
};

// Función mejorada para verificar si Supabase está disponible
export const isSupabaseAvailable = (): boolean => {
  return !isDemoMode && supabaseClient !== null && connectionState.isConnected;
};

// Wrapper para operaciones de base de datos con reconexión automática
export const withConnectionRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> => {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Verificar conexión antes de la operación
      if (!connectionState.isConnected) {
        const reconnected = await checkConnectionHealth();
        if (!reconnected) {
          throw new Error('No se pudo establecer conexión con la base de datos');
        }
      }

      return await operation();
    } catch (error: any) {
      lastError = error;
      console.error(`Intento ${attempt}/${maxRetries} falló:`, error);

      // Si es un error de conexión, marcar como desconectado
      if (isConnectionError(error)) {
        connectionState.isConnected = false;
        notifyConnectionListeners('error');
      }

      // Si no es el último intento, esperar antes de reintentar
      if (attempt < maxRetries) {
        const delay = 1000 * attempt; // Delay incremental
        console.log(`⏳ Esperando ${delay}ms antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

// Función para detectar errores de conexión
function isConnectionError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  return (
    errorMessage.includes('fetch') ||
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('aborted') ||
    error?.code === 'NETWORK_ERROR' ||
    error?.code === 'TIMEOUT'
  );
}

// Función mejorada para manejar errores de conexión
export const handleSupabaseError = (error: any): string => {
  if (!error) return 'Error desconocido';
  
  const errorMessage = error.message || error.toString();
  
  // Errores de conexión
  if (isConnectionError(error)) {
    return 'Error de conexión. Verificando conectividad...';
  }
  
  // Errores de autenticación
  if (errorMessage.includes('Invalid API key') || errorMessage.includes('unauthorized')) {
    return 'Error de autenticación. Verifica la configuración de Supabase.';
  }
  
  if (errorMessage.includes('JWT') || errorMessage.includes('token')) {
    return 'Sesión expirada. Por favor inicia sesión nuevamente.';
  }
  
  // Errores de base de datos
  if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
    return 'Error de base de datos. La tabla no existe o no tienes permisos.';
  }
  
  if (errorMessage.includes('duplicate key')) {
    return 'Ya existe un registro con esos datos. Verifica la información.';
  }
  
  if (errorMessage.includes('violates foreign key constraint')) {
    return 'Error de referencia. Verifica que los datos relacionados existan.';
  }
  
  if (errorMessage.includes('violates check constraint')) {
    return 'Los datos no cumplen con las validaciones requeridas.';
  }
  
  if (errorMessage.includes('permission denied') || errorMessage.includes('insufficient_privilege')) {
    return 'No tienes permisos para realizar esta operación.';
  }
  
  // Errores de validación
  if (errorMessage.includes('invalid input syntax')) {
    return 'Formato de datos inválido. Verifica la información ingresada.';
  }
  
  // Devolver el mensaje original si no es un error conocido
  return errorMessage || 'Error en la operación de base de datos';
};

// Función mejorada para ejecutar consultas con manejo de errores y reconexión
export const safeQuery = async <T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  fallbackData: T,
  options?: {
    retries?: number;
    timeout?: number;
    fallbackOnError?: boolean;
  }
): Promise<{ data: T; error: string | null; fromCache?: boolean }> => {
  const { retries = 2, timeout = 10000, fallbackOnError = true } = options || {};

  if (isDemoMode || !supabaseClient) {
    return { data: fallbackData, error: null, fromCache: false };
  }

  try {
    const result = await withConnectionRetry(async () => {
      // Crear timeout para la consulta
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), timeout);
      });

      const queryPromise = queryFn();
      
      return await Promise.race([queryPromise, timeoutPromise]) as { data: T | null; error: any };
    }, retries);

    if (result.error) {
      const errorMessage = handleSupabaseError(result.error);
      console.error('Database query error:', result.error);
      
      if (fallbackOnError) {
        return { data: fallbackData, error: errorMessage, fromCache: true };
      } else {
        return { data: fallbackData, error: errorMessage, fromCache: false };
      }
    }

    return { data: result.data || fallbackData, error: null, fromCache: false };
  } catch (error) {
    const errorMessage = handleSupabaseError(error);
    console.error('Query execution error:', error);
    
    if (fallbackOnError) {
      return { data: fallbackData, error: errorMessage, fromCache: true };
    } else {
      return { data: fallbackData, error: errorMessage, fromCache: false };
    }
  }
};

// Función mejorada para insertar datos
export const safeInsert = async <T>(
  tableName: string,
  data: any,
  options?: {
    retries?: number;
    validateBeforeInsert?: boolean;
  }
): Promise<{ success: boolean; data: T | null; error: string | null }> => {
  const { retries = 2, validateBeforeInsert = true } = options || {};

  if (isDemoMode || !supabaseClient) {
    return { 
      success: true, 
      data: { ...data, id: `demo-${Date.now()}`, created_at: new Date().toISOString() } as T, 
      error: null 
    };
  }

  try {
    // Validación básica antes de insertar
    if (validateBeforeInsert && (!data || Object.keys(data).length === 0)) {
      return { success: false, data: null, error: 'No hay datos para insertar' };
    }

    const result = await withConnectionRetry(async () => {
      return await supabaseClient
        .from(tableName)
        .insert([data])
        .select()
        .single();
    }, retries);

    if (result.error) {
      const errorMessage = handleSupabaseError(result.error);
      return { success: false, data: null, error: errorMessage };
    }

    return { success: true, data: result.data, error: null };
  } catch (error) {
    const errorMessage = handleSupabaseError(error);
    return { success: false, data: null, error: errorMessage };
  }
};

// Función mejorada para actualizar datos
export const safeUpdate = async (
  tableName: string,
  data: any,
  id: string,
  options?: {
    retries?: number;
    validateBeforeUpdate?: boolean;
  }
): Promise<{ success: boolean; error: string | null; rowsAffected?: number }> => {
  const { retries = 2, validateBeforeUpdate = true } = options || {};

  if (isDemoMode || !supabaseClient) {
    return { success: true, error: null, rowsAffected: 1 };
  }

  try {
    // Validación básica
    if (validateBeforeUpdate && (!data || Object.keys(data).length === 0)) {
      return { success: false, error: 'No hay datos para actualizar' };
    }

    if (!id) {
      return { success: false, error: 'ID requerido para actualización' };
    }

    const result = await withConnectionRetry(async () => {
      return await supabaseClient
        .from(tableName)
        .update(data)
        .eq('id', id)
        .select();
    }, retries);

    if (result.error) {
      const errorMessage = handleSupabaseError(result.error);
      return { success: false, error: errorMessage };
    }

    return { 
      success: true, 
      error: null, 
      rowsAffected: result.data?.length || 0 
    };
  } catch (error) {
    const errorMessage = handleSupabaseError(error);
    return { success: false, error: errorMessage };
  }
};

// Función mejorada para eliminar datos
export const safeDelete = async (
  tableName: string,
  id: string,
  options?: {
    retries?: number;
    confirmBeforeDelete?: boolean;
  }
): Promise<{ success: boolean; error: string | null; rowsAffected?: number }> => {
  const { retries = 2, confirmBeforeDelete = false } = options || {};

  if (isDemoMode || !supabaseClient) {
    return { success: true, error: null, rowsAffected: 1 };
  }

  try {
    if (!id) {
      return { success: false, error: 'ID requerido para eliminación' };
    }

    if (confirmBeforeDelete) {
      // Verificar que el registro existe antes de eliminar
      const { data: existingRecord } = await supabaseClient
        .from(tableName)
        .select('id')
        .eq('id', id)
        .single();

      if (!existingRecord) {
        return { success: false, error: 'El registro no existe' };
      }
    }

    const result = await withConnectionRetry(async () => {
      return await supabaseClient
        .from(tableName)
        .delete()
        .eq('id', id)
        .select();
    }, retries);

    if (result.error) {
      const errorMessage = handleSupabaseError(result.error);
      return { success: false, error: errorMessage };
    }

    return { 
      success: true, 
      error: null, 
      rowsAffected: result.data?.length || 0 
    };
  } catch (error) {
    const errorMessage = handleSupabaseError(error);
    return { success: false, error: errorMessage };
  }
};

// Función para ejecutar transacciones de manera segura
export const safeTransaction = async <T>(
  operations: Array<() => Promise<any>>,
  options?: {
    retries?: number;
    rollbackOnError?: boolean;
  }
): Promise<{ success: boolean; results: T[]; error: string | null }> => {
  const { retries = 1, rollbackOnError = true } = options || {};

  if (isDemoMode || !supabaseClient) {
    // En modo demo, simular éxito
    const mockResults = operations.map(() => ({ success: true }));
    return { success: true, results: mockResults as T[], error: null };
  }

  try {
    const results = await withConnectionRetry(async () => {
      const operationResults = [];
      
      for (const operation of operations) {
        const result = await operation();
        if (result.error) {
          throw new Error(`Transaction failed: ${result.error.message}`);
        }
        operationResults.push(result.data);
      }
      
      return operationResults;
    }, retries);

    return { success: true, results: results as T[], error: null };
  } catch (error) {
    const errorMessage = handleSupabaseError(error);
    console.error('Transaction failed:', error);
    return { success: false, results: [], error: errorMessage };
  }
};

// Función para verificar la conexión con timeout personalizado
export const testConnection = async (timeoutMs: number = 8000): Promise<boolean> => {
  if (isDemoMode || !supabaseClient) return false;

  try {
    console.log('🔍 Probando conexión a la base de datos...');

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection test timeout')), timeoutMs);
    });

    const testPromise = supabaseClient
      .from('categories')
      .select('id')
      .limit(1);

    const { data, error } = await Promise.race([testPromise, timeoutPromise]);

    if (error) {
      console.error('❌ Error en prueba de conexión:', error);
      return false;
    }

    console.log('✅ Conexión a la base de datos exitosa');
    return true;
  } catch (error) {
    console.error('❌ Prueba de conexión falló:', error);
    return false;
  }
};

// Función para obtener estadísticas de conexión
export const getConnectionStats = () => {
  return {
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    retryCount: connectionState.retryCount,
    maxRetries: connectionState.maxRetries,
    lastConnectionAttempt: connectionState.lastConnectionAttempt,
    timeSinceLastAttempt: connectionState.lastConnectionAttempt 
      ? Date.now() - connectionState.lastConnectionAttempt 
      : null,
    isDemoMode,
    hasClient: !!supabaseClient
  };
};

// Función para verificar el estado completo de Supabase
export const checkSupabaseHealth = async () => {
  if (isDemoMode || !supabaseClient) {
    return {
      isHealthy: false,
      mode: 'demo',
      message: 'Ejecutando en modo demo',
      details: {
        database: false,
        auth: false,
        realtime: false
      }
    };
  }

  try {
    const healthChecks = await Promise.allSettled([
      // Verificar base de datos
      supabaseClient.from('categories').select('count').limit(1),
      
      // Verificar autenticación
      supabaseClient.auth.getSession(),
      
      // Verificar realtime (opcional)
      new Promise(resolve => {
        const channel = supabaseClient.channel('health-check');
        channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            resolve({ success: true });
            supabaseClient.removeChannel(channel);
          }
        });
        
        // Timeout para realtime
        setTimeout(() => {
          resolve({ success: false });
          supabaseClient.removeChannel(channel);
        }, 3000);
      })
    ]);

    const [dbResult, authResult, realtimeResult] = healthChecks;

    const dbHealthy = dbResult.status === 'fulfilled' && !dbResult.value.error;
    const authHealthy = authResult.status === 'fulfilled' && !authResult.value.error;
    const realtimeHealthy = realtimeResult.status === 'fulfilled' && realtimeResult.value.success;

    const isHealthy = dbHealthy && authHealthy;

    return {
      isHealthy,
      mode: 'production',
      message: isHealthy ? 'Sistema funcionando correctamente' : 'Problemas de conectividad detectados',
      details: {
        database: dbHealthy,
        auth: authHealthy,
        realtime: realtimeHealthy,
        session: authResult.status === 'fulfilled' ? !!authResult.value.data?.session : false
      }
    };
  } catch (error) {
    console.error('Health check failed:', error);
    return {
      isHealthy: false,
      mode: 'production',
      message: 'Error de conexión con Supabase',
      details: {
        database: false,
        auth: false,
        realtime: false,
        session: false
      }
    };
  }
};

// Función para reintentar operaciones fallidas con backoff exponencial
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> => {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`🔄 Ejecutando operación (intento ${i + 1}/${maxRetries})`);
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(`❌ Operación falló (intento ${i + 1}/${maxRetries}):`, error);

      if (i < maxRetries - 1) {
        // Calcular delay con backoff exponencial
        const delay = Math.min(baseDelay * Math.pow(2, i), maxDelay);
        console.log(`⏳ Esperando ${delay}ms antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('❌ Todos los intentos fallaron');
  throw lastError;
};

// Función para limpiar recursos de conexión
export const cleanupConnection = () => {
  if (connectionState.healthCheckInterval) {
    clearInterval(connectionState.healthCheckInterval);
    connectionState.healthCheckInterval = null;
  }
  
  connectionState.listeners.clear();
  connectionState.isConnected = false;
  connectionState.isConnecting = false;
};

// Hook personalizado para monitorear el estado de conexión
export const useConnectionStatus = () => {
  const [status, setStatus] = React.useState<ConnectionStatus>(
    connectionState.isConnected ? 'connected' : 'disconnected'
  );

  React.useEffect(() => {
    const unsubscribe = addConnectionListener(setStatus);
    return unsubscribe;
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    stats: getConnectionStats(),
    forceReconnect: forceReconnection
  };
};

export { isDemoMode };
