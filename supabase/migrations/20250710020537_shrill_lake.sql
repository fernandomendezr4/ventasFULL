/*
  # Add Cash Register System

  1. New Tables
    - `cash_registers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `opening_amount` (numeric, initial cash amount)
      - `closing_amount` (numeric, final cash amount)
      - `total_sales` (numeric, total sales during session)
      - `status` (text, 'open' or 'closed')
      - `opened_at` (timestamp)
      - `closed_at` (timestamp)
      - `notes` (text, optional notes)

  2. Security
    - Enable RLS on `cash_registers` table
    - Add policies for authenticated users to manage cash registers

  3. Indexes
    - Add indexes for better performance on user_id and status
*/

-- Create cash_registers table
CREATE TABLE IF NOT EXISTS cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  opening_amount numeric(10,2) DEFAULT 0,
  closing_amount numeric(10,2) DEFAULT 0,
  total_sales numeric(10,2) DEFAULT 0,
  status text DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS cash_registers_user_id_idx ON cash_registers(user_id);
CREATE INDEX IF NOT EXISTS cash_registers_status_idx ON cash_registers(status);
CREATE INDEX IF NOT EXISTS cash_registers_opened_at_idx ON cash_registers(opened_at DESC);

-- Enable RLS
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

-- Create policies for cash_registers
CREATE POLICY "Anyone can view cash_registers"
  ON cash_registers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cash_registers"
  ON cash_registers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cash_registers"
  ON cash_registers
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete cash_registers"
  ON cash_registers
  FOR DELETE
  TO authenticated
  USING (true);