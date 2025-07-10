/*
  # Verificar y arreglar tabla de clientes

  1. Verificaciones
    - Asegurar que la tabla `customers` existe
    - Verificar estructura de columnas
    - Confirmar políticas RLS

  2. Correcciones
    - Recrear tabla si es necesario
    - Establecer políticas de acceso
    - Agregar índices para rendimiento
*/

-- Crear tabla customers si no existe
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Crear políticas para acceso completo (sin autenticación)
DROP POLICY IF EXISTS "Anyone can view customers" ON customers;
DROP POLICY IF EXISTS "Anyone can insert customers" ON customers;
DROP POLICY IF EXISTS "Anyone can update customers" ON customers;
DROP POLICY IF EXISTS "Anyone can delete customers" ON customers;

CREATE POLICY "Public can view customers"
  ON customers
  FOR SELECT
  USING (true);

CREATE POLICY "Public can insert customers"
  ON customers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update customers"
  ON customers
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete customers"
  ON customers
  FOR DELETE
  USING (true);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers (name);
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (email);
CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers (created_at DESC);

-- Insertar algunos clientes de ejemplo para probar
INSERT INTO customers (name, email, phone, address) VALUES
  ('Juan Pérez', 'juan.perez@email.com', '+1234567890', 'Calle Principal 123, Ciudad'),
  ('María García', 'maria.garcia@email.com', '+1234567891', 'Avenida Central 456, Ciudad'),
  ('Carlos López', 'carlos.lopez@email.com', '+1234567892', 'Plaza Mayor 789, Ciudad')
ON CONFLICT (id) DO NOTHING;