/*
  # Función para eliminar usuarios

  1. Nueva función
    - `delete_user`: Elimina un usuario de auth.users
    - Solo admins pueden ejecutarla
*/

-- Función para eliminar usuarios (solo admins)
CREATE OR REPLACE FUNCTION delete_user(user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Verificar que el usuario actual es admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo los administradores pueden eliminar usuarios';
  END IF;

  -- Eliminar el usuario de auth.users (esto eliminará el perfil automáticamente por CASCADE)
  DELETE FROM auth.users WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;