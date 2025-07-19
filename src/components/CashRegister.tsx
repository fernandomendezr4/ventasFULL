import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, TrendingUp, Clock, User, Plus, Minus, Eye, Edit2, Trash2, X, AlertTriangle, CheckCircle, Package, ShoppingCart, Calendar, Banknote, CreditCard, Building2, Smartphone, FileText, BarChart3, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CashRegister as CashRegisterType, CashMovement, SaleWithItems, CashRegisterDiscrepancyCalculation, DetailedCashRegisterReport, CashRegisterDiscrepancy, CashRegisterAudit } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import FormattedNumberInput from './FormattedNumberInput';
import { useAuth } from '../contexts/AuthContext';
import NotificationModal from './NotificationModal';
import ConfirmationModal from './ConfirmationModal';
import { useNotification } from '../hooks/useNotification';
import { useConfirmation } from '../hooks/useConfirmation';

interface CashRegisterWithUser extends CashRegisterType {
  user: UserType | null;
  current_balance?: number;
  total_income?: number;
  total_expenses?: number;
}

interface CashRegisterWithMovements extends CashRegisterWithUser {
  cash_movements: CashMovement[];
  sales_details?: SaleDetail[];
}

interface SaleDetail {
  id: string;
  total_amount: number;
  payment_type: string;
  payment_method?: string;
  created_at: string;
  customer_name?: string;
  items_count: number;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export default function CashRegister() {
  const { user: currentUser } = useAuth();
  const { notification, showSuccess, showError, showWarning, hideNotification } = useNotification();
  const { confirmation, showConfirmation, hideConfirmation, handleConfirm } = useConfirmation();
  const [currentRegister, setCurrentRegister] = useState<CashRegisterWithMovements | null>(null);
  const [registers, setRegisters] = useState<CashRegisterWithUser[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [salesDetails, setSalesDetails] = useState<SaleDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [showSalesDetailModal, setShowSalesDetailModal] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [editingMovement, setEditingMovement] = useState<CashMovement | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  
  const [openFormData, setOpenFormData] = useState({
    opening_amount: '',
    notes: '',
  });
  
  const [closeFormData, setCloseFormData] = useState({
    closing_amount: '',
    notes: '',
  });

  const [incomeFormData, setIncomeFormData] = useState({
    amount: '',
    category: 'ingresos_adicionales',
    description: '',
  });

  const [expenseFormData, setExpenseFormData] = useState({
    amount: '',
    category: 'gastos_operativos',
    description: '',
  });

  // Estado para revisión de caja
  const [reviewFormData, setReviewFormData] = useState({
    actual_amount: '',
    review_notes: ''
  });

  // Categorías para ingresos y egresos
  const incomeCategories = {
    'ingresos_adicionales': 'Ingresos Adicionales',
    'devoluciones': 'Devoluciones de Proveedores',
    'otros_ingresos': 'Otros Ingresos',
  };

  const expenseCategories = {
    'gastos_operativos': 'Gastos Operativos',
    'servicios_publicos': 'Servicios Públicos',
    'mantenimiento': 'Mantenimiento',
    'compras_inventario': 'Compras de Inventario',
    'gastos_personal': 'Gastos de Personal',
    'otros_gastos': 'Otros Gastos',
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCurrentRegister(),
        loadRegisters(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentRegister = async () => {
    try {
      if (!currentUser) return;

      // Cada usuario solo ve su propia caja abierta
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          *,
          user:users(*)
        `)
        .eq('status', 'open')
        .eq('user_id', currentUser.id)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Cargar movimientos de la caja actual
        await loadMovements(data.id);
        
        // Cargar detalles de ventas
        await loadSalesDetails(data.id);
        
        // Calcular balance actual basado en movimientos
        const movementsData = await getMovements(data.id);
        const totalIncome = movementsData
          .filter(m => m.type === 'income' || m.type === 'opening' || m.type === 'sale')
          .reduce((sum, m) => sum + m.amount, 0);
        const totalExpenses = movementsData
          .filter(m => m.type === 'expense')
          .reduce((sum, m) => sum + m.amount, 0);
        
        const currentBalance = totalIncome - totalExpenses;
        
        // Calcular ganancias de ventas
        const salesMovements = movementsData.filter(m => m.type === 'sale');
        const totalSalesAmount = salesMovements.reduce((sum, m) => sum + m.amount, 0);
        
        const registerWithBalance = {
          ...data,
          current_balance: currentBalance,
          total_income: totalIncome - (data.opening_amount || 0),
          total_expenses: totalExpenses,
          total_sales_amount: totalSalesAmount,
          cash_movements: movementsData,
          sales_details: salesDetails
        };
        setCurrentRegister(registerWithBalance as CashRegisterWithMovements);
      } else {
        setCurrentRegister(null);
        setMovements([]);
        setSalesDetails([]);
      }
    } catch (error) {
      console.error('Error loading current register:', error);
      setCurrentRegister(null);
      setMovements([]);
      setSalesDetails([]);
    }
  };

  const loadSalesDetails = async (registerId: string) => {
    try {
      // Obtener ventas de la caja actual
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          payment_type,
          created_at,
          customer:customers(name),
          payments(payment_method, notes),
          sale_items(
            quantity,
            unit_price,
            total_price,
            product:products(name)
          )
        `)
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      // Filtrar solo las ventas que corresponden a movimientos de esta caja
      const { data: movementsData, error: movementsError } = await supabase
        .from('cash_movements')
        .select('reference_id')
        .eq('cash_register_id', registerId)
        .eq('type', 'sale');

      if (movementsError) throw movementsError;

      const saleIds = movementsData.map(m => m.reference_id).filter(Boolean);
      
      const filteredSales = salesData?.filter(sale => saleIds.includes(sale.id)) || [];

      const salesWithDetails: SaleDetail[] = filteredSales.map(sale => ({
        id: sale.id,
        total_amount: sale.total_amount,
        payment_type: sale.payment_type,
        payment_method: sale.payments?.[0]?.payment_method || 'cash',
        created_at: sale.created_at,
        customer_name: sale.customer?.name,
        items_count: sale.sale_items?.length || 0,
        items: sale.sale_items?.map(item => ({
          product_name: item.product?.name || 'Producto desconocido',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        })) || []
      }));

      setSalesDetails(salesWithDetails);
    } catch (error) {
      console.error('Error loading sales details:', error);
      setSalesDetails([]);
    }
  };

  const getMovements = async (registerId: string): Promise<CashMovement[]> => {
    try {
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading movements:', error);
      return [];
    }
  };

  const loadMovements = async (registerId: string) => {
    try {
      const movementsData = await getMovements(registerId);
      setMovements(movementsData);
    } catch (error) {
      console.error('Error loading movements:', error);
      setMovements([]);
    }
  };

  const loadRegisters = async () => {
    try {
      if (!currentUser) return;

      // Cada usuario solo ve sus propias cajas (historial)
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          *,
          user:users(*)
        `)
        .eq('user_id', currentUser.id)
        .order('opened_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRegisters(data as CashRegisterWithUser[]);
    } catch (error) {
      console.error('Error loading registers:', error);
      setRegisters([]);
    }
  };

  const handleReviewCash = (register: CashRegisterWithMovements) => {
    setCurrentRegister(register);
    setReviewFormData({
      actual_amount: register.closing_amount?.toString() || '',
      review_notes: ''
    });
    setShowReviewModal(true);
  };

  const submitReview = async () => {
    if (!currentRegister) return;

    try {
      const actualAmount = parseFloat(reviewFormData.actual_amount) || 0;
      
      // Actualizar el monto de cierre con la revisión
      const { error: updateError } = await supabase
        .from('cash_registers')
        .update({
          closing_amount: actualAmount,
          notes: currentRegister.notes + 
            `\n--- REVISIÓN ${new Date().toLocaleString('es-ES')} ---\n` +
            `Monto corregido: ${formatCurrency(actualAmount)}\n` +
            `Notas de revisión: ${reviewFormData.review_notes}`
        })
        .eq('id', currentRegister.id);

      if (updateError) throw updateError;

      // Recargar datos
      loadData();
      setShowReviewModal(false);
      setCurrentRegister(null);
      
      showSuccess(
        '¡Revisión Completada!',
        'La revisión de caja ha sido completada exitosamente'
      );
    } catch (error) {
      console.error('Error reviewing cash register:', error);
      showError(
        'Error al Revisar Caja',
        'No se pudo completar la revisión. ' + (error as Error).message
      );
    }
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!currentUser) {
        alert('Error: Usuario no identificado');
        return;
      }

      const openingAmount = parseFloat(openFormData.opening_amount);
      if (isNaN(openingAmount) || openingAmount < 0) {
        alert('El monto inicial debe ser un número válido mayor o igual a 0');
        return;
      }

      // Verificar si ya hay una caja abierta para este usuario
      const { data: existingRegister, error: checkError } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('status', 'open')
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRegister) {
        showWarning(
          'Caja Ya Abierta',
          'Ya tienes una caja abierta. Debes cerrarla antes de abrir una nueva.'
        );
        return;
      }

      const registerData = {
        user_id: currentUser.id,
        opening_amount: openingAmount,
        notes: openFormData.notes,
        status: 'open' as const,
        total_sales: 0,
        closing_amount: 0,
      };

      const { data: newRegister, error } = await supabase
        .from('cash_registers')
        .insert([registerData])
        .select()
        .single();

      if (error) throw error;

      setShowOpenForm(false);
      setOpenFormData({ opening_amount: '', notes: '' });
      await loadData();
      showSuccess(
        '¡Caja Abierta Exitosamente!',
        `Tu caja ha sido abierta con un monto inicial de ${formatCurrency(openingAmount)}. Ya puedes comenzar a realizar ventas.`
      );
    } catch (error) {
      console.error('Error opening register:', error);
      showError(
        'Error al Abrir Caja',
        'No se pudo abrir la caja registradora. ' + (error as Error).message
      );
    }
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRegister) return;

    try {
      const closingAmount = parseFloat(closeFormData.closing_amount);
      
      if (isNaN(closingAmount) || closingAmount < 0) {
        alert('El monto final debe ser un número válido mayor o igual a 0');
        return;
      }
      
      const { error } = await supabase
        .from('cash_registers')
        .update({
          closing_amount: closingAmount,
          status: 'closed',
          closed_at: new Date().toISOString(),
          notes: currentRegister.notes + (closeFormData.notes ? `\n\nCierre: ${closeFormData.notes}` : ''),
        })
        .eq('id', currentRegister.id);

      if (error) throw error;

      setShowCloseForm(false);
      setCloseFormData({ closing_amount: '', notes: '' });
      await loadData();
      showSuccess(
        '¡Caja Cerrada Exitosamente!',
        `Tu caja ha sido cerrada. Monto final registrado: ${formatCurrency(closingAmount)}`
      );
    } catch (error) {
      console.error('Error closing register:', error);
      showError(
        'Error al Cerrar Caja',
        'No se pudo cerrar la caja registradora. ' + (error as Error).message
      );
    }
  };

  const handleIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRegister) return;

    try {
      const amount = parseFloat(incomeFormData.amount);
      
      if (isNaN(amount) || amount <= 0) {
        showWarning(
          'Monto Inválido',
          'El monto debe ser un número válido mayor a 0'
        );
        return;
      }

      if (!incomeFormData.description.trim()) {
        showWarning(
          'Descripción Requerida',
          'Debes proporcionar una descripción para el ingreso'
        );
        return;
      }

      const { error } = await supabase
        .from('cash_movements')
        .insert([{
          cash_register_id: currentRegister.id,
          type: 'income',
          category: incomeFormData.category,
          amount: amount,
          description: incomeFormData.description,
          created_by: currentUser?.id
        }]);

      if (error) throw error;

      setShowIncomeForm(false);
      setIncomeFormData({ amount: '', category: 'ingresos_adicionales', description: '' });
      await loadData();
      showSuccess(
        '¡Ingreso Registrado!',
        `Se ha registrado un ingreso de ${formatCurrency(amount)} exitosamente`
      );
    } catch (error) {
      console.error('Error registering income:', error);
      showError(
        'Error al Registrar Ingreso',
        'No se pudo registrar el ingreso. ' + (error as Error).message
      );
    }
  };

  const handleExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRegister) return;

    try {
      const amount = parseFloat(expenseFormData.amount);
      
      if (isNaN(amount) || amount <= 0) {
        showWarning(
          'Monto Inválido',
          'El monto debe ser un número válido mayor a 0'
        );
        return;
      }

      if (!expenseFormData.description.trim()) {
        showWarning(
          'Descripción Requerida',
          'Debes proporcionar una descripción para el egreso'
        );
        return;
      }

      // Verificar que hay suficiente dinero en caja
      if (amount > (currentRegister.current_balance || 0)) {
        showWarning(
          'Fondos Insuficientes',
          `No hay suficiente dinero en caja para este egreso. Disponible: ${formatCurrency(currentRegister.current_balance || 0)}`
        );
        return;
      }

      const { error } = await supabase
        .from('cash_movements')
        .insert([{
          cash_register_id: currentRegister.id,
          type: 'expense',
          category: expenseFormData.category,
          amount: amount,
          description: expenseFormData.description,
          created_by: currentUser?.id
        }]);

      if (error) throw error;

      setShowExpenseForm(false);
      setExpenseFormData({ amount: '', category: 'gastos_operativos', description: '' });
      await loadData();
      showSuccess(
        '¡Egreso Registrado!',
        `Se ha registrado un egreso de ${formatCurrency(amount)} exitosamente`
      );
    } catch (error) {
      console.error('Error registering expense:', error);
      showError(
        'Error al Registrar Egreso',
        'No se pudo registrar el egreso. ' + (error as Error).message
      );
    }
  };

  const handleEditMovement = async (movement: CashMovement) => {
    if (movement.type === 'sale' || movement.type === 'opening' || movement.type === 'closing') {
      showWarning(
        'No se puede editar',
        'Los movimientos de ventas, apertura y cierre no se pueden editar'
      );
      return;
    }

    const newDescription = prompt('Nueva descripción:', movement.description);
    if (newDescription === null) return;

    const newAmount = prompt('Nuevo monto:', movement.amount.toString());
    if (newAmount === null) return;

    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      showWarning('Monto Inválido', 'El monto debe ser un número válido mayor a 0');
      return;
    }

    try {
      const { error } = await supabase
        .from('cash_movements')
        .update({
          amount: amount,
          description: newDescription.trim()
        })
        .eq('id', movement.id);

      if (error) throw error;

      await loadData();
      showSuccess(
        '¡Movimiento Actualizado!',
        'El movimiento ha sido actualizado exitosamente'
      );
    } catch (error) {
      console.error('Error updating movement:', error);
      showError(
        'Error al Actualizar',
        'No se pudo actualizar el movimiento. ' + (error as Error).message
      );
    }
  };

  const handleDeleteMovement = async (movement: CashMovement) => {
    if (movement.type === 'sale' || movement.type === 'opening' || movement.type === 'closing') {
      showWarning(
        'No se puede eliminar',
        'Los movimientos de ventas, apertura y cierre no se pueden eliminar'
      );
      return;
    }

    showConfirmation(
      'Eliminar Movimiento',
      `¿Estás seguro de que quieres eliminar este movimiento de ${formatCurrency(movement.amount)}?`,
      async () => {
        try {
          const { error } = await supabase
            .from('cash_movements')
            .delete()
            .eq('id', movement.id);

          if (error) throw error;

          await loadData();
          showSuccess(
            '¡Movimiento Eliminado!',
            'El movimiento ha sido eliminado exitosamente'
          );
        } catch (error) {
          console.error('Error deleting movement:', error);
          showError(
            'Error al Eliminar',
            'No se pudo eliminar el movimiento. ' + (error as Error).message
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

  const calculateDifference = () => {
    if (!currentRegister || !closeFormData.closing_amount) return 0;
    const expected = currentRegister.current_balance || 0;
    const actual = parseFloat(closeFormData.closing_amount);
    return actual - expected;
  };

  const calculateSessionDuration = () => {
    if (!currentRegister) return '';
    const start = new Date(currentRegister.opened_at);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getCategoryLabel = (category: string) => {
    const categories = {
      'ventas_efectivo': 'Ventas en Efectivo',
      'ingresos_adicionales': 'Ingresos Adicionales',
      'devoluciones': 'Devoluciones de Proveedores',
      'otros_ingresos': 'Otros Ingresos',
      'gastos_operativos': 'Gastos Operativos',
      'servicios_publicos': 'Servicios Públicos',
      'mantenimiento': 'Mantenimiento',
      'compras_inventario': 'Compras de Inventario',
      'gastos_personal': 'Gastos de Personal',
      'otros_gastos': 'Otros Gastos',
    };
    return categories[category as keyof typeof categories] || category;
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'income':
      case 'sale':
      case 'opening':
        return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
      case 'expense':
      case 'closing':
        return <ArrowDownCircle className="h-4 w-4 text-red-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-slate-600" />;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'income':
      case 'sale':
      case 'opening':
        return 'text-green-600';
      case 'expense':
      case 'closing':
        return 'text-red-600';
      default:
        return 'text-slate-600';
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'income':
        return 'Ingreso';
      case 'expense':
        return 'Egreso';
      case 'sale':
        return 'Venta';
      case 'opening':
        return 'Apertura';
      case 'closing':
        return 'Cierre';
      default:
        return type;
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <Banknote className="h-4 w-4" />;
      case 'card':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">Mi Caja Registradora</h2>
        <div className="flex gap-2">
          {!currentRegister ? (
            <button
              onClick={() => setShowOpenForm(true)}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center text-lg font-medium shadow-lg"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Abrir Mi Caja
            </button>
          ) : (
            <>
              {/* Botones para administradores */}
              {isAdmin && (
                <>
                  <button
                    onClick={() => setShowIncomeForm(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ingreso
                  </button>
                  <button
                    onClick={() => setShowExpenseForm(true)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center"
                  >
                    <Minus className="h-4 w-4 mr-2" />
                    Egreso
                  </button>
                </>
              )}
              <button
                onClick={() => setShowMovementsModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Movimientos
              </button>
              <button
                onClick={() => setShowSalesDetailModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Detalle Ventas
              </button>
              <button
                onClick={() => setShowCloseForm(true)}
                className="bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors duration-200 flex items-center"
              >
                <Clock className="h-4 w-4 mr-2" />
                Cerrar Mi Caja
              </button>
            </>
          )}
        </div>
      </div>

      {/* Current Register Status */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Calculator className="h-5 w-5 mr-2 text-blue-600" />
          {currentRegister ? 'Mi Caja Abierta - Estado Actual' : 'Estado de Mi Caja'}
        </h3>
        
        {currentRegister ? (
          <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Balance Actual</p>
                    <p className="text-2xl font-bold text-green-900">
                      {formatCurrency(currentRegister.current_balance || 0)}
                    </p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-full">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Monto Inicial</p>
                    <p className="text-xl font-bold text-blue-900">
                      {formatCurrency(currentRegister.opening_amount || 0)}
                    </p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-full">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-600">Total Ventas</p>
                    <p className="text-xl font-bold text-emerald-900">
                      {formatCurrency(currentRegister.total_sales_amount || 0)}
                    </p>
                    <p className="text-xs text-emerald-700">{salesDetails.length} ventas</p>
                  </div>
                  <div className="p-2 bg-emerald-100 rounded-full">
                    <ShoppingCart className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Tiempo Abierta</p>
                    <p className="text-xl font-bold text-purple-900">
                      {calculateSessionDuration()}
                    </p>
                    <p className="text-xs text-purple-700">
                      Desde {new Date(currentRegister.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="p-2 bg-purple-100 rounded-full">
                    <Clock className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Sales Summary */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-medium text-slate-900 mb-3">Resumen de Ventas del Día</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {salesDetails.filter(s => s.payment_type === 'cash').length}
                  </p>
                  <p className="text-sm text-slate-600">Ventas en Efectivo</p>
                  <p className="text-xs text-green-700">
                    {formatCurrency(salesDetails.filter(s => s.payment_type === 'cash').reduce((sum, s) => sum + s.total_amount, 0))}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {salesDetails.filter(s => s.payment_type === 'installment').length}
                  </p>
                  <p className="text-sm text-slate-600">Ventas por Abonos</p>
                  <p className="text-xs text-blue-700">
                    {formatCurrency(salesDetails.filter(s => s.payment_type === 'installment').reduce((sum, s) => sum + s.total_amount, 0))}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {salesDetails.reduce((sum, s) => sum + s.items_count, 0)}
                  </p>
                  <p className="text-sm text-slate-600">Productos Vendidos</p>
                  <p className="text-xs text-purple-700">
                    Promedio: {salesDetails.length > 0 ? (salesDetails.reduce((sum, s) => sum + s.items_count, 0) / salesDetails.length).toFixed(1) : 0} por venta
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Movements */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-slate-900">Últimos Movimientos</h4>
                <button
                  onClick={() => setShowMovementsModal(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver todos
                </button>
              </div>
              <div className="space-y-2">
                {movements.slice(0, 5).map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getMovementIcon(movement.type)}
                      <div>
                        <p className="font-medium text-slate-900">{movement.description}</p>
                        <p className="text-sm text-slate-600">
                          {getMovementTypeLabel(movement.type)} • 
                          {movement.category && getCategoryLabel(movement.category)} • 
                          {new Date(movement.created_at).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </div>
                    <div className={`font-bold ${getMovementColor(movement.type)}`}>
                      {movement.type === 'expense' || movement.type === 'closing' ? '-' : '+'}
                      {formatCurrency(movement.amount)}
                    </div>
                  </div>
                ))}
                {movements.length === 0 && (
                  <p className="text-slate-500 text-center py-4">No hay movimientos registrados</p>
                )}
              </div>
            </div>

            {/* Operator Info */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  <span>Operador: {currentUser?.name}</span>
                </div>
                <span>Abierta: {new Date(currentRegister.opened_at).toLocaleString('es-ES')}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-16 w-16 text-orange-400 mx-auto mb-4" />
            <p className="text-slate-700 text-lg font-medium">No tienes una caja abierta actualmente</p>
            <p className="text-slate-500 mt-2">Abre tu caja para comenzar las operaciones del día y habilitar las ventas</p>
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                <strong>Importante:</strong> Debes abrir tu caja antes de poder realizar ventas. 
                Esto es obligatorio para todos los empleados.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Open Register Form */}
      {showOpenForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Abrir Mi Caja</h3>
          <form onSubmit={handleOpenRegister} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Operador
                </label>
                <div className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700">
                  {currentUser?.name}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto Inicial
                </label>
                <FormattedNumberInput
                  value={openFormData.opening_amount}
                  onChange={(value) => setOpenFormData({ ...openFormData, opening_amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="0"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notas (opcional)
              </label>
              <textarea
                value={openFormData.notes}
                onChange={(e) => setOpenFormData({ ...openFormData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Observaciones sobre la apertura de caja..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                Abrir Mi Caja
              </button>
              <button
                type="button"
                onClick={() => setShowOpenForm(false)}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Close Register Form Modal */}
      {showCloseForm && currentRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Cerrar Mi Caja - Resumen Completo</h3>
              <p className="text-sm text-slate-600 mt-1">
                Revisa todos los detalles antes de cerrar tu caja
              </p>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleCloseRegister} className="space-y-6">
                {/* Resumen General */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <h4 className="font-medium text-slate-900 mb-3">Resumen del Turno</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Operador:</span>
                        <span className="font-medium">{currentUser?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tiempo abierta:</span>
                        <span className="font-medium">{calculateSessionDuration()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Monto inicial:</span>
                        <span>{formatCurrency(currentRegister.opening_amount || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total ventas:</span>
                        <span className="text-green-600">+{formatCurrency(currentRegister.total_sales_amount || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Otros ingresos:</span>
                        <span className="text-green-600">+{formatCurrency(currentRegister.total_income || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total egresos:</span>
                        <span className="text-red-600">-{formatCurrency(currentRegister.total_expenses || 0)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-2">
                        <span>Balance esperado:</span>
                        <span className="text-lg">{formatCurrency(currentRegister.current_balance || 0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Monto Final (conteo físico) *
                      </label>
                      <FormattedNumberInput
                        value={closeFormData.closing_amount}
                        onChange={(value) => setCloseFormData({ ...closeFormData, closing_amount: value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        min="0"
                        placeholder="0"
                      />
                      {closeFormData.closing_amount && (
                        <div className={`mt-2 p-2 rounded text-sm ${
                          calculateDifference() === 0 
                            ? 'bg-green-50 text-green-700' 
                            : calculateDifference() > 0 
                              ? 'bg-blue-50 text-blue-700' 
                              : 'bg-red-50 text-red-700'
                        }`}>
                          <strong>Diferencia: {formatCurrency(calculateDifference())}</strong>
                          {calculateDifference() > 0 && ' (sobrante)'}
                          {calculateDifference() < 0 && ' (faltante)'}
                          {calculateDifference() === 0 && ' (exacto)'}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Notas de cierre
                      </label>
                      <textarea
                        value={closeFormData.notes}
                        onChange={(e) => setCloseFormData({ ...closeFormData, notes: e.target.value })}
                        rows={4}
                        placeholder="Observaciones, incidencias, explicación de diferencias, etc."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Detalle de Ventas */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3">Detalle de Ventas del Día</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-blue-700">Ventas en Efectivo:</p>
                      <p className="font-bold text-blue-900">
                        {salesDetails.filter(s => s.payment_type === 'cash').length} ventas
                      </p>
                      <p className="text-blue-800">
                        {formatCurrency(salesDetails.filter(s => s.payment_type === 'cash').reduce((sum, s) => sum + s.total_amount, 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-700">Ventas por Abonos:</p>
                      <p className="font-bold text-blue-900">
                        {salesDetails.filter(s => s.payment_type === 'installment').length} ventas
                      </p>
                      <p className="text-blue-800">
                        {formatCurrency(salesDetails.filter(s => s.payment_type === 'installment').reduce((sum, s) => sum + s.total_amount, 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-700">Total Productos:</p>
                      <p className="font-bold text-blue-900">
                        {salesDetails.reduce((sum, s) => sum + s.items_count, 0)} unidades
                      </p>
                      <p className="text-blue-800">
                        Ticket promedio: {salesDetails.length > 0 ? formatCurrency(salesDetails.reduce((sum, s) => sum + s.total_amount, 0) / salesDetails.length) : formatCurrency(0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Botones */}
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={!closeFormData.closing_amount}
                    className="bg-slate-600 text-white px-6 py-3 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Cerrar Mi Caja
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCloseForm(false)}
                    className="bg-slate-200 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-300 transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Income Form - Solo para administradores */}
      {showIncomeForm && isAdmin && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Registrar Ingreso</h3>
          <form onSubmit={handleIncome} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto
                </label>
                <FormattedNumberInput
                  value={incomeFormData.amount}
                  onChange={(value) => setIncomeFormData({ ...incomeFormData, amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                  min="0"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría
                </label>
                <select
                  value={incomeFormData.category}
                  onChange={(e) => setIncomeFormData({ ...incomeFormData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {Object.entries(incomeCategories).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Descripción
              </label>
              <textarea
                value={incomeFormData.description}
                onChange={(e) => setIncomeFormData({ ...incomeFormData, description: e.target.value })}
                rows={3}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Describe el motivo del ingreso..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                Registrar Ingreso
              </button>
              <button
                type="button"
                onClick={() => setShowIncomeForm(false)}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expense Form - Solo para administradores */}
      {showExpenseForm && isAdmin && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Registrar Egreso</h3>
          <form onSubmit={handleExpense} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monto
                </label>
                <FormattedNumberInput
                  value={expenseFormData.amount}
                  onChange={(value) => setExpenseFormData({ ...expenseFormData, amount: value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                  min="0"
                  max={(currentRegister?.current_balance || 0).toString()}
                  placeholder="0"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Disponible en caja: {formatCurrency(currentRegister?.current_balance || 0)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría
                </label>
                <select
                  value={expenseFormData.category}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  {Object.entries(expenseCategories).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Descripción
              </label>
              <textarea
                value={expenseFormData.description}
                onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                rows={3}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Describe el motivo del egreso..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
              >
                Registrar Egreso
              </button>
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Movements Modal */}
      {showMovementsModal && currentRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  Movimientos de Mi Caja
                </h3>
                <button
                  onClick={() => setShowMovementsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-3">
                {movements.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No hay movimientos registrados</p>
                ) : (
                  movements.map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                      <div className="flex items-center gap-3 flex-1">
                        {getMovementIcon(movement.type)}
                        <div className="flex-1">
                          <h5 className="font-medium text-slate-900">{movement.description}</h5>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>{getMovementTypeLabel(movement.type)}</span>
                            {movement.category && (
                              <>
                                <span>•</span>
                                <span>{getCategoryLabel(movement.category)}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{new Date(movement.created_at).toLocaleString('es-ES')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`font-bold ${getMovementColor(movement.type)}`}>
                          {movement.type === 'expense' || movement.type === 'closing' ? '-' : '+'}
                          {formatCurrency(movement.amount)}
                        </div>
                        {isAdmin && movement.type !== 'sale' && movement.type !== 'opening' && movement.type !== 'closing' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEditMovement(movement)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Editar movimiento"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMovement(movement)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar movimiento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sales Detail Modal */}
      {showSalesDetailModal && currentRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  Detalle de Ventas del Día
                </h3>
                <button
                  onClick={() => setShowSalesDetailModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {salesDetails.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">No hay ventas registradas en esta caja</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {salesDetails.map((sale) => (
                    <div key={sale.id} className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div>
                            <h4 className="font-semibold text-slate-900">
                              Venta #{sale.id.slice(-8)}
                            </h4>
                            <p className="text-sm text-slate-600">
                              {new Date(sale.created_at).toLocaleString('es-ES')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              sale.payment_type === 'cash' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {getPaymentMethodIcon(sale.payment_method || 'cash')}
                              <span className="ml-1">
                                {sale.payment_type === 'cash' ? 'Efectivo' : 'Abonos'}
                              </span>
                            </span>
                            {sale.customer_name && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                <User className="h-3 w-3 mr-1" />
                                {sale.customer_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-slate-900">
                            {formatCurrency(sale.total_amount)}
                          </p>
                          <p className="text-sm text-slate-600">
                            {sale.items_count} producto{sale.items_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      
                      {/* Productos de la venta */}
                      <div className="bg-slate-50 p-3 rounded-lg">
                        <h5 className="font-medium text-slate-900 mb-2 flex items-center">
                          <Package className="h-4 w-4 mr-2" />
                          Productos Vendidos
                        </h5>
                        <div className="space-y-1">
                          {sale.items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span className="flex-1">{item.product_name}</span>
                              <span className="text-slate-600 mx-2">
                                {item.quantity} × {formatCurrency(item.unit_price)}
                              </span>
                              <span className="font-medium text-slate-900">
                                {formatCurrency(item.total_price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Revisión de Caja */}
      {showReviewModal && currentRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                    <Search className="h-6 w-6 mr-3 text-yellow-600" />
                    Revisar Caja con Descuadre
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Caja del {new Date(currentRegister.opened_at).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              {/* Información del Descuadre */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-red-900 mb-2">Descuadre Detectado</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-red-700">Monto Esperado:</span>
                    <p className="font-bold text-red-900">
                      {formatCurrency((currentRegister.opening_amount || 0) + (currentRegister.total_sales || 0))}
                    </p>
                  </div>
                  <div>
                    <span className="text-red-700">Monto Registrado:</span>
                    <p className="font-bold text-red-900">
                      {formatCurrency(currentRegister.closing_amount || 0)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-red-700">Diferencia:</span>
                    <p className={`font-bold text-lg ${
                      (currentRegister.closing_amount || 0) - ((currentRegister.opening_amount || 0) + (currentRegister.total_sales || 0)) > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(currentRegister.closing_amount || 0) - ((currentRegister.opening_amount || 0) + (currentRegister.total_sales || 0)) > 0 ? '+' : ''}
                      {formatCurrency(Math.abs((currentRegister.closing_amount || 0) - ((currentRegister.opening_amount || 0) + (currentRegister.total_sales || 0))))}
                      {(currentRegister.closing_amount || 0) - ((currentRegister.opening_amount || 0) + (currentRegister.total_sales || 0)) > 0 ? ' (Sobrante)' : ' (Faltante)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Formulario de Revisión */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Monto Real Encontrado en Caja *
                  </label>
                  <FormattedNumberInput
                    value={reviewFormData.actual_amount}
                    onChange={(value) => setReviewFormData({ ...reviewFormData, actual_amount: value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ingresa el monto real contado"
                    required
                    min="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notas de la Revisión
                  </label>
                  <textarea
                    value={reviewFormData.review_notes}
                    onChange={(e) => setReviewFormData({ ...reviewFormData, review_notes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Explica las razones del descuadre, acciones tomadas, etc."
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3 flex-shrink-0">
              <button
                onClick={submitReview}
                disabled={!reviewFormData.actual_amount}
                className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
              >
                <Check className="h-4 w-4 mr-2" />
                Completar Revisión
              </button>
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
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

      {/* Register History */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            Historial de Mis Cajas
          </h3>
        </div>
        <div className="p-6">
          {registers.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              No tienes cajas registradas
            </p>
          ) : (
            <div className="space-y-4">
              {registers.map((register) => (
                <div key={register.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium text-slate-900">
                          Caja del {new Date(register.opened_at).toLocaleDateString('es-ES')}
                        </p>
                        <p className="text-sm text-slate-600">
                          {register.status === 'open' ? 
                            `Abierta desde las ${new Date(register.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 
                            `Cerrada a las ${new Date(register.closed_at!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                          }
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Inicial: {formatCurrency(register.opening_amount || 0)}</span>
                        {register.status === 'closed' && (
                          <>
                            <span>Final: {formatCurrency(register.closing_amount || 0)}</span>
                            <span>Ventas: {formatCurrency(register.total_sales || 0)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      register.status === 'open' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {register.status === 'open' ? 'Abierta' : 'Cerrada'}
                    </span>
                    {register.status === 'closed' && register.closing_amount !== undefined && register.opening_amount !== undefined && (
                      <p className="text-xs text-slate-500 mt-1">
                        Diferencia: {formatCurrency((register.closing_amount + (register.total_sales || 0)) - register.opening_amount)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}