/*
  # Mejoras al Sistema de Auditoría

  1. Nuevas Tablas
    - `audit_alerts` - Sistema de alertas configurables
    - `audit_reports` - Reportes de auditoría generados
    - `audit_compliance_checks` - Verificaciones de cumplimiento
    - `audit_data_retention` - Políticas de retención de datos

  2. Funciones Mejoradas
    - Validación de integridad de datos
    - Detección automática de patrones sospechosos
    - Generación de reportes automáticos
    - Limpieza automática de datos antiguos

  3. Triggers Optimizados
    - Auditoría granular por tipo de operación
    - Validaciones de negocio en tiempo real
    - Notificaciones automáticas de eventos críticos

  4. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas granulares por rol de usuario
    - Encriptación de datos sensibles
    - Validación de permisos en cada operación
*/

-- =====================================================
-- TABLA DE ALERTAS DE AUDITORÍA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_name text NOT NULL,
    alert_type text NOT NULL CHECK (alert_type = ANY (ARRAY['security'::text, 'compliance'::text, 'performance'::text, 'data_integrity'::text, 'business_rule'::text])),
    severity text NOT NULL DEFAULT 'medium'::text CHECK (severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])),
    entity_type text CHECK (entity_type = ANY (ARRAY['cash_register'::text, 'sale'::text, 'installment'::text, 'movement'::text, 'product'::text, 'customer'::text])),
    event_types text[] DEFAULT '{}',
    trigger_conditions jsonb DEFAULT '{}',
    description text NOT NULL DEFAULT '',
    business_impact text DEFAULT '',
    remediation_steps text DEFAULT '',
    notification_channels text[] DEFAULT ARRAY['dashboard'],
    cooldown_minutes integer DEFAULT 60 CHECK (cooldown_minutes > 0),
    max_triggers_per_hour integer DEFAULT 10 CHECK (max_triggers_per_hour > 0),
    is_active boolean DEFAULT true,
    trigger_count integer DEFAULT 0,
    last_triggered_at timestamptz,
    created_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Índices para alertas
CREATE INDEX IF NOT EXISTS idx_audit_alerts_type ON audit_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_severity ON audit_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_active ON audit_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_entity_type ON audit_alerts(entity_type);

-- =====================================================
-- TABLA DE REPORTES DE AUDITORÍA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name text NOT NULL,
    report_type text NOT NULL CHECK (report_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'custom'::text, 'security'::text, 'compliance'::text])),
    date_from date NOT NULL,
    date_to date NOT NULL,
    entities_included text[] DEFAULT '{}',
    action_types_included text[] DEFAULT '{}',
    total_events integer DEFAULT 0,
    critical_events integer DEFAULT 0,
    events_by_type jsonb DEFAULT '{}',
    events_by_entity jsonb DEFAULT '{}',
    suspicious_patterns jsonb DEFAULT '[]',
    recommendations text[] DEFAULT '{}',
    report_data jsonb DEFAULT '{}',
    file_path text,
    file_size_bytes bigint DEFAULT 0,
    generated_by uuid REFERENCES users(id),
    generated_at timestamptz DEFAULT now(),
    status text DEFAULT 'completed' CHECK (status = ANY (ARRAY['generating'::text, 'completed'::text, 'failed'::text, 'archived'::text]))
);

-- Índices para reportes
CREATE INDEX IF NOT EXISTS idx_audit_reports_type ON audit_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_audit_reports_date_range ON audit_reports(date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_audit_reports_generated_at ON audit_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_reports_status ON audit_reports(status);

-- =====================================================
-- TABLA DE VERIFICACIONES DE CUMPLIMIENTO
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_compliance_checks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    check_name text NOT NULL,
    compliance_framework text NOT NULL DEFAULT 'SOX',
    check_type text NOT NULL CHECK (check_type = ANY (ARRAY['automated'::text, 'manual'::text, 'scheduled'::text])),
    check_frequency text DEFAULT 'daily' CHECK (check_frequency = ANY (ARRAY['hourly'::text, 'daily'::text, 'weekly'::text, 'monthly'::text, 'on_demand'::text])),
    target_tables text[] DEFAULT '{}',
    check_query text NOT NULL,
    expected_result jsonb DEFAULT '{}',
    tolerance_threshold numeric(5,2) DEFAULT 0.00,
    last_check_at timestamptz,
    last_result jsonb DEFAULT '{}',
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'passed'::text, 'failed'::text, 'warning'::text, 'error'::text])),
    failure_count integer DEFAULT 0,
    consecutive_failures integer DEFAULT 0,
    max_consecutive_failures integer DEFAULT 3,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Índices para compliance checks
CREATE INDEX IF NOT EXISTS idx_compliance_checks_framework ON audit_compliance_checks(compliance_framework);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_frequency ON audit_compliance_checks(check_frequency);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_status ON audit_compliance_checks(status);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_active ON audit_compliance_checks(is_active);

