import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Package, Eye, Trash2, Search, Filter, User, Clock, AlertTriangle, CheckCircle, Activity, FileText, BarChart3, Edit2, Save, X, ShoppingCart, Users, CreditCard, Plus, Minus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CashRegisterWithUser, CashMovement, CashRegisterComprehensiveAudit, CashRegisterSalesDetail, Customer, Product } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';

export default function CashRegisterAudit() {
  const { user } = useAuth();
  const { notification, showSuccess, showError, showWarning, hideNotification } = useNotification();
  const { confirmation, showConfirmation, hideConfirmation, handleConfirm } = useConfirmation();
  
  const [registers, setRegisters] = useState<CashRegisterComprehensiveAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegister, setSelectedRegister] = useState<CashRegisterComprehensiveAudit | null>(null);
  const [salesDetail, setSalesDetail] = useState<CashRegisterSalesDetail[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'opened_at' | 'total_sales_amount' | 'discrepancy_amount'>('opened_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Edit modals
  const [editingRegister, setEditingRegister] = useState<CashRegisterComprehensiveAudit | null>(null);
  const [editingSale, setEditingSale] = useState<CashRegisterSalesDetail | null>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  
  // Form data
  const [registerEditData, setRegisterEditData] = useState({
    opening_amount: '',
    closing_amount: '',
    session_notes: '',
    discrepancy_reason: '',
  });
  
  const [saleEditData, setSaleEditData] = useState({
    total_amount: '',
    discount_amount: '',
    customer_id: '',
    payment_status: '',
    notes: '',
  });
  
  const [productEditData, setProductEditData] = useState({
    quantity: '',
    unit_price: '',
    discount: '',
  });

  useEffect(() => {
    loadAuditData();
    loadCustomers();
    loadProducts();
  }, []);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cash_register_comprehensive_audit')
        .select('*')
        .order('opened_at', { ascending: false });

      if (error) throw error;
      setRegisters(data as CashRegisterComprehensiveAudit[]);
    } catch (error) {
      console.error('Error loading audit data:', error);
      showError('Error de Carga', 'No se pudieron cargar los datos de auditoría');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadRegisterDetails = async (registerId: string) => {
    try {
      // Load sales detail
      const { data: salesData, error: salesError } = await supabase
        .from('cash_register_sales_detail')
        .select('*')
        .eq('cash_register_id', registerId)
        .order('sale_date', { ascending: false });

      if (salesError) throw salesError;
      setSalesDetail(salesData as CashRegisterSalesDetail[]);

      // Load movements
      const { data: movementsData, error: movementsError } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (movementsError) throw movementsError;
      setMovements(movementsData || []);
    } catch (error) {
      console.error('Error loading register details:', error);
      showError('Error de Carga', 'No se pudieron cargar los detalles del registro');
    }
  };

  const handleViewDetails = async (register: CashRegisterComprehensiveAudit) => {
    setSelectedRegister(register);
    await loadRegisterDetails(register.register_id);
  };

  const handleEditRegister = (register: CashRegisterComprehensiveAudit) => {
    setEditingRegister(register);
    setRegisterEditData({
      opening_amount: register.opening_amount.toString(),
      closing_amount: register.actual_closing_amount?.toString() || '',
      session_notes: register.session_notes || '',
      discrepancy_reason: register.discrepancy_reason || '',
    });
  };

  const handleUpdateRegister = async () => {
    if (!editingRegister) return;

    try {
      const { data, error } = await supabase.rpc('bulk_edit_cash_register', {
        register_id: editingRegister.register_id,
        new_opening_amount: parseFloat(registerEditData.opening_amount) || null,
        new_closing_amount: parseFloat(registerEditData.closing_amount) || null,
        new_session_notes: registerEditData.session_notes || null,
        new_discrepancy_reason: registerEditData.discrepancy_reason || null,
        performed_by_user: user?.id || null
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; changes_made: string[] };
      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar registro');
      }

      await loadAuditData();
      setEditingRegister(null);
      showSuccess(
        '¡Registro Actualizado!',
        `Se realizaron ${result.changes_made.length} cambios en el registro de caja`
      );
    } catch (error) {
      console.error('Error updating register:', error);
      showError(
        'Error al Actualizar',
        'No se pudo actualizar el registro: ' + (error as Error).message
      );
    }
  };

  const handleEditSale = (sale: CashRegisterSalesDetail) => {
    setEditingSale(sale);
    setSaleEditData({
      total_amount: sale.total_amount.toString(),
      discount_amount: sale.discount_amount?.toString() || '0',
      customer_id: sale.customer_id || '',
      payment_status: sale.payment_status || 'pending',
      notes: '',
    });
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;

    try {
      const { data, error } = await supabase.rpc('edit_cash_register_sale', {
        sale_id: editingSale.sale_id,
        new_total_amount: parseFloat(saleEditData.total_amount) || null,
        new_discount_amount: parseFloat(saleEditData.discount_amount) || null,
        new_customer_id: saleEditData.customer_id || null,
        new_payment_status: saleEditData.payment_status || null,
        new_notes: saleEditData.notes || null,
        performed_by_user: user?.id || null
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; changes_made: string[] };
      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar venta');
      }

      if (selectedRegister) {
        await loadRegisterDetails(selectedRegister.register_id);
      }
      await loadAuditData();
      setEditingSale(null);
      showSuccess(
        '¡Venta Actualizada!',
        `Se realizaron ${result.changes_made.length} cambios en la venta`
      );
    } catch (error) {
      console.error('Error updating sale:', error);
      showError(
        'Error al Actualizar',
        'No se pudo actualizar la venta: ' + (error as Error).message
      );
    }
  };

  const handleDeleteRegister = async (registerId: string) => {
    const register = registers.find(r => r.register_id === registerId);
    if (!register) return;

    showConfirmation(
      'Eliminar Registro de Caja',
      `¿Estás seguro de que quieres eliminar completamente el registro de caja #${registerId.slice(-8)}? 
      
      Esto eliminará:
      - ${register.total_sales_count} ventas
      - ${register.total_movements_count} movimientos
      - Todos los datos de auditoría relacionados
      
      Esta acción NO se puede deshacer.`,
      async () => {
        try {
          const { data, error } = await supabase.rpc('delete_cash_register_safely', {
            register_id: registerId
          });

          if (error) throw error;

          const result = data as { success: boolean; error?: string; deleted_sales: number; deleted_movements: number };
          if (!result.success) {
            throw new Error(result.error || 'Error al eliminar registro');
          }

          await loadAuditData();
          setSelectedRegister(null);
          showSuccess(
            '¡Registro Eliminado!',
            `Se eliminó el registro y ${result.deleted_sales} ventas, ${result.deleted_movements} movimientos asociados`
          );
        } catch (error) {
          console.error('Error deleting register:', error);
          showError(
            'Error al Eliminar',
            'No se pudo eliminar el registro: ' + (error as Error).message
          );
        }
      },
      {
        confirmText: 'Eliminar Completamente',
        cancelText: 'Cancelar',
        type: 'danger'
      }
    );
  };

  const handleDeleteSale = async (saleId: string) => {
    showConfirmation(
      'Eliminar Venta',
      '¿Estás seguro de que quieres eliminar esta venta? Esta acción no se puede deshacer.',
      async () => {
        try {
          const { error } = await supabase
            .from('sales')
            .delete()
            .eq('id', saleId);

          if (error) throw error;

          if (selectedRegister) {
            await loadRegisterDetails(selectedRegister.register_id);
          }
          await loadAuditData();
          showSuccess('¡Venta Eliminada!', 'La venta ha sido eliminada exitosamente');
        } catch (error) {
          console.error('Error deleting sale:', error);
          showError(
            'Error al Eliminar',
            'No se pudo eliminar la venta: ' + (error as Error).message
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

  const handleEditProduct = (sale: CashRegisterSalesDetail, product: any) => {
    setEditingProduct({ sale, product });
    setProductEditData({
      quantity: product.quantity.toString(),
      unit_price: product.unit_price.toString(),
      discount: '0',
    });
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    try {
      const { sale, product } = editingProduct;
      const newQuantity = parseInt(productEditData.quantity) || 0;
      const newUnitPrice = parseFloat(productEditData.unit_price) || 0;
      const newTotalPrice = newQuantity * newUnitPrice;

      // Update sale item
      const { error: itemError } = await supabase
        .from('sale_items')
        .update({
          quantity: newQuantity,
          unit_price: newUnitPrice,
          total_price: newTotalPrice
        })
        .eq('sale_id', sale.sale_id)
        .eq('product_id', product.product_id);

      if (itemError) throw itemError;

      // Recalculate sale total
      const { data: saleItems, error: itemsError } = await supabase
        .from('sale_items')
        .select('total_price')
        .eq('sale_id', sale.sale_id);

      if (itemsError) throw itemsError;

      const newSaleTotal = saleItems.reduce((sum, item) => sum + item.total_price, 0);

      // Update sale total
      const { error: saleError } = await supabase
        .from('sales')
        .update({
          total_amount: newSaleTotal,
          subtotal: newSaleTotal
        })
        .eq('id', sale.sale_id);

      if (saleError) throw saleError;

      if (selectedRegister) {
        await loadRegisterDetails(selectedRegister.register_id);
      }
      await loadAuditData();
      setEditingProduct(null);
      showSuccess('¡Producto Actualizado!', 'Los datos del producto han sido actualizados');
    } catch (error) {
      console.error('Error updating product:', error);
      showError(
        'Error al Actualizar',
        'No se pudo actualizar el producto: ' + (error as Error).message
      );
    }
  };

  const handleDeleteProduct = async (sale: CashRegisterSalesDetail, product: any) => {
    showConfirmation(
      'Eliminar Producto',
      `¿Estás seguro de que quieres eliminar "${product.product_name}" de esta venta?`,
      async () => {
        try {
          // Delete sale item
          const { error: itemError } = await supabase
            .from('sale_items')
            .delete()
            .eq('sale_id', sale.sale_id)
            .eq('product_id', product.product_id);

          if (itemError) throw itemError;

          // Recalculate sale total
          const { data: saleItems, error: itemsError } = await supabase
            .from('sale_items')
            .select('total_price')
            .eq('sale_id', sale.sale_id);

          if (itemsError) throw itemsError;

          if (saleItems.length === 0) {
            // If no items left, delete the entire sale
            await handleDeleteSale(sale.sale_id);
          } else {
            const newSaleTotal = saleItems.reduce((sum, item) => sum + item.total_price, 0);

            // Update sale total
            const { error: saleError } = await supabase
              .from('sales')
              .update({
                total_amount: newSaleTotal,
                subtotal: newSaleTotal
              })
              .eq('id', sale.sale_id);

            if (saleError) throw saleError;

            if (selectedRegister) {
              await loadRegisterDetails(selectedRegister.register_id);
            }
            await loadAuditData();
            showSuccess('¡Producto Eliminado!', 'El producto ha sido eliminado de la venta');
          }
        } catch (error) {
          console.error('Error deleting product:', error);
          showError(
            'Error al Eliminar',
            'No se pudo eliminar el producto: ' + (error as Error).message
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
      const registerId = register.register_id.slice(-8);
      const userName = register.operator_name?.toLowerCase() || '';
      const userEmail = register.operator_email?.toLowerCase() || '';
      
      return (
        registerId.includes(searchTerm) ||
        userName.includes(searchLower) ||
        userEmail.includes(searchLower) ||
        (register.session_notes || '').toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  }).sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    switch (sortBy) {
      case 'total_sales_amount':
        aValue = a.total_sales_amount || 0;
        bValue = b.total_sales_amount || 0;
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
    .map(userId => registers.find(r => r.user_id === userId))
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
              {uniqueUsers.map((register) => (
                <option key={register?.user_id} value={register?.user_id}>
                  {register?.operator_name}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'opened_at' | 'total_sales_amount' | 'discrepancy_amount')}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="opened_at">Ordenar por Fecha</option>
              <option value="total_sales_amount">Ordenar por Ventas</option>
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
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Resumen de Auditoría Avanzada</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-600">Total Registros</p>
              <p className="text-2xl font-bold text-blue-900">{filteredRegisters.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-600">Ventas Totales</p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(filteredRegisters.reduce((sum, register) => sum + (register.total_sales_amount || 0), 0))}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <p className="text-sm font-medium text-purple-600">Productos Vendidos</p>
              <p className="text-2xl font-bold text-purple-900">
                {filteredRegisters.reduce((sum, register) => sum + (register.total_items_sold || 0), 0)}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <p className="text-sm font-medium text-orange-600">Con Discrepancias</p>
              <p className="text-2xl font-bold text-orange-900">
                {filteredRegisters.filter(r => Math.abs(r.discrepancy_amount || 0) > 1).length}
              </p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
              <p className="text-sm font-medium text-indigo-600">Clientes Únicos</p>
              <p className="text-2xl font-bold text-indigo-900">
                {filteredRegisters.reduce((sum, register) => sum + (register.unique_customers_served || 0), 0)}
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
              <div key={register.register_id} className="p-6 hover:bg-slate-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 flex items-center">
                          <Activity className="h-4 w-4 mr-2 text-blue-600" />
                          Caja #{register.register_id.slice(-8)}
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
                          {register.operator_name && (
                            <span className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              {register.operator_name}
                            </span>
                          )}
                        </div>
                        
                        {/* Enhanced Financial Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-xs text-blue-600">Apertura</p>
                            <p className="font-bold text-blue-900">{formatCurrency(register.opening_amount)}</p>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg">
                            <p className="text-xs text-green-600">Ventas ({register.total_sales_count})</p>
                            <p className="font-bold text-green-900">{formatCurrency(register.total_sales_amount || 0)}</p>
                          </div>
                          <div className="bg-purple-50 p-3 rounded-lg">
                            <p className="text-xs text-purple-600">Productos ({register.total_items_sold})</p>
                            <p className="font-bold text-purple-900">{register.unique_products_sold} únicos</p>
                          </div>
                          <div className="bg-indigo-50 p-3 rounded-lg">
                            <p className="text-xs text-indigo-600">Clientes</p>
                            <p className="font-bold text-indigo-900">{register.unique_customers_served}</p>
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
                      title="Ver detalles completos"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditRegister(register)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                      title="Editar registro"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRegister(register.register_id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      title="Eliminar registro completo"
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

      {/* Edit Register Modal */}
      {editingRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Editar Registro #{editingRegister.register_id.slice(-8)}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Modifica los datos del registro de caja
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto de Apertura
                </label>
                <FormattedNumberInput
                  value={registerEditData.opening_amount}
                  onChange={(value) => setRegisterEditData({ ...registerEditData, opening_amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
              
              {editingRegister.status === 'closed' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Monto Real de Cierre
                  </label>
                  <FormattedNumberInput
                    value={registerEditData.closing_amount}
                    onChange={(value) => setRegisterEditData({ ...registerEditData, closing_amount: value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Esperado: {formatCurrency(editingRegister.expected_closing_amount)}
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas de Sesión
                </label>
                <textarea
                  value={registerEditData.session_notes}
                  onChange={(e) => setRegisterEditData({ ...registerEditData, session_notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notas sobre esta sesión de caja..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Razón de Discrepancia
                </label>
                <textarea
                  value={registerEditData.discrepancy_reason}
                  onChange={(e) => setRegisterEditData({ ...registerEditData, discrepancy_reason: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Explica cualquier discrepancia..."
                />
              </div>
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

      {/* Edit Sale Modal */}
      {editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Editar Venta #{editingSale.sale_id.slice(-8)}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Modifica los datos de la venta
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Total de la Venta
                </label>
                <FormattedNumberInput
                  value={saleEditData.total_amount}
                  onChange={(value) => setSaleEditData({ ...saleEditData, total_amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descuento
                </label>
                <FormattedNumberInput
                  value={saleEditData.discount_amount}
                  onChange={(value) => setSaleEditData({ ...saleEditData, discount_amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cliente
                </label>
                <select
                  value={saleEditData.customer_id}
                  onChange={(e) => setSaleEditData({ ...saleEditData, customer_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sin cliente específico</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.phone && `- ${customer.phone}`}
                    </option>
                  ))}
                </select>
              </div>
              
              {editingSale.payment_type === 'installment' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Estado de Pago
                  </label>
                  <select
                    value={saleEditData.payment_status}
                    onChange={(e) => setSaleEditData({ ...saleEditData, payment_status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="partial">Parcial</option>
                    <option value="paid">Pagada</option>
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas de Edición
                </label>
                <textarea
                  value={saleEditData.notes}
                  onChange={(e) => setSaleEditData({ ...saleEditData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Razón de la modificación..."
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleUpdateSale}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                Actualizar Venta
              </button>
              <button
                onClick={() => setEditingSale(null)}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Editar Producto: {editingProduct.product.product_name}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Venta #{editingProduct.sale.sale_id.slice(-8)}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cantidad
                </label>
                <FormattedNumberInput
                  value={productEditData.quantity}
                  onChange={(value) => setProductEditData({ ...productEditData, quantity: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Precio Unitario
                </label>
                <FormattedNumberInput
                  value={productEditData.unit_price}
                  onChange={(value) => setProductEditData({ ...productEditData, unit_price: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Total actual:</span>
                  <span className="font-bold">
                    {formatCurrency((parseFloat(productEditData.quantity) || 0) * (parseFloat(productEditData.unit_price) || 0))}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Total original:</span>
                  <span>{formatCurrency(editingProduct.product.total_price)}</span>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleUpdateProduct}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                Actualizar Producto
              </button>
              <button
                onClick={() => setEditingProduct(null)}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">
                Auditoría Detallada - Caja #{selectedRegister.register_id.slice(-8)}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Operador: {selectedRegister.operator_name} • {new Date(selectedRegister.opened_at).toLocaleDateString('es-ES')}
              </p>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              {/* Enhanced Register Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Información de Sesión</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Apertura:</span>
                      <span className="font-bold text-blue-900">{formatCurrency(selectedRegister.opening_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Duración:</span>
                      <span className="text-blue-800">{Math.round(selectedRegister.session_duration_minutes)} min</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">Ventas Realizadas</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-700">Total ventas:</span>
                      <span className="font-bold text-green-900">{selectedRegister.total_sales_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Monto:</span>
                      <span className="font-bold text-green-900">{formatCurrency(selectedRegister.total_sales_amount)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-2">Productos y Clientes</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-purple-700">Productos únicos:</span>
                      <span className="font-bold text-purple-900">{selectedRegister.unique_products_sold}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Clientes únicos:</span>
                      <span className="font-bold text-purple-900">{selectedRegister.unique_customers_served}</span>
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

              {/* Sales Detail with Edit/Delete capabilities */}
              <div className="mb-6">
                <h4 className="font-medium text-slate-900 mb-4 flex items-center">
                  <ShoppingCart className="h-5 w-5 mr-2 text-green-600" />
                  Ventas Detalladas ({salesDetail.length})
                </h4>
                {salesDetail.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">No hay ventas registradas</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {salesDetail.map((sale) => (
                      <div key={sale.sale_id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h5 className="font-medium text-slate-900">
                              Venta #{sale.sale_id.slice(-8)} - {formatCurrency(sale.total_amount)}
                            </h5>
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                              <span>{new Date(sale.sale_date).toLocaleTimeString('es-ES')}</span>
                              {sale.customer_name && (
                                <span className="flex items-center">
                                  <Users className="h-3 w-3 mr-1" />
                                  {sale.customer_name}
                                </span>
                              )}
                              <span className="flex items-center">
                                <CreditCard className="h-3 w-3 mr-1" />
                                {sale.payment_type === 'cash' ? 'Efectivo' : 'Abonos'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditSale(sale)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Editar venta"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSale(sale.sale_id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar venta"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Products in this sale */}
                        <div className="space-y-2">
                          <h6 className="text-sm font-medium text-slate-700">Productos vendidos:</h6>
                          {sale.products_detail.map((product: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                              <div className="flex-1">
                                <span className="text-sm font-medium text-slate-900">{product.product_name}</span>
                                <div className="text-xs text-slate-600">
                                  {product.quantity} × {formatCurrency(product.unit_price)} = {formatCurrency(product.total_price)}
                                  {product.category_name && ` • ${product.category_name}`}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleEditProduct(sale, product)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Editar producto"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(sale, product)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Eliminar producto"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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