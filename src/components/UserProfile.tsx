import React, { useState } from 'react';
import { User, LogOut, Settings, Shield, Mail, Calendar, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface UserProfileProps {
  onClose: () => void;
}

export default function UserProfile({ onClose }: UserProfileProps) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      await signOut();
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-purple-100 text-purple-800';
      case 'employee':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'manager':
        return 'Gerente';
      case 'employee':
        return 'Empleado';
      case 'cashier':
        return 'Cajero';
      default:
        return role;
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm mx-auto max-h-[90vh] overflow-y-auto transition-colors duration-200 animate-scale-in">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
              <User className="h-5 w-5 mr-2" />
              Mi Perfil
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors duration-200"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-6">
          {false ? (
            <form>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="text-xl font-semibold text-slate-900 dark:text-white">{user.name}</h4>
                <span className={`inline-block text-xs px-2 py-1 rounded-full mt-2 ${getRoleColor(user.role)}`}>
                  <Shield className="h-3 w-3 inline mr-1" />
                  {getRoleLabel(user.role)}
                </span>
              </div>

              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <div>
                  <Mail className="h-4 w-4 mr-3" />
                  <span>{user.email}</span>
                </div>
                <div>
                  <Calendar className="h-4 w-4 mr-3" />
                  <span>Miembro desde {new Date(user?.created_at || '').toLocaleDateString('es-ES')}</span>
                </div>
              </div>
              
              {/* Theme Toggle */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-center px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors duration-200"
                >
                  {theme === 'light' ? (
                    <>
                      <Moon className="h-4 w-4 mr-2" />
                      Cambiar a Tema Oscuro
                    </>
                  ) : (
                    <>
                      <Sun className="h-4 w-4 mr-2" />
                      Cambiar a Tema Claro
                    </>
                  )}
                </button>
              </div>
              
              <div className="flex gap-2">
                <button
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center justify-center"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}