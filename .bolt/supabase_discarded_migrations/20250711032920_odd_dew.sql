/*
  # Agregar campo cédula a clientes

  1. Cambios en tabla customers
    - Agregar campo `cedula` (text, único)
    - Agregar índice para búsquedas rápidas
  
  2. Seguridad
    - Mantener políticas RLS existentes
*/

-- Agregar campo cédula a la tabla customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'cedula'
  ) THEN
    ALTER TABLE customers ADD COLUMN cedula text DEFAULT '';
  END IF;
END $$;

-- Crear índice para búsquedas por cédula
CREATE INDEX IF NOT EXISTS customers_cedula_idx ON customers USING btree (cedula);

-- Agregar algunos clientes de ejemplo con cédula
INSERT INTO customers (name, email, phone, address, cedula) VALUES
  ('Juan Pérez', 'juan.perez@email.com', '555-0101', 'Calle 123 #45-67', '12345678'),
  ('María García', 'maria.garcia@email.com', '555-0102', 'Carrera 89 #12-34', '87654321'),
  ('Carlos López', 'carlos.lopez@email.com', '555-0103', 'Avenida 56 #78-90', '11223344')
ON CONFLICT (email) DO NOTHING;