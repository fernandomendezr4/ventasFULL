/*
  # Mejoras para el sistema de ventas con IMEI/Serial

  1. Nuevas Tablas
    - `sale_item_imei_serials` - Relación entre items de venta y IMEI/Serial específicos
    
  2. Funciones
    - `get_available_imei_serials` - Obtener IMEI/Serial disponibles para un producto
    - `reserve_imei_serial` - Reservar IMEI/Serial para una venta
    - `complete_imei_serial_sale` - Completar venta con IMEI/Serial
    - `release_reserved_imei_serials` - Liberar IMEI/Serial reservados
    
  3. Triggers
    - Actualización automática de estado de IMEI/Serial en ventas
    - Validación de disponibilidad antes de venta
    
  4. Vistas
    - `products_with_available_imei` - Productos con IMEI/Serial disponibles
*/

-- Tabla para relacionar items de venta con IMEI/Serial específicos
CREATE TABLE IF NOT EXISTS sale_item_imei_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_item_id uuid NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  imei_serial_id uuid NOT NULL REFERENCES product_imei_serials(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  
  UNIQUE(sale_item_id, imei_serial_id)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_sale_item_imei_serials_sale_item_id 
ON sale_item_imei_serials(sale_item_id);

CREATE INDEX IF NOT EXISTS idx_sale_item_imei_serials_imei_serial_id 
ON sale_item_imei_serials(imei_serial_id);

-- RLS para la nueva tabla
ALTER TABLE sale_item_imei_serials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can manage sale_item_imei_serials"
  ON sale_item_imei_serials
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Función para obtener IMEI/Serial disponibles para un producto
CREATE OR REPLACE FUNCTION get_available_imei_serials(p_product_id uuid)
RETURNS TABLE (
  id uuid,
  imei_number text,
  serial_number text,
  notes text,
  created_at timestamptz
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pis.id,
    pis.imei_number,
    pis.serial_number,
    pis.notes,
    pis.created_at
  FROM product_imei_serials pis
  WHERE pis.product_id = p_product_id
    AND pis.status = 'available'
  ORDER BY pis.created_at ASC;
END;
$$;

-- Función para reservar IMEI/Serial para una venta
CREATE OR REPLACE FUNCTION reserve_imei_serial(
  p_imei_serial_id uuid,
  p_sale_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_status text;
BEGIN
  -- Verificar estado actual
  SELECT status INTO v_current_status
  FROM product_imei_serials
  WHERE id = p_imei_serial_id;
  
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'IMEI/Serial no encontrado';
  END IF;
  
  IF v_current_status != 'available' THEN
    RAISE EXCEPTION 'IMEI/Serial no está disponible (estado: %)', v_current_status;
  END IF;
  
  -- Reservar el IMEI/Serial
  UPDATE product_imei_serials
  SET 
    status = 'reserved',
    sale_id = p_sale_id,
    updated_at = now()
  WHERE id = p_imei_serial_id
    AND status = 'available';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Función para completar venta con IMEI/Serial
CREATE OR REPLACE FUNCTION complete_imei_serial_sale(
  p_sale_item_id uuid,
  p_imei_serial_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_imei_serial_id uuid;
  v_sale_id uuid;
  v_product_id uuid;
BEGIN
  -- Obtener información del sale_item
  SELECT sale_id, product_id INTO v_sale_id, v_product_id
  FROM sale_items
  WHERE id = p_sale_item_id;
  
  IF v_sale_id IS NULL THEN
    RAISE EXCEPTION 'Sale item no encontrado';
  END IF;
  
  -- Procesar cada IMEI/Serial
  FOREACH v_imei_serial_id IN ARRAY p_imei_serial_ids
  LOOP
    -- Verificar que el IMEI/Serial pertenece al producto correcto
    IF NOT EXISTS (
      SELECT 1 FROM product_imei_serials 
      WHERE id = v_imei_serial_id 
        AND product_id = v_product_id
        AND status IN ('available', 'reserved')
    ) THEN
      RAISE EXCEPTION 'IMEI/Serial % no válido para este producto', v_imei_serial_id;
    END IF;
    
    -- Marcar como vendido
    UPDATE product_imei_serials
    SET 
      status = 'sold',
      sale_id = v_sale_id,
      sale_item_id = p_sale_item_id,
      sold_at = now(),
      updated_at = now()
    WHERE id = v_imei_serial_id;
    
    -- Crear relación en la tabla de unión
    INSERT INTO sale_item_imei_serials (sale_item_id, imei_serial_id)
    VALUES (p_sale_item_id, v_imei_serial_id)
    ON CONFLICT (sale_item_id, imei_serial_id) DO NOTHING;
  END LOOP;
  
  RETURN true;
END;
$$;

-- Función para liberar IMEI/Serial reservados (en caso de cancelación)
CREATE OR REPLACE FUNCTION release_reserved_imei_serials(p_sale_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_released_count integer := 0;
BEGIN
  -- Liberar todos los IMEI/Serial reservados para esta venta
  UPDATE product_imei_serials
  SET 
    status = 'available',
    sale_id = NULL,
    sale_item_id = NULL,
    updated_at = now()
  WHERE sale_id = p_sale_id
    AND status = 'reserved';
  
  GET DIAGNOSTICS v_released_count = ROW_COUNT;
  
  RETURN v_released_count;
END;
$$;

-- Vista para productos con IMEI/Serial disponibles
CREATE OR REPLACE VIEW products_with_available_imei AS
SELECT 
  p.*,
  c.name as category_name,
  s.name as supplier_name,
  COUNT(pis.id) as available_imei_count,
  COALESCE(
    json_agg(
      json_build_object(
        'id', pis.id,
        'imei_number', pis.imei_number,
        'serial_number', pis.serial_number,
        'notes', pis.notes,
        'created_at', pis.created_at
      ) ORDER BY pis.created_at ASC
    ) FILTER (WHERE pis.id IS NOT NULL), 
    '[]'::json
  ) as available_imei_serials
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN product_imei_serials pis ON p.id = pis.product_id AND pis.status = 'available'
WHERE p.has_imei_serial = true
GROUP BY p.id, c.name, s.name;

-- Trigger para validar cantidad vs IMEI/Serial disponibles
CREATE OR REPLACE FUNCTION validate_imei_serial_quantity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_requires_imei boolean;
  v_available_count integer;
BEGIN
  -- Verificar si el producto requiere IMEI/Serial
  SELECT requires_imei_serial INTO v_product_requires_imei
  FROM products
  WHERE id = NEW.product_id;
  
  IF v_product_requires_imei THEN
    -- Contar IMEI/Serial disponibles
    SELECT COUNT(*) INTO v_available_count
    FROM product_imei_serials
    WHERE product_id = NEW.product_id
      AND status = 'available';
    
    IF NEW.quantity > v_available_count THEN
      RAISE EXCEPTION 'No hay suficientes IMEI/Serial disponibles. Disponibles: %, Solicitados: %', 
        v_available_count, NEW.quantity;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplicar trigger a sale_items
DROP TRIGGER IF EXISTS trigger_validate_imei_serial_quantity ON sale_items;
CREATE TRIGGER trigger_validate_imei_serial_quantity
  BEFORE INSERT OR UPDATE ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_imei_serial_quantity();

-- Función para obtener detalles completos de una venta con IMEI/Serial
CREATE OR REPLACE FUNCTION get_sale_with_imei_details(p_sale_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'sale', row_to_json(s.*),
    'customer', row_to_json(c.*),
    'user', row_to_json(u.*),
    'items', (
      SELECT json_agg(
        json_build_object(
          'sale_item', row_to_json(si.*),
          'product', row_to_json(p.*),
          'imei_serials', (
            SELECT COALESCE(json_agg(
              json_build_object(
                'id', pis.id,
                'imei_number', pis.imei_number,
                'serial_number', pis.serial_number,
                'notes', pis.notes
              )
            ), '[]'::json)
            FROM sale_item_imei_serials siis
            JOIN product_imei_serials pis ON siis.imei_serial_id = pis.id
            WHERE siis.sale_item_id = si.id
          )
        )
      )
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = p_sale_id
    )
  ) INTO v_result
  FROM sales s
  LEFT JOIN customers c ON s.customer_id = c.id
  LEFT JOIN users u ON s.user_id = u.id
  WHERE s.id = p_sale_id;
  
  RETURN v_result;
END;
$$;

-- Función para validar stock disponible considerando IMEI/Serial
CREATE OR REPLACE FUNCTION get_effective_stock(p_product_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_stock integer;
  v_requires_imei boolean;
  v_available_imei_count integer;
BEGIN
  -- Obtener información del producto
  SELECT stock, requires_imei_serial 
  INTO v_product_stock, v_requires_imei
  FROM products
  WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Si no requiere IMEI/Serial, retornar stock normal
  IF NOT v_requires_imei THEN
    RETURN v_product_stock;
  END IF;
  
  -- Si requiere IMEI/Serial, contar disponibles
  SELECT COUNT(*) INTO v_available_imei_count
  FROM product_imei_serials
  WHERE product_id = p_product_id
    AND status = 'available';
  
  -- Retornar el menor entre stock y IMEI/Serial disponibles
  RETURN LEAST(v_product_stock, v_available_imei_count);
END;
$$;

-- Actualizar vista de productos detallados para incluir stock efectivo
CREATE OR REPLACE VIEW products_detailed AS
SELECT 
  p.*,
  c.name as category_name,
  s.name as supplier_name,
  s.contact_person as supplier_contact,
  COALESCE(pis_available.available_count, 0) as available_imei_serial_count,
  get_effective_stock(p.id) as effective_stock,
  last_sales.last_sale_date,
  COALESCE(sales_stats.total_sold, 0) as total_sold_all_time
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN (
  SELECT 
    product_id,
    COUNT(*) as available_count
  FROM product_imei_serials
  WHERE status = 'available'
  GROUP BY product_id
) pis_available ON p.id = pis_available.product_id
LEFT JOIN (
  SELECT 
    si.product_id,
    MAX(s.created_at) as last_sale_date
  FROM sale_items si
  JOIN sales s ON si.sale_id = s.id
  GROUP BY si.product_id
) last_sales ON p.id = last_sales.product_id
LEFT JOIN (
  SELECT 
    product_id,
    SUM(quantity) as total_sold
  FROM sale_items
  GROUP BY product_id
) sales_stats ON p.id = sales_stats.product_id;

COMMENT ON VIEW products_detailed IS 'Vista detallada de productos con información relacionada y stock efectivo';