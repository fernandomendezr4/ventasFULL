// Utilidades de seguridad específicas para el sistema de auditoría

import { supabase, isDemoMode } from './supabase';

export interface SecurityEvent {
  id: string;
  event_type: 'unauthorized_access' | 'privilege_escalation' | 'data_breach' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  detected_at: string;
  status: 'detected' | 'investigating' | 'resolved' | 'false_positive';
  metadata: any;
}

export interface AuditSecurityReport {
  period_start: string;
  period_end: string;
  total_events: number;
  security_events: SecurityEvent[];
  risk_score: number;
  recommendations: string[];
  compliance_status: 'compliant' | 'non_compliant' | 'needs_review';
}

// Detectar eventos de seguridad en tiempo real
export const detectSecurityEvents = async (hoursBack: number = 24): Promise<SecurityEvent[]> => {
  try {
    if (isDemoMode) {
      // Retornar eventos demo
      return [
        {
          id: 'demo-security-1',
          event_type: 'suspicious_activity',
          severity: 'medium',
          description: 'Múltiples intentos de acceso fuera de horario',
          user_id: 'demo-user-1',
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 (Demo Browser)',
          detected_at: new Date().toISOString(),
          status: 'detected',
          metadata: {
            attempts: 3,
            time_range: '22:00 - 23:30',
            actions: ['open_cash_register', 'view_sales']
          }
        }
      ];
    }

    if (!supabase) return [];

    const securityEvents: SecurityEvent[] = [];
    const timeThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    // Detectar accesos no autorizados (fuera de horario)
    const { data: afterHoursAccess, error: afterHoursError } = await supabase
      .from('cash_register_enhanced_audit')
      .select(`
        id,
        performed_by,
        performed_at,
        action_type,
        entity_type,
        description,
        ip_address,
        user_agent,
        metadata
      `)
      .gte('performed_at', timeThreshold)
      .or('performed_at.lt.today 08:00:00,performed_at.gt.today 18:00:00');

    if (!afterHoursError && afterHoursAccess && afterHoursAccess.length > 0) {
      // Agrupar por usuario para detectar patrones
      const userActivity = new Map<string, any[]>();
      afterHoursAccess.forEach(event => {
        const userId = event.performed_by || 'unknown';
        if (!userActivity.has(userId)) {
          userActivity.set(userId, []);
        }
        userActivity.get(userId)!.push(event);
      });

      // Crear eventos de seguridad para usuarios con actividad sospechosa
      for (const [userId, events] of userActivity) {
        if (events.length > 2) { // Más de 2 acciones fuera de horario
          securityEvents.push({
            id: `security-${Date.now()}-${userId}`,
            event_type: 'unauthorized_access',
            severity: events.length > 5 ? 'high' : 'medium',
            description: `${events.length} acciones fuera de horario laboral`,
            user_id: userId !== 'unknown' ? userId : null,
            ip_address: events[0].ip_address,
            user_agent: events[0].user_agent,
            detected_at: new Date().toISOString(),
            status: 'detected',
            metadata: {
              total_events: events.length,
              event_types: [...new Set(events.map(e => e.action_type))],
              time_range: {
                first: events[events.length - 1].performed_at,
                last: events[0].performed_at
              }
            }
          });
        }
      }
    }

    // Detectar eliminaciones masivas
    const { data: massDeletes, error: deletesError } = await supabase
      .from('cash_register_enhanced_audit')
      .select(`
        performed_by,
        performed_at,
        entity_type,
        description,
        ip_address,
        user_agent
      `)
      .eq('action_type', 'delete')
      .gte('performed_at', timeThreshold);

    if (!deletesError && massDeletes && massDeletes.length > 10) {
      // Agrupar eliminaciones por usuario
      const deletesByUser = new Map<string, any[]>();
      massDeletes.forEach(event => {
        const userId = event.performed_by || 'unknown';
        if (!deletesByUser.has(userId)) {
          deletesByUser.set(userId, []);
        }
        deletesByUser.get(userId)!.push(event);
      });

      for (const [userId, deletes] of deletesByUser) {
        if (deletes.length > 5) {
          securityEvents.push({
            id: `security-delete-${Date.now()}-${userId}`,
            event_type: 'suspicious_activity',
            severity: deletes.length > 20 ? 'critical' : 'high',
            description: `Eliminación masiva: ${deletes.length} registros eliminados`,
            user_id: userId !== 'unknown' ? userId : null,
            ip_address: deletes[0].ip_address,
            user_agent: deletes[0].user_agent,
            detected_at: new Date().toISOString(),
            status: 'detected',
            metadata: {
              total_deletes: deletes.length,
              affected_entities: [...new Set(deletes.map(d => d.entity_type))],
              time_span_hours: (new Date(deletes[0].performed_at).getTime() - 
                               new Date(deletes[deletes.length - 1].performed_at).getTime()) / (1000 * 60 * 60)
            }
          });
        }
      }
    }

    return securityEvents;

  } catch (error) {
    console.error('Error detecting security events:', error);
    return [];
  }
};

