/*
  # Mejoras para el sistema de caja registradora

  1. Nueva tabla para movimientos de caja
    - `cash_movements` - Registra todos los ingresos y egresos
    - Tipos: 'income' (ingreso), 'expense' (egreso), 'sale' (venta), 'opening' (apertura), 'closing' (cierre)
    - Categorías para clasificar los movimientos
    - Referencias a ventas cuando aplique

  2. Seguridad
    - Habilitar RLS en la nueva tabla
    - Políticas para permitir operaciones públicas (modo libre)
*/

-- Crear tabla para movimientos de caja
CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'sale', 'opening', 'closing')),
  category text NOT NULL DEFAULT 'other',
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  reference_id uuid, -- Para referenciar ventas u otros documentos
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS cash_movements_register_id_idx ON cash_movements(cash_register_id);
CREATE INDEX IF NOT EXISTS cash_movements_type_idx ON cash_movements(type);
CREATE INDEX IF NOT EXISTS cash_movements_created_at_idx ON cash_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS cash_movements_reference_id_idx ON cash_movements(reference_id);

-- Habilitar RLS
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

-- Políticas para modo libre (acceso público)
CREATE POLICY "Public can view cash_movements"
  ON cash_movements
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert cash_movements"
  ON cash_movements
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update cash_movements"
  ON cash_movements
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Public can delete cash_movements"
  ON cash_movements
  FOR DELETE
  TO public
  USING (true);

-- Agregar campos adicionales a cash_registers para mejor control
DO $$
BEGIN
  -- Agregar campo para el balance actual calculado
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'current_balance'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN current_balance numeric(10,2) DEFAULT 0;
  END IF;

  -- Agregar campo para total de ingresos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'total_income'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN total_income numeric(10,2) DEFAULT 0;
  END IF;

  -- Agregar campo para total de egresos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_registers' AND column_name = 'total_expenses'
  ) THEN
    ALTER TABLE cash_registers ADD COLUMN total_expenses numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Función para actualizar el balance de la caja cuando se agregan movimientos
CREATE OR REPLACE FUNCTION update_cash_register_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar totales en la caja registradora
  UPDATE cash_registers 
  SET 
    current_balance = opening_amount + 
      COALESCE((
        SELECT SUM(
          CASE 
            WHEN type IN ('income', 'sale', 'opening') THEN amount
            WHEN type IN ('expense', 'closing') THEN -amount
            ELSE 0
          END
        )
        FROM cash_movements 
        WHERE cash_register_id = NEW.cash_register_id
      ), 0),
    total_income = COALESCE((
      SELECT SUM(amount)
      FROM cash_movements 
      WHERE cash_register_id = NEW.cash_register_id 
      AND type IN ('income', 'sale')
    ), 0),
    total_expenses = COALESCE((
      SELECT SUM(amount)
      FROM cash_movements 
      WHERE cash_register_id = NEW.cash_register_id 
      AND type = 'expense'
    ), 0),
    total_sales = COALESCE((
      SELECT SUM(amount)
      FROM cash_movements 
      WHERE cash_register_id = NEW.cash_register_id 
      AND type = 'sale'
    ), 0)
  WHERE id = NEW.cash_register_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar balance automáticamente
DROP TRIGGER IF EXISTS update_balance_trigger ON cash_movements;
CREATE TRIGGER update_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_register_balance();

-- Insertar categorías predefinidas como datos de ejemplo (opcional)
-- Estas se pueden gestionar desde la aplicación
INSERT INTO cash_movements (cash_register_id, type, category, amount, description, created_at)
SELECT 
  '00000000-0000-0000-0000-000000000000'::uuid,
  'income',
  'example',
  0,
  'Categorías disponibles: gastos_operativos, servicios_publicos, mantenimiento, compras_inventario, gastos_personal, otros_gastos, ventas_efectivo, ingresos_adicionales, devoluciones, otros_ingresos',
  '1900-01-01'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM cash_movements WHERE description LIKE 'Categorías disponibles:%'
);