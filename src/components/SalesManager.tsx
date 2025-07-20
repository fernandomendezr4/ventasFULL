import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Package, Eye, Trash2, Search, Filter, User, Printer, Phone, CreditCard, Banknote, Building2, Smartphone, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SaleWithItems } from '../lib/types';
import { formatCurrency } from '../lib/currency';
import { useAuth } from '../contexts/AuthContext';
import PrintService from './PrintService';

export default function SalesManager() {
  const { user } = useAuth();
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'total_amount' | 'customer_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load payment methods from localStorage
  const getPaymentMethods = () => {
    try {
      const savedMethods = localStorage.getItem('payment_methods');
      if (savedMethods) {
        return JSON.parse(savedMethods);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
    return [
      { id: 'cash', name: 'Efectivo', icon: 'Banknote' },
      { id: 'card', name: 'Tarjeta', icon: 'CreditCard' },
      { id: 'transfer', name: 'Transferencia Bancaria', icon: 'Building2' },
      { id: 'nequi', name: 'NEQUI', icon: 'Smartphone' }
    ];
  };

  const paymentMethods = getPaymentMethods();

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          payments (
            payment_method,
            notes
          ),
          customer:customers (name, phone, email),
          user:users (name, email),
          sale_items (
            *,
            product:products (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSales(data as SaleWithItems[]);
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta venta?')) {
      try {
        const { error } = await supabase
          .from('sales')
          .delete()
          .eq('id', id);

        if (error) throw error;
        loadSales();
      } catch (error) {
        console.error('Error deleting sale:', error);
        alert('Error al eliminar venta: ' + (error as Error).message);
      }
    }
  };

  const getPaymentMethodName = (sale: SaleWithItems) => {
    // For cash sales, get the payment method from payments table
    if (sale.payment_type === 'cash' && sale.payments && sale.payments.length > 0) {
      const payment = sale.payments[0];
      const method = paymentMethods.find(m => m.id === payment.payment_method || 
        (payment.payment_method === 'other' && payment.notes?.includes('NEQUI')));
      return method?.name || payment.payment_method;
    }
    return sale.payment_type === 'cash' ? 'Efectivo' : 'Abonos';
  };

  const getPaymentMethodIcon = (sale: SaleWithItems) => {
    if (sale.payment_type === 'installment') {
      return <CreditCard className="h-4 w-4" />;
    }
    
    if (sale.payments && sale.payments.length > 0) {
      const payment = sale.payments[0];
      const method = paymentMethods.find(m => m.id === payment.payment_method || 
        (payment.payment_method === 'other' && payment.notes?.includes('NEQUI')));
      
      if (method) {
        switch (method.icon) {
          case 'Banknote':
            return <Banknote className="h-4 w-4" />;
          case 'CreditCard':
            return <CreditCard className="h-4 w-4" />;
          case 'Building2':
            return <Building2 className="h-4 w-4" />;
          case 'Smartphone':
            return <Smartphone className="h-4 w-4" />;
          default:
            return <CreditCard className="h-4 w-4" />;
        }
      }
    }
    
    return <Banknote className="h-4 w-4" />;
  };

  const filteredAndSortedSales = sales.filter(sale => {
    // Filter by date
    if (dateFilter && !sale.created_at.startsWith(dateFilter)) {
      return false;
    }
    
    // Filter by payment type
    if (paymentTypeFilter !== 'all' && sale.payment_type !== paymentTypeFilter) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const saleId = sale.id.slice(-8);
      const customerName = sale.customer?.name?.toLowerCase() || '';
      const customerPhone = sale.customer?.phone || '';
      const customerEmail = sale.customer?.email?.toLowerCase() || '';
      
      return (
        saleId.includes(searchTerm) ||
        customerName.includes(searchLower) ||
        customerPhone.includes(searchTerm) ||
        customerEmail.includes(searchLower) ||
        sale.total_amount.toString().includes(searchTerm)
      );
    }
    
    return true;
  }).sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    switch (sortBy) {
      case 'total_amount':
        aValue = a.total_amount;
        bValue = b.total_amount;
        break;
      case 'customer_name':
        aValue = a.customer?.name || '';
        bValue = b.customer?.name || '';
        break;
      case 'created_at':
      default:
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
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
        <h2 className="text-3xl font-bold text-slate-900">Ventas</h2>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ID de venta, cliente, vendedor, teléfono o monto..."
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
              value={paymentTypeFilter}
              onChange={(e) => setPaymentTypeFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los tipos</option>
              <option value="cash">Efectivo</option>
              <option value="installment">Abonos</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'created_at' | 'total_amount' | 'customer_name')}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="created_at">Ordenar por Fecha</option>
              <option value="total_amount">Ordenar por Monto</option>
              <option value="customer_name">Ordenar por Cliente</option>
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
        {(searchTerm || dateFilter || paymentTypeFilter !== 'all') && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {filteredAndSortedSales.length} de {sales.length} ventas
          </div>
        )}
      </div>

      {/* Sales Summary */}
      {filteredAndSortedSales.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Resumen de Ventas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-600">Total de Ventas</p>
              <p className="text-2xl font-bold text-blue-900">{filteredAndSortedSales.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-600">Monto Total</p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(filteredAndSortedSales.reduce((sum, sale) => sum + sale.total_amount, 0))}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <p className="text-sm font-medium text-purple-600">Promedio por Venta</p>
              <p className="text-2xl font-bold text-purple-900">
                {formatCurrency(filteredAndSortedSales.reduce((sum, sale) => sum + sale.total_amount, 0) / filteredAndSortedSales.length)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sales List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="relative">
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
          </div>
        ) : filteredAndSortedSales.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              {sales.length === 0 
                ? 'No hay ventas registradas' 
                : 'No se encontraron ventas que coincidan con los filtros aplicados'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredAndSortedSales.map((sale) => (
              <div key={sale.id} className="p-6 hover:bg-slate-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          Venta #{sale.id.slice(-8)} 
                        </h3>
                        <p className="text-sm text-slate-600">
                          {new Date(sale.created_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                          {sale.customer && (
                            <span className="flex items-center">
                              <User className="h-4 w-4 mr-1 text-blue-600" />
                              {sale.customer.name}
                            </span>
                          )}
                          {sale.user && (
                            <span className="flex items-center">
                              <User className="h-4 w-4 mr-1 text-green-600" />
                              {sale.user.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {/* Payment Type and Method */}
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getPaymentMethodIcon(sale)}
                            <span className="ml-1">{getPaymentMethodName(sale)}</span>
                          </span>
                          
                          {/* Payment Status for installments */}
                          {sale.payment_status && sale.payment_type === 'installment' && (
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              sale.payment_status === 'paid' 
                                ? 'bg-green-100 text-green-800' 
                                : sale.payment_status === 'partial'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                            }`}>
                              {sale.payment_status === 'paid' ? 'Pagada' : 
                               sale.payment_status === 'partial' ? 'Parcial' : 'Pendiente'}
                            </span>
                          )}
                          
                          {/* Discount indicator */}
                          {sale.discount_amount && sale.discount_amount > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              <Tag className="h-3 w-3 mr-1" />
                              Desc: {formatCurrency(sale.discount_amount)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span className="flex items-center">
                          <Package className="h-4 w-4 mr-1" />
                          {sale.sale_items.length} productos
                        </span>
                        <span className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1" />
                          {formatCurrency(sale.total_amount)}
                        </span>
                      </div>
                      {sale.customer && sale.customer.phone && (
                        <div className="flex items-center text-sm text-slate-500">
                          <Phone className="h-4 w-4 mr-1" />
                          <span>{sale.customer.phone}</span>
                        </div>
                      )}
                      
                      {/* Installment progress for credit sales */}
                      {sale.payment_type === 'installment' && (
                        <div className="mt-2 w-full">
                          <div className="flex justify-between text-xs text-slate-600 mb-1">
                            <span>Progreso: {formatCurrency(sale.total_paid || 0)} / {formatCurrency(sale.total_amount)}</span>
                            <span>{(((sale.total_paid || 0) / sale.total_amount) * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${((sale.total_paid || 0) / sale.total_amount) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <PrintService
                      sale={sale}
                      settings={(() => {
                        const savedSettings = localStorage.getItem('app_settings');
                        const printSettings = localStorage.getItem('print_settings');
                        if (savedSettings || printSettings) {
                          const appSettings = savedSettings ? JSON.parse(savedSettings) : {};
                          const printConfig = printSettings ? JSON.parse(printSettings) : {};
                          return {
                            print_enabled: true,
                            auto_print: false,
                            print_copies: 1,
                            receipt_width: '80mm',
                            show_logo: true,
                            show_company_info: true,
                            show_customer_info: true,
                            show_payment_details: true,
                            show_footer_message: true,
                            footer_message: '¡Gracias por su compra!',
                            receipt_header: '',
                            receipt_footer: 'Conserve este comprobante',
                            company_name: 'VentasFULL',
                            company_address: '',
                            company_phone: '',
                            company_email: '',
                            ...appSettings,
                            ...printConfig
                          };
                        }
                        return {
                          print_enabled: true,
                          auto_print: false,
                          print_copies: 1,
                          receipt_width: '80mm',
                          show_logo: true,
                          show_company_info: true,
                          show_customer_info: true,
                          show_payment_details: true,
                          show_footer_message: true,
                          footer_message: '¡Gracias por su compra!',
                          receipt_header: '',
                          receipt_footer: 'Conserve este comprobante',
                          company_name: 'VentasFULL',
                          company_address: '',
                          company_phone: '',
                          company_email: ''
                        };
                      })()}
                    />
                    {/* Solo mostrar botón de eliminar para admin y manager */}
                    {user?.role !== 'employee' && (
                    <button
                      onClick={() => handleDelete(sale.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-auto max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">
                Detalle de Venta #{selectedSale.id.slice(-8)}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {new Date(selectedSale.created_at).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
              <div className="flex items-center gap-6 mt-3 text-sm">
                {selectedSale.customer && (
                  <div className="flex items-center text-blue-600">
                    <User className="h-4 w-4 mr-2" />
                    <span className="font-medium">Cliente:</span>
                    <span className="ml-1">{selectedSale.customer.name}</span>
                  </div>
                )}
                {selectedSale.user && (
                  <div className="flex items-center text-green-600">
                    <User className="h-4 w-4 mr-2" />
                    <span className="font-medium">Vendedor:</span>
                    <span className="ml-1">{selectedSale.user.name}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <h4 className="font-medium text-slate-900 mb-4">Productos</h4>
              <div className="space-y-3">
                {selectedSale.sale_items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <h5 className="font-medium text-slate-900">{item.product.name}</h5>
                      <p className="text-sm text-slate-600">
                        {formatCurrency(item.unit_price)} × {item.quantity}
                      </p>
                    </div>
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(item.total_price)}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-slate-900">Total</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {formatCurrency(selectedSale.total_amount)}
                  </span>
                </div>
                
                {/* Payment and discount details in modal */}
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span>{formatCurrency(selectedSale.subtotal || selectedSale.total_amount)}</span>
                  </div>
                  {selectedSale.discount_amount && selectedSale.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-orange-600">
                      <span>Descuento:</span>
                      <span>-{formatCurrency(selectedSale.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Método de pago:</span>
                    <span className="flex items-center">
                      {getPaymentMethodIcon(selectedSale)}
                      <span className="ml-1">{getPaymentMethodName(selectedSale)}</span>
                    </span>
                  </div>
                  {selectedSale.payment_type === 'installment' && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Total pagado:</span>
                        <span className="text-green-600">{formatCurrency(selectedSale.total_paid || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Saldo pendiente:</span>
                        <span className="text-orange-600">{formatCurrency(selectedSale.total_amount - (selectedSale.total_paid || 0))}</span>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-600 mb-1">
                          <span>Progreso de pago</span>
                          <span>{(((selectedSale.total_paid || 0) / selectedSale.total_amount) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${((selectedSale.total_paid || 0) / selectedSale.total_amount) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex-shrink-0">
              <button
                onClick={() => setSelectedSale(null)}
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