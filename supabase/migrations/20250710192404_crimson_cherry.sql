/*
  # Trigger para creación automática de perfiles

  1. Función
    - `handle_new_user()` - Crea automáticamente un perfil cuando se registra un usuario
    - Asigna rol de admin por defecto
    - Usa los metadatos del usuario para el nombre

  2. Trigger
    - Se ejecuta después de insertar en auth.users
    - Llama a la función handle_new_user()
*/

-- Función para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  admin_role_id uuid;
BEGIN
  -- Obtener el ID del rol admin
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin' LIMIT 1;
  
  -- Crear perfil para el nuevo usuario
  INSERT INTO profiles (id, email, name, role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuario'),
    admin_role_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();