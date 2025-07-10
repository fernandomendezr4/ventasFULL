/*
  # Create demo users and roles

  1. New Tables
    - Inserts demo roles (admin, manager, employee)
    - Sets up basic permissions for each role
    - Creates demo user profiles

  2. Security
    - Maintains existing RLS policies
    - Sets up proper role-based access

  3. Demo Users
    - admin@ventasok.com (Admin role)
    - empleado@ventasok.com (Employee role)
    - manager@ventasok.com (Manager role)
*/

-- Insert basic roles if they don't exist
INSERT INTO roles (id, name, description) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'admin', 'Administrator with full access'),
  ('550e8400-e29b-41d4-a716-446655440002', 'manager', 'Manager with limited administrative access'),
  ('550e8400-e29b-41d4-a716-446655440003', 'employee', 'Employee with basic access')
ON CONFLICT (name) DO NOTHING;

-- Insert basic permissions if they don't exist
INSERT INTO permissions (id, name, description, resource, action) VALUES 
  ('660e8400-e29b-41d4-a716-446655440001', 'users_read', 'Read users', 'users', 'read'),
  ('660e8400-e29b-41d4-a716-446655440002', 'users_write', 'Write users', 'users', 'write'),
  ('660e8400-e29b-41d4-a716-446655440003', 'products_read', 'Read products', 'products', 'read'),
  ('660e8400-e29b-41d4-a716-446655440004', 'products_write', 'Write products', 'products', 'write'),
  ('660e8400-e29b-41d4-a716-446655440005', 'sales_read', 'Read sales', 'sales', 'read'),
  ('660e8400-e29b-41d4-a716-446655440006', 'sales_write', 'Write sales', 'sales', 'write'),
  ('660e8400-e29b-41d4-a716-446655440007', 'categories_read', 'Read categories', 'categories', 'read'),
  ('660e8400-e29b-41d4-a716-446655440008', 'categories_write', 'Write categories', 'categories', 'write'),
  ('660e8400-e29b-41d4-a716-446655440009', 'suppliers_read', 'Read suppliers', 'suppliers', 'read'),
  ('660e8400-e29b-41d4-a716-446655440010', 'suppliers_write', 'Write suppliers', 'suppliers', 'write'),
  ('660e8400-e29b-41d4-a716-446655440011', 'customers_read', 'Read customers', 'customers', 'read'),
  ('660e8400-e29b-41d4-a716-446655440012', 'customers_write', 'Write customers', 'customers', 'write'),
  ('660e8400-e29b-41d4-a716-446655440013', 'cash_registers_read', 'Read cash registers', 'cash_registers', 'read'),
  ('660e8400-e29b-41d4-a716-446655440014', 'cash_registers_write', 'Write cash registers', 'cash_registers', 'write')
ON CONFLICT (name) DO NOTHING;

-- Assign all permissions to admin role
INSERT INTO role_permissions (role_id, permission_id) 
SELECT 
  '550e8400-e29b-41d4-a716-446655440001' as role_id,
  id as permission_id
FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign read permissions and some write permissions to manager role
INSERT INTO role_permissions (role_id, permission_id) VALUES 
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001'), -- users_read
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440003'), -- products_read
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440004'), -- products_write
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440005'), -- sales_read
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440006'), -- sales_write
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440007'), -- categories_read
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440008'), -- categories_write
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440009'), -- suppliers_read
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440010'), -- suppliers_write
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440011'), -- customers_read
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440012'), -- customers_write
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440013'), -- cash_registers_read
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440014')  -- cash_registers_write
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign basic permissions to employee role
INSERT INTO role_permissions (role_id, permission_id) VALUES 
  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440003'), -- products_read
  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440005'), -- sales_read
  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440006'), -- sales_write
  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440007'), -- categories_read
  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440011'), -- customers_read
  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440012'), -- customers_write
  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440013'), -- cash_registers_read
  ('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440014')  -- cash_registers_write
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create demo user profiles (these will need to be linked to auth.users after manual user creation)
-- Note: The actual auth.users entries need to be created manually in Supabase Auth
INSERT INTO profiles (id, email, name, role_id, is_active) VALUES 
  ('770e8400-e29b-41d4-a716-446655440001', 'admin@ventasok.com', 'Administrador Demo', '550e8400-e29b-41d4-a716-446655440001', true),
  ('770e8400-e29b-41d4-a716-446655440002', 'empleado@ventasok.com', 'Empleado Demo', '550e8400-e29b-41d4-a716-446655440003', true),
  ('770e8400-e29b-41d4-a716-446655440003', 'manager@ventasok.com', 'Manager Demo', '550e8400-e29b-41d4-a716-446655440002', true)
ON CONFLICT (email) DO NOTHING;

-- Insert some sample categories
INSERT INTO categories (name, description) VALUES 
  ('Electrónicos', 'Productos electrónicos y tecnología'),
  ('Ropa', 'Vestimenta y accesorios'),
  ('Hogar', 'Artículos para el hogar'),
  ('Deportes', 'Equipamiento deportivo'),
  ('Libros', 'Libros y material educativo')
ON CONFLICT (name) DO NOTHING;

-- Insert some sample suppliers
INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES 
  ('TechSupply SA', 'Juan Pérez', 'contacto@techsupply.com', '+1234567890', 'Av. Principal 123'),
  ('Moda Global', 'María García', 'ventas@modaglobal.com', '+1234567891', 'Calle Comercio 456'),
  ('Casa y Hogar', 'Carlos López', 'info@casayhogar.com', '+1234567892', 'Blvd. Hogar 789')
ON CONFLICT DO NOTHING;

-- Insert some sample customers
INSERT INTO customers (name, email, phone, address) VALUES 
  ('Cliente General', 'general@cliente.com', '+1111111111', 'Sin dirección específica'),
  ('Ana Martínez', 'ana.martinez@email.com', '+2222222222', 'Calle Luna 123'),
  ('Roberto Silva', 'roberto.silva@email.com', '+3333333333', 'Av. Sol 456')
ON CONFLICT DO NOTHING;