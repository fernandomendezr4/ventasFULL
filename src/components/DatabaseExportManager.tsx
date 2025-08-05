import React, { useState } from 'react';
import { Download, Database, FileText, Server, CheckCircle, AlertTriangle, Copy, Terminal } from 'lucide-react';
import { supabase, isDemoMode } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ExportOptions {
  includeSchema: boolean;
  includeData: boolean;
  includeFunctions: boolean;
  includeViews: boolean;
  includeTriggers: boolean;
  includeIndexes: boolean;
  includePolicies: boolean;
  selectedTables: string[];
  exportFormat: 'sql' | 'dump';
  compressionLevel: 'none' | 'gzip';
}

interface TableInfo {
  table_name: string;
  table_type: string;
  row_count: number;
  size_mb: number;
}

export default function DatabaseExportManager() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeSchema: true,
    includeData: true,
    includeFunctions: true,
    includeViews: true,
    includeTriggers: true,
    includeIndexes: true,
    includePolicies: true,
    selectedTables: [],
    exportFormat: 'sql',
    compressionLevel: 'none'
  });
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([]);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    downloadUrl?: string;
    filename?: string;
    size?: number;
    error?: string;
  } | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  React.useEffect(() => {
    loadTableInfo();
  }, []);

  const loadTableInfo = async () => {
    try {
      if (isDemoMode) {
        // Datos demo de tablas
        const demoTables: TableInfo[] = [
          { table_name: 'users', table_type: 'BASE TABLE', row_count: 5, size_mb: 0.1 },
          { table_name: 'categories', table_type: 'BASE TABLE', row_count: 8, size_mb: 0.05 },
          { table_name: 'suppliers', table_type: 'BASE TABLE', row_count: 12, size_mb: 0.08 },
          { table_name: 'customers', table_type: 'BASE TABLE', row_count: 150, size_mb: 0.5 },
          { table_name: 'products', table_type: 'BASE TABLE', row_count: 300, size_mb: 2.1 },
          { table_name: 'sales', table_type: 'BASE TABLE', row_count: 450, size_mb: 1.8 },
          { table_name: 'sale_items', table_type: 'BASE TABLE', row_count: 1200, size_mb: 3.2 },
          { table_name: 'cash_registers', table_type: 'BASE TABLE', row_count: 85, size_mb: 0.3 },
          { table_name: 'cash_movements', table_type: 'BASE TABLE', row_count: 2500, size_mb: 5.4 },
          { table_name: 'payment_installments', table_type: 'BASE TABLE', row_count: 180, size_mb: 0.7 },
          { table_name: 'product_imei_serials', table_type: 'BASE TABLE', row_count: 800, size_mb: 1.9 }
        ];
        
        setAvailableTables(demoTables);
        setExportOptions(prev => ({ 
          ...prev, 
          selectedTables: demoTables.map(t => t.table_name) 
        }));
        return;
      }

      if (!supabase) {
        setAvailableTables([]);
        return;
      }

      // Obtener información de tablas reales
      const { data, error } = await supabase.rpc('get_table_info');
      
      if (error) {
        console.error('Error loading table info:', error);
        // Fallback: usar lista estática de tablas conocidas
        const knownTables = [
          'users', 'categories', 'suppliers', 'customers', 'products', 
          'sales', 'sale_items', 'cash_registers', 'cash_movements', 
          'payment_installments', 'product_imei_serials', 'cash_register_sales',
          'cash_register_installments', 'cash_register_audit_logs'
        ];
        
        const fallbackTables: TableInfo[] = knownTables.map(name => ({
          table_name: name,
          table_type: 'BASE TABLE',
          row_count: 0,
          size_mb: 0
        }));
        
        setAvailableTables(fallbackTables);
        setExportOptions(prev => ({ 
          ...prev, 
          selectedTables: knownTables 
        }));
        return;
      }

      setAvailableTables(data || []);
      setExportOptions(prev => ({ 
        ...prev, 
        selectedTables: (data || []).map((t: TableInfo) => t.table_name) 
      }));
    } catch (error) {
      console.error('Error loading table info:', error);
      setAvailableTables([]);
    }
  };

  const generateExportSQL = async (): Promise<string> => {
    let sqlContent = '';

    // Header del archivo
    sqlContent += `-- =====================================================\n`;
    sqlContent += `-- EXPORTACIÓN DE BASE DE DATOS - VentasFULL\n`;
    sqlContent += `-- Generado: ${new Date().toLocaleString('es-ES')}\n`;
    sqlContent += `-- Usuario: ${user?.name || 'Sistema'}\n`;
    sqlContent += `-- Modo: ${isDemoMode ? 'Demo' : 'Producción'}\n`;
    sqlContent += `-- =====================================================\n\n`;

    // Configuración inicial
    sqlContent += `-- Configuración de PostgreSQL\n`;
    sqlContent += `SET statement_timeout = 0;\n`;
    sqlContent += `SET lock_timeout = 0;\n`;
    sqlContent += `SET idle_in_transaction_session_timeout = 0;\n`;
    sqlContent += `SET client_encoding = 'UTF8';\n`;
    sqlContent += `SET standard_conforming_strings = on;\n`;
    sqlContent += `SET check_function_bodies = false;\n`;
    sqlContent += `SET xmloption = content;\n`;
    sqlContent += `SET client_min_messages = warning;\n`;
    sqlContent += `SET row_security = off;\n\n`;

    // Crear extensiones necesarias
    sqlContent += `-- Extensiones requeridas\n`;
    sqlContent += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;\n`;
    sqlContent += `CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;\n\n`;

    if (exportOptions.includeSchema) {
      sqlContent += await generateSchemaSQL();
    }

    if (exportOptions.includeData) {
      sqlContent += await generateDataSQL();
    }

    if (exportOptions.includeFunctions) {
      sqlContent += await generateFunctionsSQL();
    }

    if (exportOptions.includeViews) {
      sqlContent += await generateViewsSQL();
    }

    if (exportOptions.includeTriggers) {
      sqlContent += await generateTriggersSQL();
    }

    if (exportOptions.includeIndexes) {
      sqlContent += await generateIndexesSQL();
    }

    if (exportOptions.includePolicies) {
      sqlContent += await generatePoliciesSQL();
    }

    // Footer con instrucciones
    sqlContent += `\n-- =====================================================\n`;
    sqlContent += `-- INSTRUCCIONES DE INSTALACIÓN\n`;
    sqlContent += `-- =====================================================\n`;
    sqlContent += `-- 1. Instalar PostgreSQL en Ubuntu Server:\n`;
    sqlContent += `--    sudo apt update\n`;
    sqlContent += `--    sudo apt install postgresql postgresql-contrib\n`;
    sqlContent += `--\n`;
    sqlContent += `-- 2. Crear base de datos:\n`;
    sqlContent += `--    sudo -u postgres createdb ventasfull\n`;
    sqlContent += `--\n`;
    sqlContent += `-- 3. Ejecutar este archivo:\n`;
    sqlContent += `--    sudo -u postgres psql ventasfull < ventasfull_export.sql\n`;
    sqlContent += `--\n`;
    sqlContent += `-- 4. Crear usuario de aplicación:\n`;
    sqlContent += `--    sudo -u postgres psql\n`;
    sqlContent += `--    CREATE USER ventasfull_app WITH PASSWORD 'tu_password_seguro';\n`;
    sqlContent += `--    GRANT ALL PRIVILEGES ON DATABASE ventasfull TO ventasfull_app;\n`;
    sqlContent += `--    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ventasfull_app;\n`;
    sqlContent += `--    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ventasfull_app;\n`;
    sqlContent += `--\n`;
    sqlContent += `-- 5. Configurar conexión en tu aplicación:\n`;
    sqlContent += `--    Host: localhost\n`;
    sqlContent += `--    Puerto: 5432\n`;
    sqlContent += `--    Base de datos: ventasfull\n`;
    sqlContent += `--    Usuario: ventasfull_app\n`;
    sqlContent += `--    Contraseña: [la que configuraste]\n`;

    return sqlContent;
  };

  const generateSchemaSQL = async (): Promise<string> => {
    let schemaSQL = `-- =====================================================\n`;
    schemaSQL += `-- ESQUEMA DE BASE DE DATOS\n`;
    schemaSQL += `-- =====================================================\n\n`;

    // Definir esquema de tablas principales
    const tableDefinitions = {
      users: `
CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'employee'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'employee'::text])))
);`,
      categories: `
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT categories_pkey PRIMARY KEY (id),
    CONSTRAINT categories_name_key UNIQUE (name)
);`,
      suppliers: `
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact_person text DEFAULT ''::text,
    email text DEFAULT ''::text,
    phone text DEFAULT ''::text,
    address text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);`,
      customers: `