// Generar reporte de seguridad completo
export const generateSecurityReport = async (
  startDate: string,
  endDate: string
): Promise<AuditSecurityReport> => {
  try {
    if (isDemoMode) {
      return {
        period_start: startDate,
        period_end: endDate,
        total_events: 150,
        security_events: await detectSecurityEvents(24),
        risk_score: 25, // Bajo riesgo
        recommendations: [
          'Sistema funcionando en modo demo',
          'Configurar autenticación real para producción',
          'Implementar monitoreo de IP en tiempo real'
        ],
        compliance_status: 'compliant'
      };
    }

    if (!supabase) {
      return {
        period_start: startDate,
        period_end: endDate,
        total_events: 0,
        security_events: [],
        risk_score: 100, // Alto riesgo por falta de conexión
        recommendations: ['Restaurar conexión a la base de datos'],
        compliance_status: 'non_compliant'
      };
    }

    // Contar eventos totales en el período
    const { count: totalEvents, error: countError } = await supabase
      .from('cash_register_enhanced_audit')
      .select('id', { count: 'exact', head: true })
      .gte('performed_at', startDate)
      .lte('performed_at', endDate);

    // Detectar eventos de seguridad
    const securityEvents = await detectSecurityEvents(
      Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60))
    );

    // Calcular score de riesgo
    let riskScore = 0;
    securityEvents.forEach(event => {
      switch (event.severity) {
        case 'critical':
          riskScore += 25;
          break;
        case 'high':
          riskScore += 15;
          break;
        case 'medium':
          riskScore += 8;
          break;
        case 'low':
          riskScore += 3;
          break;
      }
    });

    // Generar recomendaciones
    const recommendations: string[] = [];
    
    if (securityEvents.length === 0) {
      recommendations.push('No se detectaron eventos de seguridad en el período');
      recommendations.push('Continuar monitoreando actividad regularmente');
    } else {
      recommendations.push(`Se detectaron ${securityEvents.length} eventos de seguridad`);
      
      const criticalEvents = securityEvents.filter(e => e.severity === 'critical');
      if (criticalEvents.length > 0) {
        recommendations.push(`URGENTE: Investigar ${criticalEvents.length} eventos críticos`);
      }
      
      const unauthorizedAccess = securityEvents.filter(e => e.event_type === 'unauthorized_access');
      if (unauthorizedAccess.length > 0) {
        recommendations.push('Revisar políticas de acceso y horarios laborales');
      }
      
      const suspiciousActivity = securityEvents.filter(e => e.event_type === 'suspicious_activity');
      if (suspiciousActivity.length > 0) {
        recommendations.push('Investigar patrones de actividad sospechosa');
      }
    }

    // Determinar estado de cumplimiento
    let complianceStatus: 'compliant' | 'non_compliant' | 'needs_review' = 'compliant';
    
    if (riskScore > 50) {
      complianceStatus = 'non_compliant';
    } else if (riskScore > 20 || securityEvents.some(e => e.severity === 'high')) {
      complianceStatus = 'needs_review';
    }

    return {
      period_start: startDate,
      period_end: endDate,
      total_events: totalEvents || 0,
      security_events: securityEvents,
      risk_score: Math.min(riskScore, 100),
      recommendations,
      compliance_status: complianceStatus
    };

  } catch (error) {
    console.error('Error generating security report:', error);
    return {
      period_start: startDate,
      period_end: endDate,
      total_events: 0,
      security_events: [],
      risk_score: 100,
      recommendations: ['Error al generar reporte de seguridad'],
      compliance_status: 'non_compliant'
    };
  }
};

