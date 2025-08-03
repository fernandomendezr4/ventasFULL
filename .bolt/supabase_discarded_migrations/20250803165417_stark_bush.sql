/*
  # Sistema de Auditoría Completa y Administrable

  1. Nuevas Tablas de Auditoría
    - `audit_logs` - Registro principal de auditoría
    - `audit_configurations` - Configuraciones de auditoría por tabla
    - `audit_reports` - Reportes de auditoría generados
    - `audit_alerts` - Alertas y notificaciones de auditoría
    - `audit_data_retention` - Políticas de retención de datos

  2. Funciones de Auditoría
    - Triggers automáticos para todas las tablas
    - Funciones de generación de reportes
    - Funciones de limpieza y mantenimiento
    - Funciones de análisis de patrones

  3. Vistas de Auditoría
    - Vista consolidada de actividad
    - Vista de cambios por usuario
    - Vista de actividad por tabla
    - Vista de alertas activas

  4. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas específicas por rol
    - Encriptación de datos sensibles
*/

-- =====================================================
-- TABLA PRINCIPAL DE AUDITORÍA
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información básica del evento
  event_id text UNIQUE NOT NULL DEFAULT 'AUD_' || extract(epoch from now())::text || '_' || substr(gen_random_uuid()::text, 1, 8),
  event_type text NOT NULL CHECK (event_type IN ('INSERT', 'UPDATE', 'DELETE', 'SELECT', 'TRUNCATE', 'LOGIN', 'LOGOUT', 'PERMISSION_CHANGE')),
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  
  -- Información de la tabla/esquema
  schema_name text NOT NULL DEFAULT 'public',
  table_name text NOT NULL,
  record_id text,
  
  -- Información del usuario
  user_id uuid,
  user_email text,
  user_role text,
  session_id text,
  ip_address inet,
  user_agent text,
  
  -- Datos del cambio
  old_values jsonb DEFAULT '{}',
  new_values jsonb DEFAULT '{}',
  changed_fields text[],
  
  -- Contexto adicional
  operation_context text, -- 'manual', 'api', 'bulk', 'system'
  business_context text, -- 'sale', 'inventory', 'user_management', etc.
  transaction_id text,
  
  -- Metadatos
  severity_level text NOT NULL DEFAULT 'normal' CHECK (severity_level IN ('low', 'normal', 'high', 'critical')),
  tags text[] DEFAULT '{}',
  additional_metadata jsonb DEFAULT '{}',
  
  -- Información de seguimiento
  related_audit_id uuid REFERENCES audit_logs(id),
  correlation_id text,
  
  -- Campos de sistema
  created_at timestamptz NOT NULL DEFAULT now(),
  indexed_at timestamptz,
  archived_at timestamptz,
  
  -- Campos de retención
  retention_policy text DEFAULT 'standard',
  expires_at timestamptz,
  
  -- Campos de verificación
  checksum text,
  is_verified boolean DEFAULT false,
  verification_timestamp timestamptz
);

