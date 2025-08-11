import React, { useState, useEffect } from 'react';
import { Lock, Mail, Eye, EyeOff, LogIn, Shield, AlertCircle, CheckCircle, User, Key, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isDemoMode } from '../lib/supabase';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [rememberMe, setRememberMe] = useState(false);
  const [showDemoCredentials, setShowDemoCredentials] = useState(false);

  const { signIn } = useAuth();

  // Verificar conexión al cargar
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (isDemoMode) {
      setConnectionStatus('disconnected');
      return;
    }

    try {
      const { testConnection } = await import('../lib/supabase');
      const isConnected = await testConnection();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Error checking connection:', error);
      setConnectionStatus('disconnected');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validaciones básicas
    if (!email.trim() && !isDemoMode) {
      setError('El email es requerido');
      setLoading(false);
      return;
    }

    if (!password.trim() && !isDemoMode) {
      setError('La contraseña es requerida');
      setLoading(false);
      return;
    }

    // En modo demo, usar valores por defecto si están vacíos
    const finalEmail = email.trim() || (isDemoMode ? 'admin@ventasfull.com' : '');
    const finalPassword = password.trim() || (isDemoMode ? 'admin123' : '');

    // Validar formato de email solo si no es modo demo
    if (!isDemoMode && finalEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(finalEmail)) {
        setError('Por favor ingresa un email válido');
        setLoading(false);
        return;
      }
    }

    try {
      await signIn(finalEmail, finalPassword);
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = (error as any)?.message || 'Error en la autenticación';
      
      // Mensajes de error más específicos y amigables
      if (isDemoMode) {
        setError('En modo demo, usa las credenciales predefinidas o cualquier email/contraseña.');
      } else if (errorMessage.includes('Invalid login credentials') || 
                 errorMessage.includes('Invalid email or password')) {
        setError('Email o contraseña incorrectos. Verifica tus datos e intenta nuevamente.');
      } else if (errorMessage.includes('Email not confirmed')) {
        setError('Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.');
      } else if (errorMessage.includes('Too many requests') || 
                 errorMessage.includes('rate limit')) {
        setError('Demasiados intentos fallidos. Espera unos minutos antes de intentar de nuevo.');
      } else if (errorMessage.includes('User not found')) {
        setError('No existe una cuenta con este email. Verifica el email o contacta al administrador.');
      } else if (errorMessage.includes('Account is disabled') || 
                 errorMessage.includes('is_active')) {
        setError('Tu cuenta está desactivada. Contacta al administrador para reactivarla.');
      } else if (errorMessage.includes('connection') || 
                 errorMessage.includes('network') || 
                 errorMessage.includes('fetch')) {
        setError('Error de conexión. Verifica tu internet e intenta nuevamente.');
      } else if (errorMessage.includes('Database connection')) {
        setError('Error de conexión con la base de datos. Intenta más tarde o contacta soporte.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail('admin@ventasfull.com');
    setPassword('admin123');
  };

  const handleQuickLogin = (userType: 'admin' | 'manager' | 'employee') => {
    const credentials = {
      admin: { email: 'admin@ventasfull.com', password: 'admin123' },
      manager: { email: 'gerente@ventasfull.com', password: 'gerente123' },
      employee: { email: 'empleado@ventasfull.com', password: 'empleado123' }
    };
    
    setEmail(credentials[userType].email);
    setPassword(credentials[userType].password);
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600';
      case 'disconnected':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle className="h-4 w-4" />;
      case 'disconnected':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>;
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Conectado a la base de datos';
      case 'disconnected':
        return isDemoMode ? 'Modo Demo Activo' : 'Sin conexión - Modo offline';
      default:
        return 'Verificando conexión...';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 animate-fade-in relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '4s' }}></div>
      </div>
      
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl w-full max-w-md p-8 animate-scale-in border border-white/20 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-6 animate-bounce-in shadow-xl relative">
            <Shield className="h-8 w-8 text-white" />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full animate-pulse opacity-30"></div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            VentasFULL
          </h1>
          <p className="text-slate-600 font-medium text-lg">
            Sistema de Gestión de Ventas
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Versión 2.0 • Seguro y Confiable
          </p>
        </div>

        {/* Connection Status */}
        <div className={`mb-6 p-3 rounded-lg border flex items-center ${
          connectionStatus === 'connected' 
            ? 'bg-green-50 border-green-200' 
            : connectionStatus === 'disconnected'
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-blue-50 border-blue-200'
        }`}>
          <div className={`mr-3 ${getConnectionStatusColor()}`}>
            {getConnectionStatusIcon()}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${getConnectionStatusColor()}`}>
              {getConnectionStatusText()}
            </p>
            {connectionStatus === 'disconnected' && !isDemoMode && (
              <p className="text-xs text-yellow-700 mt-1">
                Algunas funciones pueden estar limitadas
              </p>
            )}
          </div>
          {connectionStatus === 'disconnected' && (
            <button
              onClick={checkConnection}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200"
            >
              Reintentar
            </button>
          )}
        </div>

        {/* Demo Notice */}
        {isDemoMode && (
          <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl shadow-sm">
            <div className="flex items-start">
              <Zap className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-yellow-900 font-semibold text-sm">Modo Demo Activo</h4>
                <p className="text-yellow-800 text-sm mt-1 leading-relaxed">
                  Acceso completo sin restricciones. Usa las credenciales predefinidas o cualquier email/contraseña.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowDemoCredentials(!showDemoCredentials)}
                    className="text-xs bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full hover:bg-yellow-300 transition-colors duration-200 font-medium"
                  >
                    {showDemoCredentials ? 'Ocultar' : 'Ver'} Credenciales Demo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Demo Credentials */}
        {isDemoMode && showDemoCredentials && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h4 className="text-slate-900 font-medium text-sm mb-3">Credenciales de Acceso Rápido</h4>
            <div className="space-y-2">
              <button
                onClick={() => handleQuickLogin('admin')}
                className="w-full flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors duration-200 text-sm"
              >
                <div className="flex items-center">
                  <Shield className="h-4 w-4 text-red-600 mr-2" />
                  <div className="text-left">
                    <p className="font-medium text-red-900">Administrador</p>
                    <p className="text-red-700 text-xs">admin@ventasfull.com</p>
                  </div>
                </div>
                <span className="text-red-600 text-xs">Acceso completo</span>
              </button>
              
              <button
                onClick={() => handleQuickLogin('manager')}
                className="w-full flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors duration-200 text-sm"
              >
                <div className="flex items-center">
                  <User className="h-4 w-4 text-purple-600 mr-2" />
                  <div className="text-left">
                    <p className="font-medium text-purple-900">Gerente</p>
                    <p className="text-purple-700 text-xs">gerente@ventasfull.com</p>
                  </div>
                </div>
                <span className="text-purple-600 text-xs">Gestión avanzada</span>
              </button>
              
              <button
                onClick={() => handleQuickLogin('employee')}
                className="w-full flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors duration-200 text-sm"
              >
                <div className="flex items-center">
                  <User className="h-4 w-4 text-blue-600 mr-2" />
                  <div className="text-left">
                    <p className="font-medium text-blue-900">Empleado</p>
                    <p className="text-blue-700 text-xs">empleado@ventasfull.com</p>
                  </div>
                </div>
                <span className="text-blue-600 text-xs">Ventas básicas</span>
              </button>
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl animate-shake shadow-sm">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-red-900 font-medium text-sm">Error de Autenticación</h4>
                <p className="text-red-700 text-sm mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="email"
                required={!isDemoMode}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm hover:border-slate-400 text-slate-900 placeholder-slate-500 shadow-sm"
                placeholder={isDemoMode ? "cualquier@correo.com" : "tu@correo.com"}
                autoComplete="email"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required={!isDemoMode}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm hover:border-slate-400 text-slate-900 placeholder-slate-500 shadow-sm"
                placeholder={isDemoMode ? "cualquier contraseña" : "Tu contraseña"}
                minLength={isDemoMode ? 1 : 6}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-200 p-1 rounded-lg hover:bg-slate-100"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {!isDemoMode && (
              <p className="text-xs text-slate-500 mt-2">
                La contraseña debe tener al menos 6 caracteres
              </p>
            )}
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                disabled={loading}
              />
              <label htmlFor="remember-me" className="ml-2 text-sm text-slate-700">
                Recordar sesión
              </label>
            </div>
            {!isDemoMode && (
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200"
                onClick={() => alert('Contacta al administrador para recuperar tu contraseña')}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || (!email.trim() || !password.trim())}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-4 rounded-xl font-semibold transition-all duration-200 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 text-lg"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <>
                <LogIn className="h-6 w-6 mr-3" />
                <span>Iniciar Sesión</span>
              </>
            )}
          </button>
        </form>


        {/* Footer */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-xs text-slate-500">
            {isDemoMode 
              ? 'Ejecutándose en modo demo - Configura Supabase para usar datos reales'
              : 'Sistema seguro con autenticación Supabase'
            }
          </p>
          {!isDemoMode && connectionStatus === 'disconnected' && (
            <p className="text-xs text-red-500 mt-1">
              Sin conexión a la base de datos - Verifica tu configuración
            </p>
          )}
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Shield className="h-3 w-3" />
            <span>Protegido con encriptación SSL</span>
          </div>
        </div>
      </div>
    </div>
  );
}