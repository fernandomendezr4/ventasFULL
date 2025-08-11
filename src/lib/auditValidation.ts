// Utilidades de validación específicas para el sistema de auditoría

import { supabase, isDemoMode } from './supabase';

export interface AuditValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  criticalIssues: string[];
}

export interface DataIntegrityCheck {
  table_name: string;
  check_type: string;
  status: 'passed' | 'failed' | 'warning';
  details: string;
  affected_records: number;
  suggested_action: string;
}

export interface SecurityValidationResult {
  hasSecurityIssues: boolean;
  unauthorizedAccess: number;
  suspiciousPatterns: number;
  failedLogins: number;
  privilegeEscalations: number;
  recommendations: string[];
}

// Validar integridad completa del sistema de auditoría
export const validateAuditSystemIntegrity = async (): Promise<AuditValidationResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const criticalIssues: string[] = [];

  try {
    if (isDemoMode) {
      // En modo demo, simular validación exitosa
      return {
        isValid: true,
        errors: [],
        warnings: ['Sistema ejecutándose en modo demo'],
        criticalIssues: []
      };
    }

    if (!supabase) {
      criticalIssues.push('Sistema de base de datos no disponible');
      return {
        isValid: false,
        errors: ['No hay conexión a la base de datos'],
        warnings: [],
        criticalIssues
      };
    }

    // Verificar que las tablas de auditoría existan
    const requiredTables = [
      'cash_register_audit_logs',
      'cash_register_enhanced_audit',
      'audit_alerts',
      'audit_reports'
    ];

    for (const tableName of requiredTables) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('id')
          .limit(1);

        if (error && error.message.includes('relation') && error.message.includes('does not exist')) {
          criticalIssues.push(`Tabla de auditoría faltante: ${tableName}`);
        }
      } catch (error) {
        warnings.push(`No se pudo verificar la tabla: ${tableName}`);
      }
    }

    // Verificar funciones críticas de auditoría
    const requiredFunctions = [
      'validate_data_integrity',
      'detect_suspicious_patterns',
      'generate_audit_report'
    ];

    for (const functionName of requiredFunctions) {
      try {
        const { error } = await supabase.rpc(functionName as any);
        // Si no hay error o el error no es de función inexistente, la función existe
        if (error && error.message.includes('function') && error.message.includes('does not exist')) {
          warnings.push(`Función de auditoría faltante: ${functionName}`);
        }
      } catch (error) {
        // Ignorar errores de parámetros, solo nos interesa si la función existe
      }
    }

    // Verificar triggers de auditoría
    // Skip trigger verification as it requires system table access
    try {
      // Try to check if a custom RPC function exists for trigger verification
      const { error: triggerCheckError } = await supabase.rpc('check_audit_triggers');
      if (triggerCheckError) {
        warnings.push('Verificación de triggers no disponible - función RPC no encontrada');
      }
    } catch (error) {
      warnings.push('Verificación de triggers no disponible');
    }

    // Verificar políticas RLS
    const auditTables = ['audit_alerts', 'audit_reports', 'cash_register_enhanced_audit'];
    for (const tableName of auditTables) {
      try {
        // Try to check if a custom RPC function exists for RLS policy verification
        const { error: rlsCheckError } = await supabase.rpc('check_rls_policies', { table_name: tableName });
        if (rlsCheckError) {
          warnings.push(`Verificación de políticas RLS no disponible para ${tableName}`);
        }
      } catch (error) {
        warnings.push(`Verificación de RLS no disponible para ${tableName}`);
      }
    }

    return {
      isValid: criticalIssues.length === 0,
      errors,
      warnings,
      criticalIssues
    };

  } catch (error) {
    console.error('Error validating audit system integrity:', error);
    return {
      isValid: false,
      errors: ['Error interno al validar integridad del sistema'],
      warnings: [],
      criticalIssues: ['Error crítico en validación del sistema']
    };
  }
};