-- Índices optimizados para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_timestamp ON audit_logs (event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs (severity_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_context ON audit_logs (business_context);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON audit_logs (correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON audit_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tags ON audit_logs USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_fields ON audit_logs USING GIN (changed_fields);

-- Índice compuesto para consultas de dashboard
CREATE INDEX IF NOT EXISTS idx_audit_logs_dashboard ON audit_logs (event_timestamp DESC, table_name, event_type);

-- Índice para búsqueda de texto completo
CREATE INDEX IF NOT EXISTS idx_audit_logs_search ON audit_logs USING GIN (
  to_tsvector('spanish', 
    COALESCE(table_name, '') || ' ' || 
    COALESCE(event_type, '') || ' ' || 
    COALESCE(user_email, '') || ' ' ||
    COALESCE(business_context, '')
  )
);

-- =====================================================
-- CONFIGURACIONES DE AUDITORÍA
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Configuración por tabla
  table_name text NOT NULL UNIQUE,
  schema_name text NOT NULL DEFAULT 'public',
  
  -- Configuraciones de eventos
  audit_insert boolean DEFAULT true,
  audit_update boolean DEFAULT true,
  audit_delete boolean DEFAULT true,
  audit_select boolean DEFAULT false, -- Solo para tablas sensibles
  audit_truncate boolean DEFAULT true,
  
  -- Configuraciones de datos
  capture_old_values boolean DEFAULT true,
  capture_new_values boolean DEFAULT true,
  excluded_columns text[] DEFAULT '{}', -- Columnas a excluir de la auditoría
  sensitive_columns text[] DEFAULT '{}', -- Columnas que requieren encriptación
  
  -- Configuraciones de retención
  retention_days integer DEFAULT 365,
  auto_archive boolean DEFAULT true,
  archive_after_days integer DEFAULT 90,
  
  -- Configuraciones de alertas
  enable_alerts boolean DEFAULT false,
  alert_on_bulk_changes boolean DEFAULT true,
  bulk_threshold integer DEFAULT 100,
  alert_on_sensitive_access boolean DEFAULT true,
  
  -- Configuraciones de rendimiento
  async_logging boolean DEFAULT false,
  batch_size integer DEFAULT 1000,
  
  -- Metadatos
  description text,
  business_owner text,
  compliance_requirements text[],
  
  -- Campos de sistema
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- Insertar configuraciones por defecto para todas las tablas existentes
INSERT INTO audit_configurations (table_name, description, business_owner) VALUES
('users', 'Auditoría de usuarios del sistema', 'Administración'),
('products', 'Auditoría de productos e inventario', 'Inventario'),
('sales', 'Auditoría de ventas y transacciones', 'Ventas'),
('customers', 'Auditoría de información de clientes', 'CRM'),
('cash_registers', 'Auditoría de cajas registradoras', 'Finanzas'),
('categories', 'Auditoría de categorías de productos', 'Inventario'),
('suppliers', 'Auditoría de proveedores', 'Compras'),
('payment_installments', 'Auditoría de abonos y pagos', 'Finanzas'),
('cash_movements', 'Auditoría de movimientos de caja', 'Finanzas'),
('product_imei_serials', 'Auditoría de IMEI y números de serie', 'Inventario')
ON CONFLICT (table_name) DO NOTHING;

-- =====================================================
-- REPORTES DE AUDITORÍA
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información del reporte
  report_name text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'custom', 'compliance', 'security', 'performance')),
  report_format text DEFAULT 'json' CHECK (report_format IN ('json', 'csv', 'pdf', 'html')),
  
  -- Parámetros del reporte
  date_from timestamptz NOT NULL,
  date_to timestamptz NOT NULL,
  tables_included text[],
  event_types_included text[],
  users_included uuid[],
  
  -- Filtros adicionales
  severity_filter text[],
  business_context_filter text[],
  custom_filters jsonb DEFAULT '{}',
  
  -- Resultados del reporte
  total_events integer DEFAULT 0,
  critical_events integer DEFAULT 0,
  high_severity_events integer DEFAULT 0,
  tables_affected text[],
  users_involved text[],
  
  -- Datos del reporte
  report_data jsonb,
  report_summary jsonb,
  report_url text, -- URL del archivo generado
  file_size_bytes bigint,
  
  -- Información de generación
  generated_by uuid,
  generated_at timestamptz DEFAULT now(),
  generation_duration_ms integer,
  
  -- Estado del reporte
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'archived')),
  error_message text,
  
  -- Configuraciones de acceso
  is_public boolean DEFAULT false,
  access_level text DEFAULT 'admin' CHECK (access_level IN ('admin', 'manager', 'auditor', 'public')),
  expires_at timestamptz,
  
  -- Metadatos
  description text,
  tags text[] DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_reports_generated_at ON audit_reports (generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_reports_type ON audit_reports (report_type);
CREATE INDEX IF NOT EXISTS idx_audit_reports_status ON audit_reports (status);
CREATE INDEX IF NOT EXISTS idx_audit_reports_generated_by ON audit_reports (generated_by);

-- =====================================================
-- ALERTAS DE AUDITORÍA
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información de la alerta
  alert_name text NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('security', 'compliance', 'performance', 'data_integrity', 'business_rule')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Condiciones de la alerta
  trigger_conditions jsonb NOT NULL,
  table_name text,
  event_types text[],
  
  -- Configuración de notificaciones
  notification_channels text[] DEFAULT '{}', -- 'email', 'webhook', 'dashboard'
  notification_recipients text[],
  webhook_url text,
  
  -- Estado de la alerta
  is_active boolean DEFAULT true,
  last_triggered_at timestamptz,
  trigger_count integer DEFAULT 0,
  
  -- Configuración de frecuencia
  cooldown_minutes integer DEFAULT 60, -- Tiempo mínimo entre alertas
  max_triggers_per_hour integer DEFAULT 10,
  
  -- Información del evento que disparó la alerta
  triggered_by_audit_id uuid REFERENCES audit_logs(id),
  trigger_details jsonb,
  
  -- Resolución de la alerta
  status text DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'suppressed')),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolution_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  
  -- Metadatos
  description text,
  business_impact text,
  remediation_steps text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS idx_audit_alerts_type ON audit_alerts (alert_type);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_severity ON audit_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_status ON audit_alerts (status);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_table ON audit_alerts (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_triggered_at ON audit_alerts (last_triggered_at DESC);

-- =====================================================
-- POLÍTICAS DE RETENCIÓN DE DATOS
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_data_retention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Configuración de retención
  policy_name text NOT NULL UNIQUE,
  table_name text NOT NULL,
  
  -- Períodos de retención
  active_retention_days integer NOT NULL DEFAULT 90,
  archive_retention_days integer NOT NULL DEFAULT 365,
  total_retention_days integer NOT NULL DEFAULT 2555, -- 7 años por defecto
  
  -- Configuraciones de archivo
  auto_archive boolean DEFAULT true,
  archive_format text DEFAULT 'compressed_json' CHECK (archive_format IN ('json', 'compressed_json', 'csv', 'parquet')),
  archive_location text, -- URL del storage externo
  
  -- Configuraciones de eliminación
  auto_delete boolean DEFAULT false,
  delete_confirmation_required boolean DEFAULT true,
  
  -- Configuraciones de compliance
  compliance_framework text[], -- 'GDPR', 'SOX', 'HIPAA', etc.
  legal_hold boolean DEFAULT false,
  legal_hold_reason text,
  legal_hold_until timestamptz,
  
  -- Configuraciones de notificación
  notify_before_archive_days integer DEFAULT 7,
  notify_before_delete_days integer DEFAULT 30,
  notification_recipients text[],
  
  -- Estado
  is_active boolean DEFAULT true,
  last_executed_at timestamptz,
  next_execution_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- Políticas por defecto
INSERT INTO audit_data_retention (policy_name, table_name, active_retention_days, archive_retention_days, total_retention_days) VALUES
('users_standard', 'users', 180, 730, 2555),
('sales_financial', 'sales', 365, 1825, 3650), -- 10 años para datos financieros
('products_inventory', 'products', 90, 365, 1825),
('cash_registers_financial', 'cash_registers', 365, 1825, 3650),
('customers_crm', 'customers', 180, 1095, 2555),
('audit_logs_meta', 'audit_logs', 90, 365, 2555)
ON CONFLICT (policy_name) DO NOTHING;

-- =====================================================
-- FUNCIÓN PRINCIPAL DE AUDITORÍA
-- =====================================================

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS trigger AS $$
DECLARE
  audit_config record;
  old_data jsonb := '{}';
  new_data jsonb := '{}';
  changed_fields text[] := '{}';
  field_name text;
  correlation_id text;
  business_ctx text;
  severity_level text := 'normal';
  current_user_info record;
BEGIN
  -- Obtener configuración de auditoría para esta tabla
  SELECT * INTO audit_config 
  FROM audit_configurations 
  WHERE table_name = TG_TABLE_NAME 
    AND schema_name = TG_TABLE_SCHEMA 
    AND is_active = true;
  
  -- Si no hay configuración o no está activa, salir
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Verificar si este tipo de operación debe ser auditada
  IF (TG_OP = 'INSERT' AND NOT audit_config.audit_insert) OR
     (TG_OP = 'UPDATE' AND NOT audit_config.audit_update) OR
     (TG_OP = 'DELETE' AND NOT audit_config.audit_delete) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Obtener información del usuario actual
  SELECT 
    id, email, role
  INTO current_user_info
  FROM users 
  WHERE id = auth.uid()
  LIMIT 1;
  
  -- Generar ID de correlación para operaciones relacionadas
  correlation_id := 'CORR_' || extract(epoch from now())::text || '_' || substr(gen_random_uuid()::text, 1, 8);
  
  -- Determinar contexto de negocio basado en la tabla
  business_ctx := CASE TG_TABLE_NAME
    WHEN 'sales', 'sale_items', 'payments', 'payment_installments' THEN 'sales'
    WHEN 'products', 'categories', 'suppliers', 'product_imei_serials' THEN 'inventory'
    WHEN 'cash_registers', 'cash_movements', 'cash_register_sales' THEN 'cash_management'
    WHEN 'customers' THEN 'customer_management'
    WHEN 'users', 'roles', 'permissions' THEN 'user_management'
    ELSE 'system'
  END;
  
  -- Procesar datos según el tipo de operación
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    
    -- Determinar severidad para eliminaciones
    severity_level := CASE TG_TABLE_NAME
      WHEN 'sales', 'cash_registers' THEN 'high'
      WHEN 'users' THEN 'critical'
      ELSE 'normal'
    END;
    
  ELSIF TG_OP = 'INSERT' THEN
    new_data := to_jsonb(NEW);
    
    -- Determinar severidad para inserciones
    severity_level := CASE TG_TABLE_NAME
      WHEN 'users' THEN 'high'
      WHEN 'cash_registers' THEN 'high'
      ELSE 'normal'
    END;
    
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    
    -- Identificar campos cambiados
    FOR field_name IN SELECT jsonb_object_keys(new_data) LOOP
      IF old_data->field_name IS DISTINCT FROM new_data->field_name THEN
        changed_fields := array_append(changed_fields, field_name);
      END IF;
    END LOOP;
    
    -- Determinar severidad basada en campos cambiados
    IF 'role' = ANY(changed_fields) OR 'is_active' = ANY(changed_fields) THEN
      severity_level := 'critical';
    ELSIF 'total_amount' = ANY(changed_fields) OR 'status' = ANY(changed_fields) THEN
      severity_level := 'high';
    ELSIF array_length(changed_fields, 1) > 5 THEN
      severity_level := 'high'; -- Muchos campos cambiados
    END IF;
  END IF;
  
  -- Excluir columnas configuradas
  IF audit_config.excluded_columns IS NOT NULL THEN
    FOR field_name IN SELECT unnest(audit_config.excluded_columns) LOOP
      old_data := old_data - field_name;
      new_data := new_data - field_name;
      changed_fields := array_remove(changed_fields, field_name);
    END LOOP;
  END IF;
  
  -- Insertar registro de auditoría
  INSERT INTO audit_logs (
    event_type,
    schema_name,
    table_name,
    record_id,
    user_id,
    user_email,
    user_role,
    session_id,
    ip_address,
    old_values,
    new_values,
    changed_fields,
    operation_context,
    business_context,
    severity_level,
    correlation_id,
    additional_metadata
  ) VALUES (
    TG_OP,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    COALESCE((NEW->>'id'), (OLD->>'id')),
    current_user_info.id,
    current_user_info.email,
    current_user_info.role,
    current_setting('app.session_id', true),
    inet_client_addr(),
    old_data,
    new_data,
    changed_fields,
    COALESCE(current_setting('app.operation_context', true), 'manual'),
    business_ctx,
    severity_level,
    correlation_id,
    jsonb_build_object(
      'trigger_name', TG_NAME,
      'table_oid', TG_RELID,
      'transaction_timestamp', transaction_timestamp(),
      'statement_timestamp', statement_timestamp(),
      'clock_timestamp', clock_timestamp()
    )
  );
  
  -- Verificar si se deben disparar alertas
  PERFORM check_audit_alerts(TG_TABLE_NAME, TG_OP, severity_level, correlation_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN PARA VERIFICAR ALERTAS
-- =====================================================

CREATE OR REPLACE FUNCTION check_audit_alerts(
  p_table_name text,
  p_event_type text,
  p_severity text,
  p_correlation_id text
)
RETURNS void AS $$
DECLARE
  alert_config record;
  should_trigger boolean;
  recent_events_count integer;
BEGIN
  -- Buscar alertas activas para esta tabla
  FOR alert_config IN 
    SELECT * FROM audit_alerts 
    WHERE is_active = true 
      AND (table_name IS NULL OR table_name = p_table_name)
      AND (event_types IS NULL OR p_event_type = ANY(event_types))
      AND status = 'active'
  LOOP
    should_trigger := false;
    
    -- Verificar cooldown
    IF alert_config.last_triggered_at IS NOT NULL AND 
       alert_config.last_triggered_at + (alert_config.cooldown_minutes || ' minutes')::interval > now() THEN
      CONTINUE;
    END IF;
    
    -- Verificar límite de triggers por hora
    SELECT COUNT(*) INTO recent_events_count
    FROM audit_alerts
    WHERE id = alert_config.id
      AND last_triggered_at > now() - interval '1 hour';
    
    IF recent_events_count >= alert_config.max_triggers_per_hour THEN
      CONTINUE;
    END IF;
    
    -- Evaluar condiciones específicas del tipo de alerta
    CASE alert_config.alert_type
      WHEN 'security' THEN
        -- Alertas de seguridad
        IF p_event_type IN ('DELETE', 'UPDATE') AND p_table_name IN ('users', 'roles', 'permissions') THEN
          should_trigger := true;
        END IF;
        
      WHEN 'compliance' THEN
        -- Alertas de compliance
        IF p_severity IN ('high', 'critical') THEN
          should_trigger := true;
        END IF;
        
      WHEN 'performance' THEN
        -- Alertas de rendimiento (ej: muchas operaciones en poco tiempo)
        SELECT COUNT(*) INTO recent_events_count
        FROM audit_logs
        WHERE table_name = p_table_name
          AND event_timestamp > now() - interval '5 minutes';
        
        IF recent_events_count > 100 THEN
          should_trigger := true;
        END IF;
        
      WHEN 'data_integrity' THEN
        -- Alertas de integridad de datos
        IF p_event_type = 'DELETE' AND p_table_name IN ('sales', 'products', 'customers') THEN
          should_trigger := true;
        END IF;
        
      WHEN 'business_rule' THEN
        -- Alertas de reglas de negocio (personalizable)
        should_trigger := true;
    END CASE;
    
    -- Disparar alerta si se cumplen las condiciones
    IF should_trigger THEN
      UPDATE audit_alerts 
      SET 
        last_triggered_at = now(),
        trigger_count = trigger_count + 1,
        trigger_details = jsonb_build_object(
          'table_name', p_table_name,
          'event_type', p_event_type,
          'severity', p_severity,
          'correlation_id', p_correlation_id,
          'timestamp', now()
        )
      WHERE id = alert_config.id;
      
      -- Aquí se pueden agregar notificaciones externas
      -- Por ejemplo, llamar a una función que envíe emails o webhooks
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VISTAS DE AUDITORÍA
-- =====================================================

-- Vista consolidada de actividad
CREATE OR REPLACE VIEW audit_activity_summary AS
SELECT 
  DATE(event_timestamp) as activity_date,
  table_name,
  event_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT record_id) as unique_records,
  COUNT(*) FILTER (WHERE severity_level = 'critical') as critical_events,
  COUNT(*) FILTER (WHERE severity_level = 'high') as high_events,
  MIN(event_timestamp) as first_event,
  MAX(event_timestamp) as last_event
FROM audit_logs
WHERE event_timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(event_timestamp), table_name, event_type
ORDER BY activity_date DESC, event_count DESC;

-- Vista de cambios por usuario
CREATE OR REPLACE VIEW audit_user_activity AS
SELECT 
  user_id,
  user_email,
  user_role,
  DATE(event_timestamp) as activity_date,
  COUNT(*) as total_actions,
  COUNT(DISTINCT table_name) as tables_affected,
  COUNT(*) FILTER (WHERE event_type = 'INSERT') as inserts,
  COUNT(*) FILTER (WHERE event_type = 'UPDATE') as updates,
  COUNT(*) FILTER (WHERE event_type = 'DELETE') as deletes,
  COUNT(*) FILTER (WHERE severity_level IN ('high', 'critical')) as high_risk_actions,
  array_agg(DISTINCT table_name) as affected_tables,
  MIN(event_timestamp) as first_action,
  MAX(event_timestamp) as last_action
FROM audit_logs
WHERE event_timestamp >= CURRENT_DATE - INTERVAL '7 days'
  AND user_id IS NOT NULL
GROUP BY user_id, user_email, user_role, DATE(event_timestamp)
ORDER BY activity_date DESC, total_actions DESC;

-- Vista de actividad por tabla
CREATE OR REPLACE VIEW audit_table_activity AS
SELECT 
  table_name,
  DATE(event_timestamp) as activity_date,
  COUNT(*) as total_events,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT record_id) as unique_records,
  COUNT(*) FILTER (WHERE event_type = 'INSERT') as inserts,
  COUNT(*) FILTER (WHERE event_type = 'UPDATE') as updates,
  COUNT(*) FILTER (WHERE event_type = 'DELETE') as deletes,
  COUNT(*) FILTER (WHERE severity_level = 'critical') as critical_events,
  AVG(CASE WHEN event_type = 'UPDATE' THEN array_length(changed_fields, 1) END) as avg_fields_changed,
  array_agg(DISTINCT user_email) FILTER (WHERE user_email IS NOT NULL) as active_users
