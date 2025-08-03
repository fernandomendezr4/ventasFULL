import React, { useState, useEffect } from 'react';
import { Clock, Monitor, X, AlertTriangle, Shield, RefreshCw } from 'lucide-react';
import { getUserActiveSessions, revokeAllUserSessions, cleanupExpiredSessions } from '../lib/employeeAuth';
import { useAuth } from '../contexts/AuthContext';

interface UserSessionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

interface SessionData {
  id: string;
  session_token: string;
  created_at: string;
  last_accessed: string;
  expires_at: string;
}

export default function UserSessionManager({ 
  isOpen, 
  onClose, 
  userId, 
  userName 
}: UserSessionManagerProps) {
  const { user: currentUser } = useAuth();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const loadSessions = async () => {
    try {
      setLoading(true);
      const sessionData = await getUserActiveSessions(userId);
      setSessions(sessionData);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm(`¿Estás seguro de que quieres cerrar todas las sesiones de ${userName}? Esto forzará al usuario a iniciar sesión nuevamente.`)) {
      return;
    }

    try {
      setRevoking(true);
      const success = await revokeAllUserSessions(userId);
      
      if (success) {
        alert('Todas las sesiones han sido revocadas exitosamente');
        await loadSessions();
      } else {
        alert('Error al revocar las sesiones');
      }
    } catch (error) {
      console.error('Error revoking sessions:', error);
      alert('Error al revocar las sesiones');
    } finally {
      setRevoking(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime();
    const expires = new Date(expiresAt).getTime();
    const remaining = expires - now;
    
    if (remaining <= 0) return 'Expirada';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const isSessionExpired = (expiresAt: string) => {
    return new Date(expiresAt).getTime() <= new Date().getTime();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                <Monitor className="h-6 w-6 mr-3 text-blue-600" />
                Sesiones Activas - {userName}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Gestiona las sesiones activas del usuario
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Session Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <Shield className="h-5 w-5 text-blue-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Sesiones Activas: {sessions.filter(s => !isSessionExpired(s.expires_at)).length}
                      </p>
                      <p className="text-xs text-blue-700">
                        Total: {sessions.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={loadSessions}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
                
                {sessions.length > 0 && (
                  <button
                    onClick={handleRevokeAllSessions}
                    disabled={revoking}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                  >
                    {revoking ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Revocando...
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Cerrar Todas
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Sessions List */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Cargando sesiones...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12">
                <Monitor className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">No hay sesiones activas para este usuario</p>
                <p className="text-sm text-slate-400 mt-1">
                  Las sesiones aparecerán aquí cuando el usuario inicie sesión
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => {
                  const expired = isSessionExpired(session.expires_at);
                  const timeRemaining = getTimeRemaining(session.expires_at);
                  
                  return (
                    <div 
                      key={session.id} 
                      className={`border rounded-lg p-4 ${
                        expired 
                          ? 'border-red-200 bg-red-50' 
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Monitor className={`h-5 w-5 ${expired ? 'text-red-600' : 'text-blue-600'}`} />
                            <div>
                              <h4 className="font-medium text-slate-900">
                                Sesión #{session.id.slice(-8)}
                              </h4>
                              <p className={`text-sm ${expired ? 'text-red-600' : 'text-slate-600'}`}>
                                {expired ? 'Sesión expirada' : `Expira en ${timeRemaining}`}
                              </p>
                            </div>
                            {expired && (
                              <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                Expirada
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-slate-600">Creada:</span>
                              <p className="font-medium text-slate-900">
                                {formatDate(session.created_at)}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-600">Último acceso:</span>
                              <p className="font-medium text-slate-900">
                                {formatDate(session.last_accessed)}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-600">Expira:</span>
                              <p className={`font-medium ${expired ? 'text-red-600' : 'text-slate-900'}`}>
                                {formatDate(session.expires_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Security Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-3 flex items-center">
                <Shield className="h-4 w-4 mr-2 text-slate-600" />
                Información de Seguridad
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                <div>
                  <h5 className="font-medium text-slate-900 mb-1">Duración de Sesiones</h5>
                  <p>Las sesiones expiran automáticamente después de 8 horas de inactividad</p>
                </div>
                <div>
                  <h5 className="font-medium text-slate-900 mb-1">Limpieza Automática</h5>
                  <p>Las sesiones expiradas se eliminan automáticamente del sistema</p>
                </div>
                <div>
                  <h5 className="font-medium text-slate-900 mb-1">Múltiples Dispositivos</h5>
                  <p>Un usuario puede tener múltiples sesiones activas simultáneamente</p>
                </div>
                <div>
                  <h5 className="font-medium text-slate-900 mb-1">Revocación de Acceso</h5>
                  <p>Los administradores pueden revocar sesiones en cualquier momento</p>
                </div>
              </div>
            </div>

            {/* Warning for current user */}
            {userId === currentUser?.id && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Advertencia</h4>
                    <p className="text-sm text-yellow-800">
                      Estás viendo tus propias sesiones. Revocar todas las sesiones cerrará tu sesión actual.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}