// Ejecutar verificaciones de integridad de datos específicas
export const runDataIntegrityChecks = async (): Promise<DataIntegrityCheck[]> => {
  const checks: DataIntegrityCheck[] = [];

  try {
    if (isDemoMode) {
      // Retornar verificaciones demo
      return [
        {
          table_name: 'sales',
          check_type: 'referential_integrity',
          status: 'passed',
          details: 'Todas las ventas tienen items asociados',
          affected_records: 0,
          suggested_action: 'Ninguna acción requerida'
        },
        {
          table_name: 'products',
          check_type: 'business_rules',
          status: 'passed',
          details: 'Todos los productos tienen precios válidos',
          affected_records: 0,
          suggested_action: 'Ninguna acción requerida'
        },
        {
          table_name: 'cash_registers',
          check_type: 'data_consistency',
          status: 'passed',
          details: 'Todas las cajas tienen movimientos de apertura',
          affected_records: 0,
          suggested_action: 'Ninguna acción requerida'
        }
      ];
    }

    if (!supabase) {
      return [];
    }

    // Ejecutar función de validación de integridad
    const { data, error } = await supabase.rpc('validate_data_integrity');
    
    if (error) {
      console.error('Error running integrity checks:', error);
      return [];
    }

    // Convertir resultados al formato esperado
    return (data || []).map((result: any) => ({
      table_name: result.table_name,
      check_type: result.issue_type === 'healthy' ? 'data_consistency' : 'data_integrity',
      status: result.issue_type === 'healthy' ? 'passed' : 'failed',
      details: result.issue_description,
      affected_records: 0, // La función actual no retorna este dato
      suggested_action: result.suggested_action
    }));

  } catch (error) {
    console.error('Error in data integrity checks:', error);
    return [];
  }
};

// Validar configuración de alertas
export const validateAlertConfiguration = (alertData: any): AuditValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const criticalIssues: string[] = [];

  // Validaciones básicas
  if (!alertData.alert_name || alertData.alert_name.trim().length < 3) {
    errors.push('El nombre de la alerta debe tener al menos 3 caracteres');
  }

  if (!alertData.description || alertData.description.trim().length < 10) {
    errors.push('La descripción debe tener al menos 10 caracteres');
  }

  if (!alertData.event_types || alertData.event_types.length === 0) {
    warnings.push('No se han seleccionado tipos de eventos para monitorear');
  }

  // Validar configuración de cooldown
  if (alertData.cooldown_minutes < 1 || alertData.cooldown_minutes > 1440) {
    errors.push('El tiempo de cooldown debe estar entre 1 y 1440 minutos');
  }

  // Validar límites por hora
  if (alertData.max_triggers_per_hour < 1 || alertData.max_triggers_per_hour > 100) {
    errors.push('El máximo de activaciones por hora debe estar entre 1 y 100');
  }

  // Validar canales de notificación
  if (!alertData.notification_channels || alertData.notification_channels.length === 0) {
    warnings.push('No se han configurado canales de notificación');
  }

  // Validar severidad vs tipo de alerta
  if (alertData.alert_type === 'security' && alertData.severity === 'low') {
    warnings.push('Las alertas de seguridad generalmente deberían tener severidad media o alta');
  }

  // Validar condiciones de trigger
  if (alertData.trigger_conditions) {
    try {
      if (typeof alertData.trigger_conditions === 'string') {
        JSON.parse(alertData.trigger_conditions);
      }
    } catch (error) {
      errors.push('Las condiciones de activación no tienen formato JSON válido');
    }
  }

  return {
    isValid: errors.length === 0 && criticalIssues.length === 0,
    errors,
    warnings,
    criticalIssues
  };
};

// Validar permisos de auditoría para un usuario
export const validateAuditPermissions = async (
  userId: string,
  requiredPermissions: string[]
): Promise<{ hasPermissions: boolean; missingPermissions: string[] }> => {
  try {
    if (isDemoMode) {
      // En modo demo, simular permisos completos
      return {
        hasPermissions: true,
        missingPermissions: []
      };
    }

    if (!supabase) {
      return {
        hasPermissions: false,
        missingPermissions: requiredPermissions
      };
    }

    // Obtener rol del usuario
    const { data: userData, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      return {
        hasPermissions: false,
        missingPermissions: requiredPermissions
      };
    }

    // Los administradores tienen todos los permisos
    if (userData.role === 'admin') {
      return {
        hasPermissions: true,
        missingPermissions: []
      };
    }

    // Los gerentes tienen la mayoría de permisos de auditoría
    if (userData.role === 'manager') {
      const managerRestrictedPermissions = ['delete_audit_data', 'modify_system_settings'];
      const missingPermissions = requiredPermissions.filter(perm => 
        managerRestrictedPermissions.includes(perm)
      );
      
      return {
        hasPermissions: missingPermissions.length === 0,
        missingPermissions
      };
    }

    // Otros roles tienen permisos limitados
    const allowedPermissions = ['view_audit_logs', 'view_reports'];
    const missingPermissions = requiredPermissions.filter(perm => 
      !allowedPermissions.includes(perm)
    );

    return {
      hasPermissions: missingPermissions.length === 0,
      missingPermissions
    };

  } catch (error) {
    console.error('Error validating audit permissions:', error);
    return {
      hasPermissions: false,
      missingPermissions: requiredPermissions
    };
  }
};

