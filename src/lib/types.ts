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
      products: {
        Row: {
          id: string;
          name: string;
          description: string;
          price: number;
          stock: number;
          category_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          price: number;
          stock?: number;
          category_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          price?: number;
          stock?: number;
          category_id?: string | null;
          created_at?: string;
        };
      };
      sales: {
        Row: {
          id: string;
          total_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          total_amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          total_amount?: number;
          created_at?: string;
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
    };
  };
}

export type Category = Database['public']['Tables']['categories']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleItem = Database['public']['Tables']['sale_items']['Row'];

export interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  role?: {
    id: string;
    name: string;
    description: string;
  };
  permissions?: string[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  created_at: string;
}

export interface CashRegister {
  id: string;
  user_id: string | null;
  opening_amount: number;
  closing_amount: number;
  total_sales: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  notes: string;
  created_at: string;
}

export interface CashRegisterWithUser extends CashRegister {
  user: User | null;
}

export interface ProductWithCategory extends Product {
  category: Category | null;
  supplier: Supplier | null;
}

export interface SaleWithItems extends Sale {
  sale_items: (SaleItem & { product: Product })[];
  customer: Customer | null;
  user: User | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
}