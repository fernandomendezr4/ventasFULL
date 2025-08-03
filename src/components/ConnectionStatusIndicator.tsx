import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { useConnectionStatus, getConnectionStats, forceReconnection } from '../lib/supabase';

interface ConnectionStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export default function ConnectionStatusIndicator({ 
  showDetails = false, 
  className = '' 
}: ConnectionStatusIndicatorProps) {
  const { status, isConnected, isConnecting, stats } = useConnectionStatus();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    try {
      await forceReconnection();
    } catch (error) {
      console.error('Manual reconnection failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const getStatusIcon = () => {
    if (isRetrying || isConnecting) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }

    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'connecting':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'disconnected':
      default:
        return <WifiOff className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusText = () => {
    if (isRetrying) return 'Reconectando...';
    
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando...';
      case 'error':
        return 'Error de conexión';
      case 'disconnected':
      default:
        return stats.isDemoMode ? 'Modo Demo' : 'Desconectado';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'connecting':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'disconnected':
      default:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  if (!showDetails) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors duration-200 hover:opacity-80 ${getStatusColor()}`}
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 z-50">
          <div className="p-4">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
              <Wifi className="h-4 w-4 mr-2" />
              Estado de Conexión
            </h3>
            
            <div className="space-y-3">
              {/* Estado Principal */}
              <div className={`p-3 rounded-lg border ${getStatusColor()}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon()}
                    <span className="font-medium">{getStatusText()}</span>
                  </div>
                  {!isConnected && !stats.isDemoMode && (
                    <button
                      onClick={handleRetryConnection}
                      disabled={isRetrying || isConnecting}
                      className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded hover:bg-opacity-75 transition-colors duration-200 disabled:opacity-50"
                    >
                      {isRetrying ? 'Reintentando...' : 'Reintentar'}
                    </button>
                  )}
                </div>
              </div>

              {/* Estadísticas de Conexión */}
              <div className="bg-slate-50 p-3 rounded-lg">
                <h4 className="text-sm font-medium text-slate-900 mb-2">Estadísticas</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <span className="font-medium">Modo:</span>
                    <span className="ml-1">{stats.isDemoMode ? 'Demo' : 'Producción'}</span>
                  </div>
                  <div>
                    <span className="font-medium">Reintentos:</span>
                    <span className="ml-1">{stats.retryCount}/{stats.maxRetries}</span>
                  </div>
                  {stats.timeSinceLastAttempt && (
                    <div className="col-span-2">
                      <span className="font-medium">Último intento:</span>
                      <span className="ml-1">
                        hace {Math.round(stats.timeSinceLastAttempt / 1000)}s
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Información del Cliente */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Cliente Supabase</h4>
                <div className="text-xs text-blue-800 space-y-1">
                  <div>Estado: {stats.hasClient ? 'Inicializado' : 'No disponible'}</div>
                  {!stats.isDemoMode && (
                    <>
                      <div>URL: {import.meta.env.VITE_SUPABASE_URL ? '✓ Configurada' : '✗ No configurada'}</div>
                      <div>Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Configurada' : '✗ No configurada'}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-slate-600 text-white px-3 py-2 rounded text-xs hover:bg-slate-700 transition-colors duration-200"
                >
                  Recargar App
                </button>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="flex-1 bg-slate-200 text-slate-700 px-3 py-2 rounded text-xs hover:bg-slate-300 transition-colors duration-200"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}