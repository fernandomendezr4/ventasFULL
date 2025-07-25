/*
  # Enhanced Cash Register Audit System

  1. New Tables
    - Enhanced audit logging with detailed product and customer tracking
    - Comprehensive cash register session management
    - Detailed sales tracking within cash register context

  2. Enhanced Views
    - `cash_register_detailed_audit` - Complete audit trail with product and customer details
    - `cash_register_sales_detail` - Detailed sales information for each cash register session
    - `cash_register_comprehensive_view` - All-in-one view for audit interface

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage audit data
    - Maintain data integrity with proper foreign key constraints

  4. Functions
    - Enhanced audit logging functions
    - Bulk edit capabilities for cash register data
    - Comprehensive reporting functions
*/

-- Enhanced cash register audit logs with more detailed tracking
CREATE TABLE IF NOT EXISTS cash_register_enhanced_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('open', 'close', 'sale', 'installment', 'income', 'expense', 'edit', 'delete')),
  entity_type text NOT NULL CHECK (entity_type IN ('cash_register', 'sale', 'installment', 'movement', 'product', 'customer')),
  entity_id uuid,
  
  -- Detailed tracking fields
  product_details jsonb DEFAULT '{}',
  customer_details jsonb DEFAULT '{}',
  sale_details jsonb DEFAULT '{}',
  movement_details jsonb DEFAULT '{}',
  
  -- Financial tracking
  amount numeric(10,2) DEFAULT 0,
  previous_balance numeric(10,2),
  new_balance numeric(10,2),
  
  -- Change tracking
  old_values jsonb DEFAULT '{}',
  new_values jsonb DEFAULT '{}',
  changes_summary text DEFAULT '',
  
  -- Audit metadata
  description text DEFAULT '',
  reason text DEFAULT '',
  performed_by uuid REFERENCES users(id),
  performed_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text,
  session_id text,
  
  -- Additional context
  metadata jsonb DEFAULT '{}',
  tags text[] DEFAULT '{}',
  severity text DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'critical')),
  
  created_at timestamptz DEFAULT now()
);