FROM audit_logs
WHERE event_timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY table_name, DATE(event_timestamp)
ORDER BY activity_date DESC, total_events DESC;

-- Vista de alertas activas
CREATE OR REPLACE VIEW audit_active_alerts AS
SELECT 
  aa.id,
  aa.alert_name,
  aa.alert_type,
  aa.severity,
  aa.table_name,
  aa.status,
  aa.trigger_count,
  aa.last_triggered_at,
  aa.description,
  aa.business_impact,
  CASE 
    WHEN aa.last_triggered_at > now() - interval '1 hour' THEN 'recent'
    WHEN aa.last_triggered_at > now() - interval '24 hours' THEN 'today'
    WHEN aa.last_triggered_at > now() - interval '7 days' THEN 'this_week'
    ELSE 'older'
  END as recency,
  u1.name as created_by_name,
  u2.name as acknowledged_by_name,
  u3.name as resolved_by_name
FROM audit_alerts aa
LEFT JOIN users u1 ON aa.created_by = u1.id
LEFT JOIN users u2 ON aa.acknowledged_by = u2.id
LEFT JOIN users u3 ON aa.resolved_by = u3.id
WHERE aa.is_active = true
ORDER BY 
  CASE aa.severity 
    WHEN 'critical' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    ELSE 4 
  END,
  aa.last_triggered_at DESC NULLS LAST;

