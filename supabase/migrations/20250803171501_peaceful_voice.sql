/*
  # Create Audit System Tables

  1. New Tables
    - `audit_logs` - Main audit log table for tracking all system events
    - `audit_alerts` - Alert definitions and configurations
    - `audit_active_alerts` - Currently active alerts
    - `audit_reports` - Generated audit reports

  2. Security
    - Enable RLS on all audit tables
    - Add policies for authenticated users to read audit data
    - Add policies for system to insert audit logs

  3. Functions
    - `get_audit_statistics()` - Get audit statistics
    - `detect_suspicious_patterns()` - Detect suspicious activity patterns
    - `generate_audit_report()` - Generate audit reports
    - `audit_maintenance()` - Perform audit system maintenance
*/

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL DEFAULT gen_random_uuid()::text,
  event_type text NOT NULL,
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  table_name text,
  record_id text,
  user_email text,
  user_role text,
  severity_level text DEFAULT 'normal',
  business_context text DEFAULT '',
  changed_fields jsonb DEFAULT '[]'::jsonb,
  old_values jsonb DEFAULT '{}'::jsonb,
  new_values jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Create audit_alerts table
CREATE TABLE IF NOT EXISTS audit_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_name text NOT NULL,
  alert_type text NOT NULL,
  severity text DEFAULT 'normal',
  table_name text,
  status text DEFAULT 'active',
  trigger_count integer DEFAULT 0,
  last_triggered_at timestamptz,
  description text DEFAULT '',
  business_impact text DEFAULT '',
  conditions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  acknowledged_by uuid REFERENCES users(id),
  acknowledged_at timestamptz
);

-- Create audit_active_alerts view
CREATE OR REPLACE VIEW audit_active_alerts AS
SELECT 
  id,
  alert_name,
  alert_type,
  severity,
  table_name,
  status,
  trigger_count,
  last_triggered_at,
  description,
  business_impact
FROM audit_alerts 
WHERE status = 'active';

