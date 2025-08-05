// Utilidades para exportación de base de datos a PostgreSQL local

import { supabase, isDemoMode } from './supabase';

export interface ExportConfiguration {
  includeSchema: boolean;
  includeData: boolean;
  includeFunctions: boolean;
  includeViews: boolean;
  includeTriggers: boolean;
  includeIndexes: boolean;
  includePolicies: boolean;
  selectedTables: string[];
  maxRowsPerTable: number;
  exportFormat: 'sql' | 'dump';
}

export interface TableMetadata {
  table_name: string;
  table_type: string;
  column_count: number;
  row_count: number;
  size_bytes: number;
  has_primary_key: boolean;
  has_foreign_keys: boolean;
  has_indexes: boolean;
}

// Obtener metadatos de todas las tablas
export const getTableMetadata = async (): Promise<TableMetadata[]> => {
  if (isDemoMode) {
    // Retornar metadatos demo
    return [
      {
        table_name: 'users',
        table_type: 'BASE TABLE',
        column_count: 6,
        row_count: 5,
        size_bytes: 8192,
        has_primary_key: true,
        has_foreign_keys: false,
        has_indexes: true
      },
      {
        table_name: 'categories',
        table_type: 'BASE TABLE',
        column_count: 4,
        row_count: 8,
        size_bytes: 4096,
        has_primary_key: true,
        has_foreign_keys: false,
        has_indexes: true
      },
      {
        table_name: 'products',
        table_type: 'BASE TABLE',
        column_count: 17,
        row_count: 300,
        size_bytes: 2097152,
        has_primary_key: true,
        has_foreign_keys: true,
        has_indexes: true
      },
      {
        table_name: 'sales',
        table_type: 'BASE TABLE',
        column_count: 10,
        row_count: 450,
        size_bytes: 1048576,
        has_primary_key: true,
        has_foreign_keys: true,
        has_indexes: true
      }
    ];
  }

  if (!supabase) return [];

  try {
    // Intentar obtener metadatos usando la función RPC
    const { data, error } = await supabase.rpc('get_table_metadata');
    
    if (error) {
      console.warn('RPC function not available, using fallback method:', error.message);
      
      // Fallback: retornar metadatos básicos de las tablas principales conocidas
      console.warn('Using hardcoded table metadata as fallback');
      return [
        {
          table_name: 'users',
          table_type: 'BASE TABLE',
          column_count: 6,
          row_count: 0,
          size_bytes: 0,
          has_primary_key: true,
          has_foreign_keys: false,
          has_indexes: true
        },
        {
          table_name: 'categories',
          table_type: 'BASE TABLE',
          column_count: 4,
          row_count: 0,
          size_bytes: 0,
          has_primary_key: true,
          has_foreign_keys: false,
          has_indexes: true
        },
        {
          table_name: 'products',
          table_type: 'BASE TABLE',
          column_count: 17,
          row_count: 0,
          size_bytes: 0,
          has_primary_key: true,
          has_foreign_keys: true,
          has_indexes: true
        },
        {
          table_name: 'sales',
          table_type: 'BASE TABLE',
          column_count: 10,
          row_count: 0,
          size_bytes: 0,
          has_primary_key: true,
          has_foreign_keys: true,
          has_indexes: true
        },
        {
          table_name: 'customers',
          table_type: 'BASE TABLE',
          column_count: 7,
          row_count: 0,
          size_bytes: 0,
          has_primary_key: true,
          has_foreign_keys: false,
          has_indexes: true
        },
        {
          table_name: 'suppliers',
          table_type: 'BASE TABLE',
          column_count: 7,
          row_count: 0,
          size_bytes: 0,
          has_primary_key: true,
          has_foreign_keys: false,
          has_indexes: true
        },
        {
          table_name: 'cash_registers',
          table_type: 'BASE TABLE',
          column_count: 16,
          row_count: 0,
          size_bytes: 0,
          has_primary_key: true,
          has_foreign_keys: true,
          has_indexes: true
        },
        {
          table_name: 'cash_movements',
          table_type: 'BASE TABLE',
          column_count: 9,
          row_count: 0,
          size_bytes: 0,
          has_primary_key: true,
          has_foreign_keys: true,
          has_indexes: true
        }
      ];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getTableMetadata:', error);
    // En caso de error completo, retornar metadatos básicos hardcodeados
    return [
      {
        table_name: 'users',
        table_type: 'BASE TABLE',
        column_count: 6,
        row_count: 0,
        size_bytes: 0,
        has_primary_key: true,
        has_foreign_keys: false,
        has_indexes: true
      },
      {
        table_name: 'products',
        table_type: 'BASE TABLE',
        column_count: 17,
        row_count: 0,
        size_bytes: 0,
        has_primary_key: true,
        has_foreign_keys: true,
        has_indexes: true
      },
      {
        table_name: 'sales',
        table_type: 'BASE TABLE',
        column_count: 10,
        row_count: 0,
        size_bytes: 0,
        has_primary_key: true,
        has_foreign_keys: true,
        has_indexes: true
      }
    ];
  }
};

// Generar script SQL completo para PostgreSQL
export const generatePostgreSQLExport = async (
  config: ExportConfiguration
): Promise<string> => {
  let sqlScript = '';

  // Header del archivo
  sqlScript += generateSQLHeader();

  // Configuración inicial de PostgreSQL
  sqlScript += generateSQLPostgreSQLConfigSection();

  // Extensiones necesarias
  sqlScript += generateExtensions();

  if (config.includeSchema) {
    sqlScript += await generateTableSchemas(config.selectedTables);
  }

  if (config.includeIndexes) {
    sqlScript += await generateIndexes(config.selectedTables);
  }

  if (config.includeFunctions) {
    sqlScript += await generateFunctions();
  }

  if (config.includeViews) {
    sqlScript += await generateViews();
  }

  if (config.includeTriggers) {
    sqlScript += await generateTriggers();
  }

  if (config.includePolicies) {
    sqlScript += await generateRLSPolicies(config.selectedTables);
  }

  if (config.includeData) {
    sqlScript += await generateTableData(config.selectedTables, config.maxRowsPerTable);
  }

  // Footer con instrucciones
  sqlScript += generateInstallationInstructions();

  return sqlScript;
};

const generateSQLHeader = (): string => {
  return `--
-- Exportación de Base de Datos VentasFULL
-- Generado: ${new Date().toLocaleString('es-ES')}
-- Compatible con PostgreSQL 12+
-- 
-- INSTRUCCIONES:
-- 1. Instalar PostgreSQL en Ubuntu: sudo apt install postgresql postgresql-contrib
-- 2. Crear base de datos: sudo -u postgres createdb ventasfull
-- 3. Ejecutar este script: sudo -u postgres psql ventasfull < ventasfull_export.sql
--

`;
};

const generateSQLPostgreSQLConfigSection = (): string => {
  return `-- Configuración de PostgreSQL
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

`;
};

const generateExtensions = (): string => {
  return `-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

`;
};

const generateTableSchemas = async (selectedTables: string[]): Promise<string> => {
  let schemaSQL = `-- =====================================================
-- ESQUEMAS DE TABLAS
-- =====================================================

`;

  // Definiciones de esquemas principales
  const schemas = {
    users: `-- Tabla de usuarios del sistema
CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'employee'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'employee'::text])));

`,
    categories: `-- Tabla de categorías de productos
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);

`,
    suppliers: `-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact_person text DEFAULT ''::text,
    email text DEFAULT ''::text,
    phone text DEFAULT ''::text,
    address text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);

`,
    customers: `-- Tabla de clientes
CREATE TABLE IF NOT EXISTS public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text DEFAULT ''::text,
    phone text DEFAULT ''::text,
    address text DEFAULT ''::text,
    cedula text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);

`,
    products: `-- Tabla de productos
CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text,
    sale_price numeric(10,2) DEFAULT 0 NOT NULL,
    purchase_price numeric(10,2) DEFAULT 0,
    stock integer DEFAULT 0 NOT NULL,
    barcode text DEFAULT ''::text,
    category_id uuid,
    supplier_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    has_imei_serial boolean DEFAULT false,
    imei_serial_type text DEFAULT 'serial'::text,
    requires_imei_serial boolean DEFAULT false,
    bulk_import_batch text DEFAULT ''::text,
    import_notes text DEFAULT ''::text,
    imported_at timestamp with time zone,
    imported_by uuid
);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_price_check CHECK ((sale_price >= (0)::numeric));

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_purchase_price_check CHECK ((purchase_price >= (0)::numeric));

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_stock_check CHECK ((stock >= 0));

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_imei_serial_type_check CHECK ((imei_serial_type = ANY (ARRAY['imei'::text, 'serial'::text, 'both'::text])));

`,
    sales: `-- Tabla de ventas
CREATE TABLE IF NOT EXISTS public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    subtotal numeric(10,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    customer_id uuid,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    payment_type text DEFAULT 'cash'::text,
    total_paid numeric(10,2) DEFAULT 0,
    payment_status text DEFAULT 'pending'::text
);

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_total_amount_check CHECK ((total_amount >= (0)::numeric));

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_payment_type_check CHECK ((payment_type = ANY (ARRAY['cash'::text, 'installment'::text])));

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text])));

`,
    sale_items: `-- Tabla de items de venta
CREATE TABLE IF NOT EXISTS public.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) DEFAULT 0 NOT NULL,
    total_price numeric(10,2) DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_quantity_check CHECK ((quantity > 0));

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_unit_price_check CHECK ((unit_price >= (0)::numeric));

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_total_price_check CHECK ((total_price >= (0)::numeric));

`,
    cash_registers: `-- Tabla de cajas registradoras
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    opening_amount numeric(10,2) DEFAULT 0,
    closing_amount numeric(10,2) DEFAULT 0,
    expected_closing_amount numeric(10,2) DEFAULT 0,
    actual_closing_amount numeric(10,2) DEFAULT 0,
    discrepancy_amount numeric(10,2) DEFAULT 0,
    discrepancy_reason text DEFAULT ''::text,
    session_notes text DEFAULT ''::text,
    last_movement_at timestamp with time zone DEFAULT now(),
    total_sales numeric(10,2) DEFAULT 0,
    status text DEFAULT 'open'::text,
    opened_at timestamp with time zone DEFAULT now(),
    closed_at timestamp with time zone,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])));

`,
    cash_movements: `-- Tabla de movimientos de caja
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cash_register_id uuid NOT NULL,
    type text NOT NULL,
    category text DEFAULT ''::text,
    amount numeric(10,2) NOT NULL,
    description text DEFAULT ''::text,
    reference_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_amount_check CHECK ((amount >= (0)::numeric));

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text, 'sale'::text, 'opening'::text, 'closing'::text])));

`,
    product_imei_serials: `-- Tabla de IMEI/Serial de productos
CREATE TABLE IF NOT EXISTS public.product_imei_serials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    imei_number text DEFAULT ''::text,
    serial_number text DEFAULT ''::text,
    status text DEFAULT 'available'::text,
    sale_id uuid,
    sale_item_id uuid,
    sold_at timestamp with time zone,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    imei_slot integer
);

ALTER TABLE ONLY public.product_imei_serials
    ADD CONSTRAINT product_imei_serials_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_imei_serials
    ADD CONSTRAINT product_imei_serials_status_check CHECK ((status = ANY (ARRAY['available'::text, 'sold'::text, 'reserved'::text, 'defective'::text, 'returned'::text])));

ALTER TABLE ONLY public.product_imei_serials
    ADD CONSTRAINT product_imei_serials_number_check CHECK (((imei_number <> ''::text) OR (serial_number <> ''::text)));

`,
    payment_installments: `-- Tabla de abonos de pago
CREATE TABLE IF NOT EXISTS public.payment_installments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    amount_paid numeric(10,2) DEFAULT 0 NOT NULL,
    payment_date timestamp with time zone DEFAULT now(),
    payment_method text DEFAULT 'cash'::text,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.payment_installments
    ADD CONSTRAINT payment_installments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_installments
    ADD CONSTRAINT payment_installments_amount_paid_check CHECK ((amount_paid > (0)::numeric));

ALTER TABLE ONLY public.payment_installments
    ADD CONSTRAINT payment_installments_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'transfer'::text, 'other'::text])));

`
  };

  // Agregar esquemas de tablas seleccionadas
  for (const tableName of selectedTables) {
    if (schemas[tableName as keyof typeof schemas]) {
      schemaSQL += schemas[tableName as keyof typeof schemas];
    }
  }

  return schemaSQL;
};

const generateIndexes = async (selectedTables: string[]): Promise<string> => {
  let indexSQL = `-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

`;

  const indexDefinitions = {
    users: [
      `CREATE INDEX IF NOT EXISTS users_email_idx ON public.users USING btree (email);`,
      `CREATE INDEX IF NOT EXISTS users_role_idx ON public.users USING btree (role);`,
      `CREATE INDEX IF NOT EXISTS users_is_active_idx ON public.users USING btree (is_active);`
    ],
    products: [
      `CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products USING btree (category_id);`,
      `CREATE INDEX IF NOT EXISTS products_supplier_id_idx ON public.products USING btree (supplier_id);`,
      `CREATE INDEX IF NOT EXISTS products_stock_idx ON public.products USING btree (stock);`,
      `CREATE INDEX IF NOT EXISTS products_has_imei_serial_idx ON public.products USING btree (has_imei_serial);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique_idx ON public.products USING btree (barcode) WHERE (barcode <> ''::text);`
    ],
    sales: [
      `CREATE INDEX IF NOT EXISTS sales_created_at_idx ON public.sales USING btree (created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS sales_customer_id_idx ON public.sales USING btree (customer_id);`,
      `CREATE INDEX IF NOT EXISTS sales_user_id_idx ON public.sales USING btree (user_id);`,
      `CREATE INDEX IF NOT EXISTS sales_payment_type_idx ON public.sales USING btree (payment_type);`,
      `CREATE INDEX IF NOT EXISTS sales_payment_status_idx ON public.sales USING btree (payment_status);`
    ],
    sale_items: [
      `CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx ON public.sale_items USING btree (sale_id);`,
      `CREATE INDEX IF NOT EXISTS sale_items_product_id_idx ON public.sale_items USING btree (product_id);`
    ],
    cash_registers: [
      `CREATE INDEX IF NOT EXISTS cash_registers_user_id_idx ON public.cash_registers USING btree (user_id);`,
      `CREATE INDEX IF NOT EXISTS cash_registers_status_idx ON public.cash_registers USING btree (status);`,
      `CREATE INDEX IF NOT EXISTS cash_registers_opened_at_idx ON public.cash_registers USING btree (opened_at DESC);`
    ],
    cash_movements: [
      `CREATE INDEX IF NOT EXISTS cash_movements_cash_register_id_idx ON public.cash_movements USING btree (cash_register_id);`,
      `CREATE INDEX IF NOT EXISTS cash_movements_type_idx ON public.cash_movements USING btree (type);`,
      `CREATE INDEX IF NOT EXISTS cash_movements_created_at_idx ON public.cash_movements USING btree (created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS cash_movements_category_idx ON public.cash_movements USING btree (category);`
    ],
    product_imei_serials: [
      `CREATE INDEX IF NOT EXISTS idx_product_imei_serials_product_id ON public.product_imei_serials USING btree (product_id);`,
      `CREATE INDEX IF NOT EXISTS idx_product_imei_serials_status ON public.product_imei_serials USING btree (status);`,
      `CREATE INDEX IF NOT EXISTS idx_product_imei_serials_sale_id ON public.product_imei_serials USING btree (sale_id);`,
      `CREATE INDEX IF NOT EXISTS idx_product_imei_serials_imei ON public.product_imei_serials USING btree (imei_number);`,
      `CREATE INDEX IF NOT EXISTS idx_product_imei_serials_serial ON public.product_imei_serials USING btree (serial_number);`
    ],
    payment_installments: [
      `CREATE INDEX IF NOT EXISTS payment_installments_sale_id_idx ON public.payment_installments USING btree (sale_id);`,
      `CREATE INDEX IF NOT EXISTS payment_installments_payment_date_idx ON public.payment_installments USING btree (payment_date DESC);`
    ]
  };

  for (const tableName of selectedTables) {
    if (indexDefinitions[tableName as keyof typeof indexDefinitions]) {
      indexSQL += `-- Índices para ${tableName}\n`;
      indexSQL += indexDefinitions[tableName as keyof typeof indexDefinitions].join('\n') + '\n\n';
    }
  }

  return indexSQL;
};

const generateFunctions = async (): Promise<string> => {
  return `-- =====================================================
-- FUNCIONES DEL SISTEMA
-- =====================================================

-- Función para validar una sola caja abierta por usuario
CREATE OR REPLACE FUNCTION public.validate_single_open_register()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.status = 'open' THEN
        IF EXISTS (
            SELECT 1 FROM cash_registers 
            WHERE user_id = NEW.user_id 
            AND status = 'open' 
            AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) THEN
            RAISE EXCEPTION 'El usuario ya tiene una caja abierta';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Función para crear movimiento de apertura
CREATE OR REPLACE FUNCTION public.create_opening_movement()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO cash_movements (
        cash_register_id,
        type,
        category,
        amount,
        description,
        created_by
    ) VALUES (
        NEW.id,
        'opening',
        'apertura',
        NEW.opening_amount,
        'Apertura de caja registradora',
        NEW.user_id
    );
    RETURN NEW;
END;
$$;

-- Función para crear movimiento de cierre
CREATE OR REPLACE FUNCTION public.create_closing_movement()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.status = 'open' AND NEW.status = 'closed' THEN
        INSERT INTO cash_movements (
            cash_register_id,
            type,
            category,
            amount,
            description,
            created_by
        ) VALUES (
            NEW.id,
            'closing',
            'cierre',
            NEW.actual_closing_amount,
            'Cierre de caja registradora',
            NEW.user_id
        );
    END IF;
    RETURN NEW;
END;
$$;

`;
};

const generateViews = async (): Promise<string> => {
  return `-- =====================================================
-- VISTAS DEL SISTEMA
-- =====================================================

-- Vista detallada de productos
CREATE OR REPLACE VIEW public.products_detailed AS
SELECT 
    p.*,
    c.name as category_name,
    s.name as supplier_name,
    s.contact_person as supplier_contact,
    COALESCE(imei_count.available_count, 0) as available_imei_serial_count,
    sales_stats.last_sale_date,
    COALESCE(sales_stats.total_sold, 0) as total_sold_all_time
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN (
    SELECT product_id, COUNT(*) as available_count
    FROM product_imei_serials
    WHERE status = 'available'
    GROUP BY product_id
) imei_count ON p.id = imei_count.product_id
LEFT JOIN (
    SELECT 
        si.product_id,
        MAX(s.created_at) as last_sale_date,
        SUM(si.quantity) as total_sold
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    GROUP BY si.product_id
) sales_stats ON p.id = sales_stats.product_id;

-- Vista de resumen de cajas registradoras
CREATE OR REPLACE VIEW public.cash_register_summary AS
SELECT 
    cr.*,
    u.name as operator_name,
    u.email as operator_email,
    COALESCE(movements.total_movements, 0) as total_movements,
    COALESCE(movements.total_income, 0) as total_income,
    COALESCE(movements.total_expenses, 0) as total_expenses,
    COALESCE(movements.calculated_sales, 0) as calculated_sales,
    (cr.opening_amount + COALESCE(movements.total_income, 0) + COALESCE(movements.calculated_sales, 0) - COALESCE(movements.total_expenses, 0)) as calculated_balance,
    CASE 
        WHEN cr.closed_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (cr.closed_at - cr.opened_at)) / 3600
        ELSE 
            EXTRACT(EPOCH FROM (NOW() - cr.opened_at)) / 3600
    END as session_duration_hours
FROM cash_registers cr
LEFT JOIN users u ON cr.user_id = u.id
LEFT JOIN (
    SELECT 
        cash_register_id,
        COUNT(*) as total_movements,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
        SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as calculated_sales
    FROM cash_movements
    GROUP BY cash_register_id
) movements ON cr.id = movements.cash_register_id;

`;
};

const generateTriggers = async (): Promise<string> => {
  return `-- =====================================================
-- TRIGGERS DEL SISTEMA
-- =====================================================

-- Trigger para validar una sola caja abierta
DROP TRIGGER IF EXISTS trigger_validate_single_open_register ON public.cash_registers;
CREATE TRIGGER trigger_validate_single_open_register
    BEFORE INSERT ON public.cash_registers
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_single_open_register();

-- Trigger para crear movimiento de apertura
DROP TRIGGER IF EXISTS trigger_create_opening_movement ON public.cash_registers;
CREATE TRIGGER trigger_create_opening_movement
    AFTER INSERT ON public.cash_registers
    FOR EACH ROW
    EXECUTE FUNCTION public.create_opening_movement();

-- Trigger para crear movimiento de cierre
DROP TRIGGER IF EXISTS trigger_create_closing_movement ON public.cash_registers;
CREATE TRIGGER trigger_create_closing_movement
    AFTER UPDATE ON public.cash_registers
    FOR EACH ROW
    EXECUTE FUNCTION public.create_closing_movement();

`;
};

const generateRLSPolicies = async (selectedTables: string[]): Promise<string> => {
  let rlsSQL = `-- =====================================================
-- POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY)
-- =====================================================

`;

  for (const tableName of selectedTables) {
    rlsSQL += `-- Habilitar RLS en ${tableName}
ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;

-- Políticas para ${tableName}
DROP POLICY IF EXISTS "Public can view ${tableName}" ON public.${tableName};
CREATE POLICY "Public can view ${tableName}" ON public.${tableName} FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can insert ${tableName}" ON public.${tableName};
CREATE POLICY "Public can insert ${tableName}" ON public.${tableName} FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update ${tableName}" ON public.${tableName};
CREATE POLICY "Public can update ${tableName}" ON public.${tableName} FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Public can delete ${tableName}" ON public.${tableName};
CREATE POLICY "Public can delete ${tableName}" ON public.${tableName} FOR DELETE TO public USING (true);

`;
  }

  return rlsSQL;
};

const generateTableData = async (selectedTables: string[], maxRows: number): Promise<string> => {
  let dataSQL = `-- =====================================================
-- DATOS DE TABLAS
-- =====================================================

`;

  if (isDemoMode) {
    // Generar datos demo estructurados
    dataSQL += `-- Datos de demostración para testing
-- Nota: Cambiar estos datos por los reales en producción

-- Insertar usuarios demo
INSERT INTO public.users (id, name, email, role, is_active, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'Administrador Sistema', 'admin@ventasfull.com', 'admin', true, NOW()),
('22222222-2222-2222-2222-222222222222', 'Gerente Principal', 'gerente@ventasfull.com', 'manager', true, NOW()),
('33333333-3333-3333-3333-333333333333', 'Empleado Ventas', 'empleado@ventasfull.com', 'employee', true, NOW())
ON CONFLICT (email) DO NOTHING;

-- Insertar categorías demo
INSERT INTO public.categories (id, name, description, created_at) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Smartphones', 'Teléfonos inteligentes y móviles', NOW()),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Accesorios', 'Accesorios para dispositivos móviles', NOW()),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Tablets', 'Tabletas y dispositivos portátiles', NOW())
ON CONFLICT (name) DO NOTHING;

-- Insertar proveedores demo
INSERT INTO public.suppliers (id, name, contact_person, email, phone, address, created_at) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Distribuidora Tech', 'Juan Pérez', 'contacto@tech.com', '3001234567', 'Calle 123 #45-67', NOW()),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Importadora Global', 'María García', 'ventas@global.com', '3009876543', 'Carrera 45 #12-34', NOW())
ON CONFLICT DO NOTHING;

-- Insertar productos demo
INSERT INTO public.products (id, name, description, sale_price, purchase_price, stock, barcode, category_id, supplier_id, has_imei_serial, imei_serial_type, requires_imei_serial, created_at) VALUES
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'iPhone 15 Pro 128GB', 'Smartphone Apple iPhone 15 Pro 128GB Titanio Natural', 4500000, 4000000, 5, '123456789012', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true, 'imei', true, NOW()),
('gggggggg-gggg-gggg-gggg-gggggggggggg', 'Samsung Galaxy S24 256GB', 'Smartphone Samsung Galaxy S24 256GB Negro', 3200000, 2800000, 8, '987654321098', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true, 'imei', true, NOW()),
('hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh', 'Cargador USB-C 20W', 'Cargador rápido USB-C 20W universal', 45000, 25000, 50, '456789123456', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dddddddd-dddd-dddd-dddd-dddddddddddd', false, 'serial', false, NOW())
ON CONFLICT DO NOTHING;

`;
    return dataSQL;
  }

  // Para modo producción, exportar datos reales
  for (const tableName of selectedTables) {
    try {
      if (!supabase) continue;

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(maxRows);

      if (error) {
        dataSQL += `-- Error al exportar datos de ${tableName}: ${error.message}\n\n`;
        continue;
      }

      if (data && data.length > 0) {
        dataSQL += `-- Datos de ${tableName} (${data.length} registros)\n`;
        
        // Generar INSERT statements
        const columns = Object.keys(data[0]);
        dataSQL += `INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES\n`;
        
        const values = data.map(row => {
          const rowValues = columns.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            if (typeof value === 'boolean') return value ? 'true' : 'false';
            if (value instanceof Date) return `'${value.toISOString()}'`;
            return value;
          });
          return `(${rowValues.join(', ')})`;
        });

        dataSQL += values.join(',\n');
        dataSQL += `\nON CONFLICT DO NOTHING;\n\n`;
      }
    } catch (error) {
      console.error(`Error exporting data from ${tableName}:`, error);
      dataSQL += `-- Error al procesar tabla ${tableName}\n\n`;
    }
  }

  return dataSQL;
};