// Función para encriptar datos sensibles en logs de auditoría
export const encryptSensitiveData = async (data: any): Promise<string> => {
  try {
    // En producción, usar una clave de encriptación real
    const sensitiveFields = ['password', 'credit_card', 'ssn', 'personal_id'];
    const cleanedData = { ...data };

    // Remover o enmascarar campos sensibles
    Object.keys(cleanedData).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        cleanedData[key] = '***ENCRYPTED***';
      }
    });

    return JSON.stringify(cleanedData);
  } catch (error) {
    console.error('Error encrypting sensitive data:', error);
    return JSON.stringify(data);
  }
};

// Función para validar acceso a datos de auditoría
export const validateAuditDataAccess = async (
  userId: string,
  requestedData: string[],
  purpose: string
): Promise<{ canAccess: boolean; allowedData: string[]; deniedData: string[]; reason?: string }> => {
  try {
    if (isDemoMode) {
      return {
        canAccess: true,
        allowedData: requestedData,
        deniedData: [],
        reason: 'Acceso completo en modo demo'
      };
    }

    if (!supabase) {
      return {
        canAccess: false,
        allowedData: [],
        deniedData: requestedData,
        reason: 'Sistema de base de datos no disponible'
      };
    }

    // Obtener información del usuario
    const { data: user, error } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return {
        canAccess: false,
        allowedData: [],
        deniedData: requestedData,
        reason: 'Usuario no encontrado'
      };
    }

    if (!user.is_active) {
      return {
        canAccess: false,
        allowedData: [],
        deniedData: requestedData,
        reason: 'Usuario inactivo'
      };
    }

    // Definir permisos por rol
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'], // Acceso completo
      manager: [
        'cash_register_audit_logs',
        'cash_register_enhanced_audit',
        'audit_reports',
        'audit_alerts'
      ],
      employee: [
        'cash_register_audit_logs' // Solo logs básicos
      ]
    };

    const userPermissions = rolePermissions[user.role] || [];
    
    // Si tiene acceso completo
    if (userPermissions.includes('*')) {
      return {
        canAccess: true,
        allowedData: requestedData,
        deniedData: []
      };
    }

    // Filtrar datos según permisos
    const allowedData = requestedData.filter(dataType => 
      userPermissions.includes(dataType)
    );
    
    const deniedData = requestedData.filter(dataType => 
      !userPermissions.includes(dataType)
    );

    // Registrar intento de acceso
    await logAuditAccess(userId, requestedData, purpose, allowedData.length > 0);

    return {
      canAccess: allowedData.length > 0,
      allowedData,
      deniedData,
      reason: deniedData.length > 0 ? `Acceso denegado a: ${deniedData.join(', ')}` : undefined
    };

  } catch (error) {
    console.error('Error validating audit data access:', error);
    return {
      canAccess: false,
      allowedData: [],
      deniedData: requestedData,
      reason: 'Error interno al validar acceso'
    };
  }
};

// Registrar intentos de acceso a datos de auditoría
const logAuditAccess = async (
  userId: string,
  requestedData: string[],
  purpose: string,
  wasGranted: boolean
): Promise<void> => {
  try {
    if (isDemoMode || !supabase) return;

    const accessLog = {
      cash_register_id: null, // No aplica para acceso a auditoría
      action_type: 'audit_access',
      entity_type: 'audit_system',
      entity_id: null,
      description: `Acceso a datos de auditoría: ${requestedData.join(', ')}`,
      severity: wasGranted ? 'normal' : 'high',
      performed_by: userId,
      metadata: {
        requested_data: requestedData,
        purpose: purpose,
        access_granted: wasGranted,
        timestamp: new Date().toISOString()
      }
    };

    await supabase
      .from('cash_register_enhanced_audit')
      .insert([accessLog]);

  } catch (error) {
    console.error('Error logging audit access:', error);
  }
};

