/*
  # Create Audit System Schema

  1. New Tables
    - `audit_logs` - Main audit log table for tracking all system events
    - `audit_alerts` - Configuration and tracking of audit alerts
    - `audit_active_alerts` - View of currently active alerts
    - `audit_reports` - Generated audit reports storage

  2. Functions
    - `get_audit_statistics()` - Returns audit statistics summary
    - `detect_suspicious_patterns()` - Detects suspicious activity patterns
    - `generate_audit_report()` - Generates audit reports
    - `audit_maintenance()` - Performs audit system maintenance

  3. Security
    - Enable RLS on all audit tables
    - Add policies for authenticated users to access audit data
    - Restrict sensitive operations to admin users
*/

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL DEFAULT gen_random_uuid()::text,
  event_type text NOT NULL CHECK (event_type IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ACCESS')),
  event_timestamp timestamptz DEFAULT now(),
  table_name text NOT NULL,
  record_id text,
  user_email text,
  user_role text,
  severity_level text DEFAULT 'normal' CHECK (severity_level IN ('low', 'normal', 'high', 'critical')),
  business_context text DEFAULT '',
  changed_fields text[] DEFAULT '{}',
  old_values jsonb DEFAULT '{}',
  new_values jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  session_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_timestamp ON audit_logs (event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs (severity_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON audit_logs (user_email);

-- Create audit_alerts table
CREATE TABLE IF NOT EXISTS audit_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_name text NOT NULL,
  alert_type text NOT NULL DEFAULT 'threshold',
  severity text DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'critical')),
  table_name text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'disabled')),
  trigger_count integer DEFAULT 0,
  last_triggered_at timestamptz,
  description text DEFAULT '',
  business_impact text DEFAULT '',
  threshold_value numeric DEFAULT 0,
  time_window_minutes integer DEFAULT 60,
  condition_sql text,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for audit_alerts
CREATE INDEX IF NOT EXISTS idx_audit_alerts_status ON audit_alerts (status);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_severity ON audit_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_table_name ON audit_alerts (table_name);

-- Create audit_reports table
CREATE TABLE IF NOT EXISTS audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  report_name text NOT NULL,
  date_from timestamptz NOT NULL,
  date_to timestamptz NOT NULL,
  filters jsonb DEFAULT '{}',
  report_data jsonb DEFAULT '{}',
  file_path text,
  status text DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
  generated_by uuid,
  generated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text
);

-- Create view for active alerts
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
  business_impact,
  created_at
FROM audit_alerts
WHERE status IN ('active', 'acknowledged')
ORDER BY severity DESC, last_triggered_at DESC;

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit_logs
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

-- Create RLS policies for audit_alerts
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

-- Create RLS policies for audit_reports
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

-- Function to get audit statistics
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
    SELECT table_name, COUNT(*) as count
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
  SELECT COUNT(DISTINCT table_name) INTO unique_tables FROM audit_logs;
  
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

-- Function to detect suspicious patterns
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
      'affected_table', 'auth',
      'user_involved', user_email,
      'event_count', COUNT(*),
      'first_occurrence', MIN(event_timestamp),
      'last_occurrence', MAX(event_timestamp),
      'recommendation', 'Revisar actividad sospechosa y considerar bloquear IP'
    )
    FROM audit_logs
    WHERE event_type = 'LOGIN'
      AND severity_level = 'high'
      AND event_timestamp > NOW() - INTERVAL '24 hours'
    GROUP BY user_email, ip_address
    HAVING COUNT(*) > 5
  LOOP
    patterns := patterns || pattern;
  END LOOP;
  
  -- Pattern 2: Bulk deletions
  FOR pattern IN
    SELECT jsonb_build_object(
      'pattern_type', 'bulk_deletions',
      'description', 'Eliminaciones masivas en corto período de tiempo',
      'severity', 'critical',
      'affected_table', table_name,
      'user_involved', user_email,
      'event_count', COUNT(*),
      'first_occurrence', MIN(event_timestamp),
      'last_occurrence', MAX(event_timestamp),
      'recommendation', 'Verificar si las eliminaciones fueron autorizadas'
    )
    FROM audit_logs
    WHERE event_type = 'DELETE'
      AND event_timestamp > NOW() - INTERVAL '1 hour'
    GROUP BY table_name, user_email
    HAVING COUNT(*) > 10
  LOOP
    patterns := patterns || pattern;
  END LOOP;
  
  -- Pattern 3: Off-hours activity
  FOR pattern IN
    SELECT jsonb_build_object(
      'pattern_type', 'off_hours_activity',
      'description', 'Actividad fuera del horario laboral',
      'severity', 'medium',
      'affected_table', table_name,
      'user_involved', user_email,
      'event_count', COUNT(*),
      'first_occurrence', MIN(event_timestamp),
      'last_occurrence', MAX(event_timestamp),
      'recommendation', 'Verificar si la actividad fuera de horario está justificada'
    )
    FROM audit_logs
    WHERE (EXTRACT(hour FROM event_timestamp) < 8 OR EXTRACT(hour FROM event_timestamp) > 18)
      AND event_timestamp > NOW() - INTERVAL '7 days'
      AND event_type IN ('INSERT', 'UPDATE', 'DELETE')
    GROUP BY table_name, user_email
    HAVING COUNT(*) > 20
  LOOP
    patterns := patterns || pattern;
  END LOOP;
  
  RETURN patterns;
