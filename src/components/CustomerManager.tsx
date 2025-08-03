import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, Mail, Phone, MapPin, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Customer } from '../lib/types';
import FormattedNumberInput from './FormattedNumberInput';
import { isDemoMode } from '../lib/supabase';

export default function CustomerManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    cedula: '',
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      
      if (isDemoMode) {
        // Demo mode: provide sample customers data
        const demoCustomers = [
          {
            id: 'demo-customer-1',
            name: 'Juan Pérez',
            email: 'juan@email.com',
            phone: '3001234567',
            address: 'Calle 123 #45-67, Bogotá',
            cedula: '12345678',
            created_at: new Date().toISOString()
          },
          {
            id: 'demo-customer-2',
            name: 'María García',
            email: 'maria@email.com',
            phone: '3009876543',
            address: 'Carrera 45 #12-34, Medellín',
            cedula: '87654321',
            created_at: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 'demo-customer-3',
            name: 'Carlos López',
            email: 'carlos@email.com',
            phone: '3005555555',
            address: 'Avenida 80 #23-45, Cali',
            cedula: '11223344',
            created_at: new Date(Date.now() - 172800000).toISOString()
          }
        ];
        
        setCustomers(demoCustomers);
        setLoading(false);
        return;
      }
      
      console.log('Cargando clientes...');
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error al cargar clientes:', error);
        throw error;
      }
      
      console.log('Clientes cargados:', data);
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
      alert('Error al cargar clientes: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isDemoMode) {
      alert('Función no disponible en modo demo');
      return;
    }
    
    try {
      console.log('Guardando cliente:', formData);
      
      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(formData)
          .eq('id', editingCustomer.id);

        if (error) throw error;
      } else {
        // Crear nuevo cliente
        const { error } = await supabase
          .from('customers')
          .insert([formData]);

        if (error) throw error;
      }

      setShowForm(false);
      setEditingCustomer(null);
      setFormData({ name: '', email: '', phone: '', address: '', cedula: '' });
      loadCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Error al guardar cliente: ' + (error as Error).message);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      cedula: customer.cedula,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      if (isDemoMode) {
        alert('Función no disponible en modo demo');
        return;
      }
      
      try {
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', id);

        if (error) throw error;
        loadCustomers();
      } catch (error) {
        console.error('Error deleting customer:', error);
      }
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.email.toLowerCase().includes(searchLower) ||
      customer.phone.includes(searchTerm) ||
      customer.address.toLowerCase().includes(searchLower) ||
      customer.cedula.includes(searchTerm)
    );
  }).sort((a, b) => {
    let aValue = sortBy === 'name' ? a.name : a.created_at;
    let bValue = sortBy === 'name' ? b.name : b.created_at;
    
    if (sortBy === 'created_at') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }
    
    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Clientes</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingCustomer(null);
            setFormData({ name: '', email: '', phone: '', address: '', cedula: '' });
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Cliente
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, teléfono, dirección o cédula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'created_at')}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Ordenar por Nombre</option>
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
        {searchTerm && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredCustomers.length} de {customers.length} clientes
          </div>
        )}
      </div>

      {/* Customer Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {editingCustomer ? 'Editar Cliente' : 'Agregar Cliente'}
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
                  Cédula
                </label>
                <FormattedNumberInput
                  value={formData.cedula}
                  onChange={(value) => setFormData({ ...formData, cedula: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Dirección
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                {editingCustomer ? 'Actualizar' : 'Agregar'}
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

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3"></div>
            </div>
          ))
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {customers.length === 0 ? 'No hay clientes registrados' : 'No se encontraron clientes que coincidan con tu búsqueda'}
            </p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div key={customer.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 flex items-center">
                    <Users className="h-4 w-4 mr-2 text-green-600" />
                    {customer.name}
                  </h3>
                  {customer.cedula && (
                    <p className="text-sm text-slate-600 mt-1">CC: {customer.cedula}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(customer)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-slate-600">
                {customer.email && (
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    {customer.email}
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-2" />
                    {customer.phone}
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 mr-2 mt-0.5" />
                    <span className="flex-1">{customer.address}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  Cliente desde: {new Date(customer.created_at).toLocaleDateString('es-ES')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}