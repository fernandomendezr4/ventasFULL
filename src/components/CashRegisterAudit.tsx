import React, { useState, useEffect } from 'react';
import { Calendar, Search, Eye, Edit2, Save, X, Calculator, DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, User, Clock, Package, Activity, FileText, Filter, ShoppingCart, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import { SaleWithItems, Product, Customer } from '../lib/types';

interface CashRegisterSession {
  id: string;
  user_id: string;
  opening_amount: number;
  closing_amount: number;
  expected_closing_amount: number;
  actual_closing_amount: number;
  discrepancy_amount: number;
  discrepancy_reason: string;
  session_notes: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  user: {
    name: string;
    email: string;
  } | null;
  total_sales_amount?: number;
  total_sales_count?: number;
  total_income?: number;
  total_expenses?: number;
  calculated_balance?: number;
}

interface CashMovement {
  id: string;
  cash_register_id: string;
  type: 'income' | 'expense' | 'sale' | 'opening' | 'closing';
  category: string;
  amount: number;
  description: string;
  reference_id: string | null;
  created_at: string;
  created_by: string | null;
  created_by_user?: { name: string } | null;
}

interface SaleEditData {
  customer_id: string;
  discount_amount: string;
  payment_type: 'cash' | 'installment';
  payment_status: 'pending' | 'partial' | 'paid';
  total_paid: string;
  items: {
    id?: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
}

export default function CashRegisterAudit() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedSession, setSelectedSession] = useState<CashRegisterSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMovement, setEditingMovement] = useState<CashMovement | null>(null);
  const [editingSale, setEditingSale] = useState<SaleWithItems | null>(null);
  const [showSaleEditModal, setShowSaleEditModal] = useState(false);
  const [saleEditData, setSaleEditData] = useState<SaleEditData>({
    customer_id: '',
    discount_amount: '0',
    payment_type: 'cash',
    payment_status: 'paid',
    total_paid: '0',
    items: []
  });
  const [editFormData, setEditFormData] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    loadSessions();
    loadProducts();
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadMovements(selectedSession.id);
      loadSales(selectedSession.id);
    }
  }, [selectedSession]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

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
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async (registerId: string) => {
    try {
      setMovementsLoading(true);
      
      // Primero cargar los movimientos
      const { data: movementsData, error: movementsError } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (movementsError) throw movementsError;
      
      // Luego cargar los nombres de usuarios para los movimientos que tienen created_by
      const movementsWithUsers = await Promise.all(
        (movementsData || []).map(async (movement) => {
          if (movement.created_by) {
            try {
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('name')
                .eq('id', movement.created_by)
                .single();
              
              if (!userError && userData) {
                return {
                  ...movement,
                  created_by_user: userData
                };
              }
            } catch (error) {
              console.warn('Error loading user for movement:', error);
            }
          }
          return movement;
        })
      );
      
      setMovements(movementsWithUsers);
    } catch (error) {
      console.error('Error loading movements:', error);
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  };

  const loadSales = async (registerId: string) => {
    try {
      setSalesLoading(true);
      
      // Cargar ventas de la sesión de caja
      const { data: salesData, error: salesError } = await supabase
        .from('cash_register_sales')
        .select(`
          sale_id,
          payment_method,
          amount_received,
          change_given,
          created_at,
          sale:sales (
            *,
            customer:customers (name, phone, email),
            user:users (name, email),
            sale_items (
              *,
              product:products (*)
            )
          )
        `)
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;
      
      // Transformar los datos para que coincidan con SaleWithItems
      const transformedSales = (salesData || []).map(item => ({
        ...item.sale,
        cash_register_payment_method: item.payment_method,
        amount_received: item.amount_received,
        change_given: item.change_given
      })) as SaleWithItems[];
      
      setSales(transformedSales);
    } catch (error) {
      console.error('Error loading sales:', error);
      setSales([]);
    } finally {
      setSalesLoading(false);
    }
  };

  const refreshSessionDetails = async (registerId: string) => {
    try {
      // Recargar los detalles de la sesión específica
      const { data: sessionData, error: sessionError } = await supabase
        .from('cash_register_history_summary')
        .select('*')
        .eq('id', registerId)
        .single();

      if (sessionError) throw sessionError;

      // Actualizar la sesión en el estado
      setSessions(prevSessions => 
        prevSessions.map(session => 
          session.id === registerId ? sessionData : session
        )
      );

      // Actualizar la sesión seleccionada si es la misma
      if (selectedSession && selectedSession.id === registerId) {
        setSelectedSession(sessionData);
      }

      // Recargar movimientos para reflejar cambios
      await loadMovements(registerId);
      await loadSales(registerId);
    } catch (error) {
      console.error('Error refreshing session details:', error);
    }
  };

  const handleEditMovement = (movement: CashMovement) => {
    // No permitir editar movimientos de apertura, cierre o ventas
    if (['opening', 'closing', 'sale'].includes(movement.type)) {
      alert('No se pueden editar movimientos de apertura, cierre o ventas automáticas.');
      return;
    }

    setEditingMovement(movement);
    setEditFormData({
      type: movement.type as 'income' | 'expense',
      category: movement.category,
      amount: movement.amount.toString(),
      description: movement.description,
    });
  };

  const handleSaveMovement = async () => {
    if (!editingMovement || !selectedSession) return;

    try {
      const amount = parseFloat(editFormData.amount);
      if (amount <= 0) {
        alert('El monto debe ser mayor a cero');
        return;
      }

      if (amount > 9999999.99) {
        alert('El monto es demasiado grande. Máximo permitido: $9,999,999.99');
        return;
      }

      const updateData = {
        type: editFormData.type,
        category: editFormData.category || (editFormData.type === 'income' ? 'otros_ingresos' : 'otros_gastos'),
        amount: amount,
        description: editFormData.description.trim(),
      };

      const { error } = await supabase
        .from('cash_movements')
        .update(updateData)
        .eq('id', editingMovement.id);

      if (error) throw error;

      // Cerrar el formulario de edición
      setEditingMovement(null);
      setEditFormData({ type: 'income', category: '', amount: '', description: '' });

      // Refrescar los detalles de la sesión y movimientos
      await refreshSessionDetails(selectedSession.id);

      alert('Movimiento actualizado exitosamente');
    } catch (error) {
      console.error('Error updating movement:', error);
      alert('Error al actualizar movimiento: ' + (error as Error).message);
    }
  };

  const handleDeleteMovement = async (movementId: string) => {
    if (!selectedSession) return;

    const movement = movements.find(m => m.id === movementId);
    if (!movement) return;

    // No permitir eliminar movimientos de apertura, cierre o ventas
    if (['opening', 'closing', 'sale'].includes(movement.type)) {
      alert('No se pueden eliminar movimientos de apertura, cierre o ventas automáticas.');
      return;
    }

    if (window.confirm('¿Estás seguro de que quieres eliminar este movimiento? Esta acción no se puede deshacer.')) {
      try {
        const { error } = await supabase
          .from('cash_movements')
          .delete()
          .eq('id', movementId);

        if (error) throw error;

        // Refrescar los detalles de la sesión y movimientos
        await refreshSessionDetails(selectedSession.id);

        alert('Movimiento eliminado exitosamente');
      } catch (error) {
        console.error('Error deleting movement:', error);
        alert('Error al eliminar movimiento: ' + (error as Error).message);
      }
    }
  };

  const handleEditSale = (sale: SaleWithItems) => {
    setEditingSale(sale);
    setSaleEditData({
      customer_id: sale.customer_id || '',
      discount_amount: (sale.discount_amount || 0).toString(),
      payment_type: sale.payment_type as 'cash' | 'installment',
      payment_status: sale.payment_status as 'pending' | 'partial' | 'paid',
      total_paid: (sale.total_paid || 0).toString(),
      items: sale.sale_items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price
      }))
    });
    setShowSaleEditModal(true);
  };

  const handleSaveSale = async () => {
    if (!editingSale || !selectedSession) return;

    try {
      const subtotal = saleEditData.items.reduce((sum, item) => sum + item.total_price, 0);
      const discountAmount = parseFloat(saleEditData.discount_amount) || 0;
      const totalAmount = subtotal - discountAmount;
      const totalPaid = parseFloat(saleEditData.total_paid) || 0;

      if (totalAmount <= 0) {
        alert('El total de la venta debe ser mayor a cero');
        return;
      }

      if (saleEditData.payment_type === 'cash' && totalPaid < totalAmount) {
        alert('Para ventas en efectivo, el monto pagado debe ser igual al total');
        return;
      }

      // Actualizar la venta
      const { error: saleError } = await supabase
        .from('sales')
        .update({
          customer_id: saleEditData.customer_id || null,
          subtotal: subtotal,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          payment_type: saleEditData.payment_type,
          payment_status: saleEditData.payment_status,
          total_paid: totalPaid
        })
        .eq('id', editingSale.id);

      if (saleError) throw saleError;

      // Eliminar items existentes
      const { error: deleteItemsError } = await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', editingSale.id);

      if (deleteItemsError) throw deleteItemsError;

      // Insertar nuevos items
      const { error: insertItemsError } = await supabase
        .from('sale_items')
        .insert(saleEditData.items.map(item => ({
          sale_id: editingSale.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        })));

      if (insertItemsError) throw insertItemsError;

      // Cerrar modal y refrescar datos
      setShowSaleEditModal(false);
      setEditingSale(null);
      setSaleEditData({
        customer_id: '',
        discount_amount: '0',
        payment_type: 'cash',
        payment_status: 'paid',
        total_paid: '0',
        items: []
      });

      await refreshSessionDetails(selectedSession.id);
      alert('Venta actualizada exitosamente');
    } catch (error) {
      console.error('Error updating sale:', error);
      alert('Error al actualizar venta: ' + (error as Error).message);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!selectedSession) return;

    if (window.confirm('¿Estás seguro de que quieres eliminar esta venta? Esta acción no se puede deshacer y afectará el balance de la caja.')) {
      try {
        // Eliminar la venta (esto eliminará automáticamente los items por CASCADE)
        const { error } = await supabase
          .from('sales')
          .delete()
          .eq('id', saleId);

        if (error) throw error;

        await refreshSessionDetails(selectedSession.id);
        alert('Venta eliminada exitosamente');
      } catch (error) {
        console.error('Error deleting sale:', error);
        alert('Error al eliminar venta: ' + (error as Error).message);
      }
    }
  };

  const addSaleItem = () => {
    setSaleEditData(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: '',
        quantity: 1,
        unit_price: 0,
        total_price: 0
      }]
    }));
  };

  const removeSaleItem = (index: number) => {
    setSaleEditData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateSaleItem = (index: number, field: string, value: any) => {
    setSaleEditData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Recalcular total_price si cambia quantity o unit_price
      if (field === 'quantity' || field === 'unit_price') {
        newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
      }
      
      // Si cambia el producto, actualizar el precio
      if (field === 'product_id') {
        const product = products.find(p => p.id === value);
        if (product) {
          newItems[index].unit_price = product.sale_price;
          newItems[index].total_price = newItems[index].quantity * product.sale_price;
        }
      }
      
      return { ...prev, items: newItems };
    });
  };

  const calculateSaleTotal = () => {
    const subtotal = saleEditData.items.reduce((sum, item) => sum + item.total_price, 0);
    const discount = parseFloat(saleEditData.discount_amount) || 0;
    return subtotal - discount;
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

  const getUserName = (createdBy: string | null | undefined, createdByUser: any) => {
    if (!createdBy) return 'Sistema';
    if (createdByUser?.name) return createdByUser.name;
    if (createdBy === user?.id) return user.name || 'Tú';
    return 'Usuario';
  };

  const filteredSessions = sessions.filter(session => {
    // Filter by date
    if (dateFilter && !session.opened_at.startsWith(dateFilter)) {
      return false;
    }
    
    // Filter by status
    if (statusFilter !== 'all' && session.status !== statusFilter) {
      return false;
    }
    
    // Filter by user
    if (userFilter !== 'all' && session.user_id !== userFilter) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const sessionId = session.id.slice(-8);
      const userName = session.user?.name?.toLowerCase() || '';
      
      return (
        sessionId.includes(searchTerm) ||
        userName.includes(searchLower) ||
        session.session_notes.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  const uniqueUsers = Array.from(new Set(sessions.map(s => s.user_id)))
    .map(userId => sessions.find(s => s.user_id === userId))
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ID de sesión, usuario o notas..."
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
              {uniqueUsers.map((session) => (
                <option key={session?.user_id} value={session?.user_id}>
                  {session?.user?.name || 'Usuario desconocido'}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(searchTerm || dateFilter || statusFilter !== 'all' || userFilter !== 'all') && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredSessions.length} de {sessions.length} sesiones
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-600" />
              Sesiones de Caja ({filteredSessions.length})
            </h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
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
            ) : filteredSessions.length === 0 ? (
              <div className="p-12 text-center">
                <Calculator className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">No se encontraron sesiones de caja</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors duration-200 ${
                      selectedSession?.id === session.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            session.status === 'open' ? 'bg-green-100' : 'bg-slate-100'
                          }`}>
                            <Calculator className={`h-4 w-4 ${
                              session.status === 'open' ? 'text-green-600' : 'text-slate-600'
                            }`} />
                          </div>
                          <div>
                            <h4 className="font-medium text-slate-900">
                              Sesión #{session.id.slice(-8)}
                            </h4>
                            <p className="text-sm text-slate-600">
                              {session.user?.name || 'Usuario desconocido'}
                            </p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {new Date(session.opened_at).toLocaleDateString('es-ES')}
                              </span>
                              <span className={`px-2 py-1 rounded-full ${
                                session.status === 'open' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-slate-100 text-slate-800'
                              }`}>
                                {session.status === 'open' ? 'Abierta' : 'Cerrada'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">
                          {formatCurrency(session.calculated_balance || 0)}
                        </p>
                        <p className="text-xs text-slate-500">Balance</p>
                        {Math.abs(session.discrepancy_amount || 0) > 1 && (
                          <div className="flex items-center text-xs text-orange-600 mt-1">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Discrepancia
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

        {/* Session Details */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Eye className="h-5 w-5 mr-2 text-green-600" />
              {selectedSession ? `Detalles de Sesión #${selectedSession.id.slice(-8)}` : 'Selecciona una Sesión'}
            </h3>
          </div>
          
          {selectedSession ? (
            <div className="max-h-96 overflow-y-auto">
              {/* Session Summary */}
              <div className="p-6 border-b border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Operador:</span>
                    <p className="font-medium text-slate-900">{selectedSession.user?.name || 'Usuario desconocido'}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Estado:</span>
                    <p className={`font-medium ${
                      selectedSession.status === 'open' ? 'text-green-600' : 'text-slate-900'
                    }`}>
                      {selectedSession.status === 'open' ? 'Abierta' : 'Cerrada'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-600">Apertura:</span>
                    <p className="font-bold text-blue-600">{formatCurrency(selectedSession.opening_amount)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Ventas:</span>
                    <p className="font-bold text-green-600">{formatCurrency(selectedSession.cash_sales_amount || 0)}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Balance:</span>
                    <p className="font-bold text-purple-600">{formatCurrency(selectedSession.calculated_balance || 0)}</p>
                  </div>
                  {selectedSession.status === 'closed' && (
                    <div>
                      <span className="text-slate-600">Discrepancia:</span>
                      <p className={`font-bold ${
                        Math.abs(selectedSession.discrepancy_amount || 0) > 1 
                          ? 'text-orange-600' 
                          : 'text-green-600'
                      }`}>
                        {formatCurrency(selectedSession.discrepancy_amount || 0)}
                      </p>
                    </div>
                  )}
                </div>
                
                {selectedSession.session_notes && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-700">{selectedSession.session_notes}</p>
                  </div>
                )}
              </div>

              {/* Movements */}
              <div className="p-6">
                <h4 className="font-medium text-slate-900 mb-4 flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  Movimientos ({movements.length})
                </h4>
                
                {movementsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : movements.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No hay movimientos registrados</p>
                ) : (
                  <div className="space-y-3">
                    {movements.map((movement) => (
                      <div key={movement.id} className="p-3 bg-slate-50 rounded-lg">
                        {editingMovement?.id === movement.id ? (
                          /* Edit Form */
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setEditFormData({ ...editFormData, type: 'income' })}
                                className={`p-2 rounded border-2 transition-colors duration-200 ${
                                  editFormData.type === 'income'
                                    ? 'border-green-500 bg-green-50 text-green-700'
                                    : 'border-slate-300 hover:border-slate-400'
                                }`}
                              >
                                <TrendingUp className="h-4 w-4 mx-auto mb-1" />
                                <span className="text-xs">Ingreso</span>
                              </button>
                              <button
                                onClick={() => setEditFormData({ ...editFormData, type: 'expense' })}
                                className={`p-2 rounded border-2 transition-colors duration-200 ${
                                  editFormData.type === 'expense'
                                    ? 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-slate-300 hover:border-slate-400'
                                }`}
                              >
                                <TrendingDown className="h-4 w-4 mx-auto mb-1" />
                                <span className="text-xs">Gasto</span>
                              </button>
                            </div>
                            
                            <select
                              value={editFormData.category}
                              onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Seleccionar categoría</option>
                              {editFormData.type === 'income' ? (
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
                            
                            <FormattedNumberInput
                              value={editFormData.amount}
                              onChange={(value) => setEditFormData({ ...editFormData, amount: value })}
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Monto"
                              min="0"
                              max="9999999"
                            />
                            
                            <textarea
                              value={editFormData.description}
                              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                              rows={2}
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Descripción"
                            />
                            
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveMovement}
                                disabled={!editFormData.amount || !editFormData.description}
                                className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Guardar
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMovement(null);
                                  setEditFormData({ type: 'income', category: '', amount: '', description: '' });
                                }}
                                className="flex-1 bg-slate-200 text-slate-700 px-3 py-1 rounded text-sm hover:bg-slate-300 transition-colors duration-200 flex items-center justify-center"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Display Mode */
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {getMovementIcon(movement.type)}
                              <div>
                                <h5 className="font-medium text-slate-900 text-sm">
                                  {getMovementTypeLabel(movement.type)}
                                  {movement.category && ` - ${movement.category}`}
                                </h5>
                                <p className="text-xs text-slate-600">{movement.description}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                  <span className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {new Date(movement.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="flex items-center">
                                    <User className="h-3 w-3 mr-1" />
                                    {getUserName(movement.created_by, movement.created_by_user)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <p className={`font-bold text-sm ${
                                  movement.type === 'expense' ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {movement.type === 'expense' ? '-' : '+'}{formatCurrency(movement.amount)}
                                </p>
                              </div>
                              {/* Solo mostrar botones de edición para movimientos editables */}
                              {!['opening', 'closing', 'sale'].includes(movement.type) && user?.role === 'admin' && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEditMovement(movement)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                                    title="Editar movimiento"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMovement(movement.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                                    title="Eliminar movimiento"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sales */}
              <div className="p-6 border-t border-slate-200">
                <h4 className="font-medium text-slate-900 mb-4 flex items-center">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Ventas ({sales.length})
                </h4>
                
                {salesLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : sales.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No hay ventas registradas</p>
                ) : (
                  <div className="space-y-3">
                    {sales.map((sale) => (
                      <div key={sale.id} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <ShoppingCart className="h-4 w-4 text-green-600" />
                              <div>
                                <h5 className="font-medium text-slate-900 text-sm">
                                  Venta #{sale.id.slice(-8)}
                                </h5>
                                <p className="text-xs text-slate-600">
                                  {sale.sale_items.length} productos • {formatCurrency(sale.total_amount)}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                  <span className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {new Date(sale.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {sale.customer && (
                                    <span className="flex items-center">
                                      <User className="h-3 w-3 mr-1" />
                                      {sale.customer.name}
                                    </span>
                                  )}
                                  <span className={`px-2 py-1 rounded-full ${
                                    sale.payment_type === 'cash' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {sale.payment_type === 'cash' ? 'Efectivo' : 'Abonos'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {user?.role === 'admin' && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleEditSale(sale)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                                title="Editar venta"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteSale(sale.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                                title="Eliminar venta"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Calculator className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">Selecciona una sesión para ver los detalles</p>
            </div>
          )}
        </div>
      </div>

      {/* Sale Edit Modal */}
      {showSaleEditModal && editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Editar Venta #{editingSale.id.slice(-8)}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Modifica los detalles de la venta
              </p>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cliente
                </label>
                <select
                  value={saleEditData.customer_id}
                  onChange={(e) => setSaleEditData(prev => ({ ...prev, customer_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Cliente genérico</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo de Pago
                  </label>
                  <select
                    value={saleEditData.payment_type}
                    onChange={(e) => setSaleEditData(prev => ({ ...prev, payment_type: e.target.value as 'cash' | 'installment' }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="installment">Abonos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Estado de Pago
                  </label>
                  <select
                    value={saleEditData.payment_status}
                    onChange={(e) => setSaleEditData(prev => ({ ...prev, payment_status: e.target.value as 'pending' | 'partial' | 'paid' }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="partial">Parcial</option>
                    <option value="paid">Pagada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Total Pagado
                  </label>
                  <FormattedNumberInput
                    value={saleEditData.total_paid}
                    onChange={(value) => setSaleEditData(prev => ({ ...prev, total_paid: value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
                </div>
              </div>

              {/* Discount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descuento
                </label>
                <FormattedNumberInput
                  value={saleEditData.discount_amount}
                  onChange={(value) => setSaleEditData(prev => ({ ...prev, discount_amount: value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>

              {/* Sale Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-slate-900">Productos</h4>
                  <button
                    onClick={addSaleItem}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors duration-200 flex items-center"
                  >
                    <Package className="h-3 w-3 mr-1" />
                    Agregar Producto
                  </button>
                </div>
                
                <div className="space-y-3">
                  {saleEditData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 bg-slate-50 rounded-lg">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Producto
                        </label>
                        <select
                          value={item.product_id}
                          onChange={(e) => updateSaleItem(index, 'product_id', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Seleccionar producto</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} - {formatCurrency(product.sale_price)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Cantidad
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateSaleItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Precio Unitario
                        </label>
                        <FormattedNumberInput
                          value={item.unit_price.toString()}
                          onChange={(value) => updateSaleItem(index, 'unit_price', parseFloat(value) || 0)}
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Total
                        </label>
                        <div className="px-2 py-1 text-sm bg-slate-100 rounded border">
                          {formatCurrency(item.total_price)}
                        </div>
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => removeSaleItem(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                          title="Eliminar producto"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sale Summary */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-3">Resumen de Venta</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Subtotal:</span>
                    <p className="font-bold text-blue-900">
                      {formatCurrency(saleEditData.items.reduce((sum, item) => sum + item.total_price, 0))}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-700">Descuento:</span>
                    <p className="font-bold text-blue-900">
                      -{formatCurrency(parseFloat(saleEditData.discount_amount) || 0)}
                    </p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-blue-200">
                    <span className="text-blue-700">Total Final:</span>
                    <p className="font-bold text-blue-900 text-lg">
                      {formatCurrency(calculateSaleTotal())}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleSaveSale}
                disabled={saleEditData.items.length === 0 || saleEditData.items.some(item => !item.product_id)}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </button>
              <button
                onClick={() => {
                  setShowSaleEditModal(false);
                  setEditingSale(null);
                  setSaleEditData({
                    customer_id: '',
                    discount_amount: '0',
                    payment_type: 'cash',
                    payment_status: 'paid',
                    total_paid: '0',
                    items: []
                  });
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}