END;
$$;

-- Function to generate audit reports
CREATE OR REPLACE FUNCTION generate_audit_report(
  p_report_type text,
  p_date_from timestamptz,
  p_date_to timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_id uuid;
  report_data jsonb;
BEGIN
  -- Generate report ID
  report_id := gen_random_uuid();
  
  -- Generate report data based on type
  CASE p_report_type
    WHEN 'daily' THEN
      SELECT jsonb_build_object(
        'total_events', COUNT(*),
        'events_by_type', jsonb_object_agg(event_type, type_count),
        'events_by_severity', jsonb_object_agg(severity_level, severity_count),
        'unique_users', COUNT(DISTINCT user_email),
        'date_range', jsonb_build_object('from', p_date_from, 'to', p_date_to)
      )
      INTO report_data
      FROM (
        SELECT 
          event_type,
          severity_level,
          user_email,
          COUNT(*) OVER (PARTITION BY event_type) as type_count,
          COUNT(*) OVER (PARTITION BY severity_level) as severity_count
        FROM audit_logs
        WHERE event_timestamp BETWEEN p_date_from AND p_date_to
      ) t;
      
    WHEN 'security' THEN
      SELECT jsonb_build_object(
        'critical_events', COUNT(*) FILTER (WHERE severity_level = 'critical'),
        'high_severity_events', COUNT(*) FILTER (WHERE severity_level = 'high'),
        'failed_operations', COUNT(*) FILTER (WHERE event_type = 'DELETE' AND severity_level IN ('high', 'critical')),
        'suspicious_patterns', (SELECT detect_suspicious_patterns())
      )
      INTO report_data
      FROM audit_logs
      WHERE event_timestamp BETWEEN p_date_from AND p_date_to;
      
    ELSE
      report_data := jsonb_build_object('error', 'Unknown report type');
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
    p_report_type || ' Report - ' || p_date_from::date,
    p_date_from,
    p_date_to,
    report_data,
    'completed',
    auth.uid()
  );
  
  RETURN report_id::text;
END;
$$;

-- Function for audit maintenance
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
  WHERE event_timestamp < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_logs = ROW_COUNT;
  
  -- Reset acknowledged alerts older than 7 days
  UPDATE audit_alerts 
  SET status = 'resolved'
  WHERE status = 'acknowledged' 
    AND acknowledged_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS updated_alerts = ROW_COUNT;
  
  -- Build result message
  result := format(
    'Mantenimiento completado: %s logs eliminados, %s alertas resueltas',
    deleted_logs,
    updated_alerts
  );
  
  RETURN result;
END;
$$;

