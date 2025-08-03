import { useState, useEffect, useCallback } from 'react';
import { 
  addConnectionListener, 
  getConnectionStats, 
  forceReconnection,
  type ConnectionStatus 
} from '../lib/supabase';

interface ConnectionMonitorState {
  status: ConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  stats: any;
  lastError: string | null;
  reconnectAttempts: number;
}

export function useConnectionMonitor() {
  const [state, setState] = useState<ConnectionMonitorState>({
    status: 'connecting',
    isConnected: false,
    isConnecting: false,
    stats: null,
    lastError: null,
    reconnectAttempts: 0
  });

  const updateStats = useCallback(() => {
    const stats = getConnectionStats();
    setState(prev => ({ ...prev, stats }));
  }, []);

  const handleReconnect = useCallback(async () => {
    try {
      setState(prev => ({ 
        ...prev, 
        reconnectAttempts: prev.reconnectAttempts + 1,
        lastError: null 
      }));
      
      await forceReconnection();
      updateStats();
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        lastError: (error as Error).message 
      }));
    }
  }, [updateStats]);

  useEffect(() => {
    // Configurar listener de estado de conexión
    const unsubscribe = addConnectionListener((status) => {
      setState(prev => ({
        ...prev,
        status,
        isConnected: status === 'connected',
        isConnecting: status === 'connecting',
        lastError: status === 'error' ? 'Error de conexión' : null
      }));
    });

    // Cargar estadísticas iniciales
    updateStats();

    // Actualizar estadísticas cada 30 segundos
    const statsInterval = setInterval(updateStats, 30000);

    return () => {
      unsubscribe();
      clearInterval(statsInterval);
    };
  }, [updateStats]);

  return {
    ...state,
    reconnect: handleReconnect,
    refreshStats: updateStats
  };
}

// Hook para operaciones que requieren conexión
export function useConnectionAwareOperation() {
  const { isConnected, status } = useConnectionMonitor();

  const executeWithConnection = useCallback(async <T>(
    operation: () => Promise<T>,
    fallback?: T
  ): Promise<{ success: boolean; data: T | null; error: string | null }> => {
    if (!isConnected && status !== 'connecting') {
      return {
        success: false,
        data: fallback || null,
        error: 'No hay conexión a la base de datos'
      };
    }

    try {
      const result = await operation();
      return {
        success: true,
        data: result,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: fallback || null,
        error: (error as Error).message
      };
    }
  }, [isConnected, status]);

  return {
    isConnected,
    status,
    executeWithConnection
  };
}

// Hook para mostrar notificaciones de estado de conexión
export function useConnectionNotifications() {
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
  }>>([]);

  useEffect(() => {
    let previousStatus: ConnectionStatus | null = null;

    const unsubscribe = addConnectionListener((status) => {
      if (previousStatus === null) {
        previousStatus = status;
        return;
      }

      // Solo mostrar notificaciones en cambios de estado significativos
      if (previousStatus !== status) {
        const notification = {
          id: `connection-${Date.now()}`,
          type: getNotificationType(status),
          message: getNotificationMessage(status, previousStatus),
          timestamp: Date.now()
        };

        setNotifications(prev => [...prev, notification]);

        // Remover notificación después de 5 segundos
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== notification.id));
        }, 5000);

        previousStatus = status;
      }
    });

    return unsubscribe;
  }, []);

  const getNotificationType = (status: ConnectionStatus): 'success' | 'error' | 'warning' | 'info' => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'error':
        return 'error';
      case 'disconnected':
        return 'warning';
      case 'connecting':
        return 'info';
      default:
        return 'info';
    }
  };

  const getNotificationMessage = (status: ConnectionStatus, previousStatus: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return previousStatus === 'error' || previousStatus === 'disconnected' 
          ? 'Conexión restaurada exitosamente' 
          : 'Conectado a la base de datos';
      case 'error':
        return 'Error de conexión con la base de datos';
      case 'disconnected':
        return 'Conexión perdida - Trabajando en modo offline';
      case 'connecting':
        return 'Reintentando conexión...';
      default:
        return 'Estado de conexión desconocido';
    }
  };

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    notifications,
    dismissNotification
  };
}