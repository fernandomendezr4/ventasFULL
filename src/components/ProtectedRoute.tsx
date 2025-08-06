import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, signOut, connectionStatus, retryConnection } = useAuth();
  const [showInactiveMessage, setShowInactiveMessage] = React.useState(true);
  const [countdown, setCountdown] = React.useState(5);
  const [timeoutReached, setTimeoutReached] = React.useState(false);
  const [retryingConnection, setRetryingConnection] = React.useState(false);

  // Timeout de seguridad para evitar carga infinita
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Loading timeout reached');
        setTimeoutReached(true);
      }
    }, 8000); // Aumentado a 8 segundos para mejor estabilidad

    return () => clearTimeout(timeoutId);
  }, [loading]);

  // Timer para redirigir al login después de mostrar el mensaje
  React.useEffect(() => {
    if (user && !user.is_active && showInactiveMessage) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // Cerrar sesión y redirigir al login
            signOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [user, showInactiveMessage, signOut]);

  const handleRetryConnection = async () => {
    setRetryingConnection(true);
    try {
      await retryConnection();
    } catch (error) {
      console.error('Retry connection failed:', error);
    } finally {
      setRetryingConnection(false);
    }
  };

  if (loading && !timeoutReached) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Iniciando Sistema</h3>
          <p className="text-slate-600 mb-4">Verificando autenticación y conexión...</p>
          
          {/* Connection Status */}
          <div className={`p-3 rounded-lg border text-sm ${
            connectionStatus === 'connected' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : connectionStatus === 'disconnected'
                ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {connectionStatus === 'checking' && 'Verificando conexión...'}
            {connectionStatus === 'connected' && 'Conectado a la base de datos'}
            {connectionStatus === 'disconnected' && 'Modo demo/offline activo'}
          </div>
          
          <div className="mt-6 text-xs text-slate-400 space-y-1">
            <p>Si la carga toma mucho tiempo:</p>
            <button
              onClick={() => window.location.reload()}
              className="text-blue-600 hover:text-blue-800 underline transition-colors duration-200"
            >
              Recargar página
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar error de timeout con opciones de recuperación
  if (timeoutReached) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <div className="text-orange-600 mb-4">
            <AlertTriangle className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Tiempo de Carga Agotado</h2>
          <p className="text-slate-600 mb-6">
           La aplicación está tardando más de lo esperado en cargar. Esto puede deberse a problemas de conexión.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
            >
              Recargar Aplicación
            </button>
            
            {connectionStatus === 'disconnected' && (
              <button
                onClick={handleRetryConnection}
                disabled={retryingConnection}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200 font-medium flex items-center justify-center"
              >
                {retryingConnection ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Reintentando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reintentar Conexión
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!user || timeoutReached) {
    return <LoginForm />;
  }

  if (!user.is_active) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <div className="text-red-600 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Cuenta Inactiva</h2>
          <p className="text-slate-600 mb-4">
            Tu cuenta ha sido desactivada. Contacta al administrador para reactivarla.
          </p>
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Serás redirigido al inicio de sesión en <span className="font-bold text-blue-900">{countdown}</span> segundos
            </p>
            <div className="mt-3">
              <button
                onClick={() => signOut()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm flex items-center"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Ir al Inicio de Sesión Ahora
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <div className="text-orange-600 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Acceso Restringido</h2>
          <p className="text-slate-600 mb-4">
           No tienes permisos para acceder a esta sección.
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}