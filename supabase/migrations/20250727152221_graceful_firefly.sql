/*
  # Fix ambiguous sale_id column reference

  1. Database Function Fix
    - Update `edit_cash_register_sale` function to properly qualify column references
    - Remove ambiguity in `sale_id` column references by using table aliases
    - Ensure all column references are properly qualified

  2. Function Updates
    - Add proper table aliases to avoid column ambiguity
    - Maintain existing functionality while fixing the SQL syntax error
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS edit_cash_register_sale(uuid, numeric, text);

-- Recreate the function with properly qualified column references
CREATE OR REPLACE FUNCTION edit_cash_register_sale(
  p_sale_id uuid,
  p_new_amount numeric,
  p_notes text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_old_amount numeric;
  v_cash_register_id uuid;
BEGIN
  -- Get the current sale amount and cash register ID
  SELECT s.total_amount, crs.cash_register_id
  INTO v_old_amount, v_cash_register_id
  FROM sales s
  LEFT JOIN cash_register_sales crs ON crs.sale_id = s.id
  WHERE s.id = p_sale_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Sale not found'
    );
  END IF;
  
  -- Update the sale amount
  UPDATE sales 
  SET total_amount = p_new_amount,
      subtotal = p_new_amount
  WHERE id = p_sale_id;
  
  -- Update cash register sales if exists
  UPDATE cash_register_sales 
  SET amount_received = p_new_amount,
      payment_notes = COALESCE(payment_notes || ' | ', '') || p_notes
  WHERE sale_id = p_sale_id;
  
  -- Create audit entry
  INSERT INTO cash_register_enhanced_audit (
    cash_register_id,
    action_type,
    entity_type,
    entity_id,
    amount,
    previous_balance,
    new_balance,
    old_values,
    new_values,
    changes_summary,
    description,
    reason,
    performed_by,
    metadata
  ) VALUES (
    v_cash_register_id,
    'edit',
    'sale',
    p_sale_id,
    p_new_amount - v_old_amount,
    v_old_amount,
    p_new_amount,
    json_build_object('total_amount', v_old_amount),
    json_build_object('total_amount', p_new_amount),
    'Sale amount updated from ' || v_old_amount || ' to ' || p_new_amount,
    'Sale amount manually edited',
    p_notes,
    auth.uid(),
    json_build_object(
      'function', 'edit_cash_register_sale',
      'timestamp', now(),
      'old_amount', v_old_amount,
      'new_amount', p_new_amount
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Sale updated successfully',
    'old_amount', v_old_amount,
    'new_amount', p_new_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION edit_cash_register_sale(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION edit_cash_register_sale(uuid, numeric, text) TO public;