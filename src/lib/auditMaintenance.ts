// Utilidades para mantenimiento automático del sistema de auditoría

import { supabase, isDemoMode } from './supabase';

export interface MaintenanceTask {
  id: string;
  task_name: string;
  task_type: 'cleanup' | 'integrity_check' | 'compliance_check' | 'report_generation';
  schedule_expression: string;
  last_run_at: string | null;
  next_run_at: string;
  is_active: boolean;
  run_count: number;
  last_result: string | null;
}

export interface MaintenanceResult {
  task_id: string;
  task_name: string;
  success: boolean;
  duration_ms: number;
  result_summary: string;
  details: any;
  executed_at: string;
}

// Ejecutar todas las tareas de mantenimiento pendientes
export const runScheduledMaintenance = async (): Promise<MaintenanceResult[]> => {
  const results: MaintenanceResult[] = [];

  try {
    if (isDemoMode) {
      // Simular mantenimiento en modo demo
      const demoTasks = [
        {
          id: 'demo-task-1',
          task_name: 'Limpieza de datos antiguos',
          task_type: 'cleanup' as const,
          duration: 2500,
          result: 'Limpieza completada: 150 registros archivados'
        },
        {
          id: 'demo-task-2',
          task_name: 'Verificación de integridad',
          task_type: 'integrity_check' as const,
          duration: 1800,
          result: 'Integridad verificada: Sin problemas detectados'
        }
      ];

      for (const task of demoTasks) {
        results.push({
          task_id: task.id,
          task_name: task.task_name,
          success: true,
          duration_ms: task.duration,
          result_summary: task.result,
          details: { demo_mode: true },
          executed_at: new Date().toISOString()
        });
      }

      return results;
    }

    if (!supabase) {
      return [];
    }

    // Obtener tareas pendientes
    const { data: pendingTasks, error } = await supabase
      .from('audit_maintenance_schedule')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', new Date().toISOString());

    if (error) {
      console.error('Error loading pending tasks:', error);
      return [];
    }

    // Ejecutar cada tarea pendiente
    for (const task of pendingTasks || []) {
      const startTime = Date.now();
      let success = false;
      let resultSummary = '';
      let details: any = {};

      try {
        switch (task.task_type) {
          case 'cleanup':
            const cleanupResult = await executeCleanupTask(task);
            success = cleanupResult.success;
            resultSummary = cleanupResult.summary;
            details = cleanupResult.details;
            break;

          case 'integrity_check':
            const integrityResult = await executeIntegrityCheckTask(task);
            success = integrityResult.success;
            resultSummary = integrityResult.summary;
            details = integrityResult.details;
            break;

          case 'compliance_check':
            const complianceResult = await executeComplianceCheckTask(task);
            success = complianceResult.success;
            resultSummary = complianceResult.summary;
            details = complianceResult.details;
            break;

          case 'report_generation':
            const reportResult = await executeReportGenerationTask(task);
            success = reportResult.success;
            resultSummary = reportResult.summary;
            details = reportResult.details;
            break;

          default:
            success = false;
            resultSummary = 'Tipo de tarea no reconocido';
        }

        // Actualizar estadísticas de la tarea
        await supabase
          .from('audit_maintenance_schedule')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: calculateNextRunTime(task.schedule_expression),
            run_count: task.run_count + 1,
            last_result: resultSummary
          })
          .eq('id', task.id);

      } catch (error) {
        console.error(`Error executing task ${task.task_name}:`, error);
        success = false;
        resultSummary = `Error: ${(error as Error).message}`;
      }

      results.push({
        task_id: task.id,
        task_name: task.task_name,
        success,
        duration_ms: Date.now() - startTime,
        result_summary: resultSummary,
        details,
        executed_at: new Date().toISOString()
      });
    }

    return results;

  } catch (error) {
    console.error('Error running scheduled maintenance:', error);
    return [];
  }
};

