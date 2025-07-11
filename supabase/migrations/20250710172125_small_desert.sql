/*
  # Crear tabla de movimientos de caja

  1. Nueva Tabla
    - `cash_movements`
      - `id` (uuid, primary key)
      - `cash_register_id` (uuid, foreign key to cash_registers)
      - `type` (text, tipo de movimiento: income, expense, sale, opening, closing)
      - `category` (text, categoría del movimiento)
      - `amount` (numeric, monto del movimiento)
      - `description` (text, descripción del movimiento)
      - `reference_id` (uuid, referencia opcional a otras tablas)
      - `created_by` (uuid, usuario que creó el movimiento)
      - `created_at` (timestamp)

  2. Seguridad
    - Habilitar RLS en la tabla `cash_movements`
    - Agregar políticas para operaciones CRUD públicas

  3. Índices
    - Índice en `cash_register_id` para consultas rápidas
    - Índice en `type` para filtros
    - Índice en `created_at` para ordenamiento
*/

-- Crear tabla de movimientos de caja
CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'sale', 'opening', 'closing')),
  category text NOT NULL DEFAULT '',
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  description text NOT NULL DEFAULT '',
  reference_id uuid DEFAULT NULL,
  created_by uuid DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad
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

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS cash_movements_cash_register_id_idx ON cash_movements(cash_register_id);
CREATE INDEX IF NOT EXISTS cash_movements_type_idx ON cash_movements(type);
CREATE INDEX IF NOT EXISTS cash_movements_created_at_idx ON cash_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS cash_movements_category_idx ON cash_movements(category);

-- Función para crear movimiento automático al abrir caja
CREATE OR REPLACE FUNCTION create_opening_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Crear movimiento de apertura
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
    'apertura_caja',
    NEW.opening_amount,
    'Apertura de caja - Monto inicial',
    NEW.user_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para movimiento automático de apertura
DROP TRIGGER IF EXISTS trigger_create_opening_movement ON cash_registers;
CREATE TRIGGER trigger_create_opening_movement
  AFTER INSERT ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION create_opening_movement();

-- Función para crear movimiento automático al cerrar caja
CREATE OR REPLACE FUNCTION create_closing_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo crear movimiento si se está cerrando la caja
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
      'cierre_caja',
      NEW.closing_amount,
      'Cierre de caja - Monto final',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para movimiento automático de cierre
DROP TRIGGER IF EXISTS trigger_create_closing_movement ON cash_registers;
CREATE TRIGGER trigger_create_closing_movement
  AFTER UPDATE ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION create_closing_movement();