// Función para detectar anomalías en patrones de acceso
export const detectAccessAnomalies = async (userId: string): Promise<{
  hasAnomalies: boolean;
  anomalies: Array<{
    type: string;
    description: string;
    severity: string;
    detected_at: string;
  }>;
}> => {
  try {
    if (isDemoMode) {
      return {
        hasAnomalies: false,
        anomalies: []
      };
    }

    if (!supabase) {
      return {
        hasAnomalies: false,
        anomalies: []
      };
    }

    const anomalies: Array<{
      type: string;
      description: string;
      severity: string;
      detected_at: string;
    }> = [];

    // Obtener actividad del usuario en las últimas 24 horas
    const { data: userActivity, error } = await supabase
      .from('cash_register_enhanced_audit')
      .select('*')
      .eq('performed_by', userId)
      .gte('performed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('performed_at', { ascending: false });

    if (error || !userActivity) {
      return { hasAnomalies: false, anomalies: [] };
    }

    // Detectar actividad inusual por volumen
    if (userActivity.length > 100) {
      anomalies.push({
        type: 'high_volume_activity',
        description: `Actividad inusualmente alta: ${userActivity.length} eventos en 24 horas`,
        severity: userActivity.length > 200 ? 'critical' : 'high',
        detected_at: new Date().toISOString()
      });
    }

    // Detectar actividad fuera de horario
    const afterHoursActivity = userActivity.filter(event => {
      const hour = new Date(event.performed_at).getHours();
      return hour < 8 || hour > 18;
    });

    if (afterHoursActivity.length > 5) {
      anomalies.push({
        type: 'after_hours_access',
        description: `${afterHoursActivity.length} accesos fuera de horario laboral`,
        severity: afterHoursActivity.length > 15 ? 'high' : 'medium',
        detected_at: new Date().toISOString()
      });
    }

    // Detectar cambios de IP frecuentes
    const uniqueIPs = new Set(userActivity.map(event => event.ip_address).filter(Boolean));
    if (uniqueIPs.size > 5) {
      anomalies.push({
        type: 'multiple_ip_addresses',
        description: `Acceso desde ${uniqueIPs.size} direcciones IP diferentes`,
        severity: uniqueIPs.size > 10 ? 'high' : 'medium',
        detected_at: new Date().toISOString()
      });
    }

    // Detectar eliminaciones frecuentes
    const deleteEvents = userActivity.filter(event => event.action_type === 'delete');
    if (deleteEvents.length > 10) {
      anomalies.push({
        type: 'frequent_deletions',
        description: `${deleteEvents.length} eliminaciones en 24 horas`,
        severity: deleteEvents.length > 25 ? 'critical' : 'high',
        detected_at: new Date().toISOString()
      });
    }

    return {
      hasAnomalies: anomalies.length > 0,
      anomalies
    };

  } catch (error) {
    console.error('Error detecting access anomalies:', error);
    return {
      hasAnomalies: false,
      anomalies: []
    };
  }
};

// Función para validar configuración de seguridad del sistema
export const validateSecurityConfiguration = async (): Promise<{
  isSecure: boolean;
  issues: string[];
  recommendations: string[];
}> => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    if (isDemoMode) {
      return {
        isSecure: false,
        issues: ['Sistema ejecutándose en modo demo'],
        recommendations: [
          'Configurar autenticación real',
          'Implementar conexión segura a base de datos',
          'Configurar variables de entorno de producción'
        ]
      };
    }

    if (!supabase) {
      return {
        isSecure: false,
        issues: ['No hay conexión a la base de datos'],
        recommendations: ['Restaurar conexión a Supabase']
      };
    }

    // Verificar configuración RLS
    const auditTables = [
      'audit_alerts',
      'audit_reports', 
      'cash_register_enhanced_audit',
      'cash_register_audit_logs'
    ];

    for (const tableName of auditTables) {
      try {
        // Verificar si RLS está habilitado
        const { data: rlsStatus, error } = await supabase
          .from('pg_tables')
          .select('rowsecurity')
          .eq('tablename', tableName)
          .eq('schemaname', 'public')
          .single();

        if (error) {
          issues.push(`No se pudo verificar RLS para tabla ${tableName}`);
        } else if (!rlsStatus?.rowsecurity) {
          issues.push(`RLS no habilitado en tabla ${tableName}`);
        }
      } catch (error) {
        issues.push(`Error verificando seguridad de tabla ${tableName}`);
      }
    }

    // Verificar políticas de acceso
    try {
      const { data: policies, error } = await supabase
        .from('pg_policies')
        .select('tablename, policyname')
        .in('tablename', auditTables);

      if (error) {
        issues.push('No se pudieron verificar las políticas de seguridad');
      } else {
        const tablesWithPolicies = new Set(policies?.map(p => p.tablename) || []);
        const tablesWithoutPolicies = auditTables.filter(table => !tablesWithPolicies.has(table));
        
        if (tablesWithoutPolicies.length > 0) {
          issues.push(`Tablas sin políticas de seguridad: ${tablesWithoutPolicies.join(', ')}`);
        }
      }
    } catch (error) {
      issues.push('Error verificando políticas de seguridad');
    }

    // Generar recomendaciones basadas en los problemas encontrados
    if (issues.length === 0) {
      recommendations.push('Configuración de seguridad correcta');
      recommendations.push('Continuar monitoreando regularmente');
    } else {
      recommendations.push('Corregir problemas de seguridad identificados');
      recommendations.push('Revisar configuración de RLS y políticas');
      recommendations.push('Contactar administrador de base de datos si es necesario');
    }

    return {
      isSecure: issues.length === 0,
      issues,
      recommendations
    };

  } catch (error) {
    console.error('Error validating security configuration:', error);
    return {
      isSecure: false,
      issues: ['Error interno al validar configuración de seguridad'],
      recommendations: ['Contactar soporte técnico']
    };
  }
};

