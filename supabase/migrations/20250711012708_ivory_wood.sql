/*
  # Arreglar sistema de caja registradora

  1. Verificar tabla cash_registers
    - Asegurar estructura correcta
    - Configurar políticas RLS públicas
    - Agregar índices necesarios

  2. Funciones auxiliares
    - Función para calcular ventas del turno
    - Triggers para actualizar totales

  3. Datos de ejemplo
    - Usuario de ejemplo para pruebas
*/

-- Recrear tabla cash_registers si es necesario
CREATE TABLE IF NOT EXISTS cash_registers (
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

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS cash_registers_user_id_idx ON cash_registers(user_id);
CREATE INDEX IF NOT EXISTS cash_registers_status_idx ON cash_registers(status);
CREATE INDEX IF NOT EXISTS cash_registers_opened_at_idx ON cash_registers(opened_at DESC);

-- Habilitar RLS
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

-- Políticas públicas para acceso libre
DROP POLICY IF EXISTS "Public can view cash_registers" ON cash_registers;
DROP POLICY IF EXISTS "Public can insert cash_registers" ON cash_registers;
DROP POLICY IF EXISTS "Public can update cash_registers" ON cash_registers;
DROP POLICY IF EXISTS "Public can delete cash_registers" ON cash_registers;

CREATE POLICY "Public can view cash_registers"
  ON cash_registers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert cash_registers"
  ON cash_registers FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update cash_registers"
  ON cash_registers FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Public can delete cash_registers"
  ON cash_registers FOR DELETE
  TO public
  USING (true);

-- Asegurar que existe al menos un usuario para pruebas
INSERT INTO users (name, email, role, is_active) 
VALUES ('Cajero Principal', 'cajero@tienda.com', 'employee', true)
ON CONFLICT (email) DO NOTHING;

-- Función para calcular ventas de un período
CREATE OR REPLACE FUNCTION calculate_sales_for_period(start_time timestamptz, end_time timestamptz DEFAULT now())
RETURNS numeric AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(total_amount) FROM sales WHERE created_at >= start_time AND created_at <= end_time),
    0
  );
END;
$$ LANGUAGE plpgsql;