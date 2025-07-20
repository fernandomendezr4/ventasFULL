/*
  # Fix numeric field overflow in cash_registers table

  1. Schema Changes
    - Increase precision of monetary columns from NUMERIC(10,2) to NUMERIC(18,2)
    - This allows values up to 9,999,999,999,999,999.99 (quadrillions)
    - Affects: opening_amount, closing_amount, total_sales, expected_closing_amount, 
      actual_closing_amount, discrepancy_amount

  2. Related Tables
    - Also update cash_movements table for consistency
    - Update cash_register_sales table for consistency
    - Update cash_register_installments table for consistency
    - Update cash_register_session_summary table for consistency
    - Update cash_register_daily_reports table for consistency
    - Update cash_register_discrepancies table for consistency

  3. Safety
    - Uses ALTER COLUMN TYPE which preserves existing data
    - No data loss expected as we're increasing precision
*/

-- Update cash_registers table
ALTER TABLE cash_registers ALTER COLUMN opening_amount TYPE NUMERIC(18,2);
ALTER TABLE cash_registers ALTER COLUMN closing_amount TYPE NUMERIC(18,2);
ALTER TABLE cash_registers ALTER COLUMN total_sales TYPE NUMERIC(18,2);
ALTER TABLE cash_registers ALTER COLUMN expected_closing_amount TYPE NUMERIC(18,2);
ALTER TABLE cash_registers ALTER COLUMN actual_closing_amount TYPE NUMERIC(18,2);
ALTER TABLE cash_registers ALTER COLUMN discrepancy_amount TYPE NUMERIC(18,2);

-- Update cash_movements table
ALTER TABLE cash_movements ALTER COLUMN amount TYPE NUMERIC(18,2);

-- Update cash_register_sales table
ALTER TABLE cash_register_sales ALTER COLUMN amount_received TYPE NUMERIC(18,2);
ALTER TABLE cash_register_sales ALTER COLUMN change_given TYPE NUMERIC(18,2);
ALTER TABLE cash_register_sales ALTER COLUMN discount_applied TYPE NUMERIC(18,2);
ALTER TABLE cash_register_sales ALTER COLUMN tax_amount TYPE NUMERIC(18,2);

-- Update cash_register_installments table
ALTER TABLE cash_register_installments ALTER COLUMN amount_paid TYPE NUMERIC(18,2);

-- Update cash_register_session_summary table
ALTER TABLE cash_register_session_summary ALTER COLUMN opening_amount TYPE NUMERIC(18,2);
ALTER TABLE cash_register_session_summary ALTER COLUMN closing_amount TYPE NUMERIC(18,2);
ALTER TABLE cash_register_session_summary ALTER COLUMN expected_closing_amount TYPE NUMERIC(18,2);
ALTER TABLE cash_register_session_summary ALTER COLUMN total_sales_cash TYPE NUMERIC(18,2);
ALTER TABLE cash_register_session_summary ALTER COLUMN total_installments TYPE NUMERIC(18,2);
ALTER TABLE cash_register_session_summary ALTER COLUMN total_income TYPE NUMERIC(18,2);
ALTER TABLE cash_register_session_summary ALTER COLUMN total_expenses TYPE NUMERIC(18,2);
ALTER TABLE cash_register_session_summary ALTER COLUMN discrepancy_amount TYPE NUMERIC(18,2);

-- Update cash_register_daily_reports table
ALTER TABLE cash_register_daily_reports ALTER COLUMN total_sales_amount TYPE NUMERIC(18,2);
ALTER TABLE cash_register_daily_reports ALTER COLUMN total_installments_amount TYPE NUMERIC(18,2);
ALTER TABLE cash_register_daily_reports ALTER COLUMN total_cash_collected TYPE NUMERIC(18,2);
ALTER TABLE cash_register_daily_reports ALTER COLUMN total_discrepancies TYPE NUMERIC(18,2);

-- Update cash_register_discrepancies table
ALTER TABLE cash_register_discrepancies ALTER COLUMN expected_amount TYPE NUMERIC(18,2);
ALTER TABLE cash_register_discrepancies ALTER COLUMN actual_amount TYPE NUMERIC(18,2);
ALTER TABLE cash_register_discrepancies ALTER COLUMN difference_amount TYPE NUMERIC(18,2);

-- Update cash_register_audit_logs table
ALTER TABLE cash_register_audit_logs ALTER COLUMN amount TYPE NUMERIC(18,2);
ALTER TABLE cash_register_audit_logs ALTER COLUMN previous_balance TYPE NUMERIC(18,2);
ALTER TABLE cash_register_audit_logs ALTER COLUMN new_balance TYPE NUMERIC(18,2);

-- Update other related tables for consistency
ALTER TABLE sales ALTER COLUMN total_amount TYPE NUMERIC(18,2);
ALTER TABLE sales ALTER COLUMN total_paid TYPE NUMERIC(18,2);
ALTER TABLE sales ALTER COLUMN subtotal TYPE NUMERIC(18,2);
ALTER TABLE sales ALTER COLUMN discount_amount TYPE NUMERIC(18,2);

ALTER TABLE sale_items ALTER COLUMN unit_price TYPE NUMERIC(18,2);
ALTER TABLE sale_items ALTER COLUMN total_price TYPE NUMERIC(18,2);

ALTER TABLE products ALTER COLUMN sale_price TYPE NUMERIC(18,2);
ALTER TABLE products ALTER COLUMN purchase_price TYPE NUMERIC(18,2);

ALTER TABLE payments ALTER COLUMN amount TYPE NUMERIC(18,2);

ALTER TABLE payment_installments ALTER COLUMN amount_paid TYPE NUMERIC(18,2);