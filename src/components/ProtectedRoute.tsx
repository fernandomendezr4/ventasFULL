import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, signOut } = useAuth();
  const [showInactiveMessage, setShowInactiveMessage] = React.useState(true);
  const [countdown, setCountdown] = React.useState(5);
  const [timeoutReached, setTimeoutReached] = React.useState(false);

  // Timeout de seguridad para evitar carga infinita
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log('Loading timeout reached - forcing render');
        setTimeoutReached(true);
      }
    }, 8000); // 8 segundos máximo de carga

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

  if (loading && !timeoutReached) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando...</p>
          <p className="text-xs text-slate-400 mt-2">
            Si la carga toma mucho tiempo, recarga la página
          </p>
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
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
              >
                Ir al Login Ahora
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
        </div>
      </div>
    );
  }

  return <>{children}</>;
}