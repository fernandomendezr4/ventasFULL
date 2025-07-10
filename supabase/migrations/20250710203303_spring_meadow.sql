/*
  # Corrección completa del esquema de base de datos

  1. Limpieza de tablas problemáticas
    - Eliminar tablas duplicadas o inconsistentes
    - Corregir referencias de claves foráneas

  2. Recreación de tablas principales
    - `categories` - Categorías de productos
    - `suppliers` - Proveedores
    - `customers` - Clientes  
    - `products` - Productos con relaciones correctas
    - `sales` - Ventas
    - `sale_items` - Items de venta
    - `users` - Usuarios del sistema
    - `cash_registers` - Registros de caja

  3. Configuración de seguridad
    - Habilitar RLS en todas las tablas
    - Crear políticas de acceso apropiadas

  4. Índices y optimizaciones
    - Crear índices para mejorar rendimiento
*/

-- Eliminar tablas problemáticas si existen
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Limpiar y recrear tabla de categorías
DROP TABLE IF EXISTS categories CASCADE;
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Limpiar y recrear tabla de proveedores
DROP TABLE IF EXISTS suppliers CASCADE;
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Limpiar y recrear tabla de clientes
DROP TABLE IF EXISTS customers CASCADE;
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Limpiar y recrear tabla de usuarios
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Limpiar y recrear tabla de productos
DROP TABLE IF EXISTS products CASCADE;
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Limpiar y recrear tabla de ventas
DROP TABLE IF EXISTS sales CASCADE;
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Limpiar y recrear tabla de items de venta
DROP TABLE IF EXISTS sale_items CASCADE;
CREATE TABLE sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_price >= 0)
);

-- Limpiar y recrear tabla de caja registradora
DROP TABLE IF EXISTS cash_registers CASCADE;
CREATE TABLE cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  opening_amount numeric(10,2) DEFAULT 0 CHECK (opening_amount >= 0),
  closing_amount numeric(10,2) DEFAULT 0 CHECK (closing_amount >= 0),
  total_sales numeric(10,2) DEFAULT 0 CHECK (total_sales >= 0),
  status text DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS categories_name_idx ON categories(name);
CREATE INDEX IF NOT EXISTS suppliers_name_idx ON suppliers(name);
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers(name);
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers(email);
CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers(created_at DESC);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS products_supplier_id_idx ON products(supplier_id);
CREATE INDEX IF NOT EXISTS sales_customer_id_idx ON sales(customer_id);
CREATE INDEX IF NOT EXISTS sales_user_id_idx ON sales(user_id);
CREATE INDEX IF NOT EXISTS sales_created_at_idx ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product_id_idx ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS cash_registers_user_id_idx ON cash_registers(user_id);
CREATE INDEX IF NOT EXISTS cash_registers_status_idx ON cash_registers(status);
CREATE INDEX IF NOT EXISTS cash_registers_opened_at_idx ON cash_registers(opened_at DESC);

-- Habilitar RLS en todas las tablas
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para categorías
CREATE POLICY "Anyone can view categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert categories" ON categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update categories" ON categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete categories" ON categories FOR DELETE TO authenticated USING (true);

-- Políticas de seguridad para proveedores
CREATE POLICY "Anyone can view suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update suppliers" ON suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete suppliers" ON suppliers FOR DELETE TO authenticated USING (true);

-- Políticas de seguridad para clientes
CREATE POLICY "Public can view customers" ON customers FOR SELECT TO public USING (true);
CREATE POLICY "Public can insert customers" ON customers FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can update customers" ON customers FOR UPDATE TO public USING (true);
CREATE POLICY "Public can delete customers" ON customers FOR DELETE TO public USING (true);

-- Políticas de seguridad para usuarios
CREATE POLICY "Anyone can view users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert users" ON users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update users" ON users FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete users" ON users FOR DELETE TO authenticated USING (true);

-- Políticas de seguridad para productos
CREATE POLICY "Anyone can view products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert products" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products" ON products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete products" ON products FOR DELETE TO authenticated USING (true);

-- Políticas de seguridad para ventas
CREATE POLICY "Anyone can view sales" ON sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sales" ON sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sales" ON sales FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete sales" ON sales FOR DELETE TO authenticated USING (true);

-- Políticas de seguridad para items de venta
CREATE POLICY "Anyone can view sale_items" ON sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sale_items" ON sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sale_items" ON sale_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete sale_items" ON sale_items FOR DELETE TO authenticated USING (true);

-- Políticas de seguridad para caja registradora
CREATE POLICY "Anyone can view cash_registers" ON cash_registers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert cash_registers" ON cash_registers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update cash_registers" ON cash_registers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete cash_registers" ON cash_registers FOR DELETE TO authenticated USING (true);

-- Insertar datos de ejemplo para categorías
INSERT INTO categories (name, description) VALUES
  ('Electrónicos', 'Dispositivos electrónicos y tecnología'),
  ('Ropa', 'Vestimenta y accesorios'),
  ('Hogar', 'Artículos para el hogar'),
  ('Deportes', 'Equipamiento deportivo'),
  ('Libros', 'Libros y material de lectura')
ON CONFLICT (name) DO NOTHING;

-- Insertar datos de ejemplo para proveedores
INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES
  ('TechCorp', 'Juan Pérez', 'juan@techcorp.com', '+1234567890', 'Av. Tecnología 123'),
  ('ModaStyle', 'María García', 'maria@modastyle.com', '+1234567891', 'Calle Moda 456'),
  ('HomeCenter', 'Carlos López', 'carlos@homecenter.com', '+1234567892', 'Av. Hogar 789')
ON CONFLICT DO NOTHING;

-- Insertar datos de ejemplo para usuarios
INSERT INTO users (name, email, role, is_active) VALUES
  ('Administrador', 'admin@sistema.com', 'admin', true),
  ('Gerente Ventas', 'gerente@sistema.com', 'manager', true),
  ('Empleado 1', 'empleado1@sistema.com', 'employee', true)
ON CONFLICT (email) DO NOTHING;