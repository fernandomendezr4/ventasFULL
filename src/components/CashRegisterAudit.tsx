import React, { useState, useEffect } from 'react';
import { FileText, Calendar, User, Package, DollarSign, TrendingUp, TrendingDown, Eye, Edit2, Trash2, Search, Filter, Download, Printer, Building2, Users, Truck, ShoppingCart, CreditCard, AlertTriangle, CheckCircle, Clock, X, Save, Phone, Mail, MapPin, Tag, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';

interface CashRegisterSummary {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
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
  session_duration_minutes: number;
}

interface DetailedSale {
  id: string;
  total_amount: number;
  subtotal: number;
  discount_amount: number;
  payment_type: string;
  payment_status: string;
  created_at: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string;
    cedula: string;
    address: string;
  } | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  sale_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    product: {
      id: string;
      name: string;
      barcode: string;
      purchase_price: number;
      category: {
        name: string;
      } | null;
      supplier: {
        name: string;
        contact_person: string;
        phone: string;
      } | null;
    };
  }>;
  payments: Array<{
    payment_method: string;
    notes: string;
  }>;
}

interface DetailedInstallment {
  id: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  notes: string;
  sale: {
    id: string;
    total_amount: number;
    customer: {
      name: string;
      phone: string;
      email: string;
    } | null;
  };
}

interface MovementWithDetails {
  id: string;
  cash_register_id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  created_at: string;
  created_by: string;
  created_by_name: string;
  reference_id?: string;
}

