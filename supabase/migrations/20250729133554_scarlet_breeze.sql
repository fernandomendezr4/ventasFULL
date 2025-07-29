/*
  # Add IMEI/Serial tracking and bulk product features

  1. New Columns for Products
    - `has_imei_serial` (boolean) - Indicates if product requires IMEI/Serial tracking
    - `imei_serial_type` (text) - Type: 'imei', 'serial', or 'both'
    - `requires_imei_serial` (boolean) - If IMEI/Serial is mandatory for this product
    - `bulk_import_batch` (text) - Batch identifier for bulk imports
    - `import_notes` (text) - Notes from bulk import process

  2. New Table: product_imei_serials
    - Track individual IMEI/Serial numbers for products
    - Link to sales for tracking sold items
    - Status tracking (available, sold, reserved, defective)

  3. Security
    - Enable RLS on new table
    - Add policies for CRUD operations

  4. Indexes
    - Optimize searches by IMEI/Serial numbers
    - Index for bulk import batches
*/

-- Add new columns to products table
DO $$
BEGIN
  -- Add IMEI/Serial tracking columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'has_imei_serial'
  ) THEN
    ALTER TABLE products ADD COLUMN has_imei_serial boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'imei_serial_type'
  ) THEN
    ALTER TABLE products ADD COLUMN imei_serial_type text DEFAULT 'serial';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'requires_imei_serial'
  ) THEN
    ALTER TABLE products ADD COLUMN requires_imei_serial boolean DEFAULT false;
  END IF;

  -- Add bulk import columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'bulk_import_batch'
  ) THEN
    ALTER TABLE products ADD COLUMN bulk_import_batch text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'import_notes'
  ) THEN
    ALTER TABLE products ADD COLUMN import_notes text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'imported_at'
  ) THEN
    ALTER TABLE products ADD COLUMN imported_at timestamptz DEFAULT null;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'imported_by'
  ) THEN
    ALTER TABLE products ADD COLUMN imported_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Add constraint for imei_serial_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'products' AND constraint_name = 'products_imei_serial_type_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_imei_serial_type_check 
    CHECK (imei_serial_type IN ('imei', 'serial', 'both'));
  END IF;
END $$;

-- Create product_imei_serials table
CREATE TABLE IF NOT EXISTS product_imei_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  imei_number text DEFAULT '',
  serial_number text DEFAULT '',
  status text DEFAULT 'available',
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  sale_item_id uuid REFERENCES sale_items(id) ON DELETE SET NULL,
  sold_at timestamptz DEFAULT null,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

-- Add constraints for product_imei_serials
ALTER TABLE product_imei_serials ADD CONSTRAINT product_imei_serials_status_check 
CHECK (status IN ('available', 'sold', 'reserved', 'defective', 'returned'));