// Validar configuración de retención de datos
export const validateRetentionPolicy = (policyData: any): AuditValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const criticalIssues: string[] = [];

  // Validaciones básicas
  if (!policyData.table_name || policyData.table_name.trim().length === 0) {
    errors.push('El nombre de la tabla es requerido');
  }

  if (!policyData.retention_period_days || policyData.retention_period_days < 1) {
    errors.push('El período de retención debe ser al menos 1 día');
  }

  // Validar períodos de retención según el tipo de datos
  const recommendedRetentions: Record<string, { min: number; max: number; recommended: number }> = {
    'cash_register_audit_logs': { min: 365, max: 2555, recommended: 730 }, // 1-7 años, recomendado 2 años
    'cash_register_enhanced_audit': { min: 730, max: 3650, recommended: 1095 }, // 2-10 años, recomendado 3 años
    'audit_reports': { min: 1095, max: 3650, recommended: 1825 }, // 3-10 años, recomendado 5 años
    'employee_sessions': { min: 30, max: 365, recommended: 90 } // 1 mes - 1 año, recomendado 3 meses
  };

  const tableRecommendation = recommendedRetentions[policyData.table_name];
  if (tableRecommendation) {
    if (policyData.retention_period_days < tableRecommendation.min) {
      warnings.push(`Período muy corto para ${policyData.table_name}. Mínimo recomendado: ${tableRecommendation.min} días`);
    }
    
    if (policyData.retention_period_days > tableRecommendation.max) {
      warnings.push(`Período muy largo para ${policyData.table_name}. Máximo recomendado: ${tableRecommendation.max} días`);
    }
    
    if (Math.abs(policyData.retention_period_days - tableRecommendation.recommended) > 365) {
      warnings.push(`Considera usar ${tableRecommendation.recommended} días (recomendado para ${policyData.table_name})`);
    }
  }

  // Validar configuración de archivado
  if (policyData.archive_before_delete) {
    if (!policyData.archive_table_name || policyData.archive_table_name.trim().length === 0) {
      warnings.push('Se recomienda especificar el nombre de la tabla de archivo');
    } else {
      // Validar que el nombre de la tabla de archivo sea válido
      if (!/^[a-z][a-z0-9_]*$/.test(policyData.archive_table_name)) {
        errors.push('El nombre de la tabla de archivo debe contener solo letras minúsculas, números y guiones bajos');
      }
    }
  }

  // Validaciones de seguridad
  if (policyData.table_name.includes('audit') && policyData.retention_period_days < 365) {
    criticalIssues.push('Los datos de auditoría deben retenerse al menos 1 año por regulaciones de cumplimiento');
  }

  return {
    isValid: errors.length === 0 && criticalIssues.length === 0,
    errors,
    warnings,
    criticalIssues
  };
};