CREATE TABLE IF NOT EXISTS public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text DEFAULT ''::text,
    phone text DEFAULT ''::text,
    address text DEFAULT ''::text,
    cedula text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT customers_pkey PRIMARY KEY (id)
);`,
      products: `
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
    imported_by uuid,
    CONSTRAINT products_pkey PRIMARY KEY (id),
    CONSTRAINT products_price_check CHECK ((sale_price >= (0)::numeric)),
    CONSTRAINT products_purchase_price_check CHECK ((purchase_price >= (0)::numeric)),
    CONSTRAINT products_stock_check CHECK ((stock >= 0)),
    CONSTRAINT products_imei_serial_type_check CHECK ((imei_serial_type = ANY (ARRAY['imei'::text, 'serial'::text, 'both'::text]))),
    CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL,
    CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL,
    CONSTRAINT products_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES public.users(id)
);`,
      sales: `
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
    payment_status text DEFAULT 'pending'::text,
    CONSTRAINT sales_pkey PRIMARY KEY (id),
    CONSTRAINT sales_total_amount_check CHECK ((total_amount >= (0)::numeric)),
    CONSTRAINT sales_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT sales_discount_amount_check CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT sales_total_paid_check CHECK ((total_paid >= (0)::numeric)),
    CONSTRAINT sales_payment_type_check CHECK ((payment_type = ANY (ARRAY['cash'::text, 'installment'::text]))),
    CONSTRAINT sales_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text]))),
    CONSTRAINT sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL,
    CONSTRAINT sales_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL
);`,
      cash_registers: `
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
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cash_registers_pkey PRIMARY KEY (id),
    CONSTRAINT cash_registers_opening_amount_check CHECK ((opening_amount >= (0)::numeric)),
    CONSTRAINT cash_registers_closing_amount_check CHECK ((closing_amount >= (0)::numeric)),
    CONSTRAINT cash_registers_total_sales_check CHECK ((total_sales >= (0)::numeric)),
    CONSTRAINT cash_registers_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text]))),
    CONSTRAINT cash_registers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL
);`
    };

    // Agregar definiciones de tablas seleccionadas
    for (const tableName of exportOptions.selectedTables) {
      if (tableDefinitions[tableName as keyof typeof tableDefinitions]) {
        schemaSQL += `-- Tabla: ${tableName}\n`;
        schemaSQL += tableDefinitions[tableName as keyof typeof tableDefinitions];
        schemaSQL += `\n\n`;
      }
    }

    return schemaSQL;
  };

  const generateDataSQL = async (): Promise<string> => {
    let dataSQL = `-- =====================================================\n`;
    dataSQL += `-- DATOS DE TABLAS\n`;
    dataSQL += `-- =====================================================\n\n`;

    if (isDemoMode) {
      // Generar datos demo
      dataSQL += `-- Datos de demostración\n`;
      dataSQL += `-- Nota: Estos son datos de ejemplo para testing\n\n`;

      // Datos de usuarios demo
      dataSQL += `-- Usuarios\n`;
      dataSQL += `INSERT INTO public.users (id, name, email, role, is_active, created_at) VALUES\n`;
      dataSQL += `('demo-user-1', 'Administrador Demo', 'admin@ventasfull.com', 'admin', true, NOW()),\n`;
      dataSQL += `('demo-user-2', 'Gerente Demo', 'gerente@ventasfull.com', 'manager', true, NOW()),\n`;
      dataSQL += `('demo-user-3', 'Empleado Demo', 'empleado@ventasfull.com', 'employee', true, NOW())\n`;
      dataSQL += `ON CONFLICT (email) DO NOTHING;\n\n`;

      // Datos de categorías demo
      dataSQL += `-- Categorías\n`;
      dataSQL += `INSERT INTO public.categories (id, name, description, created_at) VALUES\n`;
      dataSQL += `('demo-cat-1', 'Smartphones', 'Teléfonos inteligentes', NOW()),\n`;
      dataSQL += `('demo-cat-2', 'Accesorios', 'Accesorios electrónicos', NOW()),\n`;
      dataSQL += `('demo-cat-3', 'Tablets', 'Tabletas y dispositivos móviles', NOW())\n`;
      dataSQL += `ON CONFLICT (name) DO NOTHING;\n\n`;

      return dataSQL;
    }

    // Para modo producción, generar consultas de exportación reales
    for (const tableName of exportOptions.selectedTables) {
      try {
        if (!supabase) continue;

        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1000); // Limitar para evitar archivos muy grandes

        if (error) {
          console.error(`Error exporting data from ${tableName}:`, error);
          dataSQL += `-- Error al exportar datos de ${tableName}: ${error.message}\n\n`;
          continue;
        }

        if (data && data.length > 0) {
          dataSQL += `-- Datos de ${tableName} (${data.length} registros)\n`;
          dataSQL += `INSERT INTO public.${tableName} (${Object.keys(data[0]).join(', ')}) VALUES\n`;
          
          const values = data.map(row => {
            const rowValues = Object.values(row).map(value => {
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
        console.error(`Error processing table ${tableName}:`, error);
        dataSQL += `-- Error al procesar tabla ${tableName}\n\n`;
      }
    }

    return dataSQL;
  };

  const generateFunctionsSQL = async (): Promise<string> => {
    let functionsSQL = `-- =====================================================\n`;
    functionsSQL += `-- FUNCIONES Y PROCEDIMIENTOS ALMACENADOS\n`;
    functionsSQL += `-- =====================================================\n\n`;

    // Funciones esenciales para el sistema
    functionsSQL += `-- Función para validar una sola caja abierta por usuario\n`;
    functionsSQL += `CREATE OR REPLACE FUNCTION validate_single_open_register()\n`;
    functionsSQL += `RETURNS TRIGGER AS $$\n`;
    functionsSQL += `BEGIN\n`;
    functionsSQL += `    IF NEW.status = 'open' THEN\n`;
    functionsSQL += `        IF EXISTS (\n`;
    functionsSQL += `            SELECT 1 FROM cash_registers \n`;
    functionsSQL += `            WHERE user_id = NEW.user_id \n`;
    functionsSQL += `            AND status = 'open' \n`;
    functionsSQL += `            AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)\n`;
    functionsSQL += `        ) THEN\n`;
    functionsSQL += `            RAISE EXCEPTION 'El usuario ya tiene una caja abierta';\n`;
    functionsSQL += `        END IF;\n`;
    functionsSQL += `    END IF;\n`;
    functionsSQL += `    RETURN NEW;\n`;
    functionsSQL += `END;\n`;
    functionsSQL += `$$ LANGUAGE plpgsql;\n\n`;

    // Función para crear movimiento de apertura
    functionsSQL += `-- Función para crear movimiento de apertura automático\n`;
    functionsSQL += `CREATE OR REPLACE FUNCTION create_opening_movement()\n`;
    functionsSQL += `RETURNS TRIGGER AS $$\n`;
    functionsSQL += `BEGIN\n`;
    functionsSQL += `    INSERT INTO cash_movements (\n`;
    functionsSQL += `        cash_register_id,\n`;
    functionsSQL += `        type,\n`;
    functionsSQL += `        category,\n`;
    functionsSQL += `        amount,\n`;
    functionsSQL += `        description,\n`;
    functionsSQL += `        created_by\n`;
    functionsSQL += `    ) VALUES (\n`;
    functionsSQL += `        NEW.id,\n`;
    functionsSQL += `        'opening',\n`;
    functionsSQL += `        'apertura',\n`;
    functionsSQL += `        NEW.opening_amount,\n`;
    functionsSQL += `        'Apertura de caja registradora',\n`;
    functionsSQL += `        NEW.user_id\n`;
    functionsSQL += `    );\n`;
    functionsSQL += `    RETURN NEW;\n`;
    functionsSQL += `END;\n`;
    functionsSQL += `$$ LANGUAGE plpgsql;\n\n`;

    // Función para crear movimiento de cierre
    functionsSQL += `-- Función para crear movimiento de cierre automático\n`;
    functionsSQL += `CREATE OR REPLACE FUNCTION create_closing_movement()\n`;
    functionsSQL += `RETURNS TRIGGER AS $$\n`;
    functionsSQL += `BEGIN\n`;
    functionsSQL += `    IF OLD.status = 'open' AND NEW.status = 'closed' THEN\n`;
    functionsSQL += `        INSERT INTO cash_movements (\n`;
    functionsSQL += `            cash_register_id,\n`;
    functionsSQL += `            type,\n`;
    functionsSQL += `            category,\n`;
    functionsSQL += `            amount,\n`;
    functionsSQL += `            description,\n`;
    functionsSQL += `            created_by\n`;
    functionsSQL += `        ) VALUES (\n`;
    functionsSQL += `            NEW.id,\n`;
    functionsSQL += `            'closing',\n`;
    functionsSQL += `            'cierre',\n`;
    functionsSQL += `            NEW.actual_closing_amount,\n`;
    functionsSQL += `            'Cierre de caja registradora',\n`;
    functionsSQL += `            NEW.user_id\n`;
    functionsSQL += `        );\n`;
    functionsSQL += `    END IF;\n`;
    functionsSQL += `    RETURN NEW;\n`;
    functionsSQL += `END;\n`;
    functionsSQL += `$$ LANGUAGE plpgsql;\n\n`;

    return functionsSQL;
  };

  const generateViewsSQL = async (): Promise<string> => {
    let viewsSQL = `-- =====================================================\n`;
    viewsSQL += `-- VISTAS MATERIALIZADAS Y NORMALES\n`;
    viewsSQL += `-- =====================================================\n\n`;

    // Vista de productos con detalles
    viewsSQL += `-- Vista de productos con información relacionada\n`;
    viewsSQL += `CREATE OR REPLACE VIEW products_detailed AS\n`;
    viewsSQL += `SELECT \n`;
    viewsSQL += `    p.*,\n`;
    viewsSQL += `    c.name as category_name,\n`;
    viewsSQL += `    s.name as supplier_name,\n`;
    viewsSQL += `    s.contact_person as supplier_contact,\n`;
    viewsSQL += `    COALESCE(imei_count.available_count, 0) as available_imei_serial_count,\n`;
    viewsSQL += `    sales_stats.last_sale_date,\n`;
    viewsSQL += `    COALESCE(sales_stats.total_sold, 0) as total_sold_all_time\n`;
    viewsSQL += `FROM products p\n`;
    viewsSQL += `LEFT JOIN categories c ON p.category_id = c.id\n`;
    viewsSQL += `LEFT JOIN suppliers s ON p.supplier_id = s.id\n`;
    viewsSQL += `LEFT JOIN (\n`;
    viewsSQL += `    SELECT product_id, COUNT(*) as available_count\n`;
    viewsSQL += `    FROM product_imei_serials\n`;
    viewsSQL += `    WHERE status = 'available'\n`;
    viewsSQL += `    GROUP BY product_id\n`;
    viewsSQL += `) imei_count ON p.id = imei_count.product_id\n`;
    viewsSQL += `LEFT JOIN (\n`;
    viewsSQL += `    SELECT \n`;
    viewsSQL += `        si.product_id,\n`;
    viewsSQL += `        MAX(s.created_at) as last_sale_date,\n`;
    viewsSQL += `        SUM(si.quantity) as total_sold\n`;
    viewsSQL += `    FROM sale_items si\n`;
    viewsSQL += `    JOIN sales s ON si.sale_id = s.id\n`;
    viewsSQL += `    GROUP BY si.product_id\n`;
    viewsSQL += `) sales_stats ON p.id = sales_stats.product_id;\n\n`;

    return viewsSQL;
  };

  const generateTriggersSQL = async (): Promise<string> => {
    let triggersSQL = `-- =====================================================\n`;
    triggersSQL += `-- TRIGGERS\n`;
    triggersSQL += `-- =====================================================\n\n`;

    // Triggers principales
    triggersSQL += `-- Trigger para validar una sola caja abierta\n`;
    triggersSQL += `DROP TRIGGER IF EXISTS trigger_validate_single_open_register ON cash_registers;\n`;
    triggersSQL += `CREATE TRIGGER trigger_validate_single_open_register\n`;
    triggersSQL += `    BEFORE INSERT ON cash_registers\n`;
    triggersSQL += `    FOR EACH ROW\n`;
    triggersSQL += `    EXECUTE FUNCTION validate_single_open_register();\n\n`;

    triggersSQL += `-- Trigger para crear movimiento de apertura\n`;
    triggersSQL += `DROP TRIGGER IF EXISTS trigger_create_opening_movement ON cash_registers;\n`;
    triggersSQL += `CREATE TRIGGER trigger_create_opening_movement\n`;
    triggersSQL += `    AFTER INSERT ON cash_registers\n`;
    triggersSQL += `    FOR EACH ROW\n`;
    triggersSQL += `    EXECUTE FUNCTION create_opening_movement();\n\n`;

    triggersSQL += `-- Trigger para crear movimiento de cierre\n`;
    triggersSQL += `DROP TRIGGER IF EXISTS trigger_create_closing_movement ON cash_registers;\n`;
    triggersSQL += `CREATE TRIGGER trigger_create_closing_movement\n`;
    triggersSQL += `    AFTER UPDATE ON cash_registers\n`;
    triggersSQL += `    FOR EACH ROW\n`;
    triggersSQL += `    EXECUTE FUNCTION create_closing_movement();\n\n`;

    return triggersSQL;
  };

  const generateIndexesSQL = async (): Promise<string> => {
    let indexesSQL = `-- =====================================================\n`;
    indexesSQL += `-- ÍNDICES PARA OPTIMIZACIÓN\n`;
    indexesSQL += `-- =====================================================\n\n`;

    // Índices principales para rendimiento
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);`,
      `CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);`,
      `CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);`,
      `CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);`,
      `CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);`,
      `CREATE INDEX IF NOT EXISTS idx_cash_movements_register_id ON cash_movements(cash_register_id);`,
      `CREATE INDEX IF NOT EXISTS idx_cash_movements_created_at ON cash_movements(created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_cash_registers_user_id ON cash_registers(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(status);`,
      `CREATE INDEX IF NOT EXISTS idx_cash_registers_opened_at ON cash_registers(opened_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_product_imei_serials_product_id ON product_imei_serials(product_id);`,
      `CREATE INDEX IF NOT EXISTS idx_product_imei_serials_status ON product_imei_serials(status);`,
      `CREATE INDEX IF NOT EXISTS idx_product_imei_serials_sale_id ON product_imei_serials(sale_id);`,
      `CREATE INDEX IF NOT EXISTS idx_payment_installments_sale_id ON payment_installments(sale_id);`,
      `CREATE INDEX IF NOT EXISTS idx_payment_installments_payment_date ON payment_installments(payment_date DESC);`
    ];

    indexesSQL += indexes.join('\n') + '\n\n';

    // Índices únicos para prevenir duplicados
    indexesSQL += `-- Índices únicos\n`;
    indexesSQL += `CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique_idx ON products(barcode) WHERE barcode <> '';\n`;
    indexesSQL += `CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);\n`;
    indexesSQL += `CREATE UNIQUE INDEX IF NOT EXISTS categories_name_idx ON categories(name);\n\n`;

    return indexesSQL;
  };

  const generatePoliciesSQL = async (): Promise<string> => {
    let policiesSQL = `-- =====================================================\n`;
    policiesSQL += `-- POLÍTICAS DE SEGURIDAD (RLS)\n`;
    policiesSQL += `-- =====================================================\n\n`;

    // Habilitar RLS en todas las tablas
    const tables = exportOptions.selectedTables;
    
    for (const tableName of tables) {
      policiesSQL += `-- Habilitar RLS en ${tableName}\n`;
      policiesSQL += `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;\n\n`;

      // Políticas básicas para acceso público (ajustar según necesidades)
      policiesSQL += `-- Políticas para ${tableName}\n`;
      policiesSQL += `CREATE POLICY "Public can view ${tableName}" ON ${tableName} FOR SELECT TO public USING (true);\n`;
      policiesSQL += `CREATE POLICY "Public can insert ${tableName}" ON ${tableName} FOR INSERT TO public WITH CHECK (true);\n`;
      policiesSQL += `CREATE POLICY "Public can update ${tableName}" ON ${tableName} FOR UPDATE TO public USING (true);\n`;
      policiesSQL += `CREATE POLICY "Public can delete ${tableName}" ON ${tableName} FOR DELETE TO public USING (true);\n\n`;
    }

    return policiesSQL;
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      setExportResult(null);

      // Generar contenido SQL
      const sqlContent = await generateExportSQL();
      
      // Crear archivo para descarga
      const blob = new Blob([sqlContent], { type: 'text/sql;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const filename = `ventasfull_export_${new Date().toISOString().split('T')[0]}.sql`;
      const sizeKB = Math.round(blob.size / 1024);

      // Descargar archivo
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      setExportResult({
        success: true,
        downloadUrl: url,
        filename,
        size: sizeKB
      });

    } catch (error) {
      console.error('Error generating export:', error);
      setExportResult({
        success: false,
        error: (error as Error).message
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTableSelection = (tableName: string) => {
    setExportOptions(prev => ({
      ...prev,
      selectedTables: prev.selectedTables.includes(tableName)
        ? prev.selectedTables.filter(t => t !== tableName)
        : [...prev.selectedTables, tableName]
    }));
  };

  const selectAllTables = () => {
    setExportOptions(prev => ({
      ...prev,
      selectedTables: availableTables.map(t => t.table_name)
    }));
  };

  const deselectAllTables = () => {
    setExportOptions(prev => ({
      ...prev,
      selectedTables: []
    }));
  };

  const getInstallationScript = () => {
    return `#!/bin/bash
# Script de instalación para VentasFULL en Ubuntu Server

echo "=== Instalación de VentasFULL en Ubuntu Server ==="

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Iniciar y habilitar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear base de datos y usuario
sudo -u postgres psql << EOF
CREATE DATABASE ventasfull;
CREATE USER ventasfull_app WITH PASSWORD 'cambiar_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE ventasfull TO ventasfull_app;
\\q
EOF

# Importar esquema y datos
echo "Importando base de datos..."
sudo -u postgres psql ventasfull < ventasfull_export_$(date +%Y-%m-%d).sql

# Configurar permisos finales
sudo -u postgres psql ventasfull << EOF
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ventasfull_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ventasfull_app;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ventasfull_app;
\\q
EOF

echo "=== Instalación completada ==="
echo "Configuración de conexión:"
echo "Host: localhost"
echo "Puerto: 5432"
echo "Base de datos: ventasfull"
echo "Usuario: ventasfull_app"
echo "Contraseña: [la que configuraste]"
`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 flex items-center">
            <Database className="h-7 w-7 mr-3 text-blue-600" />
            Exportación de Base de Datos
          </h3>
          <p className="text-slate-600 mt-1">
            Exporta el esquema y datos para instalación en servidor Ubuntu local
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center"
          >
            <Terminal className="h-4 w-4 mr-2" />
            Instrucciones
          </button>
          <button
            onClick={handleExport}
            disabled={loading || exportOptions.selectedTables.length === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exportar SQL
              </>
            )}
          </button>
        </div>
      </div>

      {/* Instrucciones de instalación */}
      {showInstructions && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
          <h4 className="font-semibold text-slate-900 mb-4 flex items-center">
            <Server className="h-5 w-5 mr-2 text-purple-600" />
            Instrucciones para Ubuntu Server
          </h4>
          
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h5 className="font-medium text-slate-900 mb-2">1. Preparar el servidor</h5>
              <div className="bg-slate-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                <div># Actualizar sistema</div>
                <div>sudo apt update && sudo apt upgrade -y</div>
                <div className="mt-2"># Instalar PostgreSQL</div>
                <div>sudo apt install postgresql postgresql-contrib -y</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h5 className="font-medium text-slate-900 mb-2">2. Configurar base de datos</h5>
              <div className="bg-slate-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                <div># Acceder a PostgreSQL</div>
                <div>sudo -u postgres psql</div>
                <div className="mt-2"># Crear base de datos y usuario</div>
                <div>CREATE DATABASE ventasfull;</div>
                <div>CREATE USER ventasfull_app WITH PASSWORD 'tu_password_seguro';</div>
                <div>GRANT ALL PRIVILEGES ON DATABASE ventasfull TO ventasfull_app;</div>
                <div>\q</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h5 className="font-medium text-slate-900 mb-2">3. Importar datos</h5>
              <div className="bg-slate-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                <div># Subir archivo SQL al servidor</div>
                <div>scp ventasfull_export.sql usuario@servidor:/tmp/</div>
                <div className="mt-2"># Importar en el servidor</div>
                <div>sudo -u postgres psql ventasfull &lt; /tmp/ventasfull_export.sql</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h5 className="font-medium text-slate-900 mb-2">4. Configurar permisos finales</h5>
              <div className="bg-slate-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                <div>sudo -u postgres psql ventasfull</div>
                <div>GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ventasfull_app;</div>
                <div>GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ventasfull_app;</div>
                <div>GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ventasfull_app;</div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="font-medium text-blue-900 mb-2">5. Configurar aplicación</h5>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Host:</strong> localhost (o IP del servidor)</p>
                <p><strong>Puerto:</strong> 5432</p>
                <p><strong>Base de datos:</strong> ventasfull</p>
                <p><strong>Usuario:</strong> ventasfull_app</p>
                <p><strong>Contraseña:</strong> [la que configuraste]</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const script = getInstallationScript();
                  const blob = new Blob([script], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'install_ventasfull.sh';
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center text-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar Script de Instalación
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getInstallationScript());
                  alert('Script copiado al portapapeles');
                }}
                className="bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors duration-200 flex items-center text-sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar Script
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opciones de exportación */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-slate-200">
          <h4 className="text-lg font-semibold text-slate-900">Opciones de Exportación</h4>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Componentes a incluir */}
          <div>
            <h5 className="font-medium text-slate-900 mb-3">Componentes a Incluir</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'includeSchema', label: 'Esquema de Tablas', icon: Database },
                { key: 'includeData', label: 'Datos', icon: FileText },
                { key: 'includeFunctions', label: 'Funciones', icon: Terminal },
                { key: 'includeViews', label: 'Vistas', icon: FileText },
                { key: 'includeTriggers', label: 'Triggers', icon: Terminal },
                { key: 'includeIndexes', label: 'Índices', icon: Database },
                { key: 'includePolicies', label: 'Políticas RLS', icon: Server }
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center">
                  <input
                    type="checkbox"
                    id={key}
                    checked={exportOptions[key as keyof ExportOptions] as boolean}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      [key]: e.target.checked
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor={key} className="ml-2 text-sm text-slate-700 flex items-center">
                    <Icon className="h-4 w-4 mr-1" />
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Selección de tablas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium text-slate-900">Tablas a Exportar</h5>
              <div className="flex gap-2">
                <button
                  onClick={selectAllTables}
                  className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200 transition-colors duration-200"
                >
                  Seleccionar Todas
                </button>
                <button
                  onClick={deselectAllTables}
                  className="text-sm bg-slate-100 text-slate-800 px-3 py-1 rounded hover:bg-slate-200 transition-colors duration-200"
                >
                  Deseleccionar Todas
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-4">
              {availableTables.map((table) => (
                <div key={table.table_name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`table_${table.table_name}`}
                      checked={exportOptions.selectedTables.includes(table.table_name)}
                      onChange={() => toggleTableSelection(table.table_name)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <label htmlFor={`table_${table.table_name}`} className="ml-2 text-sm">
                      <span className="font-medium text-slate-900">{table.table_name}</span>
                      <span className="text-slate-500 block text-xs">
                        {table.row_count} registros • {table.size_mb.toFixed(2)} MB
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-3 text-sm text-slate-600">
              Seleccionadas: {exportOptions.selectedTables.length} de {availableTables.length} tablas
            </div>
          </div>

          {/* Opciones avanzadas */}
          <div>
            <h5 className="font-medium text-slate-900 mb-3">Opciones Avanzadas</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Formato de Exportación
                </label>
                <select
                  value={exportOptions.exportFormat}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    exportFormat: e.target.value as 'sql' | 'dump'
                  }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="sql">SQL Script (.sql)</option>
                  <option value="dump">PostgreSQL Dump (.dump)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Compresión
                </label>
                <select
                  value={exportOptions.compressionLevel}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    compressionLevel: e.target.value as 'none' | 'gzip'
                  }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="none">Sin compresión</option>
                  <option value="gzip">GZIP (.gz)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resultado de exportación */}
      {exportResult && (
        <div className={`rounded-xl p-6 border ${
          exportResult.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center mb-4">
            {exportResult.success ? (
              <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
            )}
            <h4 className={`font-semibold ${
              exportResult.success ? 'text-green-900' : 'text-red-900'
            }`}>
              {exportResult.success ? 'Exportación Completada' : 'Error en Exportación'}
            </h4>
          </div>
          
          {exportResult.success ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-green-700">Archivo:</span>
                  <p className="font-medium text-green-900">{exportResult.filename}</p>
                </div>
                <div>
                  <span className="text-green-700">Tamaño:</span>
                  <p className="font-medium text-green-900">{exportResult.size} KB</p>
                </div>
                <div>
                  <span className="text-green-700">Tablas:</span>
                  <p className="font-medium text-green-900">{exportOptions.selectedTables.length}</p>
                </div>
              </div>
              
              <div className="bg-green-100 border border-green-200 rounded-lg p-3">
                <h5 className="font-medium text-green-900 mb-2">Próximos pasos:</h5>
                <ol className="text-sm text-green-800 space-y-1">
                  <li>1. Transfiere el archivo SQL a tu servidor Ubuntu</li>
                  <li>2. Instala PostgreSQL si no lo tienes</li>
                  <li>3. Crea la base de datos y usuario</li>
                  <li>4. Ejecuta el archivo SQL para importar</li>
                  <li>5. Configura tu aplicación para conectar al servidor local</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="text-red-800">
              <p>{exportResult.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Información del sistema */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h4 className="font-semibold text-slate-900 mb-4">Información del Sistema</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Modo Actual</p>
                <p className="font-bold text-blue-900">{isDemoMode ? 'Demo' : 'Producción'}</p>
              </div>
              <Database className="h-6 w-6 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Tablas Disponibles</p>
                <p className="font-bold text-green-900">{availableTables.length}</p>
              </div>
              <FileText className="h-6 w-6 text-green-600" />
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Total Registros</p>
                <p className="font-bold text-purple-900">
                  {availableTables.reduce((sum, table) => sum + table.row_count, 0).toLocaleString()}
                </p>
              </div>
              <Server className="h-6 w-6 text-purple-600" />
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600">Tamaño Estimado</p>
                <p className="font-bold text-orange-900">
                  {availableTables.reduce((sum, table) => sum + table.size_mb, 0).toFixed(1)} MB
                </p>
              </div>
              <Download className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        {isDemoMode && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
              <div>
                <h4 className="font-medium text-yellow-900">Modo Demo Activo</h4>
                <p className="text-sm text-yellow-800">
                  La exportación incluirá datos de demostración. Para exportar datos reales, 
                  configura las variables de entorno de Supabase.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ventajas de servidor local */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h4 className="font-semibold text-slate-900 mb-4">Ventajas del Servidor Local</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm text-slate-700">Control total de los datos</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm text-slate-700">Sin dependencia de servicios externos</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm text-slate-700">Mejor rendimiento en red local</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm text-slate-700">Costos reducidos a largo plazo</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm text-slate-700">Backups locales automáticos</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm text-slate-700">Configuración personalizada</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm text-slate-700">Escalabilidad según necesidades</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm text-slate-700">Cumplimiento de normativas locales</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}