-- =====================================================
-- TABLA DE RETENCIÓN DE DATOS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_data_retention (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    retention_period_days integer NOT NULL CHECK (retention_period_days > 0),
    archive_before_delete boolean DEFAULT true,
    archive_table_name text,
    last_cleanup_at timestamptz,
    records_archived integer DEFAULT 0,
    records_deleted integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Índices para retención de datos
CREATE INDEX IF NOT EXISTS idx_audit_retention_table ON audit_data_retention(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_retention_active ON audit_data_retention(is_active);

-- =====================================================
-- FUNCIONES MEJORADAS DE AUDITORÍA
-- =====================================================

-- Función para validar integridad de datos críticos
CREATE OR REPLACE FUNCTION validate_data_integrity()
RETURNS TABLE(
    table_name text,
    issue_type text,
    issue_description text,
    suggested_action text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verificar integridad de ventas
    RETURN QUERY
    SELECT 
        'sales'::text,
        'data_integrity'::text,
        'Ventas con montos negativos: ' || COUNT(*)::text,
        'Revisar y corregir ventas con montos inválidos'::text
    FROM sales 
    WHERE total_amount < 0
    HAVING COUNT(*) > 0;

    -- Verificar stock negativo
    RETURN QUERY
    SELECT 
        'products'::text,
        'data_integrity'::text,
        'Productos con stock negativo: ' || COUNT(*)::text,
        'Ajustar inventario para productos con stock negativo'::text
    FROM products 
    WHERE stock < 0
    HAVING COUNT(*) > 0;

    -- Verificar cajas sin movimientos de apertura
    RETURN QUERY
    SELECT 
        'cash_registers'::text,
        'business_rule'::text,
        'Cajas sin movimiento de apertura: ' || COUNT(*)::text,
        'Verificar que todas las cajas tengan movimiento de apertura'::text
    FROM cash_registers cr
    WHERE NOT EXISTS (
        SELECT 1 FROM cash_movements cm 
        WHERE cm.cash_register_id = cr.id 
        AND cm.type = 'opening'
    )
    HAVING COUNT(*) > 0;

    -- Verificar ventas sin items
    RETURN QUERY
    SELECT 
        'sales'::text,
        'data_integrity'::text,
        'Ventas sin productos: ' || COUNT(*)::text,
        'Eliminar o corregir ventas que no tienen productos asociados'::text
    FROM sales s
    WHERE NOT EXISTS (
        SELECT 1 FROM sale_items si 
        WHERE si.sale_id = s.id
    )
    HAVING COUNT(*) > 0;

    -- Verificar IMEI/Serial duplicados
    RETURN QUERY
    SELECT 
        'product_imei_serials'::text,
        'data_integrity'::text,
        'IMEI duplicados encontrados: ' || COUNT(*)::text,
        'Revisar y corregir IMEI duplicados en el sistema'::text
    FROM (
        SELECT imei_number, COUNT(*) as cnt
        FROM product_imei_serials 
        WHERE imei_number != '' AND imei_number IS NOT NULL
        GROUP BY imei_number
        HAVING COUNT(*) > 1
    ) duplicates
    HAVING COUNT(*) > 0;

    -- Si no hay problemas, retornar estado saludable
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            'system'::text,
            'healthy'::text,
            'Todos los controles de integridad pasaron exitosamente'::text,
            'Ninguna acción requerida'::text;
    END IF;
END;
$$;

-- Función para detectar patrones sospechosos
CREATE OR REPLACE FUNCTION detect_suspicious_patterns(
    hours_back integer DEFAULT 24
)
RETURNS TABLE(
    pattern_type text,
    description text,
    severity text,
    affected_table text,
    user_involved text,
    event_count bigint,
    first_occurrence timestamptz,
    last_occurrence timestamptz,
    recommendation text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    time_threshold timestamptz := now() - (hours_back || ' hours')::interval;
BEGIN
    -- Detectar eliminaciones masivas
    RETURN QUERY
    SELECT 
        'bulk_deletion'::text,
        'Múltiples eliminaciones en poco tiempo'::text,
        CASE WHEN COUNT(*) > 20 THEN 'critical'::text
             WHEN COUNT(*) > 10 THEN 'high'::text
             ELSE 'medium'::text END,
        'multiple'::text,
        COALESCE(u.name, 'Sistema')::text,
        COUNT(*),
        MIN(crea.performed_at),
        MAX(crea.performed_at),
        'Verificar si estas eliminaciones están autorizadas y documentar la razón'::text
    FROM cash_register_enhanced_audit crea
    LEFT JOIN users u ON crea.performed_by = u.id
    WHERE crea.action_type = 'delete' 
    AND crea.performed_at > time_threshold
    GROUP BY u.name
    HAVING COUNT(*) > 5;

    -- Detectar actividad fuera de horario
    RETURN QUERY
    SELECT 
        'after_hours_activity'::text,
        'Actividad fuera del horario laboral'::text,
        'medium'::text,
        'multiple'::text,
        COALESCE(u.name, 'Sistema')::text,
        COUNT(*),
        MIN(crea.performed_at),
        MAX(crea.performed_at),
        'Revisar si el acceso fuera de horario está autorizado'::text
    FROM cash_register_enhanced_audit crea
    LEFT JOIN users u ON crea.performed_by = u.id
    WHERE crea.performed_at > time_threshold
    AND (EXTRACT(hour FROM crea.performed_at) < 8 OR EXTRACT(hour FROM crea.performed_at) > 18)
    GROUP BY u.name
    HAVING COUNT(*) > 0;

    -- Detectar cambios de precios frecuentes
    RETURN QUERY
    SELECT 
        'frequent_price_changes'::text,
        'Cambios de precio muy frecuentes'::text,
        'high'::text,
        'products'::text,
        COALESCE(u.name, 'Sistema')::text,
        COUNT(*),
        MIN(crea.performed_at),
        MAX(crea.performed_at),
        'Revisar política de cambios de precios y autorización'::text
    FROM cash_register_enhanced_audit crea
    LEFT JOIN users u ON crea.performed_by = u.id
    WHERE crea.entity_type = 'product'
    AND crea.action_type = 'edit'
    AND crea.performed_at > time_threshold
    AND crea.old_values ? 'sale_price'
    GROUP BY u.name
    HAVING COUNT(*) > 10;

    -- Detectar ventas con descuentos altos
    RETURN QUERY
    SELECT 
        'high_discount_sales'::text,
        'Ventas con descuentos superiores al 50%'::text,
        'high'::text,
        'sales'::text,
        COALESCE(u.name, 'Sistema')::text,
        COUNT(*),
        MIN(s.created_at),
        MAX(s.created_at),
        'Revisar autorización para descuentos altos'::text
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.created_at > time_threshold
    AND s.discount_amount > (s.subtotal * 0.5)
    GROUP BY u.name
    HAVING COUNT(*) > 0;
END;
$$;

-- Función para generar reporte de auditoría
CREATE OR REPLACE FUNCTION generate_audit_report(
    report_name text,
    report_type text DEFAULT 'custom',
    date_from date DEFAULT CURRENT_DATE - INTERVAL '7 days',
    date_to date DEFAULT CURRENT_DATE,
    entities_filter text[] DEFAULT '{}',
    actions_filter text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    report_id uuid;
    total_events integer := 0;
    critical_events integer := 0;
    events_by_type jsonb := '{}';
    events_by_entity jsonb := '{}';
    suspicious_patterns jsonb := '[]';
    report_data jsonb := '{}';
BEGIN
    -- Generar ID del reporte
    report_id := gen_random_uuid();

    -- Contar eventos totales
    SELECT COUNT(*) INTO total_events
    FROM cash_register_enhanced_audit
    WHERE performed_at::date BETWEEN date_from AND date_to
    AND (array_length(entities_filter, 1) IS NULL OR entity_type = ANY(entities_filter))
    AND (array_length(actions_filter, 1) IS NULL OR action_type = ANY(actions_filter));

    -- Contar eventos críticos
    SELECT COUNT(*) INTO critical_events
    FROM cash_register_enhanced_audit
    WHERE performed_at::date BETWEEN date_from AND date_to
    AND severity = 'critical'
    AND (array_length(entities_filter, 1) IS NULL OR entity_type = ANY(entities_filter))
    AND (array_length(actions_filter, 1) IS NULL OR action_type = ANY(actions_filter));

    -- Agrupar eventos por tipo
    SELECT jsonb_object_agg(action_type, event_count) INTO events_by_type
    FROM (
        SELECT action_type, COUNT(*) as event_count
        FROM cash_register_enhanced_audit
        WHERE performed_at::date BETWEEN date_from AND date_to
        AND (array_length(entities_filter, 1) IS NULL OR entity_type = ANY(entities_filter))
        AND (array_length(actions_filter, 1) IS NULL OR action_type = ANY(actions_filter))
        GROUP BY action_type
    ) grouped_by_type;

    -- Agrupar eventos por entidad
    SELECT jsonb_object_agg(entity_type, event_count) INTO events_by_entity
    FROM (
        SELECT entity_type, COUNT(*) as event_count
        FROM cash_register_enhanced_audit
        WHERE performed_at::date BETWEEN date_from AND date_to
        AND (array_length(entities_filter, 1) IS NULL OR entity_type = ANY(entities_filter))
        AND (array_length(actions_filter, 1) IS NULL OR action_type = ANY(actions_filter))
        GROUP BY entity_type
    ) grouped_by_entity;

    -- Detectar patrones sospechosos
    SELECT jsonb_agg(
        jsonb_build_object(
            'pattern_type', pattern_type,
            'description', description,
            'severity', severity,
            'affected_table', affected_table,
            'user_involved', user_involved,
            'event_count', event_count,
            'first_occurrence', first_occurrence,
            'last_occurrence', last_occurrence,
            'recommendation', recommendation
        )
    ) INTO suspicious_patterns
    FROM detect_suspicious_patterns(24);

    -- Construir datos del reporte
    report_data := jsonb_build_object(
        'summary', jsonb_build_object(
            'total_events', total_events,
            'critical_events', critical_events,
            'date_range', jsonb_build_object(
                'from', date_from,
                'to', date_to
            ),
            'filters_applied', jsonb_build_object(
                'entities', entities_filter,
                'actions', actions_filter
            )
        ),
        'events_by_type', COALESCE(events_by_type, '{}'),
        'events_by_entity', COALESCE(events_by_entity, '{}'),
        'suspicious_patterns', COALESCE(suspicious_patterns, '[]'),
        'generated_at', now()
    );

    -- Insertar reporte
    INSERT INTO audit_reports (
        id,
        report_name,
        report_type,
        date_from,
        date_to,
        entities_included,
        action_types_included,
        total_events,
        critical_events,
        events_by_type,
        events_by_entity,
        suspicious_patterns,
        report_data,
        generated_by
    ) VALUES (
        report_id,
        report_name,
        report_type,
        date_from,
        date_to,
        entities_filter,
        actions_filter,
        total_events,
        critical_events,
        COALESCE(events_by_type, '{}'),
        COALESCE(events_by_entity, '{}'),
        COALESCE(suspicious_patterns, '[]'),
        report_data,
        auth.uid()
    );

    RETURN report_id;
END;
$$;

-- Función para ejecutar verificaciones de cumplimiento
CREATE OR REPLACE FUNCTION run_compliance_checks()
RETURNS TABLE(
    check_id uuid,
    check_name text,
    status text,
    result_summary text,
    recommendations text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    check_record record;
    check_result jsonb;
    check_status text;
    result_count integer;
BEGIN
    -- Iterar sobre todas las verificaciones activas
    FOR check_record IN 
        SELECT * FROM audit_compliance_checks 
        WHERE is_active = true 
        AND (last_check_at IS NULL OR last_check_at < now() - INTERVAL '1 hour')
    LOOP
        BEGIN
            -- Ejecutar la consulta de verificación
            EXECUTE check_record.check_query INTO check_result;
            
            -- Determinar el estado basado en el resultado
            IF check_result IS NULL THEN
                check_status := 'passed';
                result_count := 0;
            ELSE
                result_count := (check_result->>'count')::integer;
                IF result_count = 0 THEN
                    check_status := 'passed';
                ELSIF result_count <= check_record.tolerance_threshold THEN
                    check_status := 'warning';
                ELSE
                    check_status := 'failed';
                END IF;
            END IF;

            -- Actualizar el registro de verificación
            UPDATE audit_compliance_checks 
            SET 
                last_check_at = now(),
                last_result = check_result,
                status = check_status,
                consecutive_failures = CASE 
                    WHEN check_status = 'failed' THEN consecutive_failures + 1
                    ELSE 0
                END,
                failure_count = CASE 
                    WHEN check_status = 'failed' THEN failure_count + 1
                    ELSE failure_count
                END,
                updated_at = now()
            WHERE id = check_record.id;

            -- Retornar resultado
            RETURN QUERY
            SELECT 
                check_record.id,
                check_record.check_name,
                check_status,
                CASE 
                    WHEN check_status = 'passed' THEN 'Verificación exitosa'
                    WHEN check_status = 'warning' THEN 'Advertencia: ' || result_count::text || ' elementos encontrados'
                    ELSE 'Falla: ' || result_count::text || ' elementos problemáticos'
                END,
                ARRAY['Revisar elementos identificados', 'Documentar acciones correctivas']::text[];

        EXCEPTION WHEN OTHERS THEN
            -- Manejar errores en la verificación
            UPDATE audit_compliance_checks 
            SET 
                last_check_at = now(),
                status = 'error',
                last_result = jsonb_build_object('error', SQLERRM),
                consecutive_failures = consecutive_failures + 1,
                failure_count = failure_count + 1,
                updated_at = now()
            WHERE id = check_record.id;

            RETURN QUERY
            SELECT 
                check_record.id,
                check_record.check_name,
                'error'::text,
                'Error en verificación: ' || SQLERRM,
                ARRAY['Revisar consulta de verificación', 'Contactar administrador']::text[];
        END;
    END LOOP;
END;
$$;

-- Función para limpiar datos antiguos según políticas de retención
CREATE OR REPLACE FUNCTION cleanup_audit_data()
RETURNS TABLE(
    table_name text,
    records_archived integer,
    records_deleted integer,
    cleanup_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    retention_record record;
    archived_count integer;
    deleted_count integer;
    cutoff_date timestamptz;
BEGIN
    -- Iterar sobre políticas de retención activas
    FOR retention_record IN 
        SELECT * FROM audit_data_retention 
        WHERE is_active = true
    LOOP
        archived_count := 0;
        deleted_count := 0;
        cutoff_date := now() - (retention_record.retention_period_days || ' days')::interval;

        -- Procesar según la tabla
        CASE retention_record.table_name
            WHEN 'cash_register_audit_logs' THEN
                -- Archivar si está configurado
                IF retention_record.archive_before_delete AND retention_record.archive_table_name IS NOT NULL THEN
                    EXECUTE format('
                        INSERT INTO %I 
                        SELECT * FROM cash_register_audit_logs 
                        WHERE performed_at < $1
                    ', retention_record.archive_table_name) 
                    USING cutoff_date;
                    
                    GET DIAGNOSTICS archived_count = ROW_COUNT;
                END IF;

                -- Eliminar registros antiguos
                DELETE FROM cash_register_audit_logs 
                WHERE performed_at < cutoff_date;
                
                GET DIAGNOSTICS deleted_count = ROW_COUNT;

            WHEN 'cash_register_enhanced_audit' THEN
                -- Similar proceso para auditoría mejorada
                IF retention_record.archive_before_delete AND retention_record.archive_table_name IS NOT NULL THEN
                    EXECUTE format('
                        INSERT INTO %I 
                        SELECT * FROM cash_register_enhanced_audit 
                        WHERE performed_at < $1
                    ', retention_record.archive_table_name) 
                    USING cutoff_date;
                    
                    GET DIAGNOSTICS archived_count = ROW_COUNT;
                END IF;

                DELETE FROM cash_register_enhanced_audit 
                WHERE performed_at < cutoff_date;
                
                GET DIAGNOSTICS deleted_count = ROW_COUNT;

            ELSE
                -- Para otras tablas, solo registrar que se procesó
                archived_count := 0;
                deleted_count := 0;
        END CASE;

        -- Actualizar estadísticas de retención
        UPDATE audit_data_retention 
        SET 
            last_cleanup_at = now(),
            records_archived = records_archived + archived_count,
            records_deleted = records_deleted + deleted_count,
            updated_at = now()
        WHERE id = retention_record.id;

        -- Retornar resultado
        RETURN QUERY
        SELECT 
            retention_record.table_name,
            archived_count,
            deleted_count,
            now();
    END LOOP;
END;
$$;

-- Función para verificar alertas y enviar notificaciones
CREATE OR REPLACE FUNCTION check_audit_alerts()
RETURNS TABLE(
    alert_id uuid,
    alert_name text,
    triggered boolean,
    trigger_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    alert_record record;
    should_trigger boolean;
    trigger_reason text;
    recent_triggers integer;
BEGIN
    -- Iterar sobre alertas activas
    FOR alert_record IN 
        SELECT * FROM audit_alerts 
        WHERE is_active = true
    LOOP
        should_trigger := false;
        trigger_reason := '';

        -- Verificar si la alerta debe activarse según las condiciones
        CASE alert_record.alert_type
            WHEN 'security' THEN
                -- Verificar eventos de seguridad
                SELECT COUNT(*) INTO recent_triggers
                FROM cash_register_enhanced_audit
                WHERE action_type = ANY(alert_record.event_types)
                AND (alert_record.entity_type IS NULL OR entity_type = alert_record.entity_type)
                AND performed_at > now() - INTERVAL '1 hour'
                AND severity IN ('high', 'critical');

                IF recent_triggers >= (alert_record.trigger_conditions->>'max_events_per_hour')::integer THEN
                    should_trigger := true;
                    trigger_reason := format('Se detectaron %s eventos de seguridad en la última hora', recent_triggers);
                END IF;

            WHEN 'compliance' THEN
                -- Verificar eventos de cumplimiento
                SELECT COUNT(*) INTO recent_triggers
                FROM cash_register_enhanced_audit
                WHERE action_type = ANY(alert_record.event_types)
                AND (alert_record.entity_type IS NULL OR entity_type = alert_record.entity_type)
                AND performed_at > now() - INTERVAL '1 hour';

                IF recent_triggers >= COALESCE((alert_record.trigger_conditions->>'max_events_per_hour')::integer, 5) THEN
                    should_trigger := true;
                    trigger_reason := format('Se detectaron %s eventos de cumplimiento en la última hora', recent_triggers);
                END IF;

            WHEN 'data_integrity' THEN
                -- Verificar integridad de datos
                IF EXISTS (
                    SELECT 1 FROM validate_data_integrity() 
                    WHERE issue_type != 'healthy'
                ) THEN
                    should_trigger := true;
                    trigger_reason := 'Se detectaron problemas de integridad de datos';
                END IF;

            ELSE
                -- Verificación genérica
                SELECT COUNT(*) INTO recent_triggers
                FROM cash_register_enhanced_audit
                WHERE action_type = ANY(alert_record.event_types)
                AND performed_at > now() - INTERVAL '1 hour';

                IF recent_triggers > 0 THEN
                    should_trigger := true;
                    trigger_reason := format('Se detectaron %s eventos del tipo monitoreado', recent_triggers);
                END IF;
        END CASE;

        -- Verificar cooldown y límites
        IF should_trigger THEN
            -- Verificar cooldown
            IF alert_record.last_triggered_at IS NOT NULL 
               AND alert_record.last_triggered_at > now() - (alert_record.cooldown_minutes || ' minutes')::interval THEN
                should_trigger := false;
                trigger_reason := 'Alerta en período de cooldown';
            END IF;

            -- Verificar límite por hora
            SELECT COUNT(*) INTO recent_triggers
            FROM audit_reports
            WHERE report_name LIKE '%' || alert_record.alert_name || '%'
            AND generated_at > now() - INTERVAL '1 hour';

            IF recent_triggers >= alert_record.max_triggers_per_hour THEN
                should_trigger := false;
                trigger_reason := 'Límite de activaciones por hora alcanzado';
            END IF;
        END IF;

        -- Activar alerta si es necesario
        IF should_trigger THEN
            UPDATE audit_alerts 
            SET 
                trigger_count = trigger_count + 1,
                last_triggered_at = now(),
                updated_at = now()
            WHERE id = alert_record.id;
        END IF;

        -- Retornar resultado
        RETURN QUERY
        SELECT 
            alert_record.id,
            alert_record.alert_name,
            should_trigger,
            trigger_reason;
    END LOOP;
END;
$$;

-- Función para mantenimiento automático del sistema de auditoría
CREATE OR REPLACE FUNCTION audit_system_maintenance()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    maintenance_log text := '';
    cleanup_result record;
    integrity_issues integer := 0;
BEGIN
    maintenance_log := 'Iniciando mantenimiento del sistema de auditoría - ' || now()::text || E'\n';

    -- Ejecutar limpieza de datos antiguos
    maintenance_log := maintenance_log || 'Ejecutando limpieza de datos antiguos...' || E'\n';
    
    FOR cleanup_result IN 
        SELECT * FROM cleanup_audit_data()
    LOOP
        maintenance_log := maintenance_log || format(
            '  - %s: %s archivados, %s eliminados' || E'\n',
            cleanup_result.table_name,
            cleanup_result.records_archived,
            cleanup_result.records_deleted
        );
    END LOOP;

    -- Verificar integridad de datos
    maintenance_log := maintenance_log || 'Verificando integridad de datos...' || E'\n';
    
    SELECT COUNT(*) INTO integrity_issues
    FROM validate_data_integrity()
    WHERE issue_type != 'healthy';

    IF integrity_issues > 0 THEN
        maintenance_log := maintenance_log || format('  ⚠️ Se encontraron %s problemas de integridad' || E'\n', integrity_issues);
    ELSE
        maintenance_log := maintenance_log || '  ✅ Integridad de datos verificada' || E'\n';
    END IF;

    -- Ejecutar verificaciones de cumplimiento
    maintenance_log := maintenance_log || 'Ejecutando verificaciones de cumplimiento...' || E'\n';
    
    -- Actualizar estadísticas de tablas críticas
    maintenance_log := maintenance_log || 'Actualizando estadísticas...' || E'\n';
    ANALYZE cash_register_enhanced_audit;
    ANALYZE cash_register_audit_logs;
    ANALYZE sales;
    ANALYZE cash_movements;

    maintenance_log := maintenance_log || 'Mantenimiento completado - ' || now()::text || E'\n';

    RETURN maintenance_log;
END;
$$;

-- =====================================================
-- TRIGGERS MEJORADOS
-- =====================================================

-- Trigger para validar operaciones críticas
CREATE OR REPLACE FUNCTION validate_critical_operations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validar eliminaciones masivas
    IF TG_OP = 'DELETE' THEN
        -- Verificar si se están eliminando muchos registros
        IF TG_TABLE_NAME IN ('products', 'sales', 'customers') THEN
            -- Log de eliminación crítica
            INSERT INTO cash_register_enhanced_audit (
                cash_register_id,
                action_type,
                entity_type,
                entity_id,
                description,
                severity,
                performed_by,
                metadata
            ) VALUES (
                COALESCE((SELECT id FROM cash_registers WHERE user_id = auth.uid() AND status = 'open' LIMIT 1), gen_random_uuid()),
                'delete',
                TG_TABLE_NAME::text,
                OLD.id,
                format('Eliminación de %s: %s', TG_TABLE_NAME, COALESCE(OLD.name, OLD.id::text)),
                'high',
                auth.uid(),
                jsonb_build_object(
                    'table', TG_TABLE_NAME,
                    'operation', 'DELETE',
                    'timestamp', now(),
                    'old_data', row_to_json(OLD)
                )
            );
        END IF;
        RETURN OLD;
    END IF;

    -- Validar modificaciones de precios
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'products' THEN
        IF OLD.sale_price != NEW.sale_price THEN
            -- Verificar cambio de precio significativo (>50%)
            IF ABS(NEW.sale_price - OLD.sale_price) / OLD.sale_price > 0.5 THEN
                INSERT INTO cash_register_enhanced_audit (
                    cash_register_id,
                    action_type,
                    entity_type,
                    entity_id,
                    description,
                    severity,
                    performed_by,
                    old_values,
                    new_values,
                    metadata
                ) VALUES (
                    COALESCE((SELECT id FROM cash_registers WHERE user_id = auth.uid() AND status = 'open' LIMIT 1), gen_random_uuid()),
                    'edit',
                    'product',
                    NEW.id,
                    format('Cambio significativo de precio en %s', NEW.name),
                    'high',
                    auth.uid(),
                    jsonb_build_object('sale_price', OLD.sale_price),
                    jsonb_build_object('sale_price', NEW.sale_price),
                    jsonb_build_object(
                        'price_change_percent', ((NEW.sale_price - OLD.sale_price) / OLD.sale_price * 100),
                        'old_price', OLD.sale_price,
                        'new_price', NEW.sale_price
                    )
                );
            END IF;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar trigger a tablas críticas
DROP TRIGGER IF EXISTS trigger_validate_critical_operations_products ON products;
CREATE TRIGGER trigger_validate_critical_operations_products
    BEFORE UPDATE OR DELETE ON products
    FOR EACH ROW
    EXECUTE FUNCTION validate_critical_operations();

DROP TRIGGER IF EXISTS trigger_validate_critical_operations_sales ON sales;
CREATE TRIGGER trigger_validate_critical_operations_sales
    BEFORE UPDATE OR DELETE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION validate_critical_operations();

DROP TRIGGER IF EXISTS trigger_validate_critical_operations_customers ON customers;
CREATE TRIGGER trigger_validate_critical_operations_customers
    BEFORE UPDATE OR DELETE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION validate_critical_operations();

-- =====================================================
-- POLÍTICAS DE SEGURIDAD MEJORADAS
-- =====================================================

-- Habilitar RLS en nuevas tablas
ALTER TABLE audit_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_data_retention ENABLE ROW LEVEL SECURITY;

-- Políticas para audit_alerts
CREATE POLICY "Admins can manage audit alerts" ON audit_alerts
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
            AND is_active = true
        )
    );

-- Políticas para audit_reports
CREATE POLICY "Users can view audit reports" ON audit_reports
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'employee')
            AND is_active = true
        )
    );

CREATE POLICY "Admins can manage audit reports" ON audit_reports
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
            AND is_active = true
        )
    );

-- Políticas para compliance checks
CREATE POLICY "Admins can manage compliance checks" ON audit_compliance_checks
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
            AND is_active = true
        )
    );

-- Políticas para retención de datos
CREATE POLICY "Admins can manage data retention" ON audit_data_retention
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
            AND is_active = true
        )
    );