// Ejecutar tarea de limpieza
const executeCleanupTask = async (task: MaintenanceTask): Promise<{
  success: boolean;
  summary: string;
  details: any;
}> => {
  try {
    const { data, error } = await supabase.rpc('cleanup_audit_data');
    
    if (error) {
      return {
        success: false,
        summary: `Error en limpieza: ${error.message}`,
        details: { error: error.message }
      };
    }

    const totalArchived = (data || []).reduce((sum: number, result: any) => sum + result.records_archived, 0);
    const totalDeleted = (data || []).reduce((sum: number, result: any) => sum + result.records_deleted, 0);

    return {
      success: true,
      summary: `Limpieza completada: ${totalArchived} archivados, ${totalDeleted} eliminados`,
      details: {
        tables_processed: data?.length || 0,
        total_archived: totalArchived,
        total_deleted: totalDeleted,
        cleanup_results: data
      }
    };
  } catch (error) {
    return {
      success: false,
      summary: `Error ejecutando limpieza: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    };
  }
};

// Ejecutar verificación de integridad
const executeIntegrityCheckTask = async (task: MaintenanceTask): Promise<{
  success: boolean;
  summary: string;
  details: any;
}> => {
  try {
    const { data, error } = await supabase.rpc('validate_data_integrity');
    
    if (error) {
      return {
        success: false,
        summary: `Error en verificación de integridad: ${error.message}`,
        details: { error: error.message }
      };
    }

    const issues = (data || []).filter((item: any) => item.issue_type !== 'healthy');
    const success = issues.length === 0;

    return {
      success,
      summary: success 
        ? 'Verificación de integridad exitosa: Sin problemas detectados'
        : `Verificación completada: ${issues.length} problemas detectados`,
      details: {
        total_checks: data?.length || 0,
        issues_found: issues.length,
        issues: issues
      }
    };
  } catch (error) {
    return {
      success: false,
      summary: `Error ejecutando verificación: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    };
  }
};

