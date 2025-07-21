/*
  # Corregir error de trigger en cierre de caja

  1. Problemas identificados
    - El trigger `create_closing_movement` intenta acceder a campos que no existen
    - Error: record "new" has no field "cash_register_id"
    
  2. Soluciones
    - Corregir la función del trigger para usar los campos correctos
    - Asegurar que solo se ejecute en actualizaciones de cierre
    - Mejorar la lógica de creación de movimientos de cierre
    
  3. Cambios
    - Actualizar función `create_closing_movement`
    - Verificar que todos los triggers usen los campos correctos
    - Agregar validaciones adicionales
*/

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_create_closing_movement ON cash_registers;

-- Recrear la función corregida para movimientos de cierre
CREATE OR REPLACE FUNCTION create_closing_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo ejecutar cuando se actualiza el estado a 'closed' y hay un monto de cierre
  IF NEW.status = 'closed' AND OLD.status = 'open' AND NEW.closing_amount IS NOT NULL THEN
    -- Crear movimiento de cierre
    INSERT INTO cash_movements (
      cash_register_id,
      type,
      category,
      amount,
      description,
      created_by
    ) VALUES (
      NEW.id,  -- Usar NEW.id que es el ID de la caja registradora
      'closing',
      'cierre_caja',
      NEW.closing_amount,
      CONCAT('Cierre de caja - Monto: ', NEW.closing_amount::text, 
             CASE 
               WHEN NEW.discrepancy_amount != 0 THEN 
                 CONCAT(' | Discrepancia: ', NEW.discrepancy_amount::text)
               ELSE ''
             END),
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger
CREATE TRIGGER trigger_create_closing_movement
  AFTER UPDATE ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION create_closing_movement();

-- Verificar y corregir la función de movimiento de apertura también
CREATE OR REPLACE FUNCTION create_opening_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo ejecutar en INSERT (nueva caja)
  IF TG_OP = 'INSERT' AND NEW.opening_amount IS NOT NULL THEN
    -- Crear movimiento de apertura
    INSERT INTO cash_movements (
      cash_register_id,
      type,
      category,
      amount,
      description,
      created_by
    ) VALUES (
      NEW.id,  -- Usar NEW.id que es el ID de la caja registradora
      'opening',
      'apertura_caja',
      NEW.opening_amount,
      CONCAT('Apertura de caja - Monto inicial: ', NEW.opening_amount::text),
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger de apertura
DROP TRIGGER IF EXISTS trigger_create_opening_movement ON cash_registers;
CREATE TRIGGER trigger_create_opening_movement
  AFTER INSERT ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION create_opening_movement();

-- Verificar y corregir la función de auditoría
CREATE OR REPLACE FUNCTION log_cash_register_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type_val text;
  entity_type_val text;
  entity_id_val uuid;
  amount_val numeric(10,2) := 0;
  description_val text;
  previous_balance_val numeric(10,2);
  new_balance_val numeric(10,2);
BEGIN
  -- Determinar el tipo de acción y entidad según la tabla
  IF TG_TABLE_NAME = 'cash_registers' THEN
    entity_type_val := 'cash_register';
    entity_id_val := COALESCE(NEW.id, OLD.id);
    
    IF TG_OP = 'INSERT' THEN
      action_type_val := 'open';
      amount_val := NEW.opening_amount;
      description_val := 'Apertura de caja registradora';
      previous_balance_val := 0;
      new_balance_val := NEW.opening_amount;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.status = 'closed' AND OLD.status = 'open' THEN
        action_type_val := 'close';
        amount_val := NEW.closing_amount;
        description_val := 'Cierre de caja registradora';
        previous_balance_val := OLD.opening_amount + COALESCE(OLD.total_sales, 0);
        new_balance_val := NEW.closing_amount;
      ELSE
        action_type_val := 'adjustment';
        description_val := 'Ajuste en caja registradora';
      END IF;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'cash_movements' THEN
    entity_type_val := 'movement';
    entity_id_val := COALESCE(NEW.id, OLD.id);
    
    IF TG_OP = 'INSERT' THEN
      action_type_val := NEW.type;
      amount_val := NEW.amount;
      description_val := NEW.description;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'cash_register_sales' THEN
    entity_type_val := 'sale';
    entity_id_val := COALESCE(NEW.sale_id, OLD.sale_id);
    
    IF TG_OP = 'INSERT' THEN
      action_type_val := 'sale';
      amount_val := NEW.amount_received;
      description_val := CONCAT('Venta registrada - Método: ', NEW.payment_method);
    END IF;
    
  ELSIF TG_TABLE_NAME = 'cash_register_installments' THEN
    entity_type_val := 'installment';
    entity_id_val := COALESCE(NEW.installment_id, OLD.installment_id);
    
    IF TG_OP = 'INSERT' THEN
      action_type_val := 'installment';
      amount_val := NEW.amount_paid;
      description_val := CONCAT('Abono registrado - Método: ', NEW.payment_method);
    END IF;
  END IF;

  -- Solo insertar si tenemos datos válidos
  IF action_type_val IS NOT NULL AND entity_type_val IS NOT NULL THEN
    INSERT INTO cash_register_audit_logs (
      cash_register_id,
      action_type,
      entity_type,
      entity_id,
      amount,
      previous_balance,
      new_balance,
      description,
      performed_by,
      performed_at
    ) VALUES (
      CASE 
        WHEN TG_TABLE_NAME = 'cash_registers' THEN COALESCE(NEW.id, OLD.id)
        ELSE COALESCE(NEW.cash_register_id, OLD.cash_register_id)
      END,
      action_type_val,
      entity_type_val,
      entity_id_val,
      amount_val,
      previous_balance_val,
      new_balance_val,
      description_val,
      CASE 
        WHEN TG_TABLE_NAME = 'cash_registers' THEN COALESCE(NEW.user_id, OLD.user_id)
        ELSE COALESCE(NEW.created_by, OLD.created_by)
      END,
      NOW()
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Verificar que todos los triggers estén correctamente configurados
DROP TRIGGER IF EXISTS trigger_audit_cash_register ON cash_registers;
CREATE TRIGGER trigger_audit_cash_register
  AFTER INSERT OR UPDATE ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION log_cash_register_action();

DROP TRIGGER IF EXISTS trigger_audit_cash_movements ON cash_movements;
CREATE TRIGGER trigger_audit_cash_movements
  AFTER INSERT ON cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION log_cash_register_action();

DROP TRIGGER IF EXISTS trigger_audit_cash_register_sales ON cash_register_sales;
CREATE TRIGGER trigger_audit_cash_register_sales
  AFTER INSERT ON cash_register_sales
  FOR EACH ROW
  EXECUTE FUNCTION log_cash_register_action();

DROP TRIGGER IF EXISTS trigger_audit_cash_register_installments ON cash_register_installments;
CREATE TRIGGER trigger_audit_cash_register_installments
  AFTER INSERT ON cash_register_installments
  FOR EACH ROW
  EXECUTE FUNCTION log_cash_register_action();

-- Función para limpiar registros de auditoría antiguos (opcional)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  -- Eliminar logs de auditoría más antiguos de 6 meses
  DELETE FROM cash_register_audit_logs 
  WHERE performed_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;

-- Comentario de verificación
-- Los triggers ahora usan los campos correctos:
-- - NEW.id para cash_registers (no cash_register_id)
-- - NEW.cash_register_id para cash_movements
-- - Validaciones adicionales para evitar errores