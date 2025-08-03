import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, User, Mail, Shield, CheckCircle, XCircle, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as UserType } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';

export default function UserManager() {
  const { user: currentUser } = useAuth();
  const { notification, showSuccess, showError, showWarning, hideNotification } = useNotification();
  const { confirmation, showConfirmation, hideConfirmation, handleConfirm } = useConfirmation();
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'role'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    is_active: true,
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  // Determinar qué roles puede crear el usuario actual
  const getAvailableRoles = () => {
    if (currentUser?.role === 'admin') {
      return [
        { value: 'employee', label: 'Empleado' },
        { value: 'manager', label: 'Gerente' },
        { value: 'admin', label: 'Administrador' }
      ];
    } else if (currentUser?.role === 'manager') {
      return [
        { value: 'employee', label: 'Empleado' },
        { value: 'manager', label: 'Gerente' }
      ];
    }
    return [];
  };

  const availableRoles = getAvailableRoles();

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      let query = supabase.from('users').select('*');
      
      // Si el usuario es gerente, filtrar para que solo vea empleados y gerentes
      if (currentUser?.role === 'manager') {
        query = query.in('role', ['employee', 'manager']);
      }
      
      const { data, error } = await query.order('name');

      if (error) throw error;
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que el usuario actual puede crear el rol seleccionado
    if (currentUser?.role === 'manager' && formData.role === 'admin') {
      showError(
        'Permisos Insuficientes',
        'Los gerentes no pueden crear usuarios administradores. Solo pueden crear gerentes y empleados.'
      );
      return;
    }
    
    try {
      if (editingUser) {
        // Validar que no se esté intentando cambiar a admin si es manager
        if (currentUser?.role === 'manager' && formData.role === 'admin') {
          showError(
            'Permisos Insuficientes',
            'Los gerentes no pueden asignar el rol de administrador.'
          );
          return;
        }
        
        // Actualizar usuario existente (sin contraseña)
        const { error } = await supabase
          .from('users')
          .update({
            name: formData.name,
            email: formData.email,
            role: formData.role,
            is_active: formData.is_active,
          })
          .eq('id', editingUser.id);

        if (error) throw error;
        
        // Si se proporcionó una nueva contraseña, actualizarla
        if (formData.password.trim()) {
          const { data: passwordResult, error: passwordError } = await supabase.rpc('update_user_password', {
            p_user_id: editingUser.id,
            p_new_password: formData.password
          });
          
          if (passwordError) throw passwordError;
          
          const result = passwordResult as { success: boolean; error?: string };
          if (!result.success) {
            throw new Error(result.error || 'Error al actualizar contraseña');
          }
        }
      } else {
        // Validar que se proporcione contraseña para usuarios nuevos
        if (!formData.password.trim()) {
          alert('La contraseña es requerida para usuarios nuevos');
          return;
        }
        
        // Crear nuevo usuario con contraseña
        const { data: result, error } = await supabase.rpc('create_user_with_password', {
          p_name: formData.name,
          p_email: formData.email,
          p_password: formData.password,
          p_role: formData.role,
          p_is_active: formData.is_active
        });
        
        if (error) throw error;
        
        const userResult = result as { success: boolean; error?: string };
        if (!userResult.success) {
          throw new Error(userResult.error || 'Error al crear usuario');
        }
      }
      
      setShowForm(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: 'employee', is_active: true });
      loadUsers();
      
      showSuccess(
        editingUser ? '¡Usuario Actualizado!' : '¡Usuario Creado!',
        editingUser 
          ? `El usuario ${formData.name} ha sido actualizado exitosamente`
          : `El usuario ${formData.name} ha sido creado exitosamente`
      );
    } catch (error) {
      console.error('Error saving user:', error);
      
      const errorMessage = (error as Error).message;
      
      // Handle specific error cases with user-friendly messages
      if (errorMessage.includes('Email already exists in authentication system')) {
        showError(
          'Email Ya Registrado',
          'Este email ya está registrado en el sistema. Verifica si el usuario ya existe o usa un email diferente.'
        );
        return;
      } else if (errorMessage.includes('duplicate key value violates unique constraint')) {
        showError(
          'Email Duplicado',
          'Este email ya está en uso. Por favor usa un email diferente.'
        );
        return;
      } else {
        showError(
          'Error al Guardar Usuario',
          'No se pudo guardar el usuario. ' + errorMessage
        );
        return;
      }
    }
  };

  const handleChangePassword = async (user: UserType) => {
    // Validar que el gerente no pueda cambiar contraseñas de administradores
    if (currentUser?.role === 'manager' && user.role === 'admin') {
      showError(
        'Permisos Insuficientes',
        'Los gerentes no pueden cambiar contraseñas de usuarios administradores.'
      );
      return;
    }
    
    showConfirmation(
      'Cambiar Contraseña',
      `¿Estás seguro de que quieres cambiar la contraseña de ${user.name}?`,
      async () => {
        const newPassword = prompt('Ingresa la nueva contraseña (mínimo 6 caracteres):');
        if (!newPassword) return;
        
        if (newPassword.length < 6) {
          showWarning(
            'Contraseña Muy Corta',
            'La contraseña debe tener al menos 6 caracteres'
          );
          return;
        }
        
        try {
          const { data: result, error } = await supabase.rpc('update_user_password', {
            p_user_id: user.id,
            p_new_password: newPassword
          });
          
          if (error) throw error;
          
          const passwordResult = result as { success: boolean; error?: string };
          if (!passwordResult.success) {
            throw new Error(passwordResult.error || 'Error al actualizar contraseña');
          }
          
          showSuccess(
            '¡Contraseña Actualizada!',
            `La contraseña de ${user.name} ha sido actualizada exitosamente`
          );
        } catch (error) {
          console.error('Error updating password:', error);
          showError(
            'Error al Actualizar Contraseña',
            'No se pudo actualizar la contraseña. ' + (error as Error).message
          );
        }
      },
      {
        confirmText: 'Continuar',
        cancelText: 'Cancelar',
        type: 'warning'
      }
    );
  };

  const handleEdit = (user: UserType) => {
    // Validar que el gerente no pueda editar administradores
    if (currentUser?.role === 'manager' && user.role === 'admin') {
      showError(
        'Permisos Insuficientes',
        'Los gerentes no pueden editar usuarios administradores.'
      );
      return;
    }
    
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // No mostrar contraseña actual
      role: user.role,
      is_active: user.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    // Validar que el gerente no pueda eliminar administradores
    if (currentUser?.role === 'manager' && user.role === 'admin') {
      showError(
        'Permisos Insuficientes',
        'Los gerentes no pueden eliminar usuarios administradores.'
      );
      return;
    }

    showConfirmation(
      'Eliminar Usuario',
      `¿Estás seguro de que quieres eliminar al usuario "${user.name}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          // First, remove user from Supabase Auth
          const { error: authError } = await supabase.auth.admin.deleteUser(id);
          if (authError) {
            console.warn('Warning: Could not delete user from auth system:', authError);
            // Continue with deletion even if auth deletion fails
          }

          // Update any cash_register_discrepancies that reference this user
          const { error: discrepancyError } = await supabase
            .from('cash_register_discrepancies')
            .update({ created_by: null })
            .eq('created_by', id);

          if (discrepancyError) {
            console.warn('Warning updating discrepancies:', discrepancyError);
            // Continue with deletion even if this fails, as it might not be critical
          }

          // Also update resolved_by references
          const { error: resolvedError } = await supabase
            .from('cash_register_discrepancies')
            .update({ resolved_by: null })
            .eq('resolved_by', id);

          if (resolvedError) {
            console.warn('Warning updating resolved_by:', resolvedError);
            // Continue with deletion even if this fails
          }

          // Now delete the user
          const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

          if (error) throw error;
          loadUsers();
          showSuccess(
            '¡Usuario Eliminado!',
            `El usuario "${user.name}" ha sido eliminado exitosamente`
          );
        } catch (error) {
          console.error('Error deleting user:', error);
          showError(
            'Error al Eliminar Usuario',
            'No se pudo eliminar el usuario. ' + (error as Error).message
          );
        }
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      }
    );
  };

  const toggleUserStatus = async (user: UserType) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;
      loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    // Los gerentes no pueden ver administradores (filtro adicional por seguridad)
    if (currentUser?.role === 'manager' && user.role === 'admin') {
      return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (!(
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.role.toLowerCase().includes(searchLower)
      )) {
        return false;
      }
    }
    
    // Filter by role
    if (roleFilter !== 'all' && user.role !== roleFilter) {
      return false;
    }
    
    // Filter by status
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      if (user.is_active !== isActive) {
        return false;
      }
    }
    
    return true;
  }).sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    switch (sortBy) {
      case 'role':
        aValue = a.role;
        bValue = b.role;
        break;
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case 'name':
      default:
        aValue = a.name;
        bValue = b.name;
        break;
    }
    
    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Usuarios</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingUser(null);
            setFormData({ name: '', email: '', password: '', role: 'employee', is_active: true });
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
              placeholder="Buscar por nombre, email o rol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los roles</option>
              {/* Solo mostrar opción de admin si el usuario actual es admin */}
              {user?.role === 'admin' && <option value="admin">Administrador</option>}
              <option value="manager">Gerente</option>
              <option value="employee">Empleado</option>
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
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'created_at' | 'role')}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Ordenar por Nombre</option>
              <option value="role">Ordenar por Rol</option>
              <option value="created_at">Ordenar por Fecha</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              title={`Orden ${sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}`}
            >
              <Filter className={`h-4 w-4 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform duration-200`} />
            </button>
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
            {editingUser ? 'Editar Usuario' : 'Agregar Usuario'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={editingUser ? 'Dejar vacío para mantener actual' : 'Mínimo 6 caracteres'}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {!editingUser && (
                  <p className="text-xs text-slate-500 mt-1">
                    La contraseña debe tener al menos 6 caracteres
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rol
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {availableRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                {user?.role === 'manager' && (
                  <p className="text-xs text-slate-500 mt-1">
                    Como gerente, solo puedes crear usuarios gerentes y empleados
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estado
                </label>
                <select
                  value={formData.is_active ? 'active' : 'inactive'}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                {editingUser ? 'Actualizar' : 'Agregar'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          ))
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <User className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {users.length === 0 ? 'No hay usuarios registrados' : 'No se encontraron usuarios que coincidan con los filtros aplicados'}
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 flex items-center">
                    <User className="h-4 w-4 mr-2 text-purple-600" />
                    {user.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-block text-xs px-2 py-1 rounded-full ${getRoleColor(user.role)}`}>
                      <Shield className="h-3 w-3 inline mr-1" />
                      {getRoleLabel(user.role)}
                    </span>
                    <button
                      onClick={() => toggleUserStatus(user)}
                      className={`inline-flex items-center text-xs px-2 py-1 rounded-full transition-colors duration-200 ${
                        user.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {user.is_active ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Activo
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactivo
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(user)}
                    disabled={currentUser?.role === 'manager' && user.role === 'admin'}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    title="Editar usuario"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleChangePassword(user)}
                    disabled={currentUser?.role === 'manager' && user.role === 'admin'}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                    title="Cambiar contraseña"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </button>
                  {/* Solo admins pueden eliminar usuarios, y gerentes no pueden eliminar admins */}
                  {(currentUser?.role === 'admin' || (currentUser?.role === 'manager' && user.role !== 'admin')) && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={currentUser?.role === 'manager' && user.role === 'admin'}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  {user.email}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  Registrado: {new Date(user.created_at).toLocaleDateString('es-ES')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={hideNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        onClose={hideConfirmation}
        onConfirm={handleConfirm}
        title={confirmation.title}
        message={confirmation.message}
        confirmText={confirmation.confirmText}
        cancelText={confirmation.cancelText}
        type={confirmation.type}
        loading={confirmation.loading}
      />
    </div>
  );
}