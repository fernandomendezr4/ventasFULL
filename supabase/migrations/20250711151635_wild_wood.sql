/*
  # Agregar precio de compra a productos

  1. Cambios en la tabla products
    - Agregar columna `purchase_price` (precio de compra)
    - Renombrar columna `price` a `sale_price` (precio de venta)
    - Agregar restricciones para asegurar que los precios sean positivos

  2. Seguridad
    - Mantener las políticas RLS existentes
*/

-- Agregar columna de precio de compra
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE products ADD COLUMN purchase_price numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Agregar restricción para precio de compra
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'products_purchase_price_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_purchase_price_check CHECK (purchase_price >= 0);
  END IF;
END $$;

-- Renombrar la columna price a sale_price para mayor claridad
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'price'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'sale_price'
  ) THEN
    ALTER TABLE products RENAME COLUMN price TO sale_price;
  END IF;
END $$;