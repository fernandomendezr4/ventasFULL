/*
  # Solución completa para el sistema de caja registradora

  1. Corregir precisión numérica en todas las tablas relacionadas
  2. Agregar columnas faltantes en cash_register_discrepancies
  3. Corregir triggers y funciones
  4. Asegurar integridad referencial
  5. Optimizar índices para mejor rendimiento

  ## Cambios principales:
  - Aumentar precisión de campos monetarios de NUMERIC(10,2) a NUMERIC(18,2)
  - Agregar cash_register_id a cash_register_discrepancies si no existe
  - Corregir funciones de triggers
  - Asegurar que todas las relaciones estén correctas
*/

-- 1. Aumentar precisión de campos monetarios en cash_registers
DO $$
BEGIN
  -- Verificar y actualizar columnas monetarias en cash_registers
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_registers' 
    AND column_name = 'opening_amount' 
    AND numeric_precision = 10
  ) THEN
    ALTER TABLE cash_registers 
    ALTER COLUMN opening_amount TYPE NUMERIC(18,2),
    ALTER COLUMN closing_amount TYPE NUMERIC(18,2),
    ALTER COLUMN total_sales TYPE NUMERIC(18,2),
    ALTER COLUMN expected_closing_amount TYPE NUMERIC(18,2),
    ALTER COLUMN actual_closing_amount TYPE NUMERIC(18,2),
    ALTER COLUMN discrepancy_amount TYPE NUMERIC(18,2);
  END IF;
END $$;

-- 2. Aumentar precisión en cash_movements
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' 
    AND column_name = 'amount' 
    AND numeric_precision = 10
  ) THEN
    ALTER TABLE cash_movements 
    ALTER COLUMN amount TYPE NUMERIC(18,2);
  END IF;
END $$;

-- 3. Aumentar precisión en cash_register_sales
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_register_sales' 
    AND column_name = 'amount_received' 
    AND numeric_precision = 10
  ) THEN
    ALTER TABLE cash_register_sales 
    ALTER COLUMN amount_received TYPE NUMERIC(18,2),
    ALTER COLUMN change_given TYPE NUMERIC(18,2),
    ALTER COLUMN discount_applied TYPE NUMERIC(18,2),
    ALTER COLUMN tax_amount TYPE NUMERIC(18,2);
  END IF;
END $$;

-- 4. Aumentar precisión en cash_register_installments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_register_installments' 
    AND column_name = 'amount_paid' 
    AND numeric_precision = 10
  ) THEN
    ALTER TABLE cash_register_installments 
    ALTER COLUMN amount_paid TYPE NUMERIC(18,2);
  END IF;
END $$;

-- 5. Aumentar precisión en cash_register_discrepancies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_register_discrepancies' 
    AND column_name = 'expected_amount' 
    AND numeric_precision = 10
  ) THEN
    ALTER TABLE cash_register_discrepancies 
    ALTER COLUMN expected_amount TYPE NUMERIC(18,2),
    ALTER COLUMN actual_amount TYPE NUMERIC(18,2),
    ALTER COLUMN difference_amount TYPE NUMERIC(18,2);
  END IF;
END $$;

-- 6. Aumentar precisión en cash_register_audit_logs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_register_audit_logs' 
    AND column_name = 'amount' 
    AND numeric_precision = 10
  ) THEN
    ALTER TABLE cash_register_audit_logs 
    ALTER COLUMN amount TYPE NUMERIC(18,2),
    ALTER COLUMN previous_balance TYPE NUMERIC(18,2),
    ALTER COLUMN new_balance TYPE NUMERIC(18,2);
  END IF;
END $$;

-- 7. Verificar y agregar cash_register_id a cash_register_discrepancies si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_register_discrepancies' 
    AND column_name = 'cash_register_id'
  ) THEN
    ALTER TABLE cash_register_discrepancies 
    ADD COLUMN cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE;
    
    -- Agregar índice para mejor rendimiento
    CREATE INDEX IF NOT EXISTS idx_cash_register_discrepancies_register_id 
    ON cash_register_discrepancies(cash_register_id);
  END IF;
END $$;

-- 8. Corregir función de trigger para movimientos de apertura
CREATE OR REPLACE FUNCTION create_opening_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo crear movimiento de apertura para nuevos registros
  IF TG_OP = 'INSERT' THEN
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
      'Apertura de caja registradora',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Corregir función de trigger para movimientos de cierre