const generateInstallationInstructions = (): string => {
  return `
-- =====================================================
-- INSTRUCCIONES DE INSTALACIÓN EN UBUNTU SERVER
-- =====================================================

/*
PASOS PARA INSTALACIÓN:

1. PREPARAR EL SERVIDOR UBUNTU:
   sudo apt update && sudo apt upgrade -y
   sudo apt install postgresql postgresql-contrib -y
   sudo systemctl start postgresql
   sudo systemctl enable postgresql

2. CONFIGURAR POSTGRESQL:
   sudo -u postgres psql
   CREATE DATABASE ventasfull;
   CREATE USER ventasfull_app WITH PASSWORD 'tu_password_muy_seguro';
   GRANT ALL PRIVILEGES ON DATABASE ventasfull TO ventasfull_app;
   \\q

3. IMPORTAR ESTE ARCHIVO:
   sudo -u postgres psql ventasfull < ventasfull_export.sql

4. CONFIGURAR PERMISOS FINALES:
   sudo -u postgres psql ventasfull
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ventasfull_app;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ventasfull_app;
   GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ventasfull_app;
   \\q

5. CONFIGURAR APLICACIÓN:
   - Host: localhost (o IP del servidor)
   - Puerto: 5432
   - Base de datos: ventasfull
   - Usuario: ventasfull_app
   - Contraseña: [la que configuraste en el paso 2]

6. CONFIGURAR FIREWALL (si es necesario):
   sudo ufw allow 5432/tcp
   
7. CONFIGURAR POSTGRESQL PARA CONEXIONES REMOTAS (opcional):
   Editar /etc/postgresql/*/main/postgresql.conf:
   listen_addresses = '*'
   
   Editar /etc/postgresql/*/main/pg_hba.conf:
   host    ventasfull    ventasfull_app    0.0.0.0/0    md5
   
   sudo systemctl restart postgresql

8. BACKUP AUTOMÁTICO (recomendado):
   Crear script de backup diario:
   #!/bin/bash
   pg_dump -U ventasfull_app -h localhost ventasfull > /backup/ventasfull_$(date +%Y%m%d).sql
   
   Agregar a crontab:
   0 2 * * * /path/to/backup_script.sh

NOTAS IMPORTANTES:
- Cambia 'tu_password_muy_seguro' por una contraseña real y segura
- Configura backups regulares para proteger tus datos
- Considera usar SSL/TLS para conexiones remotas
- Monitorea el rendimiento y ajusta la configuración según sea necesario
- Mantén PostgreSQL actualizado para seguridad

SOPORTE:
Para soporte técnico o consultas sobre la instalación,
consulta la documentación oficial de PostgreSQL o
contacta al equipo de desarrollo de VentasFULL.
*/

-- Fin del archivo de exportación
-- Generado por VentasFULL v1.0
`;
};

