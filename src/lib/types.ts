export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          created_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_person: string;
          email: string;
          phone: string;
          address: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_person?: string;
          email?: string;
          phone?: string;
          address?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          contact_person?: string;
          email?: string;
          phone?: string;
          address?: string;
          created_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string;
          address: string;
          cedula: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string;
          phone?: string;
          address?: string;
          cedula?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string;
          address?: string;
          cedula?: string;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          role?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          description: string;
          sale_price: number;
          purchase_price: number;
          stock: number;
          barcode: string;
          category_id: string | null;
          supplier_id: string | null;
          created_at: string;
          has_imei_serial: boolean;
          imei_serial_type: 'imei' | 'serial' | 'both';
          requires_imei_serial: boolean;
          bulk_import_batch: string;
          import_notes: string;
          imported_at: string | null;
          imported_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          sale_price: number;
          purchase_price?: number;
          stock?: number;
          barcode?: string;
          category_id?: string | null;
          supplier_id?: string | null;
          created_at?: string;
          has_imei_serial?: boolean;
          imei_serial_type?: 'imei' | 'serial' | 'both';
          requires_imei_serial?: boolean;
          bulk_import_batch?: string;
          import_notes?: string;
          imported_at?: string | null;
          imported_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          sale_price?: number;
          purchase_price?: number;
          stock?: number;
          barcode?: string;
          category_id?: string | null;
          supplier_id?: string | null;
          created_at?: string;
          has_imei_serial?: boolean;
          imei_serial_type?: 'imei' | 'serial' | 'both';
          requires_imei_serial?: boolean;
          bulk_import_batch?: string;
          import_notes?: string;
          imported_at?: string | null;
          imported_by?: string | null;
        };
      };
      sales: {
        Row: {
          id: string;
          total_amount: number;
          subtotal: number;
          discount_amount: number;
          customer_id: string | null;
          user_id: string | null;
          created_at: string;
          payment_type: string;
          total_paid: number;
          payment_status: string;
        };
        Insert: {
          id?: string;
          total_amount: number;
          subtotal?: number;
          discount_amount?: number;
          customer_id?: string | null;
          user_id?: string | null;
          created_at?: string;
          payment_type?: string;
          total_paid?: number;
          payment_status?: string;
        };
        Update: {
          id?: string;
          total_amount?: number;
          subtotal?: number;
          discount_amount?: number;
          customer_id?: string | null;
          user_id?: string | null;
          created_at?: string;
          payment_type?: string;
          total_paid?: number;
          payment_status?: string;
        };
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          total_price: number;
        };
        Insert: {
          id?: string;
          sale_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          total_price: number;
        };
        Update: {
          id?: string;
          sale_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
        };
      };
      cash_registers: {
        Row: {
          id: string;
          user_id: string | null;
          opening_amount: number;
          closing_amount: number;
          expected_closing_amount: number;
          actual_closing_amount: number;
          discrepancy_amount: number;
          discrepancy_reason: string;
          session_notes: string;
          last_movement_at: string;
          total_sales: number;
          status: string;
          opened_at: string;
          closed_at: string | null;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          opening_amount?: number;
          closing_amount?: number;
          expected_closing_amount?: number;
          actual_closing_amount?: number;
          discrepancy_amount?: number;
          discrepancy_reason?: string;
          session_notes?: string;
          last_movement_at?: string;
          total_sales?: number;
          status?: string;
          opened_at?: string;
          closed_at?: string | null;
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          opening_amount?: number;
          closing_amount?: number;
          expected_closing_amount?: number;
          actual_closing_amount?: number;
          discrepancy_amount?: number;
          discrepancy_reason?: string;
          session_notes?: string;
          last_movement_at?: string;
          total_sales?: number;
          status?: string;
          opened_at?: string;
          closed_at?: string | null;
          notes?: string;
          created_at?: string;
        };
      };
      payment_installments: {
        Row: {
          id: string;
          sale_id: string;
          amount_paid: number;
          payment_date: string;
          payment_method: string;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          amount_paid: number;
          payment_date?: string;
          payment_method?: string;
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          amount_paid?: number;
          payment_date?: string;
          payment_method?: string;
          notes?: string;
          created_at?: string;
        };
      };
      product_imei_serials: {
        Row: {
          id: string;
          product_id: string;
          imei_number: string;
          serial_number: string;
          status: 'available' | 'sold' | 'reserved' | 'defective' | 'returned';
          sale_id: string | null;
          sale_item_id: string | null;
          sold_at: string | null;
          notes: string;
          created_at: string;
          created_by: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          imei_number?: string;
          serial_number?: string;
          status?: 'available' | 'sold' | 'reserved' | 'defective' | 'returned';
          sale_id?: string | null;
          sale_item_id?: string | null;
          sold_at?: string | null;
          notes?: string;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          imei_number?: string;
          serial_number?: string;
          status?: 'available' | 'sold' | 'reserved' | 'defective' | 'returned';
          sale_id?: string | null;
          sale_item_id?: string | null;
          sold_at?: string | null;
          notes?: string;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
    };
  };
}