// Ejecutar validaciones de seguridad específicas
export const runSecurityValidations = async (): Promise<SecurityValidationResult> => {
  try {
    if (isDemoMode) {
      return {
        hasSecurityIssues: false,
        unauthorizedAccess: 0,
        suspiciousPatterns: 0,
        failedLogins: 0,
        privilegeEscalations: 0,
        recommendations: [
          'Sistema ejecutándose en modo demo',
          'Configurar autenticación real para producción'
        ]
      };
    }

    if (!supabase) {
      return {
        hasSecurityIssues: true,
        unauthorizedAccess: 0,
        suspiciousPatterns: 0,
        failedLogins: 0,
        privilegeEscalations: 0,
        recommendations: ['Restaurar conexión a la base de datos']
      };
    }

    const recommendations: string[] = [];
    let hasSecurityIssues = false;

    // Verificar accesos no autorizados (actividad fuera de horario)
    const { data: afterHoursActivity, error: afterHoursError } = await supabase
      .from('cash_register_enhanced_audit')
      .select('id')
      .gte('performed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .or('performed_at.lt.today 08:00:00,performed_at.gt.today 18:00:00');

    const unauthorizedAccess = afterHoursError ? 0 : (afterHoursActivity?.length || 0);

    // Verificar patrones sospechosos
    let suspiciousPatterns = 0;
    try {
      const { data: patterns, error: patternsError } = await supabase.rpc('detect_suspicious_patterns', { hours_back: 24 });
      suspiciousPatterns = patternsError ? 0 : (patterns?.length || 0);
    } catch (error) {
      console.warn('Suspicious patterns detection not available');
    }

    // Verificar eliminaciones masivas
    const { data: massDeletes, error: deletesError } = await supabase
      .from('cash_register_enhanced_audit')
      .select('id')
      .eq('action_type', 'delete')
      .gte('performed_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Última hora

    const massDeleteCount = deletesError ? 0 : (massDeletes?.length || 0);

    // Generar recomendaciones
    if (unauthorizedAccess > 0) {
      hasSecurityIssues = true;
      recommendations.push(`Revisar ${unauthorizedAccess} accesos fuera de horario laboral`);
    }

    if (suspiciousPatterns > 0) {
      hasSecurityIssues = true;
      recommendations.push(`Investigar ${suspiciousPatterns} patrones sospechosos detectados`);
    }

    if (massDeleteCount > 5) {
      hasSecurityIssues = true;
      recommendations.push(`Verificar ${massDeleteCount} eliminaciones recientes`);
    }

    if (!hasSecurityIssues) {
      recommendations.push('Sistema de seguridad funcionando correctamente');
      recommendations.push('Continuar monitoreando actividad regularmente');
    }

    return {
      hasSecurityIssues,
      unauthorizedAccess,
      suspiciousPatterns,
      failedLogins: 0, // No implementado aún
      privilegeEscalations: 0, // No implementado aún
      recommendations
    };

  } catch (error) {
    console.error('Error running security validations:', error);
    return {
      hasSecurityIssues: true,
      unauthorizedAccess: 0,
      suspiciousPatterns: 0,
      failedLogins: 0,
      privilegeEscalations: 0,
      recommendations: ['Error al ejecutar validaciones de seguridad']
    };
  }
};

// Validar configuración de reportes de auditoría
export const validateReportConfiguration = (reportConfig: any): AuditValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const criticalIssues: string[] = [];

  // Validaciones básicas
  if (!reportConfig.report_name || reportConfig.report_name.trim().length < 3) {
    errors.push('El nombre del reporte debe tener al menos 3 caracteres');
  }

  if (!reportConfig.date_from || !reportConfig.date_to) {
    errors.push('Las fechas de inicio y fin son requeridas');
  }

  // Validar rango de fechas
  if (reportConfig.date_from && reportConfig.date_to) {
    const startDate = new Date(reportConfig.date_from);
    const endDate = new Date(reportConfig.date_to);
    const now = new Date();

    if (startDate > endDate) {
      errors.push('La fecha de inicio debe ser anterior a la fecha de fin');
    }

    if (endDate > now) {
      warnings.push('La fecha de fin está en el futuro');
    }

    // Verificar rango muy amplio
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      warnings.push('Rango de fechas muy amplio (>1 año). El reporte puede ser muy grande.');
    }

    if (daysDiff > 1095) { // 3 años
      criticalIssues.push('Rango de fechas demasiado amplio (>3 años). Esto puede causar problemas de rendimiento.');
    }
  }

  // Validar selección de entidades
  if (reportConfig.entities_included && reportConfig.entities_included.length > 10) {
    warnings.push('Muchas entidades seleccionadas. Considera crear reportes más específicos.');
  }

  // Validar configuración de formato
  if (reportConfig.format && !['json', 'csv', 'pdf'].includes(reportConfig.format)) {
    errors.push('Formato de reporte no válido');
  }

  return {
    isValid: errors.length === 0 && criticalIssues.length === 0,
    errors,
    warnings,
    criticalIssues
  };
};

// Función para validar antes de ejecutar operaciones críticas
export const validateCriticalOperation = async (
  operation: string,
  targetTable: string,
  userId: string
): Promise<{ canProceed: boolean; reason?: string; requiresConfirmation?: boolean }> => {
  try {
    if (isDemoMode) {
      return { canProceed: true };
    }

    if (!supabase) {
      return { canProceed: false, reason: 'Sistema de base de datos no disponible' };
    }

    // Verificar permisos del usuario
    const { data: user, error } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return { canProceed: false, reason: 'Usuario no encontrado' };
    }

    if (!user.is_active) {
      return { canProceed: false, reason: 'Usuario inactivo' };
    }

    // Validar operaciones según el rol
    const criticalOperations = ['delete_audit_data', 'modify_retention_policy', 'disable_audit_system'];
    
    if (criticalOperations.includes(operation) && user.role !== 'admin') {
      return { 
        canProceed: false, 
        reason: 'Solo los administradores pueden ejecutar esta operación crítica' 
      };
    }

    // Verificar si la operación requiere confirmación adicional
    const highRiskOperations = ['cleanup_audit_data', 'generate_compliance_report'];
    
    if (highRiskOperations.includes(operation)) {
      return { 
        canProceed: true, 
        requiresConfirmation: true 
      };
    }

    return { canProceed: true };

  } catch (error) {
    console.error('Error validating critical operation:', error);
    return { 
      canProceed: false, 
      reason: 'Error interno al validar la operación' 
    };
  }
};

