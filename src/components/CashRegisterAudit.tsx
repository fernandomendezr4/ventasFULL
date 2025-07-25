import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Package, Eye, Trash2, Search, Filter, User, Clock, AlertTriangle, CheckCircle, Activity, FileText, BarChart3, Edit2, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CashRegisterWithUser, CashMovement } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';

export default function CashRegisterAudit() {
  const { user } = useAuth();
  const [registers, setRegisters] = useState<CashRegisterWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegister, setSelectedRegister] = useState<CashRegisterWithUser | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'opened_at' | 'total_sales' | 'discrepancy_amount'>('opened_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingRegister, setEditingRegister] = useState<CashRegisterWithUser | null>(null);
  const [editFormData, setEditFormData] = useState({
    session_notes: '',
    discrepancy_reason: '',
    actual_closing_amount: '',
  });

  useEffect(() => {
    loadRegisters();
  }, []);

  const loadRegisters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          *,
          user:users (name, email)
        `)
        .order('opened_at', { ascending: false });

      if (error) throw error;
      setRegisters(data as CashRegisterWithUser[]);
    } catch (error) {
      console.error('Error loading registers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async (registerId: string) => {
    try {
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (error) {
      console.error('Error loading movements:', error);
      setMovements([]);
    }
  };

  const handleEditRegister = (register: CashRegisterWithUser) => {
    setEditingRegister(register);
    setEditFormData({
      session_notes: register.session_notes || '',
      discrepancy_reason: register.discrepancy_reason || '',
      actual_closing_amount: register.actual_closing_amount?.toString() || '',
    });
  };

  const handleUpdateRegister = async () => {
    if (!editingRegister) return;

    try {
      const updateData = {
        session_notes: editFormData.session_notes,
        discrepancy_reason: editFormData.discrepancy_reason,
        actual_closing_amount: editFormData.actual_closing_amount ? parseFloat(editFormData.actual_closing_amount) : null,
      };

      const { error } = await supabase
        .from('cash_registers')
        .update(updateData)
        .eq('id', editingRegister.id);

      if (error) throw error;

      await loadRegisters();
      setEditingRegister(null);
      setEditFormData({ session_notes: '', discrepancy_reason: '', actual_closing_amount: '' });
      alert('Registro actualizado exitosamente');
    } catch (error) {
      console.error('Error updating register:', error);
      alert('Error al actualizar registro: ' + (error as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este registro de caja?')) {
      try {
        const { error } = await supabase
          .from('cash_registers')
          .delete()
          .eq('id', id);

        if (error) throw error;
        loadRegisters();
      } catch (error) {
        console.error('Error deleting register:', error);
        alert('Error al eliminar registro: ' + (error as Error).message);
      }
    }
  };

  const handleViewDetails = async (register: CashRegisterWithUser) => {
    setSelectedRegister(register);
    await loadMovements(register.id);
  };

  const calculateBalance = (register: CashRegisterWithUser) => {
    return register.opening_amount + (register.total_sales || 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-slate-100 text-slate-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Abierta';
      case 'closed':
        return 'Cerrada';
      default:
        return status;
    }
  };

  const filteredRegisters = registers.filter(register => {
    // Filter by date
    if (dateFilter && !register.opened_at.startsWith(dateFilter)) {
      return false;
    }
    
    // Filter by status
    if (statusFilter !== 'all' && register.status !== statusFilter) {
      return false;
    }
    
    // Filter by user
    if (userFilter !== 'all' && register.user_id !== userFilter) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const registerId = register.id.slice(-8);
      const userName = register.user?.name?.toLowerCase() || '';
      const userEmail = register.user?.email?.toLowerCase() || '';
      
      return (
        registerId.includes(searchTerm) ||
        userName.includes(searchLower) ||
        userEmail.includes(searchLower) ||
        register.session_notes.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  }).sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    switch (sortBy) {
      case 'total_sales':
        aValue = a.total_sales || 0;
        bValue = b.total_sales || 0;
        break;
      case 'discrepancy_amount':
        aValue = Math.abs(a.discrepancy_amount || 0);
        bValue = Math.abs(b.discrepancy_amount || 0);
        break;
      case 'opened_at':
      default:
        aValue = new Date(a.opened_at).getTime();
        bValue = new Date(b.opened_at).getTime();
        break;
    }
    
    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const uniqueUsers = Array.from(new Set(registers.map(r => r.user_id).filter(Boolean)))
    .map(userId => registers.find(r => r.user_id === userId)?.user)
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ID, usuario, email o notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="open">Abiertas</option>
              <option value="closed">Cerradas</option>
            </select>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los usuarios</option>
              {uniqueUsers.map((user) => (
                <option key={user?.id} value={user?.id}>
                  {user?.name}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'opened_at' | 'total_sales' | 'discrepancy_amount')}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="opened_at">Ordenar por Fecha</option>
              <option value="total_sales">Ordenar por Ventas</option>
              <option value="discrepancy_amount">Ordenar por Discrepancia</option>
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
        {(searchTerm || dateFilter || statusFilter !== 'all' || userFilter !== 'all') && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredRegisters.length} de {registers.length} registros
          </div>
        )}
      </div>

      {/* Registers Summary */}
      {filteredRegisters.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Resumen de Auditoría</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-600">Total Registros</p>
              <p className="text-2xl font-bold text-blue-900">{filteredRegisters.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-600">Ventas Totales</p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(filteredRegisters.reduce((sum, register) => sum + (register.total_sales || 0), 0))}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <p className="text-sm font-medium text-orange-600">Con Discrepancias</p>
              <p className="text-2xl font-bold text-orange-900">
                {filteredRegisters.filter(r => Math.abs(r.discrepancy_amount || 0) > 1).length}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <p className="text-sm font-medium text-purple-600">Promedio por Sesión</p>
              <p className="text-2xl font-bold text-purple-900">
                {formatCurrency(filteredRegisters.reduce((sum, register) => sum + (register.total_sales || 0), 0) / filteredRegisters.length)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Registers List */}
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
        ) : filteredRegisters.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {registers.length === 0 
                ? 'No hay registros de caja disponibles' 
                : 'No se encontraron registros que coincidan con los filtros aplicados'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredRegisters.map((register) => (
              <div key={register.id} className="p-6 hover:bg-slate-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 flex items-center">
                          <Activity className="h-4 w-4 mr-2 text-blue-600" />
                          Caja #{register.id.slice(-8)}
                          <span className={`ml-2 inline-block text-xs px-2 py-1 rounded-full ${getStatusColor(register.status)}`}>
                            {getStatusLabel(register.status)}
                          </span>
                        </h3>
                        <div className="flex items-center gap-6 mt-2 text-sm text-slate-600">
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            Abierta: {new Date(register.opened_at).toLocaleDateString('es-ES')} a las{' '}
                            {new Date(register.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {register.closed_at && (
                            <span className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              Cerrada: {new Date(register.closed_at).toLocaleDateString('es-ES')} a las{' '}
                              {new Date(register.closed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {register.user && (
                            <span className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              {register.user.name}
                            </span>
                          )}
                        </div>
                        
                        {/* Financial Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-xs text-blue-600">Apertura</p>
                            <p className="font-bold text-blue-900">{formatCurrency(register.opening_amount)}</p>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg">
                            <p className="text-xs text-green-600">Ventas</p>
                            <p className="font-bold text-green-900">{formatCurrency(register.total_sales || 0)}</p>
                          </div>
                          <div className="bg-purple-50 p-3 rounded-lg">
                            <p className="text-xs text-purple-600">Balance Esperado</p>
                            <p className="font-bold text-purple-900">{formatCurrency(register.expected_closing_amount || 0)}</p>
                          </div>
                          {register.status === 'closed' && (
                            <div className={`p-3 rounded-lg ${
                              Math.abs(register.discrepancy_amount || 0) > 1 
                                ? 'bg-red-50' 
                                : 'bg-green-50'
                            }`}>
                              <p className={`text-xs ${
                                Math.abs(register.discrepancy_amount || 0) > 1 
                                  ? 'text-red-600' 
                                  : 'text-green-600'
                              }`}>
                                Discrepancia
                              </p>
                              <p className={`font-bold ${
                                Math.abs(register.discrepancy_amount || 0) > 1 
                                  ? 'text-red-900' 
                                  : 'text-green-900'
                              }`}>
                                {formatCurrency(register.discrepancy_amount || 0)}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Discrepancy Alert */}
                        {register.status === 'closed' && Math.abs(register.discrepancy_amount || 0) > 1 && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center">
                              <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                              <span className="text-sm font-medium text-red-900">
                                Discrepancia detectada: {formatCurrency(register.discrepancy_amount || 0)}
                              </span>
                            </div>
                            {register.discrepancy_reason && (
                              <p className="text-sm text-red-700 mt-1 ml-6">
                                Razón: {register.discrepancy_reason}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Session Notes */}
                        {register.session_notes && (
                          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <p className="text-sm text-slate-700">
                              <strong>Notas:</strong> {register.session_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewDetails(register)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {user?.role === 'admin' && (
                      <>
                        <button
                          onClick={() => handleEditRegister(register)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(register.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Register Modal */}
      {editingRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Editar Registro #{editingRegister.id.slice(-8)}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas de Sesión
                </label>
                <textarea
                  value={editFormData.session_notes}
                  onChange={(e) => setEditFormData({ ...editFormData, session_notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Razón de Discrepancia
                </label>
                <textarea
                  value={editFormData.discrepancy_reason}
                  onChange={(e) => setEditFormData({ ...editFormData, discrepancy_reason: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {editingRegister.status === 'closed' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monto Real de Cierre
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.actual_closing_amount}
                    onChange={(e) => setEditFormData({ ...editFormData, actual_closing_amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleUpdateRegister}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </button>
              <button
                onClick={() => setEditingRegister(null)}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Detail Modal */}
      {selectedRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">
                Detalle de Caja #{selectedRegister.id.slice(-8)}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Operador: {selectedRegister.user?.name} • {new Date(selectedRegister.opened_at).toLocaleDateString('es-ES')}
              </p>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              {/* Register Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Información de Apertura</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Monto inicial:</span>
                      <span className="font-bold text-blue-900">{formatCurrency(selectedRegister.opening_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Fecha/Hora:</span>
                      <span className="text-blue-800">
                        {new Date(selectedRegister.opened_at).toLocaleString('es-ES')}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">Actividad de Ventas</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-700">Total ventas:</span>
                      <span className="font-bold text-green-900">{formatCurrency(selectedRegister.total_sales || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Balance esperado:</span>
                      <span className="text-green-800">{formatCurrency(selectedRegister.expected_closing_amount || 0)}</span>
                    </div>
                  </div>
                </div>
                
                {selectedRegister.status === 'closed' && (
                  <div className={`p-4 rounded-lg border ${
                    Math.abs(selectedRegister.discrepancy_amount || 0) > 1 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <h4 className={`font-medium mb-2 ${
                      Math.abs(selectedRegister.discrepancy_amount || 0) > 1 
                        ? 'text-red-900' 
                        : 'text-green-900'
                    }`}>
                      Cierre de Caja
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className={Math.abs(selectedRegister.discrepancy_amount || 0) > 1 ? 'text-red-700' : 'text-green-700'}>
                          Monto real:
                        </span>
                        <span className={`font-bold ${Math.abs(selectedRegister.discrepancy_amount || 0) > 1 ? 'text-red-900' : 'text-green-900'}`}>
                          {formatCurrency(selectedRegister.actual_closing_amount || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={Math.abs(selectedRegister.discrepancy_amount || 0) > 1 ? 'text-red-700' : 'text-green-700'}>
                          Discrepancia:
                        </span>
                        <span className={`font-bold ${Math.abs(selectedRegister.discrepancy_amount || 0) > 1 ? 'text-red-900' : 'text-green-900'}`}>
                          {formatCurrency(selectedRegister.discrepancy_amount || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Movements List */}
              <div>
                <h4 className="font-medium text-slate-900 mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                  Movimientos de Caja ({movements.length})
                </h4>
                {movements.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">No hay movimientos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {movements.map((movement) => (
                      <div key={movement.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {movement.type === 'sale' && <Package className="h-4 w-4 text-green-600" />}
                            {movement.type === 'income' && <DollarSign className="h-4 w-4 text-blue-600" />}
                            {movement.type === 'expense' && <DollarSign className="h-4 w-4 text-red-600" />}
                            {movement.type === 'opening' && <Activity className="h-4 w-4 text-purple-600" />}
                            {movement.type === 'closing' && <CheckCircle className="h-4 w-4 text-gray-600" />}
                            <div>
                              <h5 className="font-medium text-slate-900">
                                {movement.type === 'sale' ? 'Venta' :
                                 movement.type === 'income' ? 'Ingreso' :
                                 movement.type === 'expense' ? 'Gasto' :
                                 movement.type === 'opening' ? 'Apertura' :
                                 movement.type === 'closing' ? 'Cierre' : movement.type}
                                {movement.category && ` - ${movement.category}`}
                              </h5>
                              <p className="text-sm text-slate-600">{movement.description}</p>
                              <p className="text-xs text-slate-500">
                                {new Date(movement.created_at).toLocaleTimeString('es-ES')}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${
                            movement.type === 'expense' ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {movement.type === 'expense' ? '-' : '+'}{formatCurrency(movement.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setSelectedRegister(null)}
                className="w-full bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}