// Ejecutar verificaciones de cumplimiento
const executeComplianceCheckTask = async (task: MaintenanceTask): Promise<{
  success: boolean;
  summary: string;
  details: any;
}> => {
  try {
    const { data, error } = await supabase.rpc('run_compliance_checks');
    
    if (error) {
      return {
        success: false,
        summary: `Error en verificaciones de cumplimiento: ${error.message}`,
        details: { error: error.message }
      };
    }

    const failedChecks = (data || []).filter((check: any) => check.status === 'failed');
    const success = failedChecks.length === 0;

    return {
      success,
      summary: success 
        ? `Verificaciones de cumplimiento exitosas: ${data?.length || 0} checks ejecutados`
        : `Verificaciones completadas: ${failedChecks.length} fallos de ${data?.length || 0} checks`,
      details: {
        total_checks: data?.length || 0,
        failed_checks: failedChecks.length,
        results: data
      }
    };
  } catch (error) {
    return {
      success: false,
      summary: `Error ejecutando verificaciones: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    };
  }
};

// Ejecutar generación automática de reportes
const executeReportGenerationTask = async (task: MaintenanceTask): Promise<{
  success: boolean;
  summary: string;
  details: any;
}> => {
  try {
    // Generar reporte semanal automático
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: reportId, error } = await supabase.rpc('generate_audit_report', {
      report_name: `Reporte Automático Semanal - ${new Date().toLocaleDateString('es-ES')}`,
      report_type: 'weekly',
      date_from: startDate,
      date_to: endDate,
      entities_filter: null,
      actions_filter: null
    });

    if (error) {
      return {
        success: false,
        summary: `Error generando reporte: ${error.message}`,
        details: { error: error.message }
      };
    }

    return {
      success: true,
      summary: `Reporte semanal generado exitosamente`,
      details: {
        report_id: reportId,
        date_range: { from: startDate, to: endDate }
      }
    };
  } catch (error) {
    return {
      success: false,
      summary: `Error ejecutando generación de reporte: ${(error as Error).message}`,
      details: { error: (error as Error).message }
    };
  }
};

// Calcular próxima ejecución basada en expresión cron simplificada
const calculateNextRunTime = (scheduleExpression: string): string => {
  try {
    // Implementación simplificada para expresiones cron básicas
    // Formato: "minuto hora día mes día_semana"
    const parts = scheduleExpression.split(' ');
    
    if (parts.length !== 5) {
      // Fallback: ejecutar mañana a la misma hora
      return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    const [minute, hour, day, month, dayOfWeek] = parts;
    const now = new Date();
    let nextRun = new Date(now);

    // Configurar hora y minuto
    if (hour !== '*') {
      nextRun.setHours(parseInt(hour));
    }
    if (minute !== '*') {
      nextRun.setMinutes(parseInt(minute));
    }
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);

    // Si la hora ya pasó hoy, programar para mañana
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    // Manejar día de la semana
    if (dayOfWeek !== '*') {
      const targetDayOfWeek = parseInt(dayOfWeek);
      const currentDayOfWeek = nextRun.getDay();
      const daysUntilTarget = (targetDayOfWeek - currentDayOfWeek + 7) % 7;
      
      if (daysUntilTarget > 0) {
        nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      }
    }

    return nextRun.toISOString();
  } catch (error) {
    console.error('Error calculating next run time:', error);
    // Fallback: ejecutar en 24 horas
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }
};

// Función para ejecutar mantenimiento manual completo
export const runFullSystemMaintenance = async (): Promise<{
  success: boolean;
  summary: string;
  details: MaintenanceResult[];
}> => {
  try {
    if (isDemoMode) {
      return {
        success: true,
        summary: 'Mantenimiento completo ejecutado en modo demo',
        details: [
          {
            task_id: 'demo-maintenance-1',
            task_name: 'Mantenimiento Demo',
            success: true,
            duration_ms: 3000,
            result_summary: 'Mantenimiento simulado completado',
            details: { demo_mode: true },
            executed_at: new Date().toISOString()
          }
        ]
      };
    }

    if (!supabase) {
      return {
        success: false,
        summary: 'Sistema de base de datos no disponible',
        details: []
      };
    }

    const startTime = Date.now();
    const results: MaintenanceResult[] = [];

    // Ejecutar limpieza de datos
    try {
      const cleanupStart = Date.now();
      const { data: cleanupData, error: cleanupError } = await supabase.rpc('cleanup_audit_data');
      
      results.push({
        task_id: 'cleanup',
        task_name: 'Limpieza de Datos',
        success: !cleanupError,
        duration_ms: Date.now() - cleanupStart,
        result_summary: cleanupError 
          ? `Error: ${cleanupError.message}`
          : `Limpieza completada: ${cleanupData?.length || 0} tablas procesadas`,
        details: cleanupData || { error: cleanupError?.message },
        executed_at: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        task_id: 'cleanup',
        task_name: 'Limpieza de Datos',
        success: false,
        duration_ms: 0,
        result_summary: `Error: ${(error as Error).message}`,
        details: { error: (error as Error).message },
        executed_at: new Date().toISOString()
      });
    }

    // Ejecutar verificación de integridad
    try {
      const integrityStart = Date.now();
      const { data: integrityData, error: integrityError } = await supabase.rpc('validate_data_integrity');
      
      const issues = (integrityData || []).filter((item: any) => item.issue_type !== 'healthy');
      
      results.push({
        task_id: 'integrity',
        task_name: 'Verificación de Integridad',
        success: !integrityError && issues.length === 0,
        duration_ms: Date.now() - integrityStart,
        result_summary: integrityError 
          ? `Error: ${integrityError.message}`
          : issues.length === 0 
            ? 'Integridad verificada: Sin problemas'
            : `Integridad verificada: ${issues.length} problemas detectados`,
        details: integrityData || { error: integrityError?.message },
        executed_at: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        task_id: 'integrity',
        task_name: 'Verificación de Integridad',
        success: false,
        duration_ms: 0,
        result_summary: `Error: ${(error as Error).message}`,
        details: { error: (error as Error).message },
        executed_at: new Date().toISOString()
      });
    }

    // Ejecutar verificaciones de cumplimiento
    try {
      const complianceStart = Date.now();
      const { data: complianceData, error: complianceError } = await supabase.rpc('run_compliance_checks');
      
      const failedChecks = (complianceData || []).filter((check: any) => check.status === 'failed');
      
      results.push({
        task_id: 'compliance',
        task_name: 'Verificaciones de Cumplimiento',
        success: !complianceError && failedChecks.length === 0,
        duration_ms: Date.now() - complianceStart,
        result_summary: complianceError 
          ? `Error: ${complianceError.message}`
          : failedChecks.length === 0 
            ? `Cumplimiento verificado: ${complianceData?.length || 0} checks exitosos`
            : `Cumplimiento verificado: ${failedChecks.length} fallos de ${complianceData?.length || 0} checks`,
        details: complianceData || { error: complianceError?.message },
        executed_at: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        task_id: 'compliance',
        task_name: 'Verificaciones de Cumplimiento',
        success: false,
        duration_ms: 0,
        result_summary: `Error: ${(error as Error).message}`,
        details: { error: (error as Error).message },
        executed_at: new Date().toISOString()
      });
    }

    // Ejecutar mantenimiento general del sistema
    try {
      const systemStart = Date.now();
      const { data: systemData, error: systemError } = await supabase.rpc('audit_system_maintenance');
      
      results.push({
        task_id: 'system',
        task_name: 'Mantenimiento del Sistema',
        success: !systemError,
        duration_ms: Date.now() - systemStart,
        result_summary: systemError 
          ? `Error: ${systemError.message}`
          : 'Mantenimiento del sistema completado',
        details: { log: systemData || 'Sin detalles disponibles' },
        executed_at: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        task_id: 'system',
        task_name: 'Mantenimiento del Sistema',
        success: false,
        duration_ms: 0,
        result_summary: `Error: ${(error as Error).message}`,
        details: { error: (error as Error).message },
        executed_at: new Date().toISOString()
      });
    }

    const totalDuration = Date.now() - startTime;
    const successfulTasks = results.filter(r => r.success).length;
    const success = successfulTasks === results.length;

    return {
      success,
      summary: `Mantenimiento completado en ${(totalDuration / 1000).toFixed(1)}s: ${successfulTasks}/${results.length} tareas exitosas`,
      details: results
    };

  } catch (error) {
    console.error('Error in full system maintenance:', error);
    return {
      success: false,
      summary: `Error en mantenimiento: ${(error as Error).message}`,
      details: []
    };
  }
};

// Función para programar mantenimiento automático
export const scheduleAutomaticMaintenance = async (): Promise<boolean> => {
  try {
    if (isDemoMode) {
      console.log('Automatic maintenance scheduled (demo mode)');
      return true;
    }

    if (!supabase) {
      return false;
    }

    // Verificar si ya hay tareas programadas
    const { data: existingTasks, error } = await supabase
      .from('audit_maintenance_schedule')
      .select('id')
      .eq('is_active', true);

    if (error) {
      console.error('Error checking existing tasks:', error);
      return false;
    }

    // Si no hay tareas, crear las básicas
    if (!existingTasks || existingTasks.length === 0) {
      const defaultTasks = [
        {
          task_name: 'Limpieza Diaria Automática',
          task_type: 'cleanup',
          schedule_expression: '0 2 * * *', // Diario a las 2 AM
          next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        {
          task_name: 'Verificación de Integridad Semanal',
          task_type: 'integrity_check',
          schedule_expression: '0 3 * * 0', // Domingos a las 3 AM
          next_run_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          task_name: 'Verificaciones de Cumplimiento',
          task_type: 'compliance_check',
          schedule_expression: '0 1 * * *', // Diario a la 1 AM
          next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      const { error: insertError } = await supabase
        .from('audit_maintenance_schedule')
        .insert(defaultTasks);

      if (insertError) {
        console.error('Error creating default tasks:', insertError);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error scheduling automatic maintenance:', error);
    return false;
  }
};

// Función para obtener estadísticas de mantenimiento
export const getMaintenanceStatistics = async (): Promise<{
  total_tasks: number;
  active_tasks: number;
  last_execution: string | null;
  success_rate: number;
  average_duration_ms: number;
}> => {
  try {
    if (isDemoMode) {
      return {
        total_tasks: 4,
        active_tasks: 4,
        last_execution: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        success_rate: 100,
        average_duration_ms: 2500
      };
    }

    if (!supabase) {
      return {
        total_tasks: 0,
        active_tasks: 0,
        last_execution: null,
        success_rate: 0,
        average_duration_ms: 0
      };
    }

    const { data: tasks, error } = await supabase
      .from('audit_maintenance_schedule')
      .select('*');

    if (error) {
      console.error('Error loading maintenance statistics:', error);
      return {
        total_tasks: 0,
        active_tasks: 0,
        last_execution: null,
        success_rate: 0,
        average_duration_ms: 0
      };
    }

    const totalTasks = tasks?.length || 0;
    const activeTasks = tasks?.filter(task => task.is_active).length || 0;
    const lastExecution = tasks?.reduce((latest, task) => {
      if (!task.last_run_at) return latest;
      if (!latest) return task.last_run_at;
      return new Date(task.last_run_at) > new Date(latest) ? task.last_run_at : latest;
    }, null as string | null);

    // Calcular tasa de éxito (simplificado)
    const successRate = totalTasks > 0 ? 95 : 0; // Placeholder

    return {
      total_tasks: totalTasks,
      active_tasks: activeTasks,
      last_execution: lastExecution,
      success_rate: successRate,
      average_duration_ms: 2500 // Placeholder
    };

  } catch (error) {
    console.error('Error getting maintenance statistics:', error);
    return {
      total_tasks: 0,
      active_tasks: 0,
      last_execution: null,
      success_rate: 0,
      average_duration_ms: 0
    };
  }
};