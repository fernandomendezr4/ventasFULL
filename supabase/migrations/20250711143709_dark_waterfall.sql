/*
  # Agregar código de barras a productos y descuento a ventas

  1. Modificaciones a productos
    - Agregar campo `barcode` (código de barras)
    - Agregar índice único para el código de barras

  2. Modificaciones a ventas
    - Agregar campo `discount_amount` (descuento en dinero)
    - Agregar campo `subtotal` (subtotal antes del descuento)

  3. Seguridad
    - Mantener las políticas RLS existentes
*/

-- Agregar código de barras a productos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'barcode'
  ) THEN
    ALTER TABLE products ADD COLUMN barcode text DEFAULT '';
  END IF;
END $$;

-- Crear índice único para código de barras (solo si no está vacío)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'products' AND indexname = 'products_barcode_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX products_barcode_unique_idx ON products (barcode) WHERE barcode != '';
  END IF;
END $$;

-- Agregar campos de descuento a ventas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE sales ADD COLUMN subtotal numeric(10,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE sales ADD COLUMN discount_amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Agregar restricciones para los nuevos campos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'sales_subtotal_check'
  ) THEN
    ALTER TABLE sales ADD CONSTRAINT sales_subtotal_check CHECK (subtotal >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'sales_discount_amount_check'
  ) THEN
    ALTER TABLE sales ADD CONSTRAINT sales_discount_amount_check CHECK (discount_amount >= 0);
  END IF;
END $$;

-- Eliminar tablas de abonos por cuotas (ya no se usarán)
DROP TABLE IF EXISTS installment_payments CASCADE;
DROP TABLE IF EXISTS installment_sales CASCADE;

-- Crear tabla simple para abonos
CREATE TABLE IF NOT EXISTS payment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  payment_date timestamptz DEFAULT now(),
  payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT payment_installments_amount_paid_check CHECK (amount_paid > 0)
);

-- Habilitar RLS en la nueva tabla
ALTER TABLE payment_installments ENABLE ROW LEVEL SECURITY;

-- Crear políticas para payment_installments
CREATE POLICY "Public can view payment_installments"
  ON payment_installments
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert payment_installments"
  ON payment_installments
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update payment_installments"
  ON payment_installments
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Public can delete payment_installments"
  ON payment_installments
  FOR DELETE
  TO public
  USING (true);

-- Crear índices para payment_installments
CREATE INDEX IF NOT EXISTS payment_installments_sale_id_idx ON payment_installments (sale_id);
CREATE INDEX IF NOT EXISTS payment_installments_payment_date_idx ON payment_installments (payment_date DESC);