export default function CashRegisterAudit() {
  const { user } = useAuth();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const { confirmation, showConfirmation, hideConfirmation, handleConfirm } = useConfirmation();
  
  const [registers, setRegisters] = useState<CashRegisterSummary[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<CashRegisterSummary | null>(null);
  const [detailedSales, setDetailedSales] = useState<DetailedSale[]>([]);
  const [detailedInstallments, setDetailedInstallments] = useState<DetailedInstallment[]>([]);
  const [movements, setMovements] = useState<MovementWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'sales' | 'installments' | 'movements' | 'products'>('overview');

  useEffect(() => {
    loadCashRegisters();
  }, []);

  const loadCashRegisters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cash_register_history_summary')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRegisters(data || []);
    } catch (error) {
      console.error('Error loading cash registers:', error);
      showError('Error', 'No se pudieron cargar los registros de caja');
    } finally {
      setLoading(false);
    }
  };

  const loadRegisterDetails = async (registerId: string) => {
    try {
      setLoadingDetails(true);
      
      // Cargar ventas detalladas
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(*),
          user:users(id, name, email),
          sale_items(
            *,
            product:products(
              *,
              category:categories(name),
              supplier:suppliers(name, contact_person, phone)
            )
          ),
          payments(payment_method, notes)
        `)
        .in('id', 
          await supabase
            .from('cash_register_sales')
            .select('sale_id')
            .eq('cash_register_id', registerId)
            .then(({ data }) => data?.map(item => item.sale_id) || [])
        );

      if (salesError) throw salesError;

      // Cargar abonos detallados
      const { data: installmentsData, error: installmentsError } = await supabase
        .from('payment_installments')
        .select(`
          *,
          sale:sales(
            id,
            total_amount,
            customer:customers(name, phone, email)
          )
        `)
        .in('id',
          await supabase
            .from('cash_register_installments')
            .select('installment_id')
      const userIds = [...new Set(movements?.map(m => m.created_by).filter(Boolean) || [])];
            .then(({ data }) => data?.map(item => item.installment_id) || [])
        );

      if (installmentsError) throw installmentsError;

      // Cargar movimientos
      const { data: movementsData, error: movementsError } = await supabase
        .from('cash_movements')
        .select(`
          *,
          users!inner(name)
        .select('*')
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (movementsError) throw movementsError;

      const enrichedMovements: MovementWithDetails[] = (movementsData || []).map(movement => ({
        ...movement,
        created_by_name: movement.users?.name || 'Sistema'
      }));

      setDetailedSales(salesData as DetailedSale[] || []);
      setDetailedInstallments(installmentsData as DetailedInstallment[] || []);
      setMovements(enrichedMovements);

    } catch (error) {
      console.error('Error loading register details:', error);
      showError('Error', 'No se pudieron cargar los detalles del registro');
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredRegisters = registers.filter(register => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const operatorName = register.user_name?.toLowerCase() || '';
      const registerId = register.id?.slice(-8) || '';
      
      if (!(operatorName.includes(searchLower) || registerId.includes(searchTerm))) {
        return false;
      }
    }
    
    if (dateFilter && !register.opened_at?.startsWith(dateFilter)) {
      return false;
    }
    
    if (statusFilter !== 'all' && register.status !== statusFilter) {
      return false;
    }
    
    return true;
  });

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return <ShoppingCart className="h-4 w-4 text-green-600" />;
      case 'income':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'expense':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'opening':
        return <CheckCircle className="h-4 w-4 text-purple-600" />;
      case 'closing':
        return <Clock className="h-4 w-4 text-gray-600" />;
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

  const getPaymentMethodName = (sale: DetailedSale) => {
    if (sale.payment_type === 'installment') return 'Abonos';
    
    if (sale.payments && sale.payments.length > 0) {
      const payment = sale.payments[0];
      if (payment.payment_method === 'other' && payment.notes?.includes('NEQUI')) {
        return 'NEQUI';
      }
      switch (payment.payment_method) {
        case 'cash': return 'Efectivo';
        case 'card': return 'Tarjeta';
        case 'transfer': return 'Transferencia';
        default: return payment.payment_method;
      }
    }
    
    return 'Efectivo';
  };

  const calculateSaleProfit = (sale: DetailedSale) => {
    return sale.sale_items.reduce((total, item) => {
      const profit = (item.unit_price - (item.product.purchase_price || 0)) * item.quantity;
      return total + profit;
    }, 0);
  };

  const exportToCSV = () => {
    if (!selectedRegister) return;

    const csvData = [
      // Información general
      ['INFORMACIÓN GENERAL'],
      ['Caja ID', selectedRegister.id.slice(-8)],
      ['Operador', selectedRegister.user_name],
      ['Email Operador', selectedRegister.user_email],
      ['Fecha Apertura', new Date(selectedRegister.opened_at).toLocaleDateString('es-ES')],
      ['Hora Apertura', new Date(selectedRegister.opened_at).toLocaleTimeString('es-ES')],
      ['Fecha Cierre', selectedRegister.closed_at ? new Date(selectedRegister.closed_at).toLocaleDateString('es-ES') : 'No cerrada'],
      ['Hora Cierre', selectedRegister.closed_at ? new Date(selectedRegister.closed_at).toLocaleTimeString('es-ES') : 'No cerrada'],
      ['Duración (minutos)', selectedRegister.session_duration_minutes || 0],
      ['Estado', selectedRegister.status === 'open' ? 'Abierta' : 'Cerrada'],
      [''],
      
      // Resumen financiero
      ['RESUMEN FINANCIERO'],
      ['Monto Apertura', selectedRegister.opening_amount],
      ['Total Ventas', selectedRegister.total_sales_amount],
      ['Total Abonos', selectedRegister.total_installments_amount],
      ['Total Ingresos', selectedRegister.total_income],
      ['Total Gastos', selectedRegister.total_expenses],
      ['Balance Calculado', selectedRegister.calculated_balance],
      ['Monto Cierre Real', selectedRegister.actual_closing_amount],
      ['Discrepancia', selectedRegister.discrepancy_amount],
      [''],
      
      // Ventas detalladas
      ['VENTAS DETALLADAS'],
      ['ID Venta', 'Fecha', 'Hora', 'Cliente', 'Teléfono Cliente', 'Vendedor', 'Método Pago', 'Subtotal', 'Descuento', 'Total', 'Estado', 'Productos', 'Ganancia Total'],
      ...detailedSales.map(sale => [
        sale.id.slice(-8),
        new Date(sale.created_at).toLocaleDateString('es-ES'),
        new Date(sale.created_at).toLocaleTimeString('es-ES'),
        sale.customer?.name || 'Cliente genérico',
        sale.customer?.phone || '',
        sale.user?.name || '',
        getPaymentMethodName(sale),
        sale.subtotal || sale.total_amount,
        sale.discount_amount || 0,
        sale.total_amount,
        sale.payment_status === 'paid' ? 'Pagada' : sale.payment_status === 'partial' ? 'Parcial' : 'Pendiente',
        sale.sale_items.length,
        calculateSaleProfit(sale)
      ]),
      [''],
      
      // Productos vendidos
      ['PRODUCTOS VENDIDOS'],
      ['Producto', 'Código', 'Categoría', 'Proveedor', 'Cantidad', 'Precio Unitario', 'Precio Compra', 'Total Venta', 'Ganancia Unitaria', 'Ganancia Total', 'Cliente', 'Fecha Venta'],
      ...detailedSales.flatMap(sale => 
        sale.sale_items.map(item => [
          item.product.name,
          item.product.barcode || '',
          item.product.category?.name || 'Sin categoría',
          item.product.supplier?.name || 'Sin proveedor',
          item.quantity,
          item.unit_price,
          item.product.purchase_price || 0,
          item.total_price,
          item.unit_price - (item.product.purchase_price || 0),
          (item.unit_price - (item.product.purchase_price || 0)) * item.quantity,
          sale.customer?.name || 'Cliente genérico',
          new Date(sale.created_at).toLocaleDateString('es-ES')
        ])
      ),
      [''],
      
      // Abonos
      ['ABONOS RECIBIDOS'],
      ['ID Abono', 'Fecha', 'Hora', 'Cliente', 'Teléfono', 'Monto', 'Método', 'Venta Original', 'Notas'],
      ...detailedInstallments.map(installment => [
        installment.id.slice(-8),
        new Date(installment.payment_date).toLocaleDateString('es-ES'),
        new Date(installment.payment_date).toLocaleTimeString('es-ES'),
        installment.sale.customer?.name || 'Cliente genérico',
        installment.sale.customer?.phone || '',
        installment.amount_paid,
        installment.payment_method === 'cash' ? 'Efectivo' : installment.payment_method,
        installment.sale.id.slice(-8),
        installment.notes || ''
      ])
    ];

    const csvContent = csvData.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria_detallada_caja_${selectedRegister?.id?.slice(-8)}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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

  if (selectedRegister) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">
              Auditoría Detallada - Caja #{selectedRegister.id?.slice(-8)}
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Operador: {selectedRegister.user_name} • 
              {new Date(selectedRegister.opened_at).toLocaleDateString('es-ES')} • 
              {selectedRegister.status === 'open' ? 'Abierta' : 'Cerrada'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </button>
            <button
              onClick={() => {
                setSelectedRegister(null);
                setDetailedSales([]);
                setDetailedInstallments([]);
                setMovements([]);
              }}
              className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
            >
              Volver
            </button>
          </div>
        </div>

        {/* Información del Operador */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <User className="h-5 w-5 mr-2 text-blue-600" />
            Información del Operador
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-600">Operador</p>
                  <p className="text-lg font-bold text-blue-900">{selectedRegister.user_name}</p>
                  <p className="text-xs text-blue-700">{selectedRegister.user_email}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-600">Duración Sesión</p>
                  <p className="text-lg font-bold text-green-900">
                    {Math.floor((selectedRegister.session_duration_minutes || 0) / 60)}h {(selectedRegister.session_duration_minutes || 0) % 60}m
                  </p>
                  <p className="text-xs text-green-700">
                    {new Date(selectedRegister.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - 
                    {selectedRegister.closed_at ? new Date(selectedRegister.closed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Abierta'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-purple-600">Actividad</p>
                  <p className="text-lg font-bold text-purple-900">
                    {selectedRegister.total_sales_count + selectedRegister.total_installments_count}
                  </p>
                  <p className="text-xs text-purple-700">
                    {selectedRegister.total_sales_count} ventas, {selectedRegister.total_installments_count} abonos
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen Financiero */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-green-600" />
            Resumen Financiero
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-600">Apertura</p>
              <p className="text-xl font-bold text-blue-900">{formatCurrency(selectedRegister.opening_amount || 0)}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-600">Ventas + Abonos</p>
              <p className="text-xl font-bold text-green-900">
                {formatCurrency((selectedRegister.total_sales_amount || 0) + (selectedRegister.total_installments_amount || 0))}
              </p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-sm text-red-600">Gastos</p>
              <p className="text-xl font-bold text-red-900">{formatCurrency(selectedRegister.total_expenses || 0)}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-600">Balance Final</p>
              <p className="text-xl font-bold text-purple-900">{formatCurrency(selectedRegister.calculated_balance || 0)}</p>
              {selectedRegister.discrepancy_amount && Math.abs(selectedRegister.discrepancy_amount) > 0 && (
                <p className={`text-xs font-medium ${selectedRegister.discrepancy_amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedRegister.discrepancy_amount > 0 ? 'Sobrante' : 'Faltante'}: {formatCurrency(Math.abs(selectedRegister.discrepancy_amount))}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs de Navegación */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="border-b border-slate-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Resumen', icon: FileText },
                { id: 'sales', label: `Ventas (${detailedSales.length})`, icon: ShoppingCart },
                { id: 'installments', label: `Abonos (${detailedInstallments.length})`, icon: CreditCard },
                { id: 'products', label: 'Productos Vendidos', icon: Package },
                { id: 'movements', label: `Movimientos (${movements.length})`, icon: TrendingUp }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setSelectedTab(tab.id as any);
                      if (detailedSales.length === 0 && detailedInstallments.length === 0) {
                        loadRegisterDetails(selectedRegister.id);
                      }
                    }}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                      selectedTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {loadingDetails ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Cargando detalles...</p>
              </div>
            ) : (
              <>
                {/* Tab: Resumen */}
                {selectedTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <h5 className="font-medium text-slate-900 mb-3">Estadísticas de Ventas</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Ventas en efectivo:</span>
                            <span className="font-medium">{selectedRegister.cash_sales_count} ({formatCurrency(selectedRegister.cash_sales_amount || 0)})</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Abonos recibidos:</span>
                            <span className="font-medium">{selectedRegister.total_installments_count} ({formatCurrency(selectedRegister.total_installments_amount || 0)})</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total transacciones:</span>
                            <span className="font-medium">{selectedRegister.total_sales_count + selectedRegister.total_installments_count}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span>Ingresos totales:</span>
                            <span className="font-bold text-green-600">
                              {formatCurrency((selectedRegister.total_sales_amount || 0) + (selectedRegister.total_installments_amount || 0) + (selectedRegister.total_income || 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <h5 className="font-medium text-slate-900 mb-3">Información de Sesión</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Fecha apertura:</span>
                            <span className="font-medium">{new Date(selectedRegister.opened_at).toLocaleDateString('es-ES')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Hora apertura:</span>
                            <span className="font-medium">{new Date(selectedRegister.opened_at).toLocaleTimeString('es-ES')}</span>
                          </div>
                          {selectedRegister.closed_at && (
                            <>
                              <div className="flex justify-between">
                                <span>Fecha cierre:</span>
                                <span className="font-medium">{new Date(selectedRegister.closed_at).toLocaleDateString('es-ES')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Hora cierre:</span>
                                <span className="font-medium">{new Date(selectedRegister.closed_at).toLocaleTimeString('es-ES')}</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between">
                            <span>Estado:</span>
                            <span className={`font-medium ${selectedRegister.status === 'open' ? 'text-green-600' : 'text-slate-600'}`}>
                              {selectedRegister.status === 'open' ? 'Abierta' : 'Cerrada'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {selectedRegister.session_notes && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h5 className="font-medium text-blue-900 mb-2">Notas de Sesión</h5>
                        <p className="text-blue-800">{selectedRegister.session_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Ventas */}
                {selectedTab === 'sales' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-slate-900">Ventas Realizadas ({detailedSales.length})</h5>
                      <div className="text-sm text-slate-600">
                        Total: {formatCurrency(detailedSales.reduce((sum, sale) => sum + sale.total_amount, 0))}
                      </div>
                    </div>
                    
                    {detailedSales.length === 0 ? (
                      <div className="text-center py-8">
                        <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500">No hay ventas registradas en esta caja</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {detailedSales.map((sale) => (
                          <div key={sale.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h6 className="font-medium text-slate-900">
                                  Venta #{sale.id.slice(-8)}
                                  <span className={`ml-2 inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                    sale.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                                    sale.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {sale.payment_status === 'paid' ? 'Pagada' : 
                                     sale.payment_status === 'partial' ? 'Parcial' : 'Pendiente'}
                                  </span>
                                </h6>
                                <p className="text-sm text-slate-600">
                                  {new Date(sale.created_at).toLocaleDateString('es-ES')} a las {new Date(sale.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-slate-900">{formatCurrency(sale.total_amount)}</p>
                                <p className="text-sm text-green-600">
                                  Ganancia: {formatCurrency(calculateSaleProfit(sale))}
                                </p>
                              </div>
                            </div>

                            {/* Información del Cliente */}
                            {sale.customer && (
                              <div className="bg-blue-50 p-3 rounded-lg mb-3 border border-blue-200">
                                <h7 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                                  <Users className="h-4 w-4 mr-1" />
                                  Cliente
                                </h7>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-blue-700 font-medium">{sale.customer.name}</span>
                                    {sale.customer.cedula && <p className="text-blue-600">CC: {sale.customer.cedula}</p>}
                                  </div>
                                  <div>
                                    {sale.customer.phone && (
                                      <p className="text-blue-600 flex items-center">
                                        <Phone className="h-3 w-3 mr-1" />
                                        {sale.customer.phone}
                                      </p>
                                    )}
                                    {sale.customer.email && (
                                      <p className="text-blue-600 flex items-center">
                                        <Mail className="h-3 w-3 mr-1" />
                                        {sale.customer.email}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Información del Vendedor */}
                            {sale.user && (
                              <div className="bg-green-50 p-3 rounded-lg mb-3 border border-green-200">
                                <h7 className="text-sm font-medium text-green-900 mb-1 flex items-center">
                                  <User className="h-4 w-4 mr-1" />
                                  Vendedor: {sale.user.name}
                                </h7>
                                <p className="text-sm text-green-700">{sale.user.email}</p>
                              </div>
                            )}

                            {/* Productos Vendidos */}
                            <div className="bg-slate-50 rounded-lg border">
                              <div className="p-3 border-b bg-slate-100 rounded-t-lg">
                                <h7 className="text-sm font-medium text-slate-700 flex items-center">
                                  <Package className="h-4 w-4 mr-1" />
                                  Productos Vendidos ({sale.sale_items.length})
                                </h7>
                              </div>
                              <div className="max-h-48 overflow-y-auto">
                                {sale.sale_items.map((item, index) => (
                                  <div key={index} className="p-3 border-b border-slate-200 last:border-b-0">
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <h8 className="font-medium text-slate-900">{item.product.name}</h8>
                                          {item.product.barcode && (
                                            <span className="text-xs bg-slate-200 px-2 py-1 rounded font-mono">
                                              {item.product.barcode}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-600">
                                          <span className="flex items-center">
                                            <Tag className="h-3 w-3 mr-1" />
                                            {item.product.category?.name || 'Sin categoría'}
                                          </span>
                                          {item.product.supplier && (
                                            <span className="flex items-center">
                                              <Truck className="h-3 w-3 mr-1" />
                                              {item.product.supplier.name}
                                              {item.product.supplier.contact_person && ` (${item.product.supplier.contact_person})`}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-xs">
                                          <span className="text-slate-600">
                                            {item.quantity} × {formatCurrency(item.unit_price)} = {formatCurrency(item.total_price)}
                                          </span>
                                          <span className="text-green-600">
                                            Ganancia: {formatCurrency((item.unit_price - (item.product.purchase_price || 0)) * item.quantity)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Información de Pago */}
                            <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center">
                                  <CreditCard className="h-4 w-4 mr-2 text-purple-600" />
                                  <span className="text-purple-700">Método de pago: {getPaymentMethodName(sale)}</span>
                                </div>
                                <div className="text-right">
                                  {sale.discount_amount && sale.discount_amount > 0 && (
                                    <p className="text-orange-600">Descuento: {formatCurrency(sale.discount_amount)}</p>
                                  )}
                                  <p className="font-bold text-purple-900">Total: {formatCurrency(sale.total_amount)}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Abonos */}
                {selectedTab === 'installments' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-slate-900">Abonos Recibidos ({detailedInstallments.length})</h5>
                      <div className="text-sm text-slate-600">
                        Total: {formatCurrency(detailedInstallments.reduce((sum, inst) => sum + inst.amount_paid, 0))}
                      </div>
                    </div>
                    
                    {detailedInstallments.length === 0 ? (
                      <div className="text-center py-8">
                        <CreditCard className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500">No hay abonos registrados en esta caja</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {detailedInstallments.map((installment) => (
                          <div key={installment.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h6 className="font-medium text-slate-900">
                                  Abono #{installment.id.slice(-8)}
                                  <span className="ml-2 text-sm text-slate-600">
                                    → Venta #{installment.sale.id.slice(-8)}
                                  </span>
                                </h6>
                                <p className="text-sm text-slate-600">
                                  {new Date(installment.payment_date).toLocaleDateString('es-ES')} a las {new Date(installment.payment_date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-green-600">{formatCurrency(installment.amount_paid)}</p>
                                <p className="text-sm text-slate-600">
                                  {installment.payment_method === 'cash' ? 'Efectivo' : installment.payment_method}
                                </p>
                              </div>
                            </div>

                            {/* Información del Cliente */}
                            {installment.sale.customer && (
                              <div className="bg-blue-50 p-3 rounded-lg mb-3 border border-blue-200">
                                <h7 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                                  <Users className="h-4 w-4 mr-1" />
                                  Cliente
                                </h7>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-blue-700 font-medium">{installment.sale.customer.name}</span>
                                  </div>
                                  <div>
                                    {installment.sale.customer.phone && (
                                      <p className="text-blue-600 flex items-center">
                                        <Phone className="h-3 w-3 mr-1" />
                                        {installment.sale.customer.phone}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Información de la Venta Original */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">Venta original:</span>
                                <span className="font-medium">{formatCurrency(installment.sale.total_amount)}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">Este abono:</span>
                                <span className="font-medium text-green-600">{formatCurrency(installment.amount_paid)}</span>
                              </div>
                              {installment.notes && (
                                <div className="mt-2 text-xs text-slate-600">
                                  <span className="font-medium">Notas:</span> {installment.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Productos */}
                {selectedTab === 'products' && (
                  <div className="space-y-4">
                    <h5 className="font-medium text-slate-900">Análisis de Productos Vendidos</h5>
                    
                    {detailedSales.length === 0 ? (
                      <div className="text-center py-8">
                        <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500">No hay productos vendidos en esta caja</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Resumen de productos */}
                        {(() => {
                          const productSummary = new Map();
                          detailedSales.forEach(sale => {
                            sale.sale_items.forEach(item => {
                              const key = item.product.id;
                              if (productSummary.has(key)) {
                                const existing = productSummary.get(key);
                                existing.quantity += item.quantity;
                                existing.totalRevenue += item.total_price;
                                existing.totalProfit += (item.unit_price - (item.product.purchase_price || 0)) * item.quantity;
                                existing.sales += 1;
                              } else {
                                productSummary.set(key, {
                                  product: item.product,
                                  quantity: item.quantity,
                                  totalRevenue: item.total_price,
                                  totalProfit: (item.unit_price - (item.product.purchase_price || 0)) * item.quantity,
                                  sales: 1,
                                  unitPrice: item.unit_price
                                });
                              }
                            });
                          });

                          const sortedProducts = Array.from(productSummary.values())
                            .sort((a, b) => b.totalRevenue - a.totalRevenue);

                          return (
                            <div className="grid grid-cols-1 gap-4">
                              {sortedProducts.map((summary, index) => (
                                <div key={summary.product.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <h6 className="font-medium text-slate-900">{summary.product.name}</h6>
                                        {summary.product.barcode && (
                                          <span className="text-xs bg-slate-200 px-2 py-1 rounded font-mono">
                                            {summary.product.barcode}
                                          </span>
                                        )}
                                        {index < 3 && (
                                          <Star className="h-4 w-4 text-yellow-500" />
                                        )}
                                      </div>
                                      
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                          <span className="text-slate-600">Cantidad vendida:</span>
                                          <p className="font-bold text-slate-900">{summary.quantity} unidades</p>
                                        </div>
                                        <div>
                                          <span className="text-slate-600">Ventas realizadas:</span>
                                          <p className="font-bold text-slate-900">{summary.sales} ventas</p>
                                        </div>
                                        <div>
                                          <span className="text-slate-600">Ingresos totales:</span>
                                          <p className="font-bold text-green-600">{formatCurrency(summary.totalRevenue)}</p>
                                        </div>
                                        <div>
                                          <span className="text-slate-600">Ganancia total:</span>
                                          <p className="font-bold text-blue-600">{formatCurrency(summary.totalProfit)}</p>
                                        </div>
                                      </div>
                                      
                                      <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
                                        <span className="flex items-center">
                                          <Tag className="h-3 w-3 mr-1" />
                                          {summary.product.category?.name || 'Sin categoría'}
                                        </span>
                                        {summary.product.supplier && (
                                          <span className="flex items-center">
                                            <Truck className="h-3 w-3 mr-1" />
                                            {summary.product.supplier.name}
                                          </span>
                                        )}
                                        <span>Precio: {formatCurrency(summary.unitPrice)}</span>
                                        <span>Costo: {formatCurrency(summary.product.purchase_price || 0)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Movimientos */}
                {selectedTab === 'movements' && (
                  <div className="space-y-4">
                    <h5 className="font-medium text-slate-900">Todos los Movimientos ({movements.length})</h5>
                    
                    {movements.length === 0 ? (
                      <div className="text-center py-8">
                        <TrendingUp className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500">No hay movimientos registrados</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {movements.map((movement) => (
                          <div key={movement.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getMovementIcon(movement.type)}
                                <div>
                                  <h6 className="font-medium text-slate-900">
                                    {getMovementTypeLabel(movement.type)}
                                    {movement.category && ` - ${movement.category}`}
                                  </h6>
                                  <p className="text-sm text-slate-600">{movement.description}</p>
                                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                    <span className="flex items-center">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {new Date(movement.created_at).toLocaleDateString('es-ES')} {new Date(movement.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="flex items-center">
                                      <User className="h-3 w-3 mr-1" />
                                      {movement.created_by_name}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-lg font-bold ${
                                  movement.type === 'expense' ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {movement.type === 'expense' ? '-' : '+'}{formatCurrency(movement.amount)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Auditoría de Cajas</h2>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por operador o ID de caja..."
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
          </div>
        </div>
        {(searchTerm || dateFilter || statusFilter !== 'all') && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredRegisters.length} de {registers.length} registros
          </div>
        )}
      </div>

      {/* Registers List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredRegisters.length === 0 ? (
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
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          Caja #{register.id?.slice(-8)}
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            register.status === 'open' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {register.status === 'open' ? 'Abierta' : 'Cerrada'}
                          </span>
                        </h3>
                        <p className="text-sm text-slate-600">
                          Operador: {register.user_name} ({register.user_email}) • 
                          {new Date(register.opened_at).toLocaleDateString('es-ES')} • 
                          Duración: {Math.round((register.session_duration_minutes || 0) / 60)}h {(register.session_duration_minutes || 0) % 60}m
                        </p>
                        <div className="flex items-center gap-6 mt-2 text-sm text-slate-600">
                          <span className="flex items-center">
                            <ShoppingCart className="h-4 w-4 mr-1 text-green-600" />
                            {register.total_sales_count || 0} ventas ({formatCurrency(register.total_sales_amount || 0)})
                          </span>
                          <span className="flex items-center">
                            <CreditCard className="h-4 w-4 mr-1 text-blue-600" />
                            {register.total_installments_count || 0} abonos ({formatCurrency(register.total_installments_amount || 0)})
                          </span>
                          <span className="flex items-center">
                            <FileText className="h-4 w-4 mr-1 text-purple-600" />
                            {register.total_movements || 0} movimientos
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">
                          {formatCurrency(register.calculated_balance || 0)}
                        </p>
                        <p className="text-sm text-slate-600">Balance calculado</p>
                        {register.discrepancy_amount && Math.abs(register.discrepancy_amount) > 0 && (
                          <p className={`text-sm font-medium ${
                            register.discrepancy_amount > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {register.discrepancy_amount > 0 ? 'Sobrante' : 'Faltante'}: {formatCurrency(Math.abs(register.discrepancy_amount))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedRegister(register);
                        setSelectedTab('overview');
                        loadRegisterDetails(register.id);
                      }}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                      title="Ver auditoría detallada"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}