// Función para crear hash seguro de eventos críticos
export const createAuditEventHash = async (eventData: any): Promise<string> => {
  try {
    // Crear un hash único del evento para verificación de integridad
    const eventString = JSON.stringify({
      id: eventData.id,
      action_type: eventData.action_type,
      entity_type: eventData.entity_type,
      entity_id: eventData.entity_id,
      performed_by: eventData.performed_by,
      performed_at: eventData.performed_at,
      amount: eventData.amount
    });

    const encoder = new TextEncoder();
    const data = encoder.encode(eventString + 'audit_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Error creating audit event hash:', error);
    return '';
  }
};

// Función para verificar integridad de eventos de auditoría
export const verifyAuditEventIntegrity = async (
  eventId: string,
  expectedHash: string
): Promise<{ isValid: boolean; currentHash: string; tampered: boolean }> => {
  try {
    if (isDemoMode) {
      return {
        isValid: true,
        currentHash: expectedHash,
        tampered: false
      };
    }

    if (!supabase) {
      return {
        isValid: false,
        currentHash: '',
        tampered: false
      };
    }

    // Obtener el evento actual
    const { data: event, error } = await supabase
      .from('cash_register_enhanced_audit')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return {
        isValid: false,
        currentHash: '',
        tampered: true
      };
    }

    // Calcular hash actual
    const currentHash = await createAuditEventHash(event);
    
    return {
      isValid: currentHash === expectedHash,
      currentHash,
      tampered: currentHash !== expectedHash
    };

  } catch (error) {
    console.error('Error verifying audit event integrity:', error);
    return {
      isValid: false,
      currentHash: '',
      tampered: false
    };
  }
};