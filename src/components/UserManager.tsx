import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, User, Mail, Shield, Eye, EyeOff, Save, X, AlertTriangle, CheckCircle, Key, Users, Search, Filter, Monitor } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { User as UserType } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import UserSessionManager from './UserSessionManager';
import { 
  setEmployeePassword, 
  validatePasswordStrength, 
  generateSecurePassword,
  revokeAllUserSessions 
} from '../lib/employeeAuth';

interface UserWithProfile extends UserType {
  last_login?: string;
  session_count?: number;
}

export default function UserManager() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'employee' as 'admin' | 'manager' | 'employee',
    password: '',
    is_active: true
  });
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Datos demo para usuarios
        const demoUsers = [
          {
            id: 'demo-user-1',
            name: 'Administrador Sistema',
            email: 'admin@ventasfull.com',
            role: 'admin',
            is_active: true,
            created_at: new Date().toISOString(),
            last_login: new Date(Date.now() - 3600000).toISOString(),
            session_count: 1
          },
          {
            id: 'demo-user-2',
            name: 'Gerente Principal',
            email: 'gerente@ventasfull.com',
            role: 'manager',
            is_active: true,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            last_login: new Date(Date.now() - 7200000).toISOString(),
            session_count: 0
          },
          {
            id: 'demo-user-3',
            name: 'Empleado Ventas',
            email: 'empleado@ventasfull.com',
            role: 'employee',
            is_active: true,
            created_at: new Date(Date.now() - 172800000).toISOString(),
            last_login: new Date(Date.now() - 14400000).toISOString(),
            session_count: 0
          },
          {
            id: 'demo-user-4',
            name: 'Usuario Inactivo',
            email: 'inactivo@ventasfull.com',
            role: 'employee',
            is_active: false,
            created_at: new Date(Date.now() - 259200000).toISOString(),
            last_login: null,
            session_count: 0
          }
        ];
        
        setUsers(demoUsers);
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = async (email: string, excludeId?: string): Promise<boolean> => {
    if (!email.trim()) {
      setEmailError('El email es requerido');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Formato de email inválido');
      return false;
    }

    if (isDemoMode) {
      // En modo demo, verificar duplicados localmente
      const existingUser = users.find(u => 
        u.email.toLowerCase() === email.toLowerCase() && 
        u.id !== excludeId
      );
      
      if (existingUser) {
        setEmailError('Ya existe un usuario con este email');
        return false;
      }
      
      setEmailError('');
      return true;
    }

    if (!supabase) {
      setEmailError('');
      return true;
    }

    try {
      let query = supabase
        .from('users')
        .select('id, email')
        .eq('email', email.toLowerCase())
        .limit(1);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error checking email:', error);
        setEmailError('Error al verificar email');
        return false;
      }

      if (data && data.length > 0) {
        setEmailError('Ya existe un usuario con este email');
        return false;
      }

      setEmailError('');
      return true;
    } catch (error) {
      console.error('Error in email validation:', error);
      setEmailError('Error al validar email');
      return false;
    }
  };

  const validatePassword = (password: string): boolean => {
    if (!password.trim()) {
      setPasswordError('La contraseña es requerida');
      return false;
    }

    const validation = validatePasswordStrength(password);
    if (!validation.isValid) {
      setPasswordError(validation.feedback.join(', '));
      return false;
    }

    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar permisos
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
      alert('No tienes permisos para gestionar usuarios');
      return;
    }

    // Validar formulario
    const isEmailValid = await validateEmail(formData.email, editingUser?.id);
    const isPasswordValid = editingUser ? true : validatePassword(formData.password); // Solo validar contraseña para nuevos usuarios
    
    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    if (!formData.name.trim()) {
      alert('El nombre es requerido');
      return;
    }

    try {
      if (isDemoMode) {
        // Simular creación/edición en modo demo
        const userData = {
          id: editingUser?.id || `demo-user-${Date.now()}`,
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          role: formData.role,
          is_active: formData.is_active,
          created_at: editingUser?.created_at || new Date().toISOString(),
          last_login: null,
          session_count: 0
        };

        if (editingUser) {
          setUsers(users.map(u => u.id === editingUser.id ? userData : u));
          alert('Usuario actualizado exitosamente en modo demo');
        } else {
          setUsers([userData, ...users]);
          alert('Usuario creado exitosamente en modo demo');
        }

        setShowForm(false);
        setEditingUser(null);
        resetForm();
        return;
      }

      if (editingUser) {
        // Actualizar usuario existente
        const updateData = {
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          role: formData.role,
          is_active: formData.is_active
        };

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) throw error;

        // Si se proporcionó nueva contraseña, actualizarla
        if (formData.password.trim()) {
          const passwordResult = await setEmployeePassword(editingUser.id, formData.password);
          if (!passwordResult.success) {
            console.error('Error updating password:', passwordResult.error);
            alert('Usuario actualizado, pero hubo un error al cambiar la contraseña: ' + passwordResult.error);
          }
        }

        alert('Usuario actualizado exitosamente');
      } else {
        // Crear nuevo usuario
        const userData = {
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          role: formData.role,
          is_active: formData.is_active
        };

        const { data: newUser, error } = await supabase
          .from('users')
          .insert([userData])
          .select()
          .single();

        if (error) throw error;

        // Establecer contraseña para el nuevo usuario
        const passwordResult = await setEmployeePassword(newUser.id, formData.password);
        if (!passwordResult.success) {
          // Si falla la contraseña, eliminar el usuario creado
          await supabase.from('users').delete().eq('id', newUser.id);
          throw new Error('Error al establecer contraseña: ' + passwordResult.error);
        }

        alert('Usuario creado exitosamente');
      }

      setShowForm(false);
      setEditingUser(null);
      resetForm();
      loadUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error al guardar usuario: ' + (error as Error).message);
    }
  };

  const handleEdit = (user: UserWithProfile) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role as 'admin' | 'manager' | 'employee',
      password: '', // No mostrar contraseña actual
      is_active: user.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) {
      alert('No puedes eliminar tu propio usuario');
      return;
    }

    const userToDelete = users.find(u => u.id === id);
    if (!userToDelete) return;

    if (window.confirm(`¿Estás seguro de que quieres eliminar al usuario "${userToDelete.name}"?\n\nEsta acción no se puede deshacer.`)) {
      try {
        if (isDemoMode) {
          setUsers(users.filter(u => u.id !== id));
          alert('Usuario eliminado exitosamente en modo demo');
          return;
        }

        // Revocar todas las sesiones del usuario antes de eliminarlo
        await revokeAllUserSessions(id);

        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        alert('Usuario eliminado exitosamente');
        loadUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error al eliminar usuario: ' + (error as Error).message);
      }
    }
  };

  const toggleUserStatus = async (user: UserWithProfile) => {
    if (user.id === currentUser?.id) {
      alert('No puedes desactivar tu propio usuario');
      return;
    }

    try {
      if (isDemoMode) {
        setUsers(users.map(u => 
          u.id === user.id ? { ...u, is_active: !u.is_active } : u
        ));
        alert(`Usuario ${!user.is_active ? 'activado' : 'desactivado'} exitosamente en modo demo`);
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;

      // Si se desactiva el usuario, revocar sus sesiones
      if (user.is_active) {
        await revokeAllUserSessions(user.id);
      }

      alert(`Usuario ${!user.is_active ? 'activado' : 'desactivado'} exitosamente`);
      loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert('Error al cambiar estado del usuario: ' + (error as Error).message);
    }
  };

  const generatePassword = () => {
    const newPassword = generateSecurePassword(12);
    setFormData({ ...formData, password: newPassword });
    setPasswordError('');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'employee',
      password: '',
      is_active: true
    });
    setPasswordError('');
    setEmailError('');
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
      default:
        return role;
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && user.is_active) ||
      (statusFilter === 'inactive' && !user.is_active);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Verificar permisos
  if (!currentUser || !['admin', 'manager'].includes(currentUser.role)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <div className="text-red-600 mb-4">
            <Shield className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Acceso Restringido</h2>
          <p className="text-slate-600 mb-4">
            No tienes permisos para gestionar usuarios.
          </p>
          <p className="text-sm text-slate-500">
            Solo administradores y gerentes pueden acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Gestión de Usuarios</h2>
          <p className="text-slate-600 mt-1">
            Administra usuarios del sistema y sus permisos
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingUser(null);
            resetForm();
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Usuario
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los roles</option>
              <option value="admin">Administradores</option>
              <option value="manager">Gerentes</option>
              <option value="employee">Empleados</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>
        {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all') && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredUsers.length} de {users.length} usuarios
          </div>
        )}
      </div>

      {/* User Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nombre completo del usuario"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setEmailError('');
                  }}
                  onBlur={(e) => validateEmail(e.target.value, editingUser?.id)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    emailError ? 'border-red-300' : 'border-slate-300'
                  }`}
                  placeholder="usuario@empresa.com"
                />
                {emailError && (
                  <p className="text-red-600 text-xs mt-1 flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {emailError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rol *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={currentUser?.role !== 'admin' && formData.role === 'admin'}
                >
                  <option value="employee">Empleado</option>
                  <option value="manager">Gerente</option>
                  {currentUser?.role === 'admin' && (
                    <option value="admin">Administrador</option>
                  )}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {formData.role === 'admin' ? 'Acceso completo al sistema' :
                   formData.role === 'manager' ? 'Gestión avanzada y reportes' :
                   'Operaciones básicas de venta'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {editingUser ? 'Nueva Contraseña (opcional)' : 'Contraseña *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      setPasswordError('');
                    }}
                    onBlur={(e) => {
                      if (e.target.value.trim() || !editingUser) {
                        validatePassword(e.target.value);
                      }
                    }}
                    className={`w-full px-3 py-2 pr-20 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      passwordError ? 'border-red-300' : 'border-slate-300'
                    }`}
                    placeholder={editingUser ? "Dejar vacío para mantener actual" : "Mínimo 6 caracteres"}
                    minLength={editingUser ? 0 : 6}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors duration-200"
                      title="Generar contraseña segura"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {passwordError && (
                  <p className="text-red-600 text-xs mt-1 flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {passwordError}
                  </p>
                )}
                {formData.password && (
                  <PasswordStrengthIndicator 
                    password={formData.password} 
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-slate-700">
                Usuario activo (puede iniciar sesión)
              </label>
            </div>

            {isDemoMode && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-yellow-600 mr-2" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Modo Demo</h4>
                    <p className="text-sm text-yellow-800">
                      El usuario se guardará localmente para demostración.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!!passwordError || !!emailError}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                  resetForm();
                }}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {users.length === 0 
                ? 'No hay usuarios registrados' 
                : 'No se encontraron usuarios que coincidan con los filtros'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Usuario</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Rol</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Estado</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Último Acceso</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Creado</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors duration-200">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                          user.is_active ? 'bg-blue-100' : 'bg-slate-100'
                        }`}>
                          <User className={`h-5 w-5 ${
                            user.is_active ? 'text-blue-600' : 'text-slate-400'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.name}</p>
                          <p className="text-sm text-slate-600">{user.email}</p>
                          {user.id === currentUser?.id && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              Tú
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleUserStatus(user)}
                        disabled={user.id === currentUser?.id}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                          user.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        } ${user.id === currentUser?.id ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      >
                        {user.is_active ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Activo
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3 mr-1" />
                            Inactivo
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {user.last_login ? (
                          <>
                            <p className="text-slate-900">
                              {new Date(user.last_login).toLocaleDateString('es-ES')}
                            </p>
                            <p className="text-slate-500">
                              {new Date(user.last_login).toLocaleTimeString('es-ES', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-500">Nunca</span>
                        )}
                        {user.session_count !== undefined && user.session_count > 0 && (
                          <p className="text-xs text-green-600">
                            {user.session_count} sesión{user.session_count > 1 ? 'es' : ''} activa{user.session_count > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600">
                        {new Date(user.created_at).toLocaleDateString('es-ES')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowSessionManager(true);
                          }}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                          title="Ver sesiones"
                        >
                          <Monitor className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                          title="Editar usuario"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={user.id === currentUser?.id}
                          className={`p-2 rounded-lg transition-colors duration-200 ${
                            user.id === currentUser?.id
                              ? 'text-slate-400 cursor-not-allowed'
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                          title={user.id === currentUser?.id ? 'No puedes eliminar tu propio usuario' : 'Eliminar usuario'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Statistics */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Estadísticas de Usuarios</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Usuarios</p>
                <p className="text-2xl font-bold text-blue-900">{users.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Usuarios Activos</p>
                <p className="text-2xl font-bold text-green-900">
                  {users.filter(u => u.is_active).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Administradores</p>
                <p className="text-2xl font-bold text-purple-900">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Sesiones Activas</p>
                <p className="text-2xl font-bold text-orange-900">
                  {users.reduce((sum, u) => sum + (u.session_count || 0), 0)}
                </p>
              </div>
              <Monitor className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Session Manager Modal */}
      {selectedUser && (
        <UserSessionManager
          isOpen={showSessionManager}
          onClose={() => {
            setShowSessionManager(false);
            setSelectedUser(null);
          }}
          userId={selectedUser.id}
          userName={selectedUser.name}
        />
      )}

      {/* Information Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Información sobre Roles</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-900 mb-2 flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Administrador
            </h4>
            <ul className="text-sm text-red-800 space-y-1">
              <li>• Acceso completo al sistema</li>
              <li>• Gestión de usuarios</li>
              <li>• Configuración del sistema</li>
              <li>• Auditoría y reportes</li>
              <li>• Eliminación de datos</li>
            </ul>
          </div>
          
          <div className="bg-white border border-purple-200 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-2 flex items-center">
              <User className="h-4 w-4 mr-2" />
              Gerente
            </h4>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• Gestión de inventario</li>
              <li>• Reportes y estadísticas</li>
              <li>• Gestión de ventas</li>
              <li>• Configuración básica</li>
              <li>• Supervisión de empleados</li>
            </ul>
          </div>
          
          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center">
              <User className="h-4 w-4 mr-2" />
              Empleado
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Procesamiento de ventas</li>
              <li>• Gestión de caja</li>
              <li>• Consulta de productos</li>
              <li>• Gestión de clientes</li>
              <li>• Abonos y pagos</li>
            </ul>
          </div>
        </div>

        {isDemoMode && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">Modo Demo Activo</h4>
            <p className="text-sm text-yellow-800">
              Los usuarios se gestionan localmente. Para usar el sistema completo de usuarios, 
              configura las variables de entorno de Supabase y conecta una base de datos real.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}