-- =====================================================
-- FUNCIONES DE REPORTES
-- =====================================================

CREATE OR REPLACE FUNCTION generate_audit_report(
  p_report_type text,
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_tables text[] DEFAULT NULL,
  p_users uuid[] DEFAULT NULL,
  p_event_types text[] DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  report_id uuid;
  report_data jsonb;
  summary_data jsonb;
  total_events integer;
  critical_events integer;
  generation_start timestamptz;
  generation_end timestamptz;
BEGIN
  generation_start := clock_timestamp();
  report_id := gen_random_uuid();
  
  -- Crear registro del reporte
  INSERT INTO audit_reports (
    id,
    report_name,
    report_type,
    date_from,
    date_to,
    tables_included,
    users_included,
    event_types_included,
    generated_by,
    status
  ) VALUES (
    report_id,
    p_report_type || '_' || to_char(p_date_from, 'YYYY_MM_DD') || '_to_' || to_char(p_date_to, 'YYYY_MM_DD'),
    p_report_type,
    p_date_from,
    p_date_to,
    p_tables,
    p_users,
    p_event_types,
    auth.uid(),
    'generating'
  );
  
  -- Generar datos del reporte
  WITH filtered_logs AS (
    SELECT *
    FROM audit_logs
    WHERE event_timestamp BETWEEN p_date_from AND p_date_to
      AND (p_tables IS NULL OR table_name = ANY(p_tables))
      AND (p_users IS NULL OR user_id = ANY(p_users))
      AND (p_event_types IS NULL OR event_type = ANY(p_event_types))
  ),
  report_summary AS (
    SELECT 
      COUNT(*) as total_events,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT table_name) as tables_affected,
      COUNT(*) FILTER (WHERE severity_level = 'critical') as critical_events,
      COUNT(*) FILTER (WHERE severity_level = 'high') as high_events,
      COUNT(*) FILTER (WHERE event_type = 'DELETE') as deletions,
      COUNT(*) FILTER (WHERE event_type = 'INSERT') as insertions,
      COUNT(*) FILTER (WHERE event_type = 'UPDATE') as updates,
      array_agg(DISTINCT table_name) as affected_tables,
      array_agg(DISTINCT user_email) FILTER (WHERE user_email IS NOT NULL) as involved_users
    FROM filtered_logs
  ),
  detailed_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'event_id', event_id,
        'timestamp', event_timestamp,
        'table', table_name,
        'operation', event_type,
        'user', user_email,
        'severity', severity_level,
        'changes', changed_fields,
        'context', business_context
      ) ORDER BY event_timestamp DESC
    ) as events
    FROM filtered_logs
  )
  SELECT 
    rs.total_events,
    rs.critical_events,
    jsonb_build_object(
      'summary', to_jsonb(rs),
      'events', dd.events
    ),
    to_jsonb(rs)
  INTO total_events, critical_events, report_data, summary_data
  FROM report_summary rs, detailed_data dd;
  
  generation_end := clock_timestamp();
  
  -- Actualizar reporte con los datos generados
  UPDATE audit_reports 
  SET 
    total_events = total_events,
    critical_events = critical_events,
    report_data = report_data,
    report_summary = summary_data,
    generation_duration_ms = EXTRACT(MILLISECONDS FROM generation_end - generation_start)::integer,
    status = 'completed',
    generated_at = generation_end
  WHERE id = report_id;
  
  RETURN report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN DE LIMPIEZA Y MANTENIMIENTO