// Tipos principales derivados de la base de datos
export type Category = Database['public']['Tables']['categories']['Row'];
export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type User = Database['public']['Tables']['users']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'] & {
  notes?: string;
};
export type SaleItem = Database['public']['Tables']['sale_items']['Row'];
export type CashRegister = Database['public']['Tables']['cash_registers']['Row'];
export type PaymentInstallment = Database['public']['Tables']['payment_installments']['Row'];
export type ProductImeiSerial = Database['public']['Tables']['product_imei_serials']['Row'];

// Nuevo tipo para movimientos de caja
export interface CashMovement {
  id: string;
  cash_register_id: string;
  type: 'income' | 'expense' | 'sale' | 'opening' | 'closing';
  category: string;
  amount: number;
  description: string;
  reference_id: string | null;
  created_at: string;
  created_by?: string | null;
  created_by_user?: { name: string } | null;
}

// Nuevos tipos para control mejorado de caja
export interface CashRegisterSale {
  id: string;
  cash_register_id: string;
  sale_id: string;
  payment_method: string;
  amount_received: number;
  change_given: number;
  created_at: string;
}

export interface CashRegisterDiscrepancy {
  id: string;
  cash_register_id: string;
  discrepancy_type: 'shortage' | 'overage' | 'error';
  expected_amount: number;
  actual_amount: number;
  difference_amount: number;
  reason: string;
  resolution: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CashRegisterAudit {
  id: string;
  cash_register_id: string;
  movement_id: string | null;
  action_type: 'create' | 'update' | 'delete';
  old_values: any;
  new_values: any;
  reason: string;
  performed_by: string | null;
  performed_at: string;
}

// Enhanced audit types
export interface CashRegisterEnhancedAudit {
  id: string;
  cash_register_id: string;
  action_type: 'open' | 'close' | 'sale' | 'installment' | 'income' | 'expense' | 'edit' | 'delete';
  entity_type: 'cash_register' | 'sale' | 'installment' | 'movement' | 'product' | 'customer';
  entity_id: string | null;
  product_details: any;
  customer_details: any;
  sale_details: any;
  movement_details: any;
  amount: number;
  previous_balance: number | null;
  new_balance: number | null;
  old_values: any;
  new_values: any;
  changes_summary: string;
  description: string;
  reason: string;
  performed_by: string | null;
  performed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  metadata: any;
  tags: string[];
  severity: 'low' | 'normal' | 'high' | 'critical';
  created_at: string;
}

export interface CashRegisterSalesTracking {
  id: string;
  cash_register_id: string;
  sale_id: string;
  products_sold: any[];
  total_items_count: number;
  customer_id: string | null;
  customer_snapshot: any;
  payment_method: string;
  amount_received: number;
  change_given: number;
  discount_applied: number;
  sale_started_at: string;
  sale_completed_at: string;
  processing_duration_seconds: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  notes: string;
  tags: string[];
  metadata: any;
}

export interface CashRegisterComprehensiveAudit {
  register_id: string;
  user_id: string | null;
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
  register_created_at: string;
  operator_name: string | null;
  operator_email: string | null;
  operator_role: string | null;
  total_sales_count: number;
  total_sales_amount: number;
  cash_sales_count: number;
  cash_sales_amount: number;
  installment_sales_count: number;
  installment_sales_amount: number;
  unique_products_sold: number;
  total_items_sold: number;
  unique_customers_served: number;
  total_movements_count: number;
  total_income: number;
  total_expenses: number;
  calculated_balance: number;
  session_duration_minutes: number;
  audit_entries_count: number;
  last_audit_entry: string | null;
}

export interface CashRegisterSalesDetail {
  cash_register_id: string;
  sale_id: string;
  total_amount: number;
  subtotal: number;
  discount_amount: number;
  payment_type: string;
  payment_status: string;
  total_paid: number;
  sale_date: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_cedula: string | null;
  customer_address: string | null;
  seller_id: string | null;
  seller_name: string | null;
  seller_email: string | null;
  seller_role: string | null;
  products_detail: any[];
  total_line_items: number;
  total_items_quantity: number;
  total_profit: number;
  register_payment_method: string;
  amount_received: number;
  change_given: number;
  payment_notes: string;
}

export interface CashRegisterDiscrepancyCalculation {
  expected_amount: number;
  calculated_amount: number;
  discrepancy_amount: number;
  discrepancy_type: string;
  total_sales: number;
  total_income: number;
  total_expenses: number;
  opening_amount: number;
}

export interface DetailedCashRegisterReport {
  register_info: any;
  movements_summary: any;
  sales_detail: any;
  discrepancy_analysis: any;
  audit_trail: any;
}

// Tipos extendidos con relaciones
export interface ProductWithCategory extends Product {
  category: Category | null;
  supplier: Supplier | null;
  imei_serials?: ProductImeiSerial[];
  available_units?: number;
  sold_units?: number;
  defective_units?: number;
}

export interface SaleItemWithProductAndImei extends SaleItem {
  product: Product;
  sale_item_imei_serials?: ProductImeiSerial[];
}

export interface SaleWithItems extends Sale {
  sale_items: SaleItemWithProductAndImei[];
  customer: Customer | null;
  user: User | null;
}

export interface CashRegisterWithUser extends CashRegister {
  user: User | null;
  payments?: any[];
  current_balance?: number;
  total_income?: number;
  total_expenses?: number;
  total_sales_amount?: number;
  total_sales_count?: number;
  total_installments_amount?: number;
  total_installments_count?: number;
  calculated_balance?: number;
}

export interface CashRegisterWithMovements extends CashRegisterWithUser {
  cash_movements: CashMovement[];
}

// Tipos para el carrito de compras
export interface CartItem {
  product: Product;
  quantity: number;
  // Campos opcionales para productos con IMEI/Serial
  selectedImeiSerials?: ProductImeiSerial[];
  needsImeiSelection?: boolean;
}

// Tipos para formularios
export interface ProductFormData {
  name: string;
  description: string;
  sale_price: string;
  purchase_price: string;
  stock: string;
  category_id: string;
  supplier_id: string;
  barcode: string;
  has_imei_serial: boolean;
  imei_serial_type: 'imei' | 'serial' | 'both';
  requires_imei_serial: boolean;
}

// Tipos para importación masiva
export interface BulkProductData {
  name: string;
  description?: string;
  sale_price: number;
  purchase_price?: number;
  stock: number;
  barcode?: string;
  category_id?: string;
  supplier_id?: string;
  has_imei_serial?: boolean;
  imei_serial_type?: 'imei' | 'serial' | 'both';
  requires_imei_serial?: boolean;
  import_notes?: string;
}

export interface BulkImportResult {
  success: boolean;
  inserted_count: number;
  error_count: number;
  errors: Array<{
    product_name: string;
    error: string;
  }>;
  batch_id: string;
}

// Tipos para IMEI/Serial
export interface ImeiSerialData {
  id?: string;
  imei_number?: string;
  serial_number?: string;
  notes?: string;
}

export interface CategoryFormData {
  name: string;
  description: string;
}

export interface SupplierFormData {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
}

export interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  cedula: string;
}

export interface UserFormData {
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}