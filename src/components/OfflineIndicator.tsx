import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, AlertTriangle, RefreshCw } from 'lucide-react';
import { useConnectionStatus } from '../lib/supabase';

export default function OfflineIndicator() {
  const { status, isConnected, forceReconnect } = useConnectionStatus();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnectButton, setShowReconnectButton] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (!isConnected) {
        // Intentar reconectar cuando vuelva la conexión a internet
        setTimeout(() => {
          forceReconnect();
        }, 1000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, forceReconnect]);

  // Mostrar botón de reconexión después de 10 segundos sin conexión
  useEffect(() => {
    if (!isConnected && isOnline) {
      const timer = setTimeout(() => {
        setShowReconnectButton(true);
      }, 10000);

      return () => clearTimeout(timer);
    } else {
      setShowReconnectButton(false);
    }
  }, [isConnected, isOnline]);

  // No mostrar nada si todo está bien
  if (isOnline && isConnected) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
      <div className={`rounded-lg shadow-lg border p-4 transition-all duration-300 ${
        !isOnline 
          ? 'bg-red-50 border-red-200' 
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {!isOnline ? (
              <WifiOff className="h-5 w-5 text-red-600 mr-3" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
            )}
            <div>
              <h4 className={`font-medium ${
                !isOnline ? 'text-red-900' : 'text-yellow-900'
              }`}>
                {!isOnline ? 'Sin conexión a Internet' : 'Problema de conexión'}
              </h4>
              <p className={`text-sm ${
                !isOnline ? 'text-red-700' : 'text-yellow-700'
              }`}>
                {!isOnline 
                  ? 'Verifica tu conexión a internet'
                  : status === 'connecting' 
                    ? 'Reintentando conexión...'
                    : 'No se puede conectar a la base de datos'
                }
              </p>
            </div>
          </div>

          {showReconnectButton && isOnline && (
            <button
              onClick={forceReconnect}
              className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center text-sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reconectar
            </button>
          )}
        </div>

        {/* Barra de progreso para reconexión */}
        {status === 'connecting' && (
          <div className="mt-3">
            <div className="w-full bg-blue-200 rounded-full h-1">
              <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}