// Función para generar recomendaciones de mejora del sistema
export const generateSystemRecommendations = async (): Promise<string[]> => {
  const recommendations: string[] = [];

  try {
    if (isDemoMode) {
      return [
        'Configurar variables de entorno de Supabase para usar base de datos real',
        'Implementar autenticación de usuarios real',
        'Configurar backups automáticos',
        'Establecer políticas de retención de datos'
      ];
    }

    if (!supabase) {
      return ['Restaurar conexión a la base de datos'];
    }

    // Verificar volumen de datos de auditoría
    const { data: auditCount, error } = await supabase
      .from('cash_register_enhanced_audit')
      .select('id', { count: 'exact', head: true });

    if (!error && auditCount.count) {
      if (auditCount.count > 100000) {
        recommendations.push('Considerar implementar archivado automático - más de 100k registros de auditoría');
      }
      
      if (auditCount.count > 500000) {
        recommendations.push('URGENTE: Implementar limpieza de datos - más de 500k registros pueden afectar el rendimiento');
      }
    }

    // Verificar alertas configuradas
    const { data: alertsCount, error: alertsError } = await supabase
      .from('audit_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (!alertsError && alertsCount.count !== undefined) {
      if (alertsCount.count === 0) {
        recommendations.push('Configurar alertas de auditoría para monitoreo proactivo');
      } else if (alertsCount.count < 3) {
        recommendations.push('Considerar agregar más alertas para cobertura completa');
      }
    }

    // Verificar políticas de retención
    const { data: retentionCount, error: retentionError } = await supabase
      .from('audit_data_retention')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (!retentionError && retentionCount.count !== undefined) {
      if (retentionCount.count === 0) {
        recommendations.push('Configurar políticas de retención de datos para gestión automática');
      }
    }

    // Recomendaciones generales
    recommendations.push('Ejecutar mantenimiento del sistema semanalmente');
    recommendations.push('Revisar logs de eventos críticos diariamente');
    recommendations.push('Generar reportes de cumplimiento mensualmente');

    return recommendations;

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return ['Error al generar recomendaciones del sistema'];
  }
};

// Función para validar antes de eliminar datos de auditoría
export const validateAuditDataDeletion = async (
  tableName: string,
  dateThreshold: string,
  userId: string
): Promise<{ canDelete: boolean; affectedRecords: number; warnings: string[] }> => {
  try {
    if (isDemoMode) {
      return {
        canDelete: true,
        affectedRecords: 150,
        warnings: ['Operación simulada en modo demo']
      };
    }

    if (!supabase) {
      return {
        canDelete: false,
        affectedRecords: 0,
        warnings: ['Sistema de base de datos no disponible']
      };
    }

    const warnings: string[] = [];

    // Verificar permisos del usuario
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError || !user || user.role !== 'admin') {
      return {
        canDelete: false,
        affectedRecords: 0,
        warnings: ['Solo los administradores pueden eliminar datos de auditoría']
      };
    }

    // Contar registros que serían afectados
    let affectedRecords = 0;
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .lt('created_at', dateThreshold);

      if (!error) {
        affectedRecords = count || 0;
      }
    } catch (error) {
      warnings.push('No se pudo determinar el número de registros afectados');
    }

    // Generar advertencias según el volumen
    if (affectedRecords > 10000) {
      warnings.push(`ADVERTENCIA: Se eliminarán ${affectedRecords.toLocaleString()} registros. Esta operación puede tomar tiempo.`);
    }

    if (affectedRecords > 100000) {
      warnings.push('CRÍTICO: Eliminación masiva detectada. Considera ejecutar en horario de baja actividad.');
    }

    // Verificar si hay datos críticos
    const criticalPeriod = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 año
    if (new Date(dateThreshold) > criticalPeriod) {
      warnings.push('ATENCIÓN: Se eliminarán datos de menos de 1 año. Verifica regulaciones de cumplimiento.');
    }

    return {
      canDelete: true,
      affectedRecords,
      warnings
    };

  } catch (error) {
    console.error('Error validating audit data deletion:', error);
    return {
      canDelete: false,
      affectedRecords: 0,
      warnings: ['Error interno al validar eliminación de datos']
    };
  }
};