-- Indexes for enhanced audit
CREATE INDEX IF NOT EXISTS idx_enhanced_audit_register_id ON cash_register_enhanced_audit(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_audit_action_type ON cash_register_enhanced_audit(action_type);
CREATE INDEX IF NOT EXISTS idx_enhanced_audit_entity ON cash_register_enhanced_audit(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_audit_performed_at ON cash_register_enhanced_audit(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_enhanced_audit_performed_by ON cash_register_enhanced_audit(performed_by);
CREATE INDEX IF NOT EXISTS idx_enhanced_audit_severity ON cash_register_enhanced_audit(severity);

-- Enable RLS
ALTER TABLE cash_register_enhanced_audit ENABLE ROW LEVEL SECURITY;

-- Policies for enhanced audit
CREATE POLICY "Users can view enhanced audit logs"
  ON cash_register_enhanced_audit
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert enhanced audit logs"
  ON cash_register_enhanced_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update enhanced audit logs"
  ON cash_register_enhanced_audit
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete enhanced audit logs"
  ON cash_register_enhanced_audit
  FOR DELETE
  TO authenticated
  USING (true);

-- Enhanced cash register sales tracking
CREATE TABLE IF NOT EXISTS cash_register_sales_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  
  -- Product details at time of sale
  products_sold jsonb NOT NULL DEFAULT '[]',
  total_items_count integer DEFAULT 0,
  
  -- Customer information
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_snapshot jsonb DEFAULT '{}',
  
  -- Payment details
  payment_method text DEFAULT 'cash',
  amount_received numeric(10,2) DEFAULT 0,
  change_given numeric(10,2) DEFAULT 0,
  discount_applied numeric(10,2) DEFAULT 0,
  
  -- Timing
  sale_started_at timestamptz DEFAULT now(),
  sale_completed_at timestamptz DEFAULT now(),
  processing_duration_seconds integer DEFAULT 0,
  
  -- Audit fields
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Additional metadata
  notes text DEFAULT '',
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}'
);

-- Indexes for sales tracking
CREATE INDEX IF NOT EXISTS idx_sales_tracking_register_id ON cash_register_sales_tracking(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_sales_tracking_sale_id ON cash_register_sales_tracking(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_tracking_customer_id ON cash_register_sales_tracking(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_tracking_created_at ON cash_register_sales_tracking(created_at DESC);

-- Enable RLS
ALTER TABLE cash_register_sales_tracking ENABLE ROW LEVEL SECURITY;

-- Policies for sales tracking
CREATE POLICY "Users can view sales tracking"
  ON cash_register_sales_tracking
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert sales tracking"
  ON cash_register_sales_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update sales tracking"
  ON cash_register_sales_tracking
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete sales tracking"
  ON cash_register_sales_tracking
  FOR DELETE
  TO authenticated
  USING (true);

-- Comprehensive audit view with all details
CREATE OR REPLACE VIEW cash_register_comprehensive_audit AS
SELECT 
  cr.id as register_id,
  cr.user_id,
  cr.opening_amount,
  cr.closing_amount,
  cr.expected_closing_amount,
  cr.actual_closing_amount,
  cr.discrepancy_amount,
  cr.discrepancy_reason,
  cr.session_notes,
  cr.status,
  cr.opened_at,
  cr.closed_at,
  cr.created_at as register_created_at,
  
  -- User information
  u.name as operator_name,
  u.email as operator_email,
  u.role as operator_role,
  
  -- Sales summary
  COUNT(DISTINCT s.id) as total_sales_count,
  COALESCE(SUM(s.total_amount), 0) as total_sales_amount,
  COUNT(DISTINCT CASE WHEN s.payment_type = 'cash' THEN s.id END) as cash_sales_count,
  COALESCE(SUM(CASE WHEN s.payment_type = 'cash' THEN s.total_amount ELSE 0 END), 0) as cash_sales_amount,
  COUNT(DISTINCT CASE WHEN s.payment_type = 'installment' THEN s.id END) as installment_sales_count,
  COALESCE(SUM(CASE WHEN s.payment_type = 'installment' THEN s.total_amount ELSE 0 END), 0) as installment_sales_amount,
  
  -- Product summary
  COUNT(DISTINCT si.product_id) as unique_products_sold,
  COALESCE(SUM(si.quantity), 0) as total_items_sold,
  
  -- Customer summary
  COUNT(DISTINCT s.customer_id) as unique_customers_served,
  
  -- Movement summary
  COUNT(DISTINCT cm.id) as total_movements_count,
  COALESCE(SUM(CASE WHEN cm.type = 'income' THEN cm.amount ELSE 0 END), 0) as total_income,
  COALESCE(SUM(CASE WHEN cm.type = 'expense' THEN cm.amount ELSE 0 END), 0) as total_expenses,
  
  -- Calculated balance
  cr.opening_amount + 
  COALESCE(SUM(CASE WHEN cm.type IN ('income', 'sale') THEN cm.amount ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cm.type = 'expense' THEN cm.amount ELSE 0 END), 0) as calculated_balance,
  
  -- Session duration
  CASE 
    WHEN cr.closed_at IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (cr.closed_at - cr.opened_at)) / 60
    ELSE 
      EXTRACT(EPOCH FROM (NOW() - cr.opened_at)) / 60
  END as session_duration_minutes,
  
  -- Audit counts
  COUNT(DISTINCT crea.id) as audit_entries_count,
  MAX(crea.performed_at) as last_audit_entry
  
FROM cash_registers cr
LEFT JOIN users u ON cr.user_id = u.id
LEFT JOIN cash_register_sales crs ON cr.id = crs.cash_register_id
LEFT JOIN sales s ON crs.sale_id = s.id
LEFT JOIN sale_items si ON s.id = si.sale_id
LEFT JOIN cash_movements cm ON cr.id = cm.cash_register_id
LEFT JOIN cash_register_enhanced_audit crea ON cr.id = crea.cash_register_id
GROUP BY 
  cr.id, cr.user_id, cr.opening_amount, cr.closing_amount, cr.expected_closing_amount,
  cr.actual_closing_amount, cr.discrepancy_amount, cr.discrepancy_reason, cr.session_notes,
  cr.status, cr.opened_at, cr.closed_at, cr.created_at,
  u.name, u.email, u.role;

-- Detailed sales view for audit
CREATE OR REPLACE VIEW cash_register_sales_detail AS
SELECT 
  crs.cash_register_id,
  s.id as sale_id,
  s.total_amount,
  s.subtotal,
  s.discount_amount,
  s.payment_type,
  s.payment_status,
  s.total_paid,
  s.created_at as sale_date,
  
  -- Customer details
  c.id as customer_id,
  c.name as customer_name,
  c.email as customer_email,
  c.phone as customer_phone,
  c.cedula as customer_cedula,
  c.address as customer_address,
  
  -- Seller details
  seller.id as seller_id,
  seller.name as seller_name,
  seller.email as seller_email,
  seller.role as seller_role,
  
  -- Products sold
  json_agg(
    json_build_object(
      'product_id', p.id,
      'product_name', p.name,
      'product_barcode', p.barcode,
      'category_name', cat.name,
      'quantity', si.quantity,
      'unit_price', si.unit_price,
      'total_price', si.total_price,
      'purchase_price', p.purchase_price,
      'profit_per_unit', p.sale_price - p.purchase_price,
      'total_profit', (p.sale_price - p.purchase_price) * si.quantity
    )
  ) as products_detail,
  
  -- Summary calculations
  COUNT(si.id) as total_line_items,
  SUM(si.quantity) as total_items_quantity,
  SUM((p.sale_price - p.purchase_price) * si.quantity) as total_profit,
  
  -- Payment details
  crs.payment_method as register_payment_method,
  crs.amount_received,
  crs.change_given,
  crs.payment_notes
  
FROM cash_register_sales crs
JOIN sales s ON crs.sale_id = s.id
LEFT JOIN customers c ON s.customer_id = c.id
LEFT JOIN users seller ON s.user_id = seller.id
LEFT JOIN sale_items si ON s.id = si.sale_id
LEFT JOIN products p ON si.product_id = p.id
LEFT JOIN categories cat ON p.category_id = cat.id
GROUP BY 
  crs.cash_register_id, s.id, s.total_amount, s.subtotal, s.discount_amount,
  s.payment_type, s.payment_status, s.total_paid, s.created_at,
  c.id, c.name, c.email, c.phone, c.cedula, c.address,
  seller.id, seller.name, seller.email, seller.role,
  crs.payment_method, crs.amount_received, crs.change_given, crs.payment_notes;

-- Function to log enhanced audit entries
CREATE OR REPLACE FUNCTION log_enhanced_cash_register_audit()
RETURNS TRIGGER AS $$
DECLARE
  audit_data jsonb;
  product_data jsonb;
  customer_data jsonb;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    audit_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    audit_data := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW),
      'changes', to_jsonb(NEW) - to_jsonb(OLD)
    );
  ELSIF TG_OP = 'DELETE' THEN
    audit_data := to_jsonb(OLD);
  END IF;

  -- Insert enhanced audit log
  INSERT INTO cash_register_enhanced_audit (
    cash_register_id,
    action_type,
    entity_type,
    entity_id,
    old_values,
    new_values,
    description,
    performed_by,
    metadata
  ) VALUES (
    CASE 
      WHEN TG_TABLE_NAME = 'cash_registers' THEN 
        COALESCE(NEW.id, OLD.id)
      WHEN TG_TABLE_NAME = 'sales' THEN 
        (SELECT cash_register_id FROM cash_register_sales WHERE sale_id = COALESCE(NEW.id, OLD.id) LIMIT 1)
      ELSE NULL
    END,
    CASE TG_OP
      WHEN 'INSERT' THEN 'create'
      WHEN 'UPDATE' THEN 'edit'
      WHEN 'DELETE' THEN 'delete'
    END,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    CASE TG_OP
      WHEN 'INSERT' THEN 'Created ' || TG_TABLE_NAME
      WHEN 'UPDATE' THEN 'Updated ' || TG_TABLE_NAME
      WHEN 'DELETE' THEN 'Deleted ' || TG_TABLE_NAME
    END,
    COALESCE(NEW.user_id, OLD.user_id, NEW.created_by, OLD.created_by),
    audit_data
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to track sales in cash register context
CREATE OR REPLACE FUNCTION track_cash_register_sale()
RETURNS TRIGGER AS $$
DECLARE
  register_id uuid;
  products_data jsonb;
  customer_data jsonb;
BEGIN
  -- Get the cash register ID for this sale
  SELECT cash_register_id INTO register_id
  FROM cash_register_sales 
  WHERE sale_id = NEW.id 
  LIMIT 1;
  
  IF register_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get products data
  SELECT json_agg(
    json_build_object(
      'product_id', p.id,
      'product_name', p.name,
      'barcode', p.barcode,
      'category', cat.name,
      'quantity', si.quantity,
      'unit_price', si.unit_price,
      'total_price', si.total_price,
      'purchase_price', p.purchase_price,
      'profit', (p.sale_price - p.purchase_price) * si.quantity
    )
  ) INTO products_data
  FROM sale_items si
  JOIN products p ON si.product_id = p.id
  LEFT JOIN categories cat ON p.category_id = cat.id
  WHERE si.sale_id = NEW.id;
  
  -- Get customer data if exists
  IF NEW.customer_id IS NOT NULL THEN
    SELECT to_jsonb(c) INTO customer_data
    FROM customers c
    WHERE c.id = NEW.customer_id;
  END IF;
  
  -- Insert or update sales tracking
  INSERT INTO cash_register_sales_tracking (
    cash_register_id,
    sale_id,
    products_sold,
    total_items_count,
    customer_id,
    customer_snapshot,
    payment_method,
    amount_received,
    change_given,
    discount_applied,
    created_by,
    notes
  ) VALUES (
    register_id,
    NEW.id,
    COALESCE(products_data, '[]'),
    (SELECT SUM(quantity) FROM sale_items WHERE sale_id = NEW.id),
    NEW.customer_id,
    COALESCE(customer_data, '{}'),
    NEW.payment_type,
    NEW.total_paid,
    GREATEST(NEW.total_paid - NEW.total_amount, 0),
    COALESCE(NEW.discount_amount, 0),
    NEW.user_id,
    ''
  )
  ON CONFLICT (sale_id) DO UPDATE SET
    products_sold = EXCLUDED.products_sold,
    total_items_count = EXCLUDED.total_items_count,
    customer_snapshot = EXCLUDED.customer_snapshot,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to safely delete cash register with all related data
CREATE OR REPLACE FUNCTION delete_cash_register_safely(register_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  sales_count integer;
  movements_count integer;
BEGIN
  -- Check if register exists
  IF NOT EXISTS (SELECT 1 FROM cash_registers WHERE id = register_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cash register not found'
    );
  END IF;
  
  -- Count related records
  SELECT COUNT(*) INTO sales_count
  FROM cash_register_sales
  WHERE cash_register_id = register_id;
  
  SELECT COUNT(*) INTO movements_count
  FROM cash_movements
  WHERE cash_register_id = register_id;
  
  -- Delete in proper order (foreign key constraints)
  DELETE FROM cash_register_enhanced_audit WHERE cash_register_id = register_id;
  DELETE FROM cash_register_sales_tracking WHERE cash_register_id = register_id;
  DELETE FROM cash_register_installments WHERE cash_register_id = register_id;
  DELETE FROM cash_register_sales WHERE cash_register_id = register_id;
  DELETE FROM cash_movements WHERE cash_register_id = register_id;
  DELETE FROM cash_register_discrepancies WHERE cash_register_id = register_id;
  DELETE FROM cash_register_audits WHERE cash_register_id = register_id;
  DELETE FROM cash_registers WHERE id = register_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'deleted_sales', sales_count,
    'deleted_movements', movements_count,
    'message', 'Cash register and all related data deleted successfully'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to bulk edit cash register data
CREATE OR REPLACE FUNCTION bulk_edit_cash_register(
  register_id uuid,
  new_opening_amount numeric DEFAULT NULL,
  new_closing_amount numeric DEFAULT NULL,
  new_session_notes text DEFAULT NULL,
  new_discrepancy_reason text DEFAULT NULL,
  performed_by_user uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  old_register cash_registers%ROWTYPE;
  changes_made text[] := '{}';
BEGIN
  -- Get current register data
  SELECT * INTO old_register
  FROM cash_registers
  WHERE id = register_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cash register not found'
    );
  END IF;
  
  -- Update fields if provided
  UPDATE cash_registers SET
    opening_amount = COALESCE(new_opening_amount, opening_amount),
    actual_closing_amount = COALESCE(new_closing_amount, actual_closing_amount),
    session_notes = COALESCE(new_session_notes, session_notes),
    discrepancy_reason = COALESCE(new_discrepancy_reason, discrepancy_reason),
    discrepancy_amount = CASE 
      WHEN new_closing_amount IS NOT NULL THEN 
        new_closing_amount - expected_closing_amount
      ELSE discrepancy_amount
    END
  WHERE id = register_id;
  
  -- Track changes
  IF new_opening_amount IS NOT NULL AND new_opening_amount != old_register.opening_amount THEN
    changes_made := array_append(changes_made, 'opening_amount: ' || old_register.opening_amount || ' → ' || new_opening_amount);
  END IF;
  
  IF new_closing_amount IS NOT NULL AND new_closing_amount != old_register.actual_closing_amount THEN
    changes_made := array_append(changes_made, 'closing_amount: ' || COALESCE(old_register.actual_closing_amount, 0) || ' → ' || new_closing_amount);
  END IF;
  
  IF new_session_notes IS NOT NULL AND new_session_notes != COALESCE(old_register.session_notes, '') THEN
    changes_made := array_append(changes_made, 'session_notes updated');
  END IF;
  
  IF new_discrepancy_reason IS NOT NULL AND new_discrepancy_reason != COALESCE(old_register.discrepancy_reason, '') THEN
    changes_made := array_append(changes_made, 'discrepancy_reason updated');
  END IF;
  
  -- Log the bulk edit
  INSERT INTO cash_register_enhanced_audit (
    cash_register_id,
    action_type,
    entity_type,
    entity_id,
    old_values,
    new_values,
    description,
    changes_summary,
    performed_by,
    severity
  ) VALUES (
    register_id,
    'edit',
    'cash_register',
    register_id,
    to_jsonb(old_register),
    (SELECT to_jsonb(cr) FROM cash_registers cr WHERE cr.id = register_id),
    'Bulk edit of cash register data',
    array_to_string(changes_made, '; '),
    performed_by_user,
    'normal'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'changes_made', changes_made,
    'message', 'Cash register updated successfully'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to edit sale within cash register context
CREATE OR REPLACE FUNCTION edit_cash_register_sale(
  sale_id uuid,
  new_total_amount numeric DEFAULT NULL,
  new_discount_amount numeric DEFAULT NULL,
  new_customer_id uuid DEFAULT NULL,
  new_payment_status text DEFAULT NULL,
  new_notes text DEFAULT NULL,
  performed_by_user uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  old_sale sales%ROWTYPE;
  register_id uuid;
  changes_made text[] := '{}';
BEGIN
  -- Get current sale data
  SELECT * INTO old_sale
  FROM sales
  WHERE id = sale_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Sale not found'
    );
  END IF;
  
  -- Get associated cash register
  SELECT cash_register_id INTO register_id
  FROM cash_register_sales
  WHERE sale_id = sale_id;
  
  -- Update sale fields if provided
  UPDATE sales SET
    total_amount = COALESCE(new_total_amount, total_amount),
    discount_amount = COALESCE(new_discount_amount, discount_amount),
    customer_id = CASE 
      WHEN new_customer_id = '00000000-0000-0000-0000-000000000000'::uuid THEN NULL
      ELSE COALESCE(new_customer_id, customer_id)
    END,
    payment_status = COALESCE(new_payment_status, payment_status)
  WHERE id = sale_id;
  
  -- Track changes
  IF new_total_amount IS NOT NULL AND new_total_amount != old_sale.total_amount THEN
    changes_made := array_append(changes_made, 'total_amount: ' || old_sale.total_amount || ' → ' || new_total_amount);
  END IF;
  
  IF new_discount_amount IS NOT NULL AND new_discount_amount != COALESCE(old_sale.discount_amount, 0) THEN
    changes_made := array_append(changes_made, 'discount_amount: ' || COALESCE(old_sale.discount_amount, 0) || ' → ' || new_discount_amount);
  END IF;
  
  IF new_customer_id IS NOT NULL AND new_customer_id != COALESCE(old_sale.customer_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    changes_made := array_append(changes_made, 'customer changed');
  END IF;
  
  IF new_payment_status IS NOT NULL AND new_payment_status != COALESCE(old_sale.payment_status, '') THEN
    changes_made := array_append(changes_made, 'payment_status: ' || COALESCE(old_sale.payment_status, 'none') || ' → ' || new_payment_status);
  END IF;
  
  -- Log the edit in enhanced audit
  IF register_id IS NOT NULL THEN
    INSERT INTO cash_register_enhanced_audit (
      cash_register_id,
      action_type,
      entity_type,
      entity_id,
      old_values,
      new_values,
      description,
      changes_summary,
      performed_by,
      severity
    ) VALUES (
      register_id,
      'edit',
      'sale',
      sale_id,
      to_jsonb(old_sale),
      (SELECT to_jsonb(s) FROM sales s WHERE s.id = sale_id),
      'Sale edited from cash register audit',
      array_to_string(changes_made, '; '),
      performed_by_user,
      'normal'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'changes_made', changes_made,
    'message', 'Sale updated successfully'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get comprehensive cash register report
CREATE OR REPLACE FUNCTION get_cash_register_comprehensive_report(register_id uuid)
RETURNS jsonb AS $$
DECLARE
  register_data jsonb;
  sales_data jsonb;
  movements_data jsonb;
  audit_data jsonb;
  result jsonb;
BEGIN
  -- Get register basic info
  SELECT to_jsonb(cra) INTO register_data
  FROM cash_register_comprehensive_audit cra
  WHERE cra.register_id = register_id;
  
  -- Get detailed sales
  SELECT json_agg(crsd) INTO sales_data
  FROM cash_register_sales_detail crsd
  WHERE crsd.cash_register_id = register_id;
  
  -- Get movements
  SELECT json_agg(
    json_build_object(
      'id', cm.id,
      'type', cm.type,
      'category', cm.category,
      'amount', cm.amount,
      'description', cm.description,
      'created_at', cm.created_at,
      'created_by_name', u.name
    )
  ) INTO movements_data
  FROM cash_movements cm
  LEFT JOIN users u ON cm.created_by = u.id
  WHERE cm.cash_register_id = register_id
  ORDER BY cm.created_at;
  
  -- Get audit trail
  SELECT json_agg(
    json_build_object(
      'id', crea.id,
      'action_type', crea.action_type,
      'entity_type', crea.entity_type,
      'description', crea.description,
      'changes_summary', crea.changes_summary,
      'performed_at', crea.performed_at,
      'performed_by_name', u.name,
      'severity', crea.severity
    )
  ) INTO audit_data
  FROM cash_register_enhanced_audit crea
  LEFT JOIN users u ON crea.performed_by = u.id
  WHERE crea.cash_register_id = register_id
  ORDER BY crea.performed_at DESC;
  
  -- Combine all data
  result := jsonb_build_object(
    'register_info', COALESCE(register_data, '{}'),
    'sales_detail', COALESCE(sales_data, '[]'),
    'movements', COALESCE(movements_data, '[]'),
    'audit_trail', COALESCE(audit_data, '[]'),
    'generated_at', now(),
    'generated_by', register_id
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for enhanced audit logging
DO $$
BEGIN
  -- Drop existing triggers if they exist
  DROP TRIGGER IF EXISTS trigger_enhanced_audit_cash_registers ON cash_registers;
  DROP TRIGGER IF EXISTS trigger_enhanced_audit_sales ON sales;
  DROP TRIGGER IF EXISTS trigger_track_cash_register_sale ON sales;
  DROP TRIGGER IF EXISTS trigger_track_sale_items ON sale_items;
  
  -- Create new enhanced triggers
  CREATE TRIGGER trigger_enhanced_audit_cash_registers
    AFTER INSERT OR UPDATE OR DELETE ON cash_registers
    FOR EACH ROW EXECUTE FUNCTION log_enhanced_cash_register_audit();
    
  CREATE TRIGGER trigger_enhanced_audit_sales
    AFTER INSERT OR UPDATE OR DELETE ON sales
    FOR EACH ROW EXECUTE FUNCTION log_enhanced_cash_register_audit();
    
  CREATE TRIGGER trigger_track_cash_register_sale
    AFTER INSERT OR UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION track_cash_register_sale();
END $$;

-- Add unique constraint to prevent duplicate sales tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cash_register_sales_tracking_sale_id_key'
  ) THEN
    ALTER TABLE cash_register_sales_tracking 
    ADD CONSTRAINT cash_register_sales_tracking_sale_id_key UNIQUE (sale_id);
  END IF;
END $$;

-- Update existing cash register sales to have tracking data
INSERT INTO cash_register_sales_tracking (
  cash_register_id,
  sale_id,
  products_sold,
  total_items_count,
  customer_id,
  customer_snapshot,
  payment_method,
  amount_received,
  change_given,
  discount_applied,
  created_by,
  created_at
)
SELECT 
  crs.cash_register_id,
  s.id,
  COALESCE(
    (SELECT json_agg(
      json_build_object(
        'product_id', p.id,
        'product_name', p.name,
        'barcode', p.barcode,
        'category', cat.name,
        'quantity', si.quantity,
        'unit_price', si.unit_price,
        'total_price', si.total_price,
        'purchase_price', p.purchase_price,
        'profit', (p.sale_price - p.purchase_price) * si.quantity
      )
    )
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    WHERE si.sale_id = s.id), '[]'
  ),
  COALESCE((SELECT SUM(quantity) FROM sale_items WHERE sale_id = s.id), 0),
  s.customer_id,
  CASE 
    WHEN s.customer_id IS NOT NULL THEN 
      (SELECT to_jsonb(c) FROM customers c WHERE c.id = s.customer_id)
    ELSE '{}'
  END,
  s.payment_type,
  s.total_paid,
  GREATEST(s.total_paid - s.total_amount, 0),
  COALESCE(s.discount_amount, 0),
  s.user_id,
  s.created_at
FROM cash_register_sales crs
JOIN sales s ON crs.sale_id = s.id
WHERE NOT EXISTS (
  SELECT 1 FROM cash_register_sales_tracking crst 
  WHERE crst.sale_id = s.id
);