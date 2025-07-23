import React, { useState, useEffect } from 'react';
import { 
  Search, Calendar, Filter, Eye, Edit2, Trash2, User, Package, 
  DollarSign, Clock, AlertTriangle, CheckCircle, Activity, 
  FileText, BarChart3, CreditCard, TrendingUp, TrendingDown,
  X, Save, Plus, Minus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';

interface CashRegisterSession {
  id: string;
  user_id: string;
  user_name: string;
  opening_amount: number;
  closing_amount: number;
  actual_closing_amount: number;
  expected_closing_amount: number;
  discrepancy_amount: number;
  status: string;
  opened_at: string;
  closed_at: string | null;
  session_notes: string;
  total_sales_amount: number;
  total_sales_count: number;
  cash_sales_amount: number;
  cash_sales_count: number;
  total_installments_amount: number;
  total_installments_count: number;
  total_income: number;
  total_expenses: number;
  total_movements: number;
  calculated_balance: number;
}

interface SaleDetail {
  id: string;
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  payment_type: string;
  payment_method: string;
  created_at: string;
  items_count: number;
  sale_items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

interface MovementDetail {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  created_at: string;
  created_by_name: string;
}

export default function CashRegisterAudit() {
  const { user } = useAuth();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const { confirmation, showConfirmation, hideConfirmation, handleConfirm } = useConfirmation();
  
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<CashRegisterSession | null>(null);
  const [salesDetails, setSalesDetails] = useState<SaleDetail[]>([]);
  const [movementsDetails, setMovementsDetails] = useState<MovementDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  
  // Edit states
  const [editingSession, setEditingSession] = useState<CashRegisterSession | null>(null);
  const [editingMovement, setEditingMovement] = useState<MovementDetail | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Form data
  const [editFormData, setEditFormData] = useState({
    session_notes: '',
    discrepancy_reason: '',
    actual_closing_amount: ''
  });
  
  const [movementFormData, setMovementFormData] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    amount: '',
    description: ''
  });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cash_register_history_summary')
        .select('*')
        .order('opened_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      showError('Error', 'No se pudieron cargar las sesiones de caja');
    } finally {
      setLoading(false);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    try {
      setLoadingDetails(true);
      
      // Cargar ventas de la sesión
      const { data: salesData, error: salesError } = await supabase
        .from('cash_register_sales')
        .select(`
          *,
          sale:sales (
            id,
            total_amount,
            payment_type,
            created_at,
            customer:customers (name, phone),
            sale_items (
              quantity,
              unit_price,
              total_price,
              product:products (name)
            )
          )
        `)
        .eq('cash_register_id', sessionId);

      if (salesError) throw salesError;

      // Transformar datos de ventas
      const transformedSales: SaleDetail[] = (salesData || []).map(item => ({
        id: item.sale.id,
        total_amount: item.sale.total_amount,
        customer_name: item.sale.customer?.name || null,
        customer_phone: item.sale.customer?.phone || null,
        payment_type: item.sale.payment_type,
        payment_method: item.payment_method,
        created_at: item.sale.created_at,
        items_count: item.sale.sale_items.length,
        sale_items: item.sale.sale_items.map((saleItem: any) => ({
          product_name: saleItem.product.name,
          quantity: saleItem.quantity,
          unit_price: saleItem.unit_price,
          total_price: saleItem.total_price
        }))
      }));

      setSalesDetails(transformedSales);

      // Cargar movimientos de la sesión
      const { data: movementsData, error: movementsError } = await supabase
        .from('cash_movements')
        .select(`
          *,
          created_by_user:users!cash_movements_created_by_fkey (name)
        `)
        .eq('cash_register_id', sessionId)
        .order('created_at', { ascending: false });

      if (movementsError) throw movementsError;

      const transformedMovements: MovementDetail[] = (movementsData || []).map(movement => ({
        id: movement.id,
        type: movement.type,
        category: movement.category,
        amount: movement.amount,
        description: movement.description,
        created_at: movement.created_at,
        created_by_name: movement.created_by_user?.name || 'Sistema'
      }));

      setMovementsDetails(transformedMovements);
    } catch (error) {
      console.error('Error loading session details:', error);
      showError('Error', 'No se pudieron cargar los detalles de la sesión');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewDetails = async (session: CashRegisterSession) => {
    setSelectedSession(session);
    setShowDetailsModal(true);
    await loadSessionDetails(session.id);
  };

  const handleEditSession = (session: CashRegisterSession) => {
    setEditingSession(session);
    setEditFormData({
      session_notes: session.session_notes || '',
      discrepancy_reason: '', // Se carga desde discrepancies si existe
      actual_closing_amount: session.actual_closing_amount?.toString() || ''
    });
    setShowEditModal(true);
  };

  const handleDeleteSession = (session: CashRegisterSession) => {
    showConfirmation(
      'Eliminar Sesión de Caja',
      `¿Estás seguro de que quieres eliminar la sesión de caja del ${new Date(session.opened_at).toLocaleDateString()}? Esta acción eliminará también todas las ventas y movimientos asociados.`,
      async () => {
        try {
          const { error } = await supabase
            .from('cash_registers')
            .delete()
            .eq('id', session.id);

          if (error) throw error;
          
          await loadSessions();
          showSuccess('Sesión Eliminada', 'La sesión de caja ha sido eliminada exitosamente');
        } catch (error) {
          console.error('Error deleting session:', error);
          showError('Error', 'No se pudo eliminar la sesión: ' + (error as Error).message);
        }
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      }
    );
  };

  const handleSaveSessionEdit = async () => {
    if (!editingSession) return;

    try {
      const updateData: any = {
        session_notes: editFormData.session_notes
      };

      // Si se cambió el monto de cierre, recalcular discrepancia
      if (editFormData.actual_closing_amount && 
          parseFloat(editFormData.actual_closing_amount) !== editingSession.actual_closing_amount) {
        const newAmount = parseFloat(editFormData.actual_closing_amount);
        const expectedAmount = editingSession.expected_closing_amount;
        updateData.actual_closing_amount = newAmount;
        updateData.discrepancy_amount = newAmount - expectedAmount;
      }

      const { error } = await supabase
        .from('cash_registers')
        .update(updateData)
        .eq('id', editingSession.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingSession(null);
      await loadSessions();
      showSuccess('Sesión Actualizada', 'Los datos de la sesión han sido actualizados exitosamente');
    } catch (error) {
      console.error('Error updating session:', error);
      showError('Error', 'No se pudo actualizar la sesión: ' + (error as Error).message);
    }
  };

  const handleEditMovement = (movement: MovementDetail) => {
    setEditingMovement(movement);
    setMovementFormData({
      type: movement.type as 'income' | 'expense',
      category: movement.category,
      amount: movement.amount.toString(),
      description: movement.description
    });
    setShowMovementModal(true);
  };

  const handleDeleteMovement = (movement: MovementDetail) => {
    showConfirmation(
      'Eliminar Movimiento',
      `¿Estás seguro de que quieres eliminar este movimiento de ${movement.type === 'income' ? 'ingreso' : 'gasto'} por ${formatCurrency(movement.amount)}?`,
      async () => {
        try {
          const { error } = await supabase
            .from('cash_movements')
            .delete()
            .eq('id', movement.id);

          if (error) throw error;

          // Recargar detalles de la sesión
          if (selectedSession) {
            await loadSessionDetails(selectedSession.id);
          }
          await loadSessions();
          showSuccess('Movimiento Eliminado', 'El movimiento ha sido eliminado exitosamente');
        } catch (error) {
          console.error('Error deleting movement:', error);
          showError('Error', 'No se pudo eliminar el movimiento: ' + (error as Error).message);
        }
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      }
    );
  };

  const handleSaveMovementEdit = async () => {
    if (!editingMovement || !selectedSession) return;

    try {
      const updateData = {
        type: movementFormData.type,
        category: movementFormData.category,
        amount: parseFloat(movementFormData.amount),
        description: movementFormData.description
      };

      const { error } = await supabase
        .from('cash_movements')
        .update(updateData)
        .eq('id', editingMovement.id);

      if (error) throw error;

      setShowMovementModal(false);
      setEditingMovement(null);
      
      // Recargar detalles de la sesión
      await loadSessionDetails(selectedSession.id);
      await loadSessions();
      showSuccess('Movimiento Actualizado', 'El movimiento ha sido actualizado exitosamente');
    } catch (error) {
      console.error('Error updating movement:', error);
      showError('Error', 'No se pudo actualizar el movimiento: ' + (error as Error).message);
    }
  };

  const handleDeleteSale = (sale: SaleDetail) => {
    showConfirmation(
      'Eliminar Venta',
      `¿Estás seguro de que quieres eliminar la venta #${sale.id.slice(-8)} por ${formatCurrency(sale.total_amount)}? Esta acción también eliminará todos los items de la venta.`,
      async () => {
        try {
          const { error } = await supabase
            .from('sales')
            .delete()
            .eq('id', sale.id);

          if (error) throw error;

          // Recargar detalles de la sesión
          if (selectedSession) {
            await loadSessionDetails(selectedSession.id);
          }
          await loadSessions();
          showSuccess('Venta Eliminada', 'La venta ha sido eliminada exitosamente');
        } catch (error) {
          console.error('Error deleting sale:', error);
          showError('Error', 'No se pudo eliminar la venta: ' + (error as Error).message);
        }
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      }
    );
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = !searchTerm || 
      session.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.session_notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.id.includes(searchTerm);
    
    const matchesDate = !dateFilter || 
      new Date(session.opened_at).toDateString() === new Date(dateFilter).toDateString();
    
    const matchesStatus = !statusFilter || session.status === statusFilter;
    const matchesUser = !userFilter || session.user_id === userFilter;

    return matchesSearch && matchesDate && matchesStatus && matchesUser;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return <Package className="h-4 w-4 text-green-600" />;
      case 'income':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'expense':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'opening':
        return <Activity className="h-4 w-4 text-purple-600" />;
      case 'closing':
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-slate-600" />;
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'sale':
        return 'Venta';
      case 'income':
        return 'Ingreso';
      case 'expense':
        return 'Gasto';
      case 'opening':
        return 'Apertura';
      case 'closing':
        return 'Cierre';
      default:
        return type;
    }
  };

  if (loading) {
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
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Auditoría de Cajas</h2>
        <button
          onClick={loadSessions}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
        >
          <FileText className="h-4 w-4 mr-2" />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por usuario, notas o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los estados</option>
            <option value="open">Abierta</option>
            <option value="closed">Cerrada</option>
          </select>
          
          <button
            onClick={() => {
              setSearchTerm('');
              setDateFilter('');
              setStatusFilter('');
              setUserFilter('');
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
          >
            <Filter className="h-4 w-4 mr-2 inline" />
            Limpiar Filtros
          </button>
        </div>
        
        {(searchTerm || dateFilter || statusFilter) && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredSessions.length} de {sessions.length} sesiones
          </div>
        )}
      </div>

      {/* Sessions Summary */}
      {filteredSessions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Resumen de Sesiones</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-600">Total Sesiones</p>
              <p className="text-2xl font-bold text-blue-900">{filteredSessions.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-600">Ventas Totales</p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(filteredSessions.reduce((sum, s) => sum + (s.total_sales_amount || 0), 0))}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <p className="text-sm font-medium text-purple-600">Número de Ventas</p>
              <p className="text-2xl font-bold text-purple-900">
                {filteredSessions.reduce((sum, s) => sum + (s.total_sales_count || 0), 0)}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <p className="text-sm font-medium text-orange-600">Discrepancias</p>
              <p className="text-2xl font-bold text-orange-900">
                {formatCurrency(filteredSessions.reduce((sum, s) => sum + Math.abs(s.discrepancy_amount || 0), 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredSessions.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {sessions.length === 0 
                ? 'No hay sesiones de caja registradas' 
                : 'No se encontraron sesiones que coincidan con los filtros aplicados'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredSessions.map((session) => (
              <div key={session.id} className="p-6 hover:bg-slate-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <div>
                        <h3 className="font-semibold text-slate-900 flex items-center">
                          <Activity className="h-5 w-5 mr-2 text-blue-600" />
                          Sesión #{session.id.slice(-8)}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-slate-600 mt-1">
                          <span className="flex items-center">
                            <User className="h-4 w-4 mr-1" />
                            {session.user_name}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {new Date(session.opened_at).toLocaleDateString('es-ES')} - 
                            {new Date(session.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                            {session.status === 'open' ? 'Abierta' : 'Cerrada'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600">Apertura:</span>
                        <p className="font-semibold text-slate-900">{formatCurrency(session.opening_amount)}</p>
                      </div>
                      <div>
                        <span className="text-slate-600">Ventas:</span>
                        <p className="font-semibold text-green-600">
                          {formatCurrency(session.total_sales_amount || 0)} ({session.total_sales_count || 0})
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-600">Balance:</span>
                        <p className="font-semibold text-blue-600">{formatCurrency(session.calculated_balance || 0)}</p>
                      </div>
                      <div>
                        <span className="text-slate-600">Discrepancia:</span>
                        <p className={`font-semibold ${
                          Math.abs(session.discrepancy_amount || 0) > 1 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}>
                          {formatCurrency(session.discrepancy_amount || 0)}
                        </p>
                      </div>
                    </div>
                    
                    {session.session_notes && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm text-slate-700">
                          <strong>Notas:</strong> {session.session_notes}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleViewDetails(session)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {user?.role === 'admin' && (
                      <>
                        <button
                          onClick={() => handleEditSession(session)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                          title="Editar sesión"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          title="Eliminar sesión"
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

      {/* Session Details Modal */}
      {showDetailsModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Detalles de Sesión #{selectedSession.id.slice(-8)}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {selectedSession.user_name} • {new Date(selectedSession.opened_at).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedSession(null);
                    setSalesDetails([]);
                    setMovementsDetails([]);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Session Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-900 mb-2">Información de Sesión</h4>
                      <div className="space-y-1 text-sm">
                        <p><strong>Apertura:</strong> {formatCurrency(selectedSession.opening_amount)}</p>
                        <p><strong>Cierre esperado:</strong> {formatCurrency(selectedSession.expected_closing_amount)}</p>
                        <p><strong>Cierre real:</strong> {formatCurrency(selectedSession.actual_closing_amount)}</p>
                        <p><strong>Discrepancia:</strong> 
                          <span className={Math.abs(selectedSession.discrepancy_amount || 0) > 1 ? 'text-red-600' : 'text-green-600'}>
                            {formatCurrency(selectedSession.discrepancy_amount || 0)}
                          </span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h4 className="font-medium text-green-900 mb-2">Ventas</h4>
                      <div className="space-y-1 text-sm">
                        <p><strong>Total ventas:</strong> {selectedSession.total_sales_count || 0}</p>
                        <p><strong>Monto total:</strong> {formatCurrency(selectedSession.total_sales_amount || 0)}</p>
                        <p><strong>Ventas efectivo:</strong> {selectedSession.cash_sales_count || 0}</p>
                        <p><strong>Monto efectivo:</strong> {formatCurrency(selectedSession.cash_sales_amount || 0)}</p>
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <h4 className="font-medium text-purple-900 mb-2">Movimientos</h4>
                      <div className="space-y-1 text-sm">
                        <p><strong>Total movimientos:</strong> {selectedSession.total_movements || 0}</p>
                        <p><strong>Ingresos:</strong> {formatCurrency(selectedSession.total_income || 0)}</p>
                        <p><strong>Gastos:</strong> {formatCurrency(selectedSession.total_expenses || 0)}</p>
                        <p><strong>Abonos:</strong> {formatCurrency(selectedSession.total_installments_amount || 0)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sales Details */}
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                      <Package className="h-5 w-5 mr-2 text-green-600" />
                      Ventas Realizadas ({salesDetails.length})
                    </h4>
                    {salesDetails.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-lg">
                        <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500">No hay ventas registradas en esta sesión</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {salesDetails.map((sale) => (
                          <div key={sale.id} className="border border-slate-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h5 className="font-medium text-slate-900">
                                  Venta #{sale.id.slice(-8)} - {formatCurrency(sale.total_amount)}
                                </h5>
                                <div className="flex items-center gap-4 text-sm text-slate-600 mt-1">
                                  <span>{new Date(sale.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                  <span>{sale.payment_type === 'cash' ? 'Efectivo' : 'Abonos'}</span>
                                  <span>{sale.items_count} productos</span>
                                  {sale.customer_name && (
                                    <span className="flex items-center">
                                      <User className="h-3 w-3 mr-1" />
                                      {sale.customer_name}
                                      {sale.customer_phone && ` (${sale.customer_phone})`}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {user?.role === 'admin' && (
                                <button
                                  onClick={() => handleDeleteSale(sale)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                  title="Eliminar venta"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            
                            {/* Sale Items */}
                            <div className="bg-slate-50 rounded-lg p-3">
                              <h6 className="text-sm font-medium text-slate-700 mb-2">Productos vendidos:</h6>
                              <div className="space-y-1">
                                {sale.sale_items.map((item, index) => (
                                  <div key={index} className="flex justify-between text-sm">
                                    <span>{item.product_name} x{item.quantity}</span>
                                    <span>{formatCurrency(item.total_price)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Movements Details */}
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                      Movimientos de Caja ({movementsDetails.length})
                    </h4>
                    {movementsDetails.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-lg">
                        <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500">No hay movimientos registrados en esta sesión</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {movementsDetails.map((movement) => (
                          <div key={movement.id} className="border border-slate-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getMovementIcon(movement.type)}
                                <div>
                                  <h5 className="font-medium text-slate-900">
                                    {getMovementTypeLabel(movement.type)}
                                    {movement.category && ` - ${movement.category}`}
                                  </h5>
                                  <p className="text-sm text-slate-600">{movement.description}</p>
                                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                    <span className="flex items-center">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {new Date(movement.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="flex items-center">
                                      <User className="h-3 w-3 mr-1" />
                                      {movement.created_by_name}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <p className={`font-bold text-lg ${
                                    movement.type === 'expense' ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {movement.type === 'expense' ? '-' : '+'}{formatCurrency(movement.amount)}
                                  </p>
                                </div>
                                {user?.role === 'admin' && movement.type !== 'opening' && movement.type !== 'closing' && movement.type !== 'sale' && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleEditMovement(movement)}
                                      className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors duration-200"
                                      title="Editar movimiento"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMovement(movement)}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                                      title="Eliminar movimiento"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {showEditModal && editingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Editar Sesión #{editingSession.id.slice(-8)}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto Real de Cierre
                </label>
                <FormattedNumberInput
                  value={editFormData.actual_closing_amount}
                  onChange={(value) => setEditFormData({ ...editFormData, actual_closing_amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={editingSession.actual_closing_amount?.toString()}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Esperado: {formatCurrency(editingSession.expected_closing_amount)}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas de Sesión
                </label>
                <textarea
                  value={editFormData.session_notes}
                  onChange={(e) => setEditFormData({ ...editFormData, session_notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notas sobre esta sesión..."
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleSaveSessionEdit}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                Guardar Cambios
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSession(null);
                }}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Movement Modal */}
      {showMovementModal && editingMovement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Editar Movimiento
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de Movimiento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMovementFormData({ ...movementFormData, type: 'income' })}
                    className={`p-3 rounded-lg border-2 transition-colors duration-200 ${
                      movementFormData.type === 'income'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <TrendingUp className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Ingreso</span>
                  </button>
                  <button
                    onClick={() => setMovementFormData({ ...movementFormData, type: 'expense' })}
                    className={`p-3 rounded-lg border-2 transition-colors duration-200 ${
                      movementFormData.type === 'expense'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <TrendingDown className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Gasto</span>
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría
                </label>
                <select
                  value={movementFormData.category}
                  onChange={(e) => setMovementFormData({ ...movementFormData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar categoría</option>
                  {movementFormData.type === 'income' ? (
                    <>
                      <option value="otros_ingresos">Otros Ingresos</option>
                      <option value="devolucion_proveedor">Devolución Proveedor</option>
                      <option value="ajuste_inventario">Ajuste Inventario</option>
                      <option value="prestamo">Préstamo</option>
                    </>
                  ) : (
                    <>
                      <option value="otros_gastos">Otros Gastos</option>
                      <option value="compra_productos">Compra Productos</option>
                      <option value="servicios">Servicios</option>
                      <option value="transporte">Transporte</option>
                      <option value="mantenimiento">Mantenimiento</option>
                      <option value="devolucion_cliente">Devolución Cliente</option>
                    </>
                  )}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto
                </label>
                <FormattedNumberInput
                  value={movementFormData.amount}
                  onChange={(value) => setMovementFormData({ ...movementFormData, amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={movementFormData.description}
                  onChange={(e) => setMovementFormData({ ...movementFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleSaveMovementEdit}
                disabled={!movementFormData.amount || !movementFormData.description}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Guardar Cambios
              </button>
              <button
                onClick={() => {
                  setShowMovementModal(false);
                  setEditingMovement(null);
                }}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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