-- Create audit_reports table
CREATE TABLE IF NOT EXISTS audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  report_name text NOT NULL,
  date_from timestamptz,
  date_to timestamptz,
  filters jsonb DEFAULT '{}'::jsonb,
  report_data jsonb DEFAULT '{}'::jsonb,
  file_path text,
  status text DEFAULT 'pending',
  generated_by uuid REFERENCES users(id),
  generated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_timestamp ON audit_logs (event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON audit_logs (user_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity_level ON audit_logs (severity_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs (record_id);

CREATE INDEX IF NOT EXISTS idx_audit_alerts_status ON audit_alerts (status);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_severity ON audit_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_table_name ON audit_alerts (table_name);

CREATE INDEX IF NOT EXISTS idx_audit_reports_generated_at ON audit_reports (generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_reports_status ON audit_reports (status);

-- Add constraints
ALTER TABLE audit_logs ADD CONSTRAINT IF NOT EXISTS audit_logs_event_type_check 
  CHECK (event_type IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ACCESS', 'ERROR'));

ALTER TABLE audit_logs ADD CONSTRAINT IF NOT EXISTS audit_logs_severity_check 
  CHECK (severity_level IN ('low', 'normal', 'medium', 'high', 'critical'));

ALTER TABLE audit_alerts ADD CONSTRAINT IF NOT EXISTS audit_alerts_severity_check 
  CHECK (severity IN ('low', 'normal', 'medium', 'high', 'critical'));

ALTER TABLE audit_alerts ADD CONSTRAINT IF NOT EXISTS audit_alerts_status_check 
  CHECK (status IN ('active', 'inactive', 'acknowledged', 'resolved'));

ALTER TABLE audit_reports ADD CONSTRAINT IF NOT EXISTS audit_reports_status_check 
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view audit alerts"
  ON audit_alerts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update audit alerts"
  ON audit_alerts
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage audit alerts"
  ON audit_alerts
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Users can view audit reports"
  ON audit_reports
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create audit reports"
  ON audit_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to get audit statistics
CREATE OR REPLACE FUNCTION get_audit_statistics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  total_events integer;
  events_by_type jsonb;
  events_by_table jsonb;
  events_by_severity jsonb;
  unique_users integer;
  unique_tables integer;
BEGIN
  -- Get total events
  SELECT COUNT(*) INTO total_events FROM audit_logs;
  
  -- Get events by type
  SELECT jsonb_object_agg(event_type, count)
  INTO events_by_type
  FROM (
    SELECT event_type, COUNT(*) as count
    FROM audit_logs
    GROUP BY event_type
  ) t;
  
  -- Get events by table
  SELECT jsonb_object_agg(table_name, count)
  INTO events_by_table
  FROM (
    SELECT COALESCE(table_name, 'unknown') as table_name, COUNT(*) as count
    FROM audit_logs
    GROUP BY table_name
  ) t;
  
  -- Get events by severity
  SELECT jsonb_object_agg(severity_level, count)
  INTO events_by_severity
  FROM (
    SELECT severity_level, COUNT(*) as count
    FROM audit_logs
    GROUP BY severity_level
  ) t;
  
  -- Get unique users
  SELECT COUNT(DISTINCT user_email) INTO unique_users FROM audit_logs WHERE user_email IS NOT NULL;
  
  -- Get unique tables
  SELECT COUNT(DISTINCT table_name) INTO unique_tables FROM audit_logs WHERE table_name IS NOT NULL;
  
  -- Build result
  result := jsonb_build_object(
    'total_events', total_events,
    'events_by_type', COALESCE(events_by_type, '{}'::jsonb),
    'events_by_table', COALESCE(events_by_table, '{}'::jsonb),
    'events_by_severity', COALESCE(events_by_severity, '{}'::jsonb),
    'unique_users', unique_users,
    'unique_tables', unique_tables
  );
  
  RETURN result;
END;
$$;

-- Create function to detect suspicious patterns
CREATE OR REPLACE FUNCTION detect_suspicious_patterns()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  patterns jsonb := '[]'::jsonb;
  pattern jsonb;
BEGIN
  -- Pattern 1: Multiple failed login attempts
  FOR pattern IN
    SELECT jsonb_build_object(
      'pattern_type', 'multiple_failed_logins',
      'description', 'Múltiples intentos de login fallidos desde la misma IP',
      'severity', 'high',
      'affected_table', 'users',
      'user_involved', user_email,
      'event_count', count,
      'first_occurrence', first_occurrence,
      'last_occurrence', last_occurrence,
      'recommendation', 'Revisar actividad del usuario y considerar bloqueo temporal'
    )
    FROM (
      SELECT 
        user_email,
        COUNT(*) as count,
        MIN(event_timestamp) as first_occurrence,
        MAX(event_timestamp) as last_occurrence
      FROM audit_logs
      WHERE event_type = 'LOGIN' 
        AND severity_level = 'high'
        AND event_timestamp > now() - interval '1 hour'
      GROUP BY user_email, ip_address
      HAVING COUNT(*) > 5
    ) t
  LOOP
    patterns := patterns || pattern;
  END LOOP;
  
  -- Pattern 2: Bulk data modifications
  FOR pattern IN
    SELECT jsonb_build_object(
      'pattern_type', 'bulk_modifications',
      'description', 'Modificaciones masivas de datos en corto período',
      'severity', 'medium',
      'affected_table', table_name,
      'user_involved', user_email,
      'event_count', count,
      'first_occurrence', first_occurrence,
      'last_occurrence', last_occurrence,
      'recommendation', 'Verificar si las modificaciones fueron autorizadas'
    )
    FROM (
      SELECT 
        table_name,
        user_email,
        COUNT(*) as count,
        MIN(event_timestamp) as first_occurrence,
        MAX(event_timestamp) as last_occurrence
      FROM audit_logs
      WHERE event_type IN ('UPDATE', 'DELETE')
        AND event_timestamp > now() - interval '10 minutes'
      GROUP BY table_name, user_email
      HAVING COUNT(*) > 20
    ) t
  LOOP
    patterns := patterns || pattern;
  END LOOP;
  
  RETURN patterns;
END;
$$;

-- Create function to generate audit reports
CREATE OR REPLACE FUNCTION generate_audit_report(
  p_report_type text,
  p_date_from timestamptz,
  p_date_to timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_id uuid;
  report_data jsonb;
BEGIN
  report_id := gen_random_uuid();
  
  -- Generate report data based on type
  CASE p_report_type
    WHEN 'daily' THEN
      SELECT jsonb_build_object(
        'total_events', COUNT(*),
        'events_by_type', jsonb_object_agg(event_type, type_count),
        'unique_users', COUNT(DISTINCT user_email),
        'critical_events', COUNT(*) FILTER (WHERE severity_level = 'critical')
      )
      INTO report_data
      FROM (
        SELECT 
          event_type,
          user_email,
          severity_level,
          COUNT(*) OVER (PARTITION BY event_type) as type_count
        FROM audit_logs
        WHERE event_timestamp BETWEEN p_date_from AND p_date_to
      ) t;
      
    WHEN 'security' THEN
      SELECT jsonb_build_object(
        'high_severity_events', COUNT(*) FILTER (WHERE severity_level IN ('high', 'critical')),
        'failed_logins', COUNT(*) FILTER (WHERE event_type = 'LOGIN' AND severity_level = 'high'),
        'unauthorized_access', COUNT(*) FILTER (WHERE event_type = 'ACCESS' AND severity_level = 'high'),
        'data_modifications', COUNT(*) FILTER (WHERE event_type IN ('UPDATE', 'DELETE'))
      )
      INTO report_data
      FROM audit_logs
      WHERE event_timestamp BETWEEN p_date_from AND p_date_to;
      
    ELSE
      report_data := '{}'::jsonb;
  END CASE;
  
  -- Insert report record
  INSERT INTO audit_reports (
    id,
    report_type,
    report_name,
    date_from,
    date_to,
    report_data,
    status,
    generated_by
  ) VALUES (
    report_id,
    p_report_type,
    p_report_type || ' Report - ' || to_char(now(), 'YYYY-MM-DD HH24:MI'),
    p_date_from,
    p_date_to,
    report_data,
    'completed',
    auth.uid()
  );
  
  RETURN report_id;
END;
$$;

-- Create function for audit maintenance
CREATE OR REPLACE FUNCTION audit_maintenance()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_logs integer;
  updated_alerts integer;
  result text;
BEGIN
  -- Clean old audit logs (older than 90 days)
  DELETE FROM audit_logs 
  WHERE event_timestamp < now() - interval '90 days';
  
  GET DIAGNOSTICS deleted_logs = ROW_COUNT;
  
  -- Reset acknowledged alerts older than 7 days
  UPDATE audit_alerts 
  SET status = 'active', acknowledged_by = NULL, acknowledged_at = NULL
  WHERE status = 'acknowledged' 
    AND acknowledged_at < now() - interval '7 days';
  
  GET DIAGNOSTICS updated_alerts = ROW_COUNT;
  
  result := format('Mantenimiento completado: %s logs eliminados, %s alertas reactivadas', 
                   deleted_logs, updated_alerts);
  
  RETURN result;
END;
$$;

-- Insert some default audit alerts
INSERT INTO audit_alerts (alert_name, alert_type, severity, table_name, description, business_impact) VALUES
('Modificaciones masivas de productos', 'bulk_changes', 'high', 'products', 'Detecta cuando se modifican muchos productos en poco tiempo', 'Posible error o actividad maliciosa'),
('Eliminaciones de ventas', 'data_deletion', 'critical', 'sales', 'Alerta cuando se eliminan registros de ventas', 'Pérdida de datos críticos de negocio'),
('Acceso fuera de horario', 'unusual_access', 'medium', NULL, 'Detecta acceso al sistema fuera del horario laboral', 'Posible acceso no autorizado'),
('Cambios en usuarios administrativos', 'admin_changes', 'critical', 'users', 'Alerta cuando se modifican usuarios con rol admin', 'Cambios en permisos críticos')
ON CONFLICT DO NOTHING;

-- Insert some sample audit logs for testing
INSERT INTO audit_logs (event_type, table_name, user_email, user_role, severity_level, business_context) VALUES
('INSERT', 'products', 'admin@example.com', 'admin', 'normal', 'Producto agregado al inventario'),
('UPDATE', 'sales', 'employee@example.com', 'employee', 'normal', 'Venta modificada'),
('DELETE', 'customers', 'manager@example.com', 'manager', 'medium', 'Cliente eliminado'),
('LOGIN', 'users', 'admin@example.com', 'admin', 'normal', 'Inicio de sesión exitoso')
ON CONFLICT DO NOTHING;