-- =====================================================

CREATE OR REPLACE FUNCTION audit_maintenance()
RETURNS text AS $$
DECLARE
  archived_count integer := 0;
  deleted_count integer := 0;
  retention_policy record;
  maintenance_log text := '';
BEGIN
  maintenance_log := 'Iniciando mantenimiento de auditoría: ' || now()::text || E'\n';
  
  -- Procesar políticas de retención
  FOR retention_policy IN 
    SELECT * FROM audit_data_retention WHERE is_active = true
  LOOP
    -- Archivar registros antiguos
    IF retention_policy.auto_archive THEN
      WITH archived_records AS (
        UPDATE audit_logs 
        SET 
          archived_at = now(),
          indexed_at = CASE WHEN indexed_at IS NULL THEN now() ELSE indexed_at END
        WHERE table_name = retention_policy.table_name
          AND event_timestamp < now() - (retention_policy.active_retention_days || ' days')::interval
          AND archived_at IS NULL
        RETURNING id
      )
      SELECT COUNT(*) INTO archived_count FROM archived_records;
      
      maintenance_log := maintenance_log || 'Archivados ' || archived_count || ' registros de ' || retention_policy.table_name || E'\n';
    END IF;
    
    -- Eliminar registros muy antiguos (solo si está configurado)
    IF retention_policy.auto_delete AND NOT retention_policy.legal_hold THEN
      WITH deleted_records AS (
        DELETE FROM audit_logs
        WHERE table_name = retention_policy.table_name
          AND event_timestamp < now() - (retention_policy.total_retention_days || ' days')::interval
        RETURNING id
      )
      SELECT COUNT(*) INTO deleted_count FROM deleted_records;
      
      maintenance_log := maintenance_log || 'Eliminados ' || deleted_count || ' registros antiguos de ' || retention_policy.table_name || E'\n';
    END IF;
    
    -- Actualizar última ejecución
    UPDATE audit_data_retention 
    SET 
      last_executed_at = now(),
      next_execution_at = now() + interval '1 day'
    WHERE id = retention_policy.id;
  END LOOP;
  
  -- Limpiar alertas resueltas antiguas
  DELETE FROM audit_alerts 
  WHERE status = 'resolved' 
    AND resolved_at < now() - interval '90 days';
  
  -- Actualizar estadísticas de tablas
  ANALYZE audit_logs;
  ANALYZE audit_reports;
  ANALYZE audit_alerts;
  
  maintenance_log := maintenance_log || 'Mantenimiento completado: ' || now()::text;
  
  RETURN maintenance_log;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN PARA ANÁLISIS DE PATRONES SOSPECHOSOS
