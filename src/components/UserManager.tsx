import React, { useState, useEffect } from 'react';
<<<<<<< HEAD
import { Plus, Edit2, Trash2, User, Search, Filter, Eye, EyeOff, Save, X, UserCheck, UserX, Lock, Mail, Shield, Monitor, Key } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ConfirmationModal from './ConfirmationModal';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import UserSessionManager from './UserSessionManager';
import { setEmployeePassword, generateSecurePassword } from '../lib/employeeAuth';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  is_active: boolean;
  created_at: string;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'admin' | 'manager' | 'employee';
  is_active: boolean;
}

export default function UserManager() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'role' | 'created_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'employee',
    is_active: true
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [selectedUserForSessions, setSelectedUserForSessions] = useState<UserData | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Demo mode: provide sample users data
        const demoUsers: UserData[] = [
          {
            id: 'demo-user-1',
            name: 'Administrador Demo',
            email: 'admin@ventasfull.com',
            role: 'admin',
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: 'demo-user-2',
            name: 'Gerente Demo',
            email: 'gerente@ventasfull.com',
            role: 'manager',
            is_active: true,
            created_at: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 'demo-user-3',
            name: 'Empleado Demo',
            email: 'empleado@ventasfull.com',
            role: 'employee',
            is_active: false,
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
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
=======
import { Plus, Edit2, Trash2, User, Mail, Shield, CheckCircle, XCircle, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as UserType } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';

export default function UserManager() {
  const { user } = useAuth();
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
    if (user?.role === 'admin') {
      return [
        { value: 'employee', label: 'Empleado' },
        { value: 'manager', label: 'Gerente' },
        { value: 'admin', label: 'Administrador' }
      ];
    } else if (user?.role === 'manager') {
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
      if (user?.role === 'manager') {
        query = query.in('role', ['employee', 'manager']);
      }
      
      const { data, error } = await query.order('name');

      if (error) throw error;
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
>>>>>>> 56f80df (Primer commit)
    } finally {
      setLoading(false);
    }
  };

<<<<<<< HEAD
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validar nombre
    if (!formData.name.trim()) {
      errors.name = 'El nombre es requerido';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'El nombre debe tener al menos 2 caracteres';
    }

    // Validar email
    if (!formData.email.trim()) {
      errors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'El email no tiene un formato válido';
    } else {
      // Verificar email duplicado
      const emailExists = users.some(user => 
        user.email.toLowerCase() === formData.email.toLowerCase() && 
        user.id !== editingUser?.id
      );
      if (emailExists) {
        errors.email = 'Ya existe un usuario con este email';
      }
    }

    // Validar contraseña (solo para usuarios nuevos o si se está cambiando)
    if (!editingUser || formData.password) {
      if (!formData.password) {
        errors.password = 'La contraseña es requerida';
      } else if (formData.password.length < 6) {
        errors.password = 'La contraseña debe tener al menos 6 caracteres';
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
        errors.password = 'La contraseña debe contener al menos una mayúscula, una minúscula y un número';
      }

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Las contraseñas no coinciden';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      if (isDemoMode) {
        // Demo mode: simulate user creation/update
        const userData: UserData = {
          id: editingUser?.id || `demo-user-${Date.now()}`,
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          role: formData.role,
          is_active: formData.is_active,
          created_at: editingUser?.created_at || new Date().toISOString()
        };

        if (editingUser) {
          setUsers(prev => prev.map(user => 
            user.id === editingUser.id ? userData : user
          ));
          alert('Usuario actualizado exitosamente (modo demo)');
        } else {
          setUsers(prev => [userData, ...prev]);
          alert('Usuario creado exitosamente (modo demo)');
        }

        resetForm();
        return;
      }

      if (editingUser) {
        // Actualizar usuario existente
        const updateData: any = {
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          role: formData.role,
          is_active: formData.is_active
        };

        const { error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id);

        if (updateError) throw updateError;

        // Si se proporcionó nueva contraseña, actualizarla
        if (formData.password) {
          const passwordResult = await setEmployeePassword(editingUser.id, formData.password);

          if (!passwordResult.success) {
            console.error('Error updating password:', passwordResult.error);
            alert('Usuario actualizado pero hubo un error al cambiar la contraseña: ' + passwordResult.error);
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

        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert([userData])
          .select()
          .single();

        if (userError) throw userError;

        // Crear contraseña para el nuevo usuario
        const passwordResult = await setEmployeePassword(newUser.id, formData.password);

        if (!passwordResult.success) {
          console.error('Error creating password:', passwordResult.error);
          // Eliminar usuario si no se pudo crear la contraseña
          await supabase.from('users').delete().eq('id', newUser.id);
          throw new Error('Error al crear la contraseña del usuario');
        }

        alert('Usuario creado exitosamente');
      }

      await fetchUsers();
      resetForm();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error al guardar usuario: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const newPassword = generateSecurePassword(12);
    setFormData({ 
      ...formData, 
      password: newPassword, 
      confirmPassword: newPassword 
    });
  };

  const handleViewSessions = (user: UserData) => {
    setSelectedUserForSessions(user);
    setShowSessionManager(true);
  };

  const handleEdit = (user: UserData) => {
=======
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que el usuario actual puede crear el rol seleccionado
    if (user?.role === 'manager' && formData.role === 'admin') {
      showError(
        'Permisos Insuficientes',
        'Los gerentes no pueden crear usuarios administradores. Solo pueden crear gerentes y empleados.'
      );
      return;
    }
    
    try {
      if (editingUser) {
        // Validar que no se esté intentando cambiar a admin si es manager
        if (user?.role === 'manager' && formData.role === 'admin') {
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
      } else if (errorMessage.includes('duplicate key value violates unique constraint')) {
        showError(
          'Email Duplicado',
          'Este email ya está en uso. Por favor usa un email diferente.'
        );
      } else {
        showError(
          'Error al Guardar Usuario',
          'No se pudo guardar el usuario. ' + errorMessage
        );
      }
    }
  };

  const handleChangePassword = async (user: UserType) => {
    // Validar que el gerente no pueda cambiar contraseñas de administradores
    if (user?.role === 'manager' && user.role === 'admin') {
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
    if (user?.role === 'manager' && user.role === 'admin') {
      showError(
        'Permisos Insuficientes',
        'Los gerentes no pueden editar usuarios administradores.'
      );
      return;
    }
    
>>>>>>> 56f80df (Primer commit)
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
<<<<<<< HEAD
      password: '',
      confirmPassword: '',
      role: user.role,
      is_active: user.is_active
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleDelete = (user: UserData) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      if (isDemoMode) {
        setUsers(prev => prev.filter(user => user.id !== userToDelete.id));
        alert('Usuario eliminado exitosamente (modo demo)');
        setShowDeleteConfirm(false);
        setUserToDelete(null);
        return;
      }

      // Eliminar contraseña primero
      await supabase
        .from('employee_passwords')
        .delete()
        .eq('user_id', userToDelete.id);

      // Eliminar usuario
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userToDelete.id);

      if (error) throw error;

      await fetchUsers();
      alert('Usuario eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar usuario: ' + (error as Error).message);
    } finally {
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  const toggleUserStatus = async (user: UserData) => {
    try {
      if (isDemoMode) {
        setUsers(prev => prev.map(u => 
          u.id === user.id ? { ...u, is_active: !u.is_active } : u
        ));
        return;
      }

=======
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
    if (user?.role === 'manager' && user.role === 'admin') {
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
>>>>>>> 56f80df (Primer commit)
      const { error } = await supabase
        .from('users')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;
<<<<<<< HEAD
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Error al actualizar estado del usuario: ' + (error as Error).message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'employee',
      is_active: true
    });
    setFormErrors({});
    setEditingUser(null);
    setShowForm(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };
=======
      loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    // Los gerentes no pueden ver administradores (filtro adicional por seguridad)
    if (user?.role === 'manager' && user.role === 'admin') {
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
>>>>>>> 56f80df (Primer commit)

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
<<<<<<< HEAD
        return 'bg-red-100 text-red-800 border-red-200';
      case 'manager':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'employee':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
=======
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-purple-100 text-purple-800';
      case 'employee':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
>>>>>>> 56f80df (Primer commit)
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

<<<<<<< HEAD
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && user.is_active) ||
      (statusFilter === 'inactive' && !user.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  }).sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'email':
        aValue = a.email.toLowerCase();
        bValue = b.email.toLowerCase();
        break;
      case 'role':
        aValue = a.role;
        bValue = b.role;
        break;
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading && !showForm) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-slate-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center">
            <User className="h-8 w-8 mr-3 text-blue-600" />
            Gestión de Usuarios
            {isDemoMode && (
              <span className="ml-3 text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                DEMO
              </span>
            )}
          </h2>
          <p className="text-slate-600 mt-1">
            Administra usuarios del sistema y sus permisos
          </p>
        </div>
=======
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Usuarios</h2>
>>>>>>> 56f80df (Primer commit)
        <button
          onClick={() => {
            setShowForm(true);
            setEditingUser(null);
<<<<<<< HEAD
            resetForm();
=======
            setFormData({ name: '', email: '', password: '', role: 'employee', is_active: true });
>>>>>>> 56f80df (Primer commit)
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
<<<<<<< HEAD
          Nuevo Usuario
=======
          Agregar Usuario
>>>>>>> 56f80df (Primer commit)
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
<<<<<<< HEAD
              placeholder="Buscar por nombre o email..."
=======
              placeholder="Buscar por nombre, email o rol..."
>>>>>>> 56f80df (Primer commit)
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
<<<<<<< HEAD
          <div className="flex gap-2">
=======
          <div className="flex flex-wrap gap-2">
>>>>>>> 56f80df (Primer commit)
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los roles</option>
<<<<<<< HEAD
              <option value="admin">Administradores</option>
              <option value="manager">Gerentes</option>
              <option value="employee">Empleados</option>
=======
              {/* Solo mostrar opción de admin si el usuario actual es admin */}
              {user?.role === 'admin' && <option value="admin">Administrador</option>}
              <option value="manager">Gerente</option>
              <option value="employee">Empleado</option>
>>>>>>> 56f80df (Primer commit)
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
<<<<<<< HEAD
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as any);
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="created_at-desc">Más recientes</option>
              <option value="created_at-asc">Más antiguos</option>
              <option value="name-asc">Nombre A-Z</option>
              <option value="name-desc">Nombre Z-A</option>
              <option value="email-asc">Email A-Z</option>
              <option value="email-desc">Email Z-A</option>
              <option value="role-asc">Rol A-Z</option>
              <option value="role-desc">Rol Z-A</option>
            </select>
=======
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
>>>>>>> 56f80df (Primer commit)
          </div>
        </div>
        {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all') && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredUsers.length} de {users.length} usuarios
          </div>
        )}
      </div>

<<<<<<< HEAD
      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h3>
                <button
                  onClick={resetForm}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Información Personal */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-4">Información Personal</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nombre Completo *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          formErrors.name ? 'border-red-300' : 'border-slate-300'
                        }`}
                        placeholder="Nombre completo del usuario"
                      />
                      {formErrors.name && (
                        <p className="text-red-600 text-sm mt-1">{formErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Email *
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            formErrors.email ? 'border-red-300' : 'border-slate-300'
                          }`}
                          placeholder="email@empresa.com"
                        />
                      </div>
                      {formErrors.email && (
                        <p className="text-red-600 text-sm mt-1">{formErrors.email}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Credenciales de Acceso */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-4 flex items-center">
                    <Lock className="h-4 w-4 mr-2" />
                    Credenciales de Acceso
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Contraseña {editingUser ? '(dejar vacío para mantener actual)' : '*'}
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className={`w-full pl-10 pr-12 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            formErrors.password ? 'border-red-300' : 'border-slate-300'
                          }`}
                          placeholder={editingUser ? 'Nueva contraseña (opcional)' : 'Contraseña segura'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {formErrors.password && (
                        <p className="text-red-600 text-sm mt-1">{formErrors.password}</p>
                      )}
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors duration-200"
                        >
                          Generar contraseña segura
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Confirmar Contraseña {editingUser ? '' : '*'}
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          className={`w-full pl-10 pr-12 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            formErrors.confirmPassword ? 'border-red-300' : 'border-slate-300'
                          }`}
                          placeholder="Confirmar contraseña"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {formErrors.confirmPassword && (
                        <p className="text-red-600 text-sm mt-1">{formErrors.confirmPassword}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {formData.password && (
                    <div className="mt-4">
                      <PasswordStrengthIndicator password={formData.password} />
                    </div>
                  )}
                </div>

                {/* Permisos y Estado */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 mb-4 flex items-center">
                    <Shield className="h-4 w-4 mr-2" />
                    Permisos y Estado
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Rol del Usuario *
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'manager' | 'employee' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="employee">Empleado - Acceso básico</option>
                        <option value="manager">Gerente - Gestión completa</option>
                        <option value="admin">Administrador - Acceso total</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        {formData.role === 'admin' && 'Acceso completo a todas las funciones'}
                        {formData.role === 'manager' && 'Gestión de ventas, productos y usuarios'}
                        {formData.role === 'employee' && 'Ventas y gestión básica de clientes'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Estado de la Cuenta
                      </label>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="is_active"
                            checked={formData.is_active}
                            onChange={() => setFormData({ ...formData, is_active: true })}
                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300"
                          />
                          <span className="ml-2 text-sm text-green-700 font-medium">Activo</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="is_active"
                            checked={!formData.is_active}
                            onChange={() => setFormData({ ...formData, is_active: false })}
                            className="h-4 w-4 text-red-600 focus:ring-red-500 border-slate-300"
                          />
                          <span className="ml-2 text-sm text-red-700 font-medium">Inactivo</span>
                        </label>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Los usuarios inactivos no pueden iniciar sesión
                      </p>
                    </div>
                  </div>
                </div>

                {isDemoMode && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <Shield className="h-5 w-5 text-yellow-600 mr-2" />
                      <div>
                        <h4 className="font-medium text-yellow-900">Modo Demo</h4>
                        <p className="text-sm text-yellow-800">
                          Los usuarios se guardarán localmente para demostración.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <User className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {users.length === 0 
                ? 'No hay usuarios registrados' 
                : 'No se encontraron usuarios que coincidan con los filtros'}
            </p>
            {users.length === 0 && (
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditingUser(null);
                  resetForm();
                }}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Crear Primer Usuario
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Usuario</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Rol</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Estado</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Fecha de Registro</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors duration-200">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.name}</p>
                          {user.id === currentUser?.id && (
                            <p className="text-xs text-blue-600">Tú</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 text-slate-400 mr-2" />
                        <span className="text-sm text-slate-900">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                        <Shield className="h-3 w-3 inline mr-1" />
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleUserStatus(user)}
                        disabled={user.id === currentUser?.id}
                        className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
                          user.is_active 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={user.id === currentUser?.id ? 'No puedes cambiar tu propio estado' : ''}
                      >
                        {user.is_active ? (
                          <>
                            <UserCheck className="h-3 w-3" />
                            Activo
                          </>
                        ) : (
                          <>
                            <UserX className="h-3 w-3" />
                            Inactivo
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm text-slate-900">
                          {new Date(user.created_at).toLocaleDateString('es-ES')}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(user.created_at).toLocaleTimeString('es-ES', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                          title="Editar usuario"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={user.id === currentUser?.id}
                          className={`p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 ${
                            user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          title={user.id === currentUser?.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleViewSessions(user)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                          title="Ver sesiones activas"
                        >
                          <Monitor className="h-4 w-4" />
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Eliminar Usuario"
        message={`¿Estás seguro de que quieres eliminar al usuario "${userToDelete?.name}"? Esta acción no se puede deshacer y se eliminarán todos los datos asociados.`}
        confirmText="Eliminar Usuario"
        cancelText="Cancelar"
        type="danger"
      />

      {/* User Session Manager Modal */}
      {showSessionManager && selectedUserForSessions && (
        <UserSessionManager
          isOpen={showSessionManager}
          onClose={() => {
            setShowSessionManager(false);
            setSelectedUserForSessions(null);
          }}
          userId={selectedUserForSessions.id}
          userName={selectedUserForSessions.name}
        />
      )}

      {/* User Statistics */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Estadísticas de Usuarios</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total de Usuarios</p>
                <p className="text-2xl font-bold text-blue-900">{users.length}</p>
              </div>
              <User className="h-8 w-8 text-blue-600" />
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
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Administradores</p>
                <p className="text-2xl font-bold text-red-900">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Empleados</p>
                <p className="text-2xl font-bold text-purple-900">
                  {users.filter(u => u.role === 'employee').length}
                </p>
              </div>
              <User className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Security Information */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Lock className="h-5 w-5 mr-2 text-slate-600" />
          Información de Seguridad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-slate-900 mb-2">Políticas de Contraseña</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Mínimo 6 caracteres</li>
              <li>• Al menos una letra mayúscula</li>
              <li>• Al menos una letra minúscula</li>
              <li>• Al menos un número</li>
              <li>• Se recomienda incluir símbolos especiales</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-slate-900 mb-2">Roles y Permisos</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• <strong>Empleado:</strong> Ventas y clientes básico</li>
              <li>• <strong>Gerente:</strong> Gestión completa excepto usuarios</li>
              <li>• <strong>Administrador:</strong> Acceso total al sistema</li>
            </ul>
          </div>
        </div>
        
        {isDemoMode && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Modo Demo:</strong> Las contraseñas se almacenan localmente solo para demostración. 
              En producción, se utilizan métodos de encriptación seguros.
            </p>
          </div>
        )}
      </div>
=======
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
                    disabled={user?.role === 'manager' && user.role === 'admin'}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    title="Editar usuario"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleChangePassword(user)}
                    disabled={user?.role === 'manager' && user.role === 'admin'}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                    title="Cambiar contraseña"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </button>
                  {/* Solo admins pueden eliminar usuarios, y gerentes no pueden eliminar admins */}
                  {(user?.role === 'admin' || (user?.role === 'manager' && user.role !== 'admin')) && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={user?.role === 'manager' && user.role === 'admin'}
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
>>>>>>> 56f80df (Primer commit)
    </div>
  );
}