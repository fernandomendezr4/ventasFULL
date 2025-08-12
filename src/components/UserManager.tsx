import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, User, Search, Filter, Shield, Mail, Calendar, Key, Eye, EyeOff, Lock } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { setEmployeePassword, generateSecurePassword, validatePasswordStrength } from '../lib/employeeAuth';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
    showPassword: false,
    showConfirmPassword: false
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'employee',
    is_active: true,
    password: '',
    confirmPassword: '',
    showPassword: false,
    showConfirmPassword: false
  });

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const generatePassword = () => {
    const newPassword = generateSecurePassword(12);
    if (showPasswordForm) {
      setPasswordData(prev => ({
        ...prev,
        password: newPassword,
        confirmPassword: newPassword
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        password: newPassword,
        confirmPassword: newPassword
      }));
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUserForPassword) return;
    
    if (passwordData.password !== passwordData.confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }
    
    const validation = validatePasswordStrength(passwordData.password);
    if (!validation.isValid) {
      alert('La contraseña no cumple con los requisitos de seguridad:\n' + validation.feedback.join('\n'));
      return;
    }
    
    try {
      setPasswordLoading(true);
      
      if (isDemoMode) {
        alert(`Contraseña actualizada exitosamente para ${selectedUserForPassword.name} (modo demo)`);
        setShowPasswordForm(false);
        setSelectedUserForPassword(null);
        setPasswordData({
          password: '',
          confirmPassword: '',
          showPassword: false,
          showConfirmPassword: false
        });
        return;
      }
      
      const result = await setEmployeePassword(selectedUserForPassword.id, passwordData.password);
      
      if (result.success) {
        alert(`Contraseña actualizada exitosamente para ${selectedUserForPassword.name}`);
        setShowPasswordForm(false);
        setSelectedUserForPassword(null);
        setPasswordData({
          password: '',
          confirmPassword: '',
          showPassword: false,
          showConfirmPassword: false
        });
      } else {
        alert('Error al actualizar contraseña: ' + result.error);
      }
    } catch (error) {
      console.error('Error updating password:', error);
      alert('Error al actualizar contraseña: ' + (error as Error).message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Demo mode: provide sample users data
        const demoUsers = [
          {
            id: 'demo-admin',
            name: 'Administrador Demo',
            email: 'admin@ventasfull.com',
            role: 'admin',
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: 'demo-manager',
            name: 'Gerente Demo',
            email: 'gerente@ventasfull.com',
            role: 'manager',
            is_active: true,
            created_at: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 'demo-employee',
            name: 'Empleado Demo',
            email: 'empleado@ventasfull.com',
            role: 'employee',
            is_active: true,
            created_at: new Date(Date.now() - 172800000).toISOString()
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
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (error) throw error;
      setRoles(data);
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar contraseña si se está creando un nuevo usuario
    if (!editingUser && formData.password) {
      if (formData.password !== formData.confirmPassword) {
        alert('Las contraseñas no coinciden');
        return;
      }
      
      const validation = validatePasswordStrength(formData.password);
      if (!validation.isValid) {
        alert('La contraseña no cumple con los requisitos de seguridad:\n' + validation.feedback.join('\n'));
        return;
      }
    }
    
    if (isDemoMode) {
      // Demo mode: simulate user creation
      const newUser = {
        id: `demo-user-${Date.now()}`,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        is_active: formData.is_active,
        created_at: new Date().toISOString()
      };
      
      if (editingUser) {
        setUsers(users.map(u => 
          u.id === editingUser.id ? { ...newUser, id: editingUser.id } : u
        ));
      } else {
        setUsers([...users, newUser]);
        
        // Simular creación de contraseña en modo demo
        if (formData.password) {
          alert(`Usuario creado con contraseña en modo demo`);
        }
      }
      
      setShowForm(false);
      setEditingUser(null);
      setFormData({ 
        name: '', 
        email: '', 
        role: 'employee', 
        is_active: true,
        password: '',
        confirmPassword: '',
        showPassword: false,
        showConfirmPassword: false
      });
      alert(`Usuario ${editingUser ? 'actualizado' : 'creado'} exitosamente en modo demo`);
      return;
    }
    
    try {
      const userData = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        is_active: formData.is_active
      };
      
      if (editingUser) {
        const { error } = await supabase
          .from('users')
          .update(userData)
          .eq('id', editingUser.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('users')
          .insert([userData]);

        if (error) throw error;
        
        // Si se proporcionó una contraseña, configurarla
        if (formData.password) {
          // Obtener el ID del usuario recién creado
          const { data: newUser, error: getUserError } = await supabase
            .from('users')
            .select('id')
            .eq('email', formData.email)
            .single();
          
          if (!getUserError && newUser) {
            const passwordResult = await setEmployeePassword(newUser.id, formData.password);
            if (!passwordResult.success) {
              console.error('Error setting password:', passwordResult.error);
              alert('Usuario creado pero error al configurar contraseña: ' + passwordResult.error);
            }
          }
        }
      }

      setShowForm(false);
      setEditingUser(null);
      setFormData({ 
        name: '', 
        email: '', 
        role: 'employee', 
        is_active: true,
        password: '',
        confirmPassword: '',
        showPassword: false,
        showConfirmPassword: false
      });
      loadUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error al guardar usuario: ' + (error as Error).message);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      password: '',
      confirmPassword: '',
      showPassword: false,
      showConfirmPassword: false
    });
    setShowForm(true);
  };

  const handleEditPassword = (user: User) => {
    setSelectedUserForPassword(user);
    setPasswordData({
      password: '',
      confirmPassword: '',
      showPassword: false,
      showConfirmPassword: false
    });
    setShowPasswordForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      if (isDemoMode) {
        setUsers(users.filter(u => u.id !== id));
        alert('Usuario eliminado exitosamente en modo demo');
        return;
      }
      
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', id);

        if (error) throw error;
        loadUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error al eliminar usuario: ' + (error as Error).message);
      }
    }
  };

  const toggleUserStatus = async (user: User) => {
    try {
      if (isDemoMode) {
        setUsers(users.map(u => 
          u.id === user.id ? { ...u, is_active: !u.is_active } : u
        ));
        return;
      }
      
      const { error } = await supabase
        .from('users')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;
      loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Error al actualizar estado del usuario: ' + (error as Error).message);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = user.name.toLowerCase().includes(searchLower) ||
                         user.email.toLowerCase().includes(searchLower);
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = !statusFilter || 
                         (statusFilter === 'active' && user.is_active) ||
                         (statusFilter === 'inactive' && !user.is_active);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Usuarios</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingUser(null);
            setFormData({ 
              name: '', 
              email: '', 
              role: 'employee', 
              is_active: true,
              password: '',
              confirmPassword: '',
              showPassword: false,
              showConfirmPassword: false
            });
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
              placeholder="Buscar usuarios por nombre o email..."
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
              <option value="">Todos los roles</option>
              <option value="admin">Administrador</option>
              <option value="manager">Gerente</option>
              <option value="employee">Empleado</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>
        {(searchTerm || roleFilter || statusFilter) && (
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
                  Nombre
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
                  Rol
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="employee">Empleado</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estado
                </label>
                <select
                  value={formData.is_active.toString()}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
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

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-10 w-10 bg-slate-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
                <X className="h-4 w-4" />
          <div className="text-center py-12">
            <User className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {users.length === 0 ? 'No hay usuarios registrados' : 'No se encontraron usuarios que coincidan con los filtros'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredUsers.map((user) => (
              <div key={user.id} className="p-6 hover:bg-slate-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{user.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-slate-600">
                        <span className="flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {user.email}
                        </span>
                        <span className="flex items-center">
                          <Shield className="h-3 w-3 mr-1" />
                          {user.role}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(user.created_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </div>
                    <button
                      onClick={() => toggleUserStatus(user)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 ${
                        user.is_active
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {user.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                      title="Editar usuario"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditPassword(user)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                      title="Cambiar contraseña"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
                  Nombre *
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
                  Email *
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
                  Rol
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="employee">Empleado</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estado
                </label>
                <select
                  value={formData.is_active.toString()}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>
            
            {/* Sección de Contraseña (solo para nuevos usuarios) */}
            {!editingUser && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-medium text-slate-900 mb-3 flex items-center">
                  <Lock className="h-4 w-4 mr-2 text-purple-600" />
                  Configuración de Contraseña
                </h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">
                        Contraseña {!isDemoMode && '*'}
                      </label>
                      <button
                        type="button"
                        onClick={generatePassword}
                        className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded hover:bg-purple-200 transition-colors duration-200"
                      >
                        Generar Segura
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={formData.showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={isDemoMode ? "Opcional en modo demo" : "Mínimo 6 caracteres"}
                        required={!isDemoMode}
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, showPassword: !formData.showPassword })}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {formData.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {formData.password && (
                      <PasswordStrengthIndicator password={formData.password} />
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Confirmar Contraseña {!isDemoMode && '*'}
                    </label>
                    <div className="relative">
                      <input
                        type={formData.showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Confirma la contraseña"
                        required={!isDemoMode && !!formData.password}
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, showConfirmPassword: !formData.showConfirmPassword })}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {formData.showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {formData.password && formData.confirmPassword && (
                      <div className="mt-1 text-xs">
                        {formData.password === formData.confirmPassword ? (
                          <span className="text-green-600 flex items-center">
                            <Shield className="h-3 w-3 mr-1" />
                            Las contraseñas coinciden
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center">
                            <Shield className="h-3 w-3 mr-1" />
                            Las contraseñas no coinciden
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {isDemoMode && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <Shield className="h-4 w-4 text-yellow-600 mr-2" />
                        <div>
                          <h5 className="font-medium text-yellow-900 text-sm">Modo Demo</h5>
                          <p className="text-xs text-yellow-800">
                            La contraseña se guardará localmente para demostración.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!editingUser && formData.password && formData.password !== formData.confirmPassword}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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

      {/* Password Change Modal */}
      {showPasswordForm && selectedUserForPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <Key className="h-5 w-5 mr-2 text-purple-600" />
                  Cambiar Contraseña
                </h3>
                <button
                  onClick={() => {
                    setShowPasswordForm(false);
                    setSelectedUserForPassword(null);
                    setPasswordData({
                      password: '',
                      confirmPassword: '',
                      showPassword: false,
                      showConfirmPassword: false
                    });
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-2">
                Usuario: <span className="font-medium">{selectedUserForPassword.name}</span>
              </p>
            </div>
            
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Nueva Contraseña *
                  </label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded hover:bg-purple-200 transition-colors duration-200"
                  >
                    Generar Segura
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={passwordData.showPassword ? 'text' : 'password'}
                    value={passwordData.password}
                    onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordData({ ...passwordData, showPassword: !passwordData.showPassword })}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {passwordData.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordData.password && (
                  <PasswordStrengthIndicator password={passwordData.password} className="mt-2" />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirmar Nueva Contraseña *
                </label>
                <div className="relative">
                  <input
                    type={passwordData.showConfirmPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirma la nueva contraseña"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordData({ ...passwordData, showConfirmPassword: !passwordData.showConfirmPassword })}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {passwordData.showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordData.password && passwordData.confirmPassword && (
                  <div className="mt-1 text-xs">
                    {passwordData.password === passwordData.confirmPassword ? (
                      <span className="text-green-600 flex items-center">
                        <Shield className="h-3 w-3 mr-1" />
                        Las contraseñas coinciden
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center">
                        <Shield className="h-3 w-3 mr-1" />
                        Las contraseñas no coinciden
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {isDemoMode && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <Shield className="h-4 w-4 text-yellow-600 mr-2" />
                    <div>
                      <h5 className="font-medium text-yellow-900 text-sm">Modo Demo</h5>
                      <p className="text-xs text-yellow-800">
                        El cambio de contraseña se simulará localmente.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h5 className="font-medium text-blue-900 text-sm mb-2">Requisitos de Seguridad</h5>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Mínimo 6 caracteres (recomendado 8+)</li>
                  <li>• Al menos una letra mayúscula y una minúscula</li>
                  <li>• Al menos un número</li>
                  <li>• Se recomienda incluir símbolos especiales</li>
                </ul>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={passwordLoading || passwordData.password !== passwordData.confirmPassword}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
                >
                  {passwordLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" />
                      Cambiar Contraseña
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setSelectedUserForPassword(null);
                    setPasswordData({
                      password: '',
                      confirmPassword: '',
                      showPassword: false,
                      showConfirmPassword: false
                    });
                  }}
                  className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}