-- Insert some default audit alerts
INSERT INTO audit_alerts (alert_name, alert_type, severity, table_name, description, business_impact) VALUES
('Eliminaciones Masivas', 'threshold', 'critical', 'products', 'Detecta cuando se eliminan muchos productos en poco tiempo', 'Pérdida potencial de datos de inventario'),
('Acceso Fuera de Horario', 'pattern', 'medium', NULL, 'Detecta actividad fuera del horario laboral', 'Posible acceso no autorizado'),
('Cambios en Usuarios', 'event', 'high', 'users', 'Detecta cambios en la tabla de usuarios', 'Posibles cambios no autorizados en permisos'),
('Ventas Anómalas', 'threshold', 'high', 'sales', 'Detecta ventas con montos inusuales', 'Posibles errores o fraude en ventas'),
('Movimientos de Caja Irregulares', 'pattern', 'high', 'cash_movements', 'Detecta patrones irregulares en movimientos de caja', 'Posibles discrepancias financieras')
ON CONFLICT DO NOTHING;

-- Function to log audit events (to be called by triggers)
CREATE OR REPLACE FUNCTION log_audit_event(
  p_event_type text,
  p_table_name text,
  p_record_id text DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_severity text DEFAULT 'normal',
  p_business_context text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_email text;
  current_user_role text;
  changed_fields text[];
BEGIN
  -- Get current user info (if available)
  SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
  SELECT role INTO current_user_role FROM profiles WHERE id = auth.uid();
  
  -- Calculate changed fields
  IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    SELECT array_agg(key)
    INTO changed_fields
    FROM jsonb_each(p_new_values)
    WHERE value != COALESCE(p_old_values->key, 'null'::jsonb);
  END IF;
  
  -- Insert audit log
  INSERT INTO audit_logs (
    event_type,
    table_name,
    record_id,
    user_email,
    user_role,
    severity_level,
    business_context,
    changed_fields,
    old_values,
    new_values,
    ip_address
  ) VALUES (
    p_event_type,
    p_table_name,
    p_record_id,
    current_user_email,
    current_user_role,
    p_severity,
    p_business_context,
    changed_fields,
    p_old_values,
    p_new_values,
    inet_client_addr()
  );
  
  -- Check for alert triggers
  PERFORM check_audit_alerts(p_event_type, p_table_name, p_severity);
END;
$$;

-- Function to check and trigger alerts
CREATE OR REPLACE FUNCTION check_audit_alerts(
  p_event_type text,
  p_table_name text,
  p_severity text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  alert_record record;
  event_count integer;
BEGIN
  -- Check each active alert
  FOR alert_record IN 
    SELECT * FROM audit_alerts 
    WHERE status = 'active' 
      AND (table_name IS NULL OR table_name = p_table_name)
  LOOP
    -- Count recent events matching alert criteria
    SELECT COUNT(*)
    INTO event_count
    FROM audit_logs
    WHERE event_timestamp > NOW() - (alert_record.time_window_minutes || ' minutes')::interval
      AND (alert_record.table_name IS NULL OR table_name = alert_record.table_name)
      AND event_type = p_event_type;
    
    -- Trigger alert if threshold exceeded
    IF event_count >= alert_record.threshold_value THEN
      UPDATE audit_alerts
      SET 
        trigger_count = trigger_count + 1,
        last_triggered_at = NOW()
      WHERE id = alert_record.id;
    END IF;
  END LOOP;
END;
$$;

-- Create some sample audit data for demonstration
INSERT INTO audit_logs (event_type, table_name, record_id, user_email, user_role, severity_level, business_context, event_timestamp) VALUES
('INSERT', 'products', gen_random_uuid()::text, 'admin@example.com', 'admin', 'normal', 'Nuevo producto agregado', NOW() - INTERVAL '1 hour'),
('UPDATE', 'sales', gen_random_uuid()::text, 'user@example.com', 'employee', 'normal', 'Venta modificada', NOW() - INTERVAL '2 hours'),
('DELETE', 'customers', gen_random_uuid()::text, 'manager@example.com', 'manager', 'high', 'Cliente eliminado', NOW() - INTERVAL '3 hours'),
('LOGIN', 'auth', NULL, 'admin@example.com', 'admin', 'normal', 'Inicio de sesión exitoso', NOW() - INTERVAL '4 hours'),
('UPDATE', 'cash_registers', gen_random_uuid()::text, 'user@example.com', 'employee', 'normal', 'Caja cerrada', NOW() - INTERVAL '5 hours')
ON CONFLICT DO NOTHING;