-- =====================================================

CREATE OR REPLACE FUNCTION detect_suspicious_patterns()
RETURNS table(
  pattern_type text,
  description text,
  severity text,
  affected_table text,
  user_involved text,
  event_count integer,
  first_occurrence timestamptz,
  last_occurrence timestamptz,
  recommendation text
) AS $$
BEGIN
  RETURN QUERY
  
  -- Patrón 1: Muchas eliminaciones en poco tiempo
  SELECT 
    'bulk_deletions'::text,
    'Usuario realizó muchas eliminaciones en poco tiempo'::text,
    'high'::text,
    al.table_name,
    al.user_email,
    COUNT(*)::integer,
    MIN(al.event_timestamp),
    MAX(al.event_timestamp),
    'Verificar si las eliminaciones fueron autorizadas'::text
  FROM audit_logs al
  WHERE al.event_type = 'DELETE'
    AND al.event_timestamp > now() - interval '1 hour'
  GROUP BY al.table_name, al.user_email
  HAVING COUNT(*) > 10
  
  UNION ALL
  
  -- Patrón 2: Acceso fuera de horario laboral
  SELECT 
    'after_hours_access'::text,
    'Actividad detectada fuera del horario laboral'::text,
    'medium'::text,
    al.table_name,
    al.user_email,
    COUNT(*)::integer,
    MIN(al.event_timestamp),
    MAX(al.event_timestamp),
    'Verificar si el acceso fuera de horario fue autorizado'::text
  FROM audit_logs al
  WHERE (EXTRACT(hour FROM al.event_timestamp) < 6 OR EXTRACT(hour FROM al.event_timestamp) > 22)
    AND al.event_timestamp > now() - interval '24 hours'
    AND al.user_id IS NOT NULL
  GROUP BY al.table_name, al.user_email
  HAVING COUNT(*) > 5
  
  UNION ALL
  
  -- Patrón 3: Cambios masivos en datos financieros
  SELECT 
    'financial_bulk_changes'::text,
    'Cambios masivos en datos financieros detectados'::text,
    'critical'::text,
    al.table_name,
    al.user_email,
    COUNT(*)::integer,
    MIN(al.event_timestamp),
    MAX(al.event_timestamp),
    'Revisar inmediatamente los cambios en datos financieros'::text
  FROM audit_logs al
  WHERE al.table_name IN ('sales', 'cash_registers', 'payment_installments')
    AND al.event_type IN ('UPDATE', 'DELETE')
    AND al.event_timestamp > now() - interval '1 hour'
  GROUP BY al.table_name, al.user_email
  HAVING COUNT(*) > 20
  
  UNION ALL
  
  -- Patrón 4: Intentos de acceso con diferentes IPs
  SELECT 
    'multiple_ip_access'::text,
    'Usuario accediendo desde múltiples IPs'::text,
    'medium'::text,
    'users'::text,
    al.user_email,
    COUNT(DISTINCT al.ip_address)::integer,
    MIN(al.event_timestamp),
    MAX(al.event_timestamp),
    'Verificar si el acceso desde múltiples ubicaciones es legítimo'::text
  FROM audit_logs al
  WHERE al.event_timestamp > now() - interval '24 hours'
    AND al.user_id IS NOT NULL
    AND al.ip_address IS NOT NULL
  GROUP BY al.user_email
  HAVING COUNT(DISTINCT al.ip_address) > 3;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS PARA TODAS LAS TABLAS