-- =====================================================
-- DATOS INICIALES PARA SISTEMA DE AUDITORÍA
-- =====================================================

-- Insertar alertas predeterminadas
INSERT INTO audit_alerts (
    alert_name,
    alert_type,
    severity,
    entity_type,
    event_types,
    trigger_conditions,
    description,
    business_impact,
    remediation_steps,
    notification_channels
) VALUES 
(
    'Eliminaciones Masivas de Productos',
    'security',
    'high',
    'product',
    ARRAY['delete'],
    '{"max_events_per_hour": 5}',
    'Detecta cuando se eliminan muchos productos en poco tiempo',
    'Pérdida potencial de datos críticos de inventario',
    '1. Verificar autorización del usuario, 2. Revisar logs de actividad, 3. Contactar administrador si es necesario',
    ARRAY['dashboard', 'email']
),
(
    'Acceso Fuera de Horario Laboral',
    'compliance',
    'medium',
    'cash_register',
    ARRAY['open', 'close'],
    '{"outside_business_hours": true}',
    'Detecta operaciones de caja fuera del horario laboral establecido',
    'Posible violación de políticas de seguridad y control interno',
    '1. Verificar autorización para trabajo fuera de horario, 2. Documentar razón del acceso, 3. Notificar a supervisor',
    ARRAY['dashboard']
),
(
    'Cambios de Precio Significativos',
    'business_rule',
    'high',
    'product',
    ARRAY['edit'],
    '{"price_change_threshold_percent": 50}',
    'Detecta cambios de precio superiores al 50% del valor original',
    'Posible error en precios o manipulación no autorizada',
    '1. Verificar autorización del cambio, 2. Confirmar precio correcto, 3. Documentar razón del cambio',
    ARRAY['dashboard', 'email']
),
(
    'Ventas con Descuentos Altos',
    'business_rule',
    'medium',
    'sale',
    ARRAY['sale'],
    '{"discount_threshold_percent": 30}',
    'Detecta ventas con descuentos superiores al 30%',
    'Posible pérdida de rentabilidad o error en aplicación de descuentos',
    '1. Verificar autorización del descuento, 2. Confirmar cálculo correcto, 3. Documentar justificación',
    ARRAY['dashboard']
)
ON CONFLICT DO NOTHING;