CREATE OR REPLACE FUNCTION create_closing_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo crear movimiento de cierre cuando se cierra la caja
  IF TG_OP = 'UPDATE' AND OLD.status = 'open' AND NEW.status = 'closed' THEN
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
      CONCAT('Cierre de caja registradora - Balance: ', NEW.closing_amount::text),
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Corregir función de auditoría
CREATE OR REPLACE FUNCTION log_cash_register_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type_val TEXT;
  entity_type_val TEXT;
  entity_id_val UUID;
  amount_val NUMERIC(18,2) := 0;
  prev_balance NUMERIC(18,2) := 0;
  new_balance NUMERIC(18,2) := 0;
  description_val TEXT;
BEGIN
  -- Determinar el tipo de acción y entidad
  IF TG_TABLE_NAME = 'cash_registers' THEN
    entity_type_val := 'cash_register';
    entity_id_val := COALESCE(NEW.id, OLD.id);
    
    IF TG_OP = 'INSERT' THEN
      action_type_val := 'open';
      amount_val := NEW.opening_amount;
      description_val := 'Apertura de caja registradora';
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'open' AND NEW.status = 'closed' THEN
      action_type_val := 'close';
      amount_val := NEW.closing_amount;
      prev_balance := NEW.opening_amount;
      new_balance := NEW.closing_amount;
      description_val := 'Cierre de caja registradora';
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
    
  ELSIF TG_TABLE_NAME = 'cash_movements' THEN
    entity_type_val := 'movement';
    entity_id_val := COALESCE(NEW.id, OLD.id);
    action_type_val := COALESCE(NEW.type, OLD.type);
    amount_val := COALESCE(NEW.amount, OLD.amount);
    description_val := COALESCE(NEW.description, OLD.description);
    
  ELSIF TG_TABLE_NAME = 'cash_register_sales' THEN
    entity_type_val := 'sale';
    entity_id_val := COALESCE(NEW.sale_id, OLD.sale_id);
    action_type_val := 'sale';
    amount_val := COALESCE(NEW.amount_received, OLD.amount_received);
    description_val := 'Venta registrada en caja';
    
  ELSIF TG_TABLE_NAME = 'cash_register_installments' THEN
    entity_type_val := 'installment';
    entity_id_val := COALESCE(NEW.installment_id, OLD.installment_id);
    action_type_val := 'installment';
    amount_val := COALESCE(NEW.amount_paid, OLD.amount_paid);
    description_val := 'Abono registrado en caja';
    
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Insertar registro de auditoría
  INSERT INTO cash_register_audit_logs (
    cash_register_id,
    action_type,
    entity_type,
    entity_id,
    amount,
    previous_balance,
    new_balance,
    description,
    performed_by
  ) VALUES (
    CASE 
      WHEN TG_TABLE_NAME = 'cash_registers' THEN entity_id_val
      ELSE COALESCE(NEW.cash_register_id, OLD.cash_register_id)
    END,
    action_type_val,
    entity_type_val,
    entity_id_val,
    amount_val,
    prev_balance,
    new_balance,
    description_val,
    CASE 
      WHEN TG_TABLE_NAME = 'cash_registers' THEN COALESCE(NEW.user_id, OLD.user_id)
      ELSE COALESCE(NEW.created_by, OLD.created_by)
    END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 11. Recrear triggers si no existen
DO $$
BEGIN
  -- Trigger para apertura de caja
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_create_opening_movement'
  ) THEN
    CREATE TRIGGER trigger_create_opening_movement
      AFTER INSERT ON cash_registers
      FOR EACH ROW EXECUTE FUNCTION create_opening_movement();
  END IF;

  -- Trigger para cierre de caja
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_create_closing_movement'
  ) THEN
    CREATE TRIGGER trigger_create_closing_movement
      AFTER UPDATE ON cash_registers
      FOR EACH ROW EXECUTE FUNCTION create_closing_movement();
  END IF;

  -- Trigger para auditoría de caja
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_audit_cash_register'
  ) THEN
    CREATE TRIGGER trigger_audit_cash_register
      AFTER INSERT OR UPDATE ON cash_registers
      FOR EACH ROW EXECUTE FUNCTION log_cash_register_action();
  END IF;
END $$;