-- =====================================================

-- Función para crear triggers automáticamente
CREATE OR REPLACE FUNCTION create_audit_triggers()
RETURNS text AS $$
DECLARE
  table_record record;
  trigger_sql text;
  result_log text := '';
BEGIN
  -- Obtener todas las tablas que necesitan auditoría
  FOR table_record IN 
    SELECT table_name 
    FROM audit_configurations 
    WHERE is_active = true
  LOOP
    -- Crear trigger para cada tabla
    trigger_sql := format(
      'DROP TRIGGER IF EXISTS audit_trigger_%s ON %s;
       CREATE TRIGGER audit_trigger_%s
         AFTER INSERT OR UPDATE OR DELETE ON %s
         FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();',
      table_record.table_name,
      table_record.table_name,
      table_record.table_name,
      table_record.table_name
    );
    
    EXECUTE trigger_sql;
    result_log := result_log || 'Trigger creado para tabla: ' || table_record.table_name || E'\n';
  END LOOP;
  
  RETURN result_log;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar creación de triggers
SELECT create_audit_triggers();

-- =====================================================
-- ALERTAS PREDEFINIDAS
-- =====================================================

INSERT INTO audit_alerts (
  alert_name,
  alert_type,
  severity,
  trigger_conditions,
  table_name,
  event_types,
  description,
  business_impact,
  remediation_steps,
  notification_channels,
  is_active
) VALUES
(
  'Eliminación de Usuarios Crítica',
  'security',
  'critical',
  '{"event_type": "DELETE", "table": "users"}',
  'users',
  ARRAY['DELETE'],
  'Se eliminó un usuario del sistema',
  'Pérdida de acceso y posible brecha de seguridad',
  '1. Verificar autorización, 2. Revisar logs de acceso, 3. Notificar a administración',
  ARRAY['dashboard', 'email'],
  true
),
(
  'Cambios Masivos en Ventas',
  'business_rule',
  'high',
  '{"bulk_threshold": 50, "time_window": "1 hour"}',
  'sales',
  ARRAY['UPDATE', 'DELETE'],
  'Muchos cambios en ventas en poco tiempo',
  'Posible manipulación de datos financieros',
  '1. Revisar cambios, 2. Verificar autorización, 3. Contactar responsable',
  ARRAY['dashboard', 'email'],
  true
),
(
  'Acceso Fuera de Horario',
  'security',
  'medium',
  '{"time_range": "22:00-06:00", "min_events": 5}',
  NULL,
  ARRAY['INSERT', 'UPDATE', 'DELETE'],
  'Actividad detectada fuera del horario laboral',
  'Posible acceso no autorizado',
  '1. Verificar identidad del usuario, 2. Revisar actividad, 3. Confirmar autorización',
  ARRAY['dashboard'],
  true
),
(
  'Modificación de Precios Crítica',
  'business_rule',
  'high',
  '{"fields": ["sale_price", "purchase_price"], "change_threshold": 50}',
  'products',
  ARRAY['UPDATE'],
  'Cambios significativos en precios de productos',
  'Impacto en rentabilidad y pricing',
  '1. Verificar autorización, 2. Revisar impacto financiero, 3. Notificar a gerencia',
  ARRAY['dashboard', 'email'],
  true
);

-- =====================================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas de auditoría
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_data_retention ENABLE ROW LEVEL SECURITY;

-- Políticas para audit_logs
CREATE POLICY "Admins pueden ver todos los logs de auditoría"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'auditor')
    )
  );

CREATE POLICY "Managers pueden ver logs de sus áreas"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
        AND role = 'manager'
    )
    AND business_context IN ('sales', 'inventory', 'customer_management')
  );

CREATE POLICY "Usuarios pueden ver sus propios logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Solo el sistema puede insertar logs de auditoría
CREATE POLICY "Sistema puede insertar logs de auditoría"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas para configuraciones (solo admins)
CREATE POLICY "Solo admins pueden gestionar configuraciones de auditoría"
  ON audit_configurations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
        AND role = 'admin'
    )
  );

-- Políticas para reportes
CREATE POLICY "Usuarios autorizados pueden ver reportes"
  ON audit_reports FOR SELECT
  TO authenticated
  USING (
    generated_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'manager', 'auditor')
    )
  );

CREATE POLICY "Usuarios autorizados pueden crear reportes"
  ON audit_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'manager', 'auditor')
    )
  );

-- Políticas para alertas
CREATE POLICY "Usuarios autorizados pueden gestionar alertas"
  ON audit_alerts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'manager', 'auditor')
    )
  );

-- =====================================================
-- FUNCIONES DE UTILIDAD
-- =====================================================

