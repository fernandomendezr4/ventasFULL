import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Calendar, Edit2, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Profile {
  id: string;
  name: string;
  email: string;
  role_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

export default function UserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  useEffect(() => {
    if (user) {
      loadProfile();
      loadRoles();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
      setFormData({
        name: data.name,
        email: data.email,
      });
    } catch (error) {
      console.error('Error loading profile:', error);
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

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(formData)
        .eq('id', user?.id);

      if (error) throw error;
      
      setEditing(false);
      loadProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error al actualizar perfil: ' + (error as Error).message);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setFormData({
      name: profile?.name || '',
      email: profile?.email || '',
    });
  };

  const getRoleName = (roleId: string | null) => {
    if (!roleId) return 'Sin rol asignado';
    const role = roles.find(r => r.id === roleId);
    return role?.name || 'Rol desconocido';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <p className="text-slate-500">No se pudo cargar el perfil</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Mi Perfil</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </button>
              <button
                onClick={handleCancel}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200 flex items-center"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </button>
            </div>
          )}
        </div>

        </div>
      </div>
    </div>
  );
}