// Función para generar script de backup automático
export const generateBackupScript = (): string => {
  return `#!/bin/bash
# Script de backup automático para VentasFULL
# Guardar como: /usr/local/bin/backup_ventasfull.sh
# Hacer ejecutable: chmod +x /usr/local/bin/backup_ventasfull.sh

# Configuración
DB_NAME="ventasfull"
DB_USER="ventasfull_app"
DB_HOST="localhost"
BACKUP_DIR="/backup/ventasfull"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/ventasfull_backup_$DATE.sql"

# Crear directorio de backup si no existe
mkdir -p $BACKUP_DIR

# Realizar backup
echo "Iniciando backup de VentasFULL..."
pg_dump -U $DB_USER -h $DB_HOST -W $DB_NAME > $BACKUP_FILE

# Comprimir backup
gzip $BACKUP_FILE

# Eliminar backups antiguos (mantener últimos 30 días)
find $BACKUP_DIR -name "ventasfull_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completado: $BACKUP_FILE.gz"

# Agregar a crontab para ejecución diaria a las 2 AM:
# 0 2 * * * /usr/local/bin/backup_ventasfull.sh >> /var/log/ventasfull_backup.log 2>&1
`;
};

// Función para generar configuración de PostgreSQL optimizada
export const generatePostgreSQLConfig = (): string => {
  return `# Configuración optimizada de PostgreSQL para VentasFULL
# Archivo: /etc/postgresql/*/main/postgresql.conf

# Configuración de memoria
shared_buffers = 256MB                  # 25% de RAM disponible
effective_cache_size = 1GB              # 75% de RAM disponible
work_mem = 4MB                          # Para operaciones de ordenamiento
maintenance_work_mem = 64MB             # Para operaciones de mantenimiento

# Configuración de WAL
wal_buffers = 16MB
checkpoint_completion_target = 0.9
wal_level = replica

# Configuración de conexiones
max_connections = 100
listen_addresses = 'localhost'          # Cambiar a '*' para conexiones remotas

# Configuración de logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_min_duration_statement = 1000       # Log consultas lentas (>1s)

# Configuración de autovacuum
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 1min

# Configuración específica para VentasFULL
# Optimizaciones para transacciones frecuentes
fsync = on
synchronous_commit = on
commit_delay = 0

# Configuración de timezone
timezone = 'America/Bogota'
log_timezone = 'America/Bogota'
`;
};