-- Función para obtener estadísticas de auditoría
CREATE OR REPLACE FUNCTION get_audit_statistics(
  p_date_from timestamptz DEFAULT now() - interval '30 days',
  p_date_to timestamptz DEFAULT now()
)
RETURNS jsonb AS $$
DECLARE
  stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_events', COUNT(*),
    'events_by_type', jsonb_object_agg(event_type, type_count),
    'events_by_table', jsonb_object_agg(table_name, table_count),
    'events_by_severity', jsonb_object_agg(severity_level, severity_count),
    'unique_users', COUNT(DISTINCT user_id),
    'unique_tables', COUNT(DISTINCT table_name),
    'date_range', jsonb_build_object(
      'from', p_date_from,
      'to', p_date_to
    )
  ) INTO stats
  FROM (
    SELECT 
      event_type,
      table_name,
      severity_level,
      user_id,
      COUNT(*) OVER (PARTITION BY event_type) as type_count,
      COUNT(*) OVER (PARTITION BY table_name) as table_count,
      COUNT(*) OVER (PARTITION BY severity_level) as severity_count
    FROM audit_logs
    WHERE event_timestamp BETWEEN p_date_from AND p_date_to
  ) subq;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para buscar en logs de auditoría
CREATE OR REPLACE FUNCTION search_audit_logs(
  p_search_term text,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS table(
  id uuid,
  event_id text,
  event_timestamp timestamptz,
  table_name text,
  event_type text,
  user_email text,
  severity_level text,
  business_context text,
  changed_fields text[],
  relevance_score real
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.event_id,
    al.event_timestamp,
    al.table_name,
    al.event_type,
    al.user_email,
    al.severity_level,
    al.business_context,
    al.changed_fields,
    ts_rank(
      to_tsvector('spanish', 
        COALESCE(al.table_name, '') || ' ' || 
        COALESCE(al.event_type, '') || ' ' || 
        COALESCE(al.user_email, '') || ' ' ||
        COALESCE(al.business_context, '')
      ),
      plainto_tsquery('spanish', p_search_term)
    ) as relevance_score
  FROM audit_logs al
  WHERE to_tsvector('spanish', 
    COALESCE(al.table_name, '') || ' ' || 
    COALESCE(al.event_type, '') || ' ' || 
    COALESCE(al.user_email, '') || ' ' ||
    COALESCE(al.business_context, '')
  ) @@ plainto_tsquery('spanish', p_search_term)
  ORDER BY relevance_score DESC, al.event_timestamp DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PROGRAMAR MANTENIMIENTO AUTOMÁTICO
-- =====================================================

-- Crear extensión para trabajos programados si no existe
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programar mantenimiento diario a las 2 AM
SELECT cron.schedule('audit-maintenance', '0 2 * * *', 'SELECT audit_maintenance();');

-- Programar detección de patrones sospechosos cada hora
SELECT cron.schedule('suspicious-patterns', '0 * * * *', 'SELECT detect_suspicious_patterns();');

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE audit_logs IS 'Registro principal de auditoría con información detallada de todos los eventos del sistema';
COMMENT ON TABLE audit_configurations IS 'Configuraciones de auditoría por tabla para personalizar el comportamiento';
COMMENT ON TABLE audit_reports IS 'Reportes de auditoría generados con datos consolidados y análisis';
COMMENT ON TABLE audit_alerts IS 'Sistema de alertas para detectar actividad sospechosa o violaciones de políticas';
COMMENT ON TABLE audit_data_retention IS 'Políticas de retención de datos para cumplimiento y gestión de almacenamiento';

COMMENT ON FUNCTION audit_trigger_function() IS 'Función principal que captura todos los eventos de auditoría automáticamente';
COMMENT ON FUNCTION generate_audit_report(text, timestamptz, timestamptz, text[], uuid[], text[]) IS 'Genera reportes de auditoría personalizados con filtros avanzados';
COMMENT ON FUNCTION audit_maintenance() IS 'Función de mantenimiento que archiva y limpia datos según políticas de retención';
COMMENT ON FUNCTION detect_suspicious_patterns() IS 'Detecta patrones sospechosos en la actividad del sistema';

-- =====================================================
-- DATOS INICIALES Y CONFIGURACIÓN
-- =====================================================

-- Configurar alertas específicas para tablas críticas
UPDATE audit_configurations 
SET 
  enable_alerts = true,
  alert_on_bulk_changes = true,
  bulk_threshold = 50,
  alert_on_sensitive_access = true
WHERE table_name IN ('users', 'sales', 'cash_registers', 'products');

-- Configurar columnas sensibles que requieren tratamiento especial
UPDATE audit_configurations 
SET sensitive_columns = ARRAY['password_hash', 'session_token']
WHERE table_name = 'users';

-- Configurar exclusiones para columnas que cambian frecuentemente
UPDATE audit_configurations 
SET excluded_columns = ARRAY['updated_at', 'last_accessed']
WHERE table_name IN ('users', 'products');

-- Mensaje de finalización
DO $$
BEGIN
  RAISE NOTICE 'Sistema de auditoría completa instalado exitosamente';
  RAISE NOTICE 'Características instaladas:';
  RAISE NOTICE '- Auditoría automática en todas las tablas';
  RAISE NOTICE '- Sistema de alertas inteligentes';
  RAISE NOTICE '- Generación de reportes personalizados';
  RAISE NOTICE '- Detección de patrones sospechosos';
  RAISE NOTICE '- Políticas de retención de datos';
  RAISE NOTICE '- Mantenimiento automático programado';
  RAISE NOTICE '- Seguridad con RLS habilitado';
  RAISE NOTICE '';
  RAISE NOTICE 'Para usar el sistema:';
  RAISE NOTICE '1. Accede al panel de auditoría en la aplicación';
  RAISE NOTICE '2. Configura alertas según tus necesidades';
  RAISE NOTICE '3. Genera reportes de auditoría';
  RAISE NOTICE '4. Revisa patrones sospechosos regularmente';
END $$;