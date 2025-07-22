/*
  # Agregar foreign key entre cash_movements y users

  1. Cambios en la tabla
    - Agregar foreign key constraint entre cash_movements.created_by y users.id
    - Esto permitirá hacer joins correctos en las consultas

  2. Seguridad
    - Mantener las políticas RLS existentes
    - No afectar datos existentes
*/

-- Agregar foreign key constraint si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cash_movements_created_by_fkey' 
    AND table_name = 'cash_movements'
  ) THEN
    ALTER TABLE cash_movements 
    ADD CONSTRAINT cash_movements_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Crear índice para mejorar rendimiento de las consultas con join
CREATE INDEX IF NOT EXISTS idx_cash_movements_created_by 
ON cash_movements(created_by);