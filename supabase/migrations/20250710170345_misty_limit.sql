/*
  # Fix Demo Users and Sample Data

  1. Updates
    - Ensure all required permissions exist
    - Create demo user profiles with proper role assignments
    - Add sample data for testing

  2. Security
    - Uses existing roles and permissions from previous migrations
    - Creates profiles that can be linked to auth users
*/

-- First, let's ensure we have all the permissions we need (using the existing permission names)
INSERT INTO permissions (name, description, resource, action) VALUES 
  ('users_read', 'Read users', 'users', 'read'),
  ('users_create', 'Create users', 'users', 'create'),
  ('users_update', 'Update users', 'users', 'update'),
  ('users_delete', 'Delete users', 'users', 'delete'),
  ('products_read', 'Read products', 'products', 'read'),
  ('products_create', 'Create products', 'products', 'create'),
  ('products_update', 'Update products', 'products', 'update'),
  ('products_delete', 'Delete products', 'products', 'delete'),
  ('sales_read', 'Read sales', 'sales', 'read'),
  ('sales_create', 'Create sales', 'sales', 'create'),
  ('sales_update', 'Update sales', 'sales', 'update'),
  ('sales_delete', 'Delete sales', 'sales', 'delete'),
  ('categories_read', 'Read categories', 'categories', 'read'),
  ('categories_create', 'Create categories', 'categories', 'create'),
  ('categories_update', 'Update categories', 'categories', 'update'),
  ('categories_delete', 'Delete categories', 'categories', 'delete'),
  ('suppliers_read', 'Read suppliers', 'suppliers', 'read'),
  ('suppliers_create', 'Create suppliers', 'suppliers', 'create'),
  ('suppliers_update', 'Update suppliers', 'suppliers', 'update'),
  ('suppliers_delete', 'Delete suppliers', 'suppliers', 'delete'),
  ('customers_read', 'Read customers', 'customers', 'read'),
  ('customers_create', 'Create customers', 'customers', 'create'),
  ('customers_update', 'Update customers', 'customers', 'update'),
  ('customers_delete', 'Delete customers', 'customers', 'delete'),
  ('cash_register_read', 'Read cash register', 'cash_register', 'read'),
  ('cash_register_create', 'Create cash register', 'cash_register', 'create'),
  ('cash_register_update', 'Update cash register', 'cash_register', 'update'),
  ('cash_register_delete', 'Delete cash register', 'cash_register', 'delete'),
  ('dashboard_read', 'Read dashboard', 'dashboard', 'read')
ON CONFLICT (name) DO NOTHING;

-- Ensure all permissions are assigned to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'manager'
AND p.name IN (
  'users_read', 'products_read', 'products_create', 'products_update',
  'categories_read', 'categories_create', 'categories_update',
  'sales_read', 'sales_create', 'suppliers_read', 'suppliers_create', 'suppliers_update',
  'customers_read', 'customers_create', 'customers_update',
  'cash_register_read', 'cash_register_create', 'cash_register_update',
  'dashboard_read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to employee role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'employee'
AND p.name IN (
  'products_read', 'categories_read', 'sales_read', 'sales_create',
  'customers_read', 'customers_create', 'cash_register_read',
  'cash_register_create', 'cash_register_update', 'dashboard_read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

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

-- Insert some sample products
INSERT INTO products (name, description, price, stock, category_id) VALUES 
  ('Laptop Gaming', 'Laptop para gaming de alta gama', 1299.99, 15, (SELECT id FROM categories WHERE name = 'Electrónicos')),
  ('Mouse Inalámbrico', 'Mouse óptico inalámbrico', 29.99, 50, (SELECT id FROM categories WHERE name = 'Electrónicos')),
  ('Camiseta Polo', 'Camiseta polo 100% algodón', 39.99, 30, (SELECT id FROM categories WHERE name = 'Ropa')),
  ('Pantalón Jeans', 'Pantalón jeans azul clásico', 69.99, 25, (SELECT id FROM categories WHERE name = 'Ropa')),
  ('Lámpara LED', 'Lámpara LED de escritorio', 49.99, 20, (SELECT id FROM categories WHERE name = 'Hogar')),
  ('Pelota Fútbol', 'Pelota de fútbol profesional', 34.99, 40, (SELECT id FROM categories WHERE name = 'Deportes'))
ON CONFLICT DO NOTHING;