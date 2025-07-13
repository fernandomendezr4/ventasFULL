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
    };
  };
}

// Tipos principales derivados de la base de datos
export type Category = Database['public']['Tables']['categories']['Row'];
export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type User = Database['public']['Tables']['users']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleItem = Database['public']['Tables']['sale_items']['Row'];
export type CashRegister = Database['public']['Tables']['cash_registers']['Row'];
export type PaymentInstallment = Database['public']['Tables']['payment_installments']['Row'];

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
  created_by: string | null;
}

// Tipos extendidos con relaciones
export interface ProductWithCategory extends Product {
  category: Category | null;
  supplier: Supplier | null;
}

export interface SaleWithItems extends Sale {
  sale_items: (SaleItem & { product: Product })[];
  customer: Customer | null;
  user: User | null;
}

export interface CashRegisterWithUser extends CashRegister {
  user: User | null;
  current_balance?: number;
  total_income?: number;
  total_expenses?: number;
  total_sales_amount?: number;
}

export interface CashRegisterWithMovements extends CashRegisterWithUser {
  cash_movements: CashMovement[];
}

// Tipos para el carrito de compras
export interface CartItem {
  product: Product;
  quantity: number;
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