-- Add constraint to ensure at least one of IMEI or Serial is provided
ALTER TABLE product_imei_serials ADD CONSTRAINT product_imei_serials_number_check 
CHECK (imei_number != '' OR serial_number != '');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_has_imei_serial ON products(has_imei_serial);
CREATE INDEX IF NOT EXISTS idx_products_bulk_import_batch ON products(bulk_import_batch);
CREATE INDEX IF NOT EXISTS idx_products_imported_at ON products(imported_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_imei_serials_product_id ON product_imei_serials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_imei_serials_imei ON product_imei_serials(imei_number);
CREATE INDEX IF NOT EXISTS idx_product_imei_serials_serial ON product_imei_serials(serial_number);
CREATE INDEX IF NOT EXISTS idx_product_imei_serials_status ON product_imei_serials(status);
CREATE INDEX IF NOT EXISTS idx_product_imei_serials_sale_id ON product_imei_serials(sale_id);

-- Enable RLS
ALTER TABLE product_imei_serials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_imei_serials
CREATE POLICY "Public can view product_imei_serials"
  ON product_imei_serials
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert product_imei_serials"
  ON product_imei_serials
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update product_imei_serials"
  ON product_imei_serials
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Public can delete product_imei_serials"
  ON product_imei_serials
  FOR DELETE
  TO public
  USING (true);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_product_imei_serials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_product_imei_serials_updated_at ON product_imei_serials;
CREATE TRIGGER trigger_update_product_imei_serials_updated_at
  BEFORE UPDATE ON product_imei_serials
  FOR EACH ROW
  EXECUTE FUNCTION update_product_imei_serials_updated_at();

-- Create function to validate IMEI format (basic validation)
CREATE OR REPLACE FUNCTION validate_imei(imei_text text)
RETURNS boolean AS $$
BEGIN
  -- Basic IMEI validation: 15 digits
  IF imei_text ~ '^[0-9]{15}$' THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Create function for bulk product import
CREATE OR REPLACE FUNCTION bulk_import_products(
  products_data jsonb,
  batch_id text,
  imported_by_user uuid
)
RETURNS jsonb AS $$
DECLARE
  product_record jsonb;
  inserted_count integer := 0;
  error_count integer := 0;
  errors jsonb := '[]'::jsonb;
  result jsonb;
BEGIN
  -- Iterate through products data
  FOR product_record IN SELECT * FROM jsonb_array_elements(products_data)
  LOOP
    BEGIN
      -- Insert product
      INSERT INTO products (
        name,
        description,
        sale_price,
        purchase_price,
        stock,
        barcode,
        category_id,
        supplier_id,
        has_imei_serial,
        imei_serial_type,
        requires_imei_serial,
        bulk_import_batch,
        import_notes,
        imported_at,
        imported_by
      ) VALUES (
        product_record->>'name',
        COALESCE(product_record->>'description', ''),
        COALESCE((product_record->>'sale_price')::numeric, 0),
        COALESCE((product_record->>'purchase_price')::numeric, 0),
        COALESCE((product_record->>'stock')::integer, 0),
        COALESCE(product_record->>'barcode', ''),
        CASE WHEN product_record->>'category_id' != '' THEN (product_record->>'category_id')::uuid ELSE NULL END,
        CASE WHEN product_record->>'supplier_id' != '' THEN (product_record->>'supplier_id')::uuid ELSE NULL END,
        COALESCE((product_record->>'has_imei_serial')::boolean, false),
        COALESCE(product_record->>'imei_serial_type', 'serial'),
        COALESCE((product_record->>'requires_imei_serial')::boolean, false),
        batch_id,
        COALESCE(product_record->>'import_notes', ''),
        now(),
        imported_by_user
      );
      
      inserted_count := inserted_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      errors := errors || jsonb_build_object(
        'product_name', product_record->>'name',
        'error', SQLERRM
      );
    END;
  END LOOP;

  -- Return result
  result := jsonb_build_object(
    'success', true,
    'inserted_count', inserted_count,
    'error_count', error_count,
    'errors', errors,
    'batch_id', batch_id
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create view for products with IMEI/Serial information
CREATE OR REPLACE VIEW products_with_imei_serials AS
SELECT 
  p.*,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', pis.id,
        'imei_number', pis.imei_number,
        'serial_number', pis.serial_number,
        'status', pis.status,
        'sale_id', pis.sale_id,
        'sold_at', pis.sold_at,
        'notes', pis.notes
      )
    ) FILTER (WHERE pis.id IS NOT NULL),
    '[]'::jsonb
  ) as imei_serials,
  COUNT(pis.id) FILTER (WHERE pis.status = 'available') as available_units,
  COUNT(pis.id) FILTER (WHERE pis.status = 'sold') as sold_units,
  COUNT(pis.id) FILTER (WHERE pis.status = 'defective') as defective_units
FROM products p
LEFT JOIN product_imei_serials pis ON p.id = pis.product_id
GROUP BY p.id;

-- Create function to get available IMEI/Serial for a product
CREATE OR REPLACE FUNCTION get_available_imei_serial(
  product_id_param uuid,
  quantity_needed integer DEFAULT 1
)
RETURNS jsonb AS $$
DECLARE
  available_items jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'imei_number', imei_number,
      'serial_number', serial_number
    )
  )
  INTO available_items
  FROM product_imei_serials
  WHERE product_id = product_id_param 
    AND status = 'available'
  ORDER BY created_at
  LIMIT quantity_needed;

  RETURN COALESCE(available_items, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Create function to mark IMEI/Serial as sold
CREATE OR REPLACE FUNCTION mark_imei_serial_sold(
  imei_serial_ids uuid[],
  sale_id_param uuid,
  sale_item_id_param uuid DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  UPDATE product_imei_serials
  SET 
    status = 'sold',
    sale_id = sale_id_param,
    sale_item_id = sale_item_id_param,
    sold_at = now(),
    updated_at = now()
  WHERE id = ANY(imei_serial_ids)
    AND status = 'available';

  RETURN true;
END;
$$ LANGUAGE plpgsql;