import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, LogIn, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isDemoMode } from '../lib/supabase';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // En modo demo, permitir cualquier login
    if (isDemoMode) {
      const result = await signIn(email, password);
      if (result.error) {
        setError('Error en modo demo');
      }
      setLoading(false);
      return;
    }

    try {
      // Verificar conexión antes de intentar login
      const connectionOk = await import('../lib/supabase').then(module => module.testConnection());
      if (!connectionOk) {
        setError('Error de conexión con la base de datos. Verifica tu conexión a internet.');
        setLoading(false);
        return;
      }

      const result = await signIn(email, password);

      if (result.error) {
        const errorMessage = result.error.message || 'Error en la autenticación';
        
        // Mensajes de error más amigables
        if (errorMessage.includes('Invalid login credentials')) {
          setError('Email o contraseña incorrectos');
        } else if (errorMessage.includes('Email not confirmed')) {
          setError('Debes confirmar tu email antes de iniciar sesión');
        } else if (errorMessage.includes('Too many requests')) {
          setError('Demasiados intentos. Espera unos minutos antes de intentar de nuevo');
        } else {
          setError(errorMessage);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 animate-scale-in">
        {isDemoMode && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-yellow-600 mr-2" />
              <div>
                <h4 className="text-yellow-900 font-medium">Modo Demo</h4>
                <p className="text-yellow-800 text-sm mt-1">
                  Usa cualquier email y contraseña para acceder
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4 animate-bounce-in">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 gradient-text">VentasFULL</h1>
          <p className="text-slate-600 mt-2">
            Sistema de Gestión de Ventas
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pl-10"
                placeholder={isDemoMode ? "cualquier@email.com" : "tu@email.com"}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-10 pr-10"
                placeholder={isDemoMode ? "cualquier contraseña" : "Tu contraseña"}
                minLength={isDemoMode ? 1 : 6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors duration-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full button-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" />
                Iniciar Sesión
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}