-- 12. Actualizar constraints para nuevas precisiones
DO $$
BEGIN
  -- Actualizar constraints en cash_registers
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'cash_registers_opening_amount_check'
  ) THEN
    ALTER TABLE cash_registers DROP CONSTRAINT cash_registers_opening_amount_check;
    ALTER TABLE cash_registers ADD CONSTRAINT cash_registers_opening_amount_check 
    CHECK (opening_amount >= 0::NUMERIC(18,2));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'cash_registers_closing_amount_check'
  ) THEN
    ALTER TABLE cash_registers DROP CONSTRAINT cash_registers_closing_amount_check;
    ALTER TABLE cash_registers ADD CONSTRAINT cash_registers_closing_amount_check 
    CHECK (closing_amount >= 0::NUMERIC(18,2));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'cash_registers_total_sales_check'
  ) THEN
    ALTER TABLE cash_registers DROP CONSTRAINT cash_registers_total_sales_check;
    ALTER TABLE cash_registers ADD CONSTRAINT cash_registers_total_sales_check 
    CHECK (total_sales >= 0::NUMERIC(18,2));
  END IF;
END $$;

-- 13. Crear función auxiliar para calcular balance de caja
CREATE OR REPLACE FUNCTION calculate_cash_register_balance(register_id UUID)
RETURNS TABLE (
  current_balance NUMERIC(18,2),
  total_income NUMERIC(18,2),
  total_expenses NUMERIC(18,2),
  total_sales NUMERIC(18,2),
  opening_amount NUMERIC(18,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(cr.opening_amount, 0) + 
    COALESCE(income.total, 0) + 
    COALESCE(sales.total, 0) - 
    COALESCE(expenses.total, 0) as current_balance,
    COALESCE(income.total, 0) as total_income,
    COALESCE(expenses.total, 0) as total_expenses,
    COALESCE(sales.total, 0) as total_sales,
    COALESCE(cr.opening_amount, 0) as opening_amount
  FROM cash_registers cr
  LEFT JOIN (
    SELECT 
      cash_register_id,
      SUM(amount) as total
    FROM cash_movements 
    WHERE cash_register_id = register_id 
    AND type = 'income'
    GROUP BY cash_register_id
  ) income ON income.cash_register_id = cr.id
  LEFT JOIN (
    SELECT 
      cash_register_id,
      SUM(amount) as total
    FROM cash_movements 
    WHERE cash_register_id = register_id 
    AND type = 'expense'
    GROUP BY cash_register_id
  ) expenses ON expenses.cash_register_id = cr.id
  LEFT JOIN (
    SELECT 
      cash_register_id,
      SUM(amount) as total
    FROM cash_movements 
    WHERE cash_register_id = register_id 
    AND type = 'sale'
    GROUP BY cash_register_id
  ) sales ON sales.cash_register_id = cr.id
  WHERE cr.id = register_id;
END;
$$ LANGUAGE plpgsql;

-- 14. Asegurar que todas las políticas RLS estén correctas
DO $$
BEGIN
  -- Verificar políticas para cash_register_discrepancies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cash_register_discrepancies' 
    AND policyname = 'Public can insert cash_register_discrepancies'
  ) THEN
    CREATE POLICY "Public can insert cash_register_discrepancies"
      ON cash_register_discrepancies
      FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cash_register_discrepancies' 
    AND policyname = 'Public can view cash_register_discrepancies'
  ) THEN
    CREATE POLICY "Public can view cash_register_discrepancies"
      ON cash_register_discrepancies
      FOR SELECT
      TO public
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cash_register_discrepancies' 
    AND policyname = 'Public can update cash_register_discrepancies'
  ) THEN
    CREATE POLICY "Public can update cash_register_discrepancies"
      ON cash_register_discrepancies
      FOR UPDATE
      TO public
      USING (true);
  END IF;
END $$;

-- 15. Crear índices adicionales para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_cash_movements_register_type_date 
ON cash_movements(cash_register_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_register_sales_register_date 
ON cash_register_sales(cash_register_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_register_installments_register_date 
ON cash_register_installments(cash_register_id, created_at DESC);

-- 16. Actualizar estadísticas de la base de datos
ANALYZE cash_registers;
ANALYZE cash_movements;
ANALYZE cash_register_sales;
ANALYZE cash_register_installments;
ANALYZE cash_register_discrepancies;
ANALYZE cash_register_audit_logs;