/*
  # Corrección de Relaciones y Constraints

  1. Foreign Keys
    - Corregir relaciones problemáticas
    - Agregar ON DELETE CASCADE donde corresponde
    - Optimizar referencias

  2. Constraints
    - Revisar y corregir constraints
    - Agregar validaciones faltantes
    - Optimizar checks

  3. Índices de Relaciones
    - Optimizar índices de foreign keys
    - Mejorar rendimiento de joins
*/

-- =====================================================
-- 1. CORRECCIÓN DE FOREIGN KEYS PROBLEMÁTICAS
-- =====================================================

-- Verificar y corregir relación products -> categories
DO $$
BEGIN
  -- Eliminar FK existente si hay problemas
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'products_category_id_fkey' 
    AND table_name = 'products'
  ) THEN
    ALTER TABLE products DROP CONSTRAINT products_category_id_fkey;
  END IF;
  
  -- Limpiar referencias huérfanas
  UPDATE products SET category_id = NULL 
  WHERE category_id IS NOT NULL 
  AND category_id NOT IN (SELECT id FROM categories);
  
  -- Recrear FK con CASCADE
  ALTER TABLE products 
  ADD CONSTRAINT products_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
END $$;

-- Verificar y corregir relación products -> suppliers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'products_supplier_id_fkey' 
    AND table_name = 'products'
  ) THEN
    ALTER TABLE products DROP CONSTRAINT products_supplier_id_fkey;
  END IF;
  
  UPDATE products SET supplier_id = NULL 
  WHERE supplier_id IS NOT NULL 
  AND supplier_id NOT IN (SELECT id FROM suppliers);
  
  ALTER TABLE products 
  ADD CONSTRAINT products_supplier_id_fkey 
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
END $$;

-- Verificar y corregir relación sales -> customers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'sales_customer_id_fkey' 
    AND table_name = 'sales'
  ) THEN
    ALTER TABLE sales DROP CONSTRAINT sales_customer_id_fkey;
  END IF;
  
  UPDATE sales SET customer_id = NULL 
  WHERE customer_id IS NOT NULL 
  AND customer_id NOT IN (SELECT id FROM customers);
  
  ALTER TABLE sales 
  ADD CONSTRAINT sales_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
END $$;

-- Verificar y corregir relación sales -> users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'sales_user_id_fkey' 
    AND table_name = 'sales'
  ) THEN
    ALTER TABLE sales DROP CONSTRAINT sales_user_id_fkey;
  END IF;
  
  UPDATE sales SET user_id = NULL 
  WHERE user_id IS NOT NULL 
  AND user_id NOT IN (SELECT id FROM users);
  
  ALTER TABLE sales 
  ADD CONSTRAINT sales_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
END $$;

-- =====================================================
-- 2. CORRECCIÓN DE SALE_ITEMS
-- =====================================================

-- Limpiar sale_items huérfanos
DELETE FROM sale_items 
WHERE sale_id NOT IN (SELECT id FROM sales);

DELETE FROM sale_items 
WHERE product_id NOT IN (SELECT id FROM products);

-- Recrear constraints de sale_items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'sale_items_sale_id_fkey' 
    AND table_name = 'sale_items'
  ) THEN
    ALTER TABLE sale_items DROP CONSTRAINT sale_items_sale_id_fkey;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'sale_items_product_id_fkey' 
    AND table_name = 'sale_items'
  ) THEN
    ALTER TABLE sale_items DROP CONSTRAINT sale_items_product_id_fkey;
  END IF;
  
  ALTER TABLE sale_items 
  ADD CONSTRAINT sale_items_sale_id_fkey 
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
  
  ALTER TABLE sale_items 
  ADD CONSTRAINT sale_items_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
END $$;

-- =====================================================
-- 3. CORRECCIÓN DE CASH_MOVEMENTS
-- =====================================================

-- Limpiar movimientos huérfanos
DELETE FROM cash_movements 
WHERE cash_register_id NOT IN (SELECT id FROM cash_registers);

-- Recrear constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cash_movements_cash_register_id_fkey' 
    AND table_name = 'cash_movements'
  ) THEN
    ALTER TABLE cash_movements DROP CONSTRAINT cash_movements_cash_register_id_fkey;
  END IF;
  
  ALTER TABLE cash_movements 
  ADD CONSTRAINT cash_movements_cash_register_id_fkey 
  FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id) ON DELETE CASCADE;
END $$;

-- =====================================================
-- 4. CORRECCIÓN DE PAYMENT_INSTALLMENTS
-- =====================================================

-- Limpiar installments huérfanos
DELETE FROM payment_installments 
WHERE sale_id NOT IN (SELECT id FROM sales);

-- Recrear constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'payment_installments_sale_id_fkey' 
    AND table_name = 'payment_installments'
  ) THEN
    ALTER TABLE payment_installments DROP CONSTRAINT payment_installments_sale_id_fkey;
  END IF;
  
  ALTER TABLE payment_installments 
  ADD CONSTRAINT payment_installments_sale_id_fkey 
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
END $$;

-- =====================================================
-- 5. CORRECCIÓN DE PRODUCT_IMEI_SERIALS
-- =====================================================

-- Limpiar IMEI/Serial huérfanos
DELETE FROM product_imei_serials 
WHERE product_id NOT IN (SELECT id FROM products);

-- Limpiar referencias a ventas inexistentes
UPDATE product_imei_serials 
SET sale_id = NULL, sale_item_id = NULL, sold_at = NULL, status = 'available'
WHERE sale_id IS NOT NULL 
AND sale_id NOT IN (SELECT id FROM sales);

-- Recrear constraints
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'product_imei_serials_product_id_fkey' 
    AND table_name = 'product_imei_serials'
  ) THEN
    ALTER TABLE product_imei_serials DROP CONSTRAINT product_imei_serials_product_id_fkey;
  END IF;
  
  ALTER TABLE product_imei_serials 
  ADD CONSTRAINT product_imei_serials_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'product_imei_serials_sale_id_fkey' 
    AND table_name = 'product_imei_serials'
  ) THEN
    ALTER TABLE product_imei_serials DROP CONSTRAINT product_imei_serials_sale_id_fkey;
  END IF;
  
  ALTER TABLE product_imei_serials 
  ADD CONSTRAINT product_imei_serials_sale_id_fkey 
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;
END $$;

-- =====================================================
-- 6. OPTIMIZACIÓN DE CONSTRAINTS
-- =====================================================

-- Mejorar constraints de productos
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_price_check;

ALTER TABLE products 
ADD CONSTRAINT products_price_check 
CHECK (sale_price >= 0 AND purchase_price >= 0);

-- Mejorar constraints de ventas
ALTER TABLE sales 
DROP CONSTRAINT IF EXISTS sales_amounts_check;

ALTER TABLE sales 
ADD CONSTRAINT sales_amounts_check 
CHECK (
  total_amount >= 0 AND 
  subtotal >= 0 AND 
  discount_amount >= 0 AND 
  total_paid >= 0 AND
  total_amount >= discount_amount
);

-- =====================================================
-- 7. ÍNDICES PARA RELACIONES OPTIMIZADAS
-- =====================================================

-- Índices para mejorar joins frecuentes
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_product 
ON sale_items (sale_id, product_id);

CREATE INDEX IF NOT EXISTS idx_products_category_supplier 
ON products (category_id, supplier_id) 
WHERE category_id IS NOT NULL OR supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_customer_user_date 
ON sales (customer_id, user_id, DATE(created_at)) 
WHERE customer_id IS NOT NULL OR user_id IS NOT NULL;

-- =====================================================
-- 8. FUNCIÓN DE VALIDACIÓN DE RELACIONES
-- =====================================================

CREATE OR REPLACE FUNCTION validate_database_relationships()
RETURNS TABLE (
  table_name text,
  relationship text,
  orphaned_count bigint,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar productos huérfanos por categoría
  RETURN QUERY
  SELECT 
    'products'::text,
    'category_id -> categories'::text,
    COUNT(*)::bigint,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'NEEDS_CLEANUP' END
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE p.category_id IS NOT NULL AND c.id IS NULL;

  -- Verificar sale_items huérfanos
  RETURN QUERY
  SELECT 
    'sale_items'::text,
    'sale_id -> sales'::text,
    COUNT(*)::bigint,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'CRITICAL' END
  FROM sale_items si
  LEFT JOIN sales s ON si.sale_id = s.id
  WHERE s.id IS NULL;

  -- Verificar movimientos de caja huérfanos
  RETURN QUERY
  SELECT 
    'cash_movements'::text,
    'cash_register_id -> cash_registers'::text,
    COUNT(*)::bigint,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'CRITICAL' END
  FROM cash_movements cm
  LEFT JOIN cash_registers cr ON cm.cash_register_id = cr.id
  WHERE cr.id IS NULL;
END;
$$;

-- =====================================================
-- 9. FUNCIÓN DE REPARACIÓN AUTOMÁTICA
-- =====================================================

CREATE OR REPLACE FUNCTION repair_database_relationships()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  repair_log text := '';
  affected_rows integer;
BEGIN
  -- Reparar productos con categorías inexistentes
  UPDATE products SET category_id = NULL 
  WHERE category_id IS NOT NULL 
  AND category_id NOT IN (SELECT id FROM categories);
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  repair_log := repair_log || 'Productos con categoría corregidos: ' || affected_rows || '. ';

  -- Reparar productos con proveedores inexistentes
  UPDATE products SET supplier_id = NULL 
  WHERE supplier_id IS NOT NULL 
  AND supplier_id NOT IN (SELECT id FROM suppliers);
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  repair_log := repair_log || 'Productos con proveedor corregidos: ' || affected_rows || '. ';

  -- Eliminar sale_items huérfanos
  DELETE FROM sale_items 
  WHERE sale_id NOT IN (SELECT id FROM sales);
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  repair_log := repair_log || 'Sale_items huérfanos eliminados: ' || affected_rows || '. ';

  -- Eliminar movimientos huérfanos
  DELETE FROM cash_movements 
  WHERE cash_register_id NOT IN (SELECT id FROM cash_registers);
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  repair_log := repair_log || 'Movimientos huérfanos eliminados: ' || affected_rows || '. ';

  -- Corregir IMEI/Serial huérfanos
  UPDATE product_imei_serials 
  SET sale_id = NULL, sale_item_id = NULL, status = 'available'
  WHERE sale_id IS NOT NULL 
  AND sale_id NOT IN (SELECT id FROM sales);
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  repair_log := repair_log || 'IMEI/Serial corregidos: ' || affected_rows || '.';

  RETURN repair_log;
END;
$$;

-- =====================================================
-- 10. EJECUCIÓN DE REPARACIONES
-- =====================================================

-- Ejecutar reparación automática
SELECT repair_database_relationships();

-- Verificar estado final
SELECT * FROM validate_database_relationships();