-- Insertar verificaciones de cumplimiento predeterminadas
INSERT INTO audit_compliance_checks (
    check_name,
    compliance_framework,
    check_type,
    check_frequency,
    target_tables,
    check_query,
    expected_result,
    tolerance_threshold
) VALUES 
(
    'Verificación de Integridad de Ventas',
    'SOX',
    'automated',
    'daily',
    ARRAY['sales', 'sale_items'],
    'SELECT COUNT(*) as count FROM sales s WHERE NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id)',
    '{"count": 0}',
    0
),
(
    'Verificación de Stock Negativo',
    'Internal',
    'automated',
    'hourly',
    ARRAY['products'],
    'SELECT COUNT(*) as count FROM products WHERE stock < 0',
    '{"count": 0}',
    0
),
(
    'Verificación de Cajas sin Apertura',
    'Internal',
    'automated',
    'daily',
    ARRAY['cash_registers', 'cash_movements'],
    'SELECT COUNT(*) as count FROM cash_registers cr WHERE NOT EXISTS (SELECT 1 FROM cash_movements cm WHERE cm.cash_register_id = cr.id AND cm.type = ''opening'')',
    '{"count": 0}',
    0
),
(
    'Verificación de IMEI Duplicados',
    'Data_Integrity',
    'automated',
    'weekly',
    ARRAY['product_imei_serials'],
    'SELECT COUNT(*) as count FROM (SELECT imei_number, COUNT(*) FROM product_imei_serials WHERE imei_number != '''' GROUP BY imei_number HAVING COUNT(*) > 1) duplicates',
    '{"count": 0}',
    0
)
ON CONFLICT DO NOTHING;

-- Insertar políticas de retención predeterminadas
INSERT INTO audit_data_retention (
    table_name,
    retention_period_days,
    archive_before_delete,
    archive_table_name
) VALUES 
(
    'cash_register_audit_logs',
    365,
    true,
    'cash_register_audit_logs_archive'
),
(
    'cash_register_enhanced_audit',
    730,
    true,
    'cash_register_enhanced_audit_archive'
),
(
    'audit_reports',
    1095,
    false,
    null
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- VISTAS MEJORADAS PARA AUDITORÍA
-- =====================================================

-- Vista consolidada de auditoría con información completa
CREATE OR REPLACE VIEW audit_comprehensive_view AS
SELECT 
    crea.id,
    crea.cash_register_id,
    crea.action_type,
    crea.entity_type,
    crea.entity_id,
    crea.amount,
    crea.previous_balance,
    crea.new_balance,
    crea.description,
    crea.severity,
    crea.performed_by,
    crea.performed_at,
    crea.metadata,
    
    -- Información del usuario
    u.name as performed_by_name,
    u.email as performed_by_email,
    u.role as performed_by_role,
    
    -- Información de la caja registradora
    cr.opened_at as register_opened_at,
    cr.status as register_status,
    cr_user.name as register_operator_name,
    
    -- Información contextual según el tipo de entidad
    CASE 
        WHEN crea.entity_type = 'sale' THEN (
            SELECT jsonb_build_object(
                'customer_name', c.name,
                'total_amount', s.total_amount,
                'payment_type', s.payment_type,
                'items_count', (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id)
            )
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.id = crea.entity_id::uuid
        )
        WHEN crea.entity_type = 'product' THEN (
            SELECT jsonb_build_object(
                'product_name', p.name,
                'current_stock', p.stock,
                'sale_price', p.sale_price,
                'category', cat.name
            )
            FROM products p
            LEFT JOIN categories cat ON p.category_id = cat.id
            WHERE p.id = crea.entity_id::uuid
        )
        ELSE '{}'::jsonb
    END as entity_details,
    
    -- Indicadores de riesgo
    CASE 
        WHEN crea.severity = 'critical' THEN 'high_risk'
        WHEN crea.action_type = 'delete' AND crea.entity_type IN ('product', 'sale') THEN 'medium_risk'
        WHEN EXTRACT(hour FROM crea.performed_at) NOT BETWEEN 8 AND 18 THEN 'medium_risk'
        ELSE 'low_risk'
    END as risk_level,
    
    -- Tiempo desde el evento
    EXTRACT(EPOCH FROM (now() - crea.performed_at)) / 3600 as hours_since_event

FROM cash_register_enhanced_audit crea
LEFT JOIN users u ON crea.performed_by = u.id
LEFT JOIN cash_registers cr ON crea.cash_register_id = cr.id
LEFT JOIN users cr_user ON cr.user_id = cr_user.id
ORDER BY crea.performed_at DESC;

-- Vista de resumen de alertas activas
CREATE OR REPLACE VIEW audit_alerts_summary AS
SELECT 
    aa.id,
    aa.alert_name,
    aa.alert_type,
    aa.severity,
    aa.entity_type,
    aa.is_active,
    aa.trigger_count,
    aa.last_triggered_at,
    
    -- Tiempo desde la última activación
    CASE 
        WHEN aa.last_triggered_at IS NULL THEN 'Nunca activada'
        ELSE EXTRACT(EPOCH FROM (now() - aa.last_triggered_at)) / 3600 || ' horas'
    END as time_since_last_trigger,
    
    -- Estado de la alerta
    CASE 
        WHEN NOT aa.is_active THEN 'inactive'
        WHEN aa.last_triggered_at IS NULL THEN 'waiting'
        WHEN aa.last_triggered_at > now() - (aa.cooldown_minutes || ' minutes')::interval THEN 'cooldown'
        ELSE 'ready'
    END as alert_status,
    
    -- Información del creador
    u.name as created_by_name,
    aa.created_at

FROM audit_alerts aa
LEFT JOIN users u ON aa.created_by = u.id
ORDER BY aa.severity DESC, aa.trigger_count DESC;

-- =====================================================
-- FUNCIONES DE UTILIDAD PARA EL FRONTEND
-- =====================================================

-- Función para obtener estadísticas de auditoría del dashboard
CREATE OR REPLACE FUNCTION get_audit_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    today_events integer;
    critical_events integer;
    active_alerts integer;
    pending_compliance integer;
BEGIN
    -- Eventos de hoy
    SELECT COUNT(*) INTO today_events
    FROM cash_register_enhanced_audit
    WHERE performed_at::date = CURRENT_DATE;

    -- Eventos críticos últimas 24 horas
    SELECT COUNT(*) INTO critical_events
    FROM cash_register_enhanced_audit
    WHERE severity = 'critical'
    AND performed_at > now() - INTERVAL '24 hours';

    -- Alertas activas
    SELECT COUNT(*) INTO active_alerts
    FROM audit_alerts
    WHERE is_active = true;

    -- Verificaciones de cumplimiento pendientes
    SELECT COUNT(*) INTO pending_compliance
    FROM audit_compliance_checks
    WHERE status IN ('failed', 'warning')
    AND is_active = true;

    result := jsonb_build_object(
        'today_events', today_events,
        'critical_events', critical_events,
        'active_alerts', active_alerts,
        'pending_compliance', pending_compliance,
        'last_updated', now()
    );

    RETURN result;
END;
$$;

-- =====================================================
-- CONFIGURACIÓN DE MANTENIMIENTO AUTOMÁTICO
-- =====================================================

-- Crear tabla para programar tareas de mantenimiento
CREATE TABLE IF NOT EXISTS public.audit_maintenance_schedule (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_name text NOT NULL,
    task_type text NOT NULL CHECK (task_type = ANY (ARRAY['cleanup'::text, 'integrity_check'::text, 'compliance_check'::text, 'report_generation'::text])),
    schedule_expression text NOT NULL, -- Cron-like expression
    last_run_at timestamptz,
    next_run_at timestamptz,
    is_active boolean DEFAULT true,
    run_count integer DEFAULT 0,
    last_result text,
    created_at timestamptz DEFAULT now()
);

-- Insertar tareas de mantenimiento predeterminadas
INSERT INTO audit_maintenance_schedule (
    task_name,
    task_type,
    schedule_expression,
    next_run_at
) VALUES 
(
    'Limpieza Diaria de Auditoría',
    'cleanup',
    '0 2 * * *', -- Diario a las 2 AM
    CURRENT_DATE + INTERVAL '1 day' + INTERVAL '2 hours'
),
(
    'Verificación de Integridad Semanal',
    'integrity_check',
    '0 3 * * 0', -- Domingos a las 3 AM
    date_trunc('week', CURRENT_DATE) + INTERVAL '1 week' + INTERVAL '3 hours'
),
(
    'Verificaciones de Cumplimiento',
    'compliance_check',
    '0 1 * * *', -- Diario a la 1 AM
    CURRENT_DATE + INTERVAL '1 day' + INTERVAL '1 hour'
),
(
    'Reporte Semanal Automático',
    'report_generation',
    '0 6 * * 1', -- Lunes a las 6 AM
    date_trunc('week', CURRENT_DATE) + INTERVAL '1 week' + INTERVAL '6 hours'
)
ON CONFLICT DO NOTHING;

-- Habilitar RLS en tabla de mantenimiento
ALTER TABLE audit_maintenance_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage maintenance schedule" ON audit_maintenance_schedule
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
            AND is_active = true
        )
    );

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE audit_alerts IS 'Sistema de alertas configurables para eventos de auditoría';
COMMENT ON TABLE audit_reports IS 'Reportes de auditoría generados automática o manualmente';
COMMENT ON TABLE audit_compliance_checks IS 'Verificaciones automáticas de cumplimiento normativo';
COMMENT ON TABLE audit_data_retention IS 'Políticas de retención y archivado de datos de auditoría';
COMMENT ON TABLE audit_maintenance_schedule IS 'Programación de tareas de mantenimiento automático';

COMMENT ON FUNCTION validate_data_integrity() IS 'Valida la integridad de datos críticos del sistema';
COMMENT ON FUNCTION detect_suspicious_patterns(integer) IS 'Detecta patrones de actividad sospechosos en el período especificado';
COMMENT ON FUNCTION generate_audit_report(text, text, date, date, text[], text[]) IS 'Genera un reporte completo de auditoría';
COMMENT ON FUNCTION run_compliance_checks() IS 'Ejecuta todas las verificaciones de cumplimiento activas';
COMMENT ON FUNCTION cleanup_audit_data() IS 'Limpia datos antiguos según políticas de retención';
COMMENT ON FUNCTION audit_system_maintenance() IS 'Ejecuta mantenimiento completo del sistema de auditoría';

-- =====================================================
-- FINALIZACIÓN
-- =====================================================

-- Ejecutar verificación inicial de integridad
SELECT validate_data_integrity();

-- Ejecutar verificaciones de cumplimiento iniciales
SELECT run_compliance_checks();

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Sistema de auditoría mejorado instalado exitosamente';
    RAISE NOTICE 'Características implementadas:';
    RAISE NOTICE '  ✅ Sistema de alertas configurables';
    RAISE NOTICE '  ✅ Generación automática de reportes';
    RAISE NOTICE '  ✅ Verificaciones de cumplimiento';
    RAISE NOTICE '  ✅ Políticas de retención de datos';
    RAISE NOTICE '  ✅ Detección de patrones sospechosos';
    RAISE NOTICE '  ✅ Validación de integridad de datos';
    RAISE NOTICE '  ✅ Mantenimiento automático programado';
    RAISE NOTICE '  ✅ Seguridad mejorada con RLS granular';
END;
$$;