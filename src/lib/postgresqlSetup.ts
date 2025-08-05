// Utilidades para configuración de PostgreSQL en servidor local

export interface PostgreSQLSetupConfig {
  database_name: string;
  username: string;
  password: string;
  host: string;
  port: number;
  ssl_mode: 'disable' | 'require' | 'prefer';
  max_connections: number;
  shared_buffers_mb: number;
  effective_cache_size_mb: number;
}

export interface SetupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

// Validar configuración de PostgreSQL
export const validatePostgreSQLSetup = (config: PostgreSQLSetupConfig): SetupValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Validar nombre de base de datos
  if (!config.database_name || config.database_name.length < 3) {
    errors.push('El nombre de la base de datos debe tener al menos 3 caracteres');
  }

  if (!/^[a-z][a-z0-9_]*$/.test(config.database_name)) {
    errors.push('El nombre de la base de datos solo puede contener letras minúsculas, números y guiones bajos');
  }

  // Validar usuario
  if (!config.username || config.username.length < 3) {
    errors.push('El nombre de usuario debe tener al menos 3 caracteres');
  }

  if (config.username === 'postgres') {
    warnings.push('Se recomienda no usar el usuario "postgres" para la aplicación');
  }

  // Validar contraseña
  if (!config.password || config.password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }

  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(config.password)) {
    warnings.push('Se recomienda una contraseña con mayúsculas, minúsculas y números');
  }

  // Validar configuración de memoria
  if (config.shared_buffers_mb < 128) {
    warnings.push('shared_buffers muy bajo, se recomienda al menos 128MB');
  }

  if (config.shared_buffers_mb > config.effective_cache_size_mb) {
    warnings.push('shared_buffers no debería ser mayor que effective_cache_size');
  }

  // Recomendaciones generales
  recommendations.push('Configurar backups automáticos diarios');
  recommendations.push('Habilitar logging de consultas lentas');
  recommendations.push('Configurar monitoreo de rendimiento');
  recommendations.push('Implementar rotación de logs');

  if (config.ssl_mode === 'disable') {
    recommendations.push('Considerar habilitar SSL para mayor seguridad');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations
  };
};

// Generar script de instalación personalizado
export const generateCustomInstallScript = (config: PostgreSQLSetupConfig): string => {
  return `#!/bin/bash
# Script de instalación personalizado para VentasFULL
# Generado automáticamente

set -e  # Salir si hay errores

echo "=== Instalación de VentasFULL en Ubuntu Server ==="
echo "Base de datos: ${config.database_name}"
echo "Usuario: ${config.username}"
echo "Host: ${config.host}"
echo "Puerto: ${config.port}"
echo ""

# Verificar si se ejecuta como root
if [[ $EUID -eq 0 ]]; then
   echo "No ejecutar este script como root. Usar sudo cuando sea necesario."
   exit 1
fi

# Actualizar sistema
echo "Actualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar PostgreSQL
echo "Instalando PostgreSQL..."
sudo apt install postgresql postgresql-contrib postgresql-client -y

# Verificar instalación
if ! command -v psql &> /dev/null; then
    echo "Error: PostgreSQL no se instaló correctamente"
    exit 1
fi

# Iniciar y habilitar PostgreSQL
echo "Configurando servicios..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Esperar a que PostgreSQL esté listo
sleep 5

# Crear base de datos y usuario
echo "Configurando base de datos..."
sudo -u postgres psql << EOF
-- Crear base de datos
CREATE DATABASE ${config.database_name};

-- Crear usuario de aplicación
CREATE USER ${config.username} WITH PASSWORD '${config.password}';

-- Otorgar permisos básicos
GRANT ALL PRIVILEGES ON DATABASE ${config.database_name} TO ${config.username};

-- Configurar usuario como propietario
ALTER DATABASE ${config.database_name} OWNER TO ${config.username};

-- Salir
\\q
EOF

# Verificar que la base de datos se creó correctamente
if sudo -u postgres psql -lqt | cut -d \\| -f 1 | grep -qw ${config.database_name}; then
    echo "✅ Base de datos '${config.database_name}' creada exitosamente"
else
    echo "❌ Error al crear la base de datos"
    exit 1
fi

# Importar esquema y datos (si existe el archivo)
if [ -f "ventasfull_export.sql" ]; then
    echo "Importando esquema y datos..."
    sudo -u postgres psql ${config.database_name} < ventasfull_export.sql
    
    # Configurar permisos finales después de la importación
    sudo -u postgres psql ${config.database_name} << EOF
-- Otorgar permisos en todas las tablas
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${config.username};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${config.username};
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${config.username};

-- Configurar permisos por defecto para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${config.username};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${config.username};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${config.username};

\\q
EOF
    echo "✅ Datos importados exitosamente"
else
    echo "⚠️  Archivo ventasfull_export.sql no encontrado"
    echo "   Descarga el archivo de exportación desde la aplicación"
    echo "   y colócalo en el mismo directorio que este script"
fi

# Configurar PostgreSQL para la aplicación
echo "Optimizando configuración de PostgreSQL..."
sudo tee -a /etc/postgresql/*/main/postgresql.conf << EOF

# Configuración optimizada para VentasFULL
shared_buffers = ${config.shared_buffers_mb}MB
effective_cache_size = ${config.effective_cache_size_mb}MB
work_mem = 4MB
maintenance_work_mem = 64MB
wal_buffers = 16MB
checkpoint_completion_target = 0.9
max_connections = ${config.max_connections}

# Logging optimizado
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on

# Timezone para Colombia
timezone = 'America/Bogota'
log_timezone = 'America/Bogota'
EOF

# Configurar acceso (solo local por defecto)
if [ "${config.host}" != "localhost" ] && [ "${config.host}" != "127.0.0.1" ]; then
    echo "Configurando acceso remoto..."
    sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf
    
    # Agregar regla de acceso
    echo "host    ${config.database_name}    ${config.username}    0.0.0.0/0    md5" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf
    
    echo "⚠️  Configurado para acceso remoto. Asegúrate de configurar el firewall correctamente."
fi

# Reiniciar PostgreSQL para aplicar cambios
echo "Reiniciando PostgreSQL..."
sudo systemctl restart postgresql

# Verificar que PostgreSQL esté funcionando
if sudo systemctl is-active --quiet postgresql; then
    echo "✅ PostgreSQL está funcionando correctamente"
else
    echo "❌ Error: PostgreSQL no está funcionando"
    exit 1
fi

# Crear script de backup
echo "Configurando backup automático..."
sudo tee /usr/local/bin/backup_ventasfull.sh << 'EOF'
#!/bin/bash
# Backup automático de VentasFULL

BACKUP_DIR="/backup/ventasfull"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/ventasfull_backup_$DATE.sql"

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

# Realizar backup
pg_dump -U ${config.username} -h ${config.host} -p ${config.port} ${config.database_name} > $BACKUP_FILE

# Comprimir
gzip $BACKUP_FILE

# Eliminar backups antiguos (mantener 30 días)
find $BACKUP_DIR -name "ventasfull_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completado: $BACKUP_FILE.gz"
EOF

sudo chmod +x /usr/local/bin/backup_ventasfull.sh

# Configurar cron para backup diario
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup_ventasfull.sh >> /var/log/ventasfull_backup.log 2>&1") | crontab -

echo ""
echo "=== INSTALACIÓN COMPLETADA ==="
echo ""
echo "📊 Información de conexión:"
echo "   Host: ${config.host}"
echo "   Puerto: ${config.port}"
echo "   Base de datos: ${config.database_name}"
echo "   Usuario: ${config.username}"
echo "   Contraseña: [la que configuraste]"
echo ""
echo "🔧 Configuración aplicada:"
echo "   ✅ PostgreSQL instalado y configurado"
echo "   ✅ Base de datos creada"
echo "   ✅ Usuario de aplicación configurado"
echo "   ✅ Permisos otorgados"
echo "   ✅ Backup automático configurado (diario a las 2 AM)"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Configurar tu aplicación con los datos de conexión"
echo "   2. Probar la conexión desde tu aplicación"
echo "   3. Configurar firewall si es necesario"
echo "   4. Configurar SSL/TLS para mayor seguridad"
echo ""
echo "📋 Comandos útiles:"
echo "   - Conectar a la base de datos: psql -U ${config.username} -h ${config.host} -d ${config.database_name}"
echo "   - Ver estado de PostgreSQL: sudo systemctl status postgresql"
echo "   - Ver logs: sudo tail -f /var/log/postgresql/postgresql-*.log"
echo "   - Backup manual: /usr/local/bin/backup_ventasfull.sh"
echo ""
echo "🎉 ¡VentasFULL está listo para usar en tu servidor local!"
`;
};

// Función para generar configuración de conexión para diferentes frameworks
export const generateConnectionConfigs = (config: PostgreSQLSetupConfig) => {
  return {
    // Node.js con pg
    nodejs_pg: `// Configuración para Node.js con pg
const { Pool } = require('pg');

const pool = new Pool({
  user: '${config.username}',
  host: '${config.host}',
  database: '${config.database_name}',
  password: '${config.password}',
  port: ${config.port},
  ssl: ${config.ssl_mode !== 'disable'},
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;`,

    // Supabase local
    supabase_local: `// Configuración para Supabase local
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://${config.host}:8000'; // Puerto de Supabase local
const supabaseKey = 'tu-anon-key-local';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
});`,

    // Variables de entorno
    env_vars: `# Variables de entorno para VentasFULL
DATABASE_URL=postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database_name}
DB_HOST=${config.host}
DB_PORT=${config.port}
DB_NAME=${config.database_name}
DB_USER=${config.username}
DB_PASSWORD=${config.password}
DB_SSL=${config.ssl_mode !== 'disable' ? 'true' : 'false'}`,

    // Docker Compose
    docker_compose: `# docker-compose.yml para VentasFULL
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ${config.database_name}
      POSTGRES_USER: ${config.username}
      POSTGRES_PASSWORD: ${config.password}
    ports:
      - "${config.port}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./ventasfull_export.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped

  app:
    build: .
    environment:
      DATABASE_URL: postgresql://${config.username}:${config.password}@postgres:5432/${config.database_name}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:`
  };
};

// Función para generar script de monitoreo
export const generateMonitoringScript = (config: PostgreSQLSetupConfig): string => {
  return `#!/bin/bash
# Script de monitoreo para VentasFULL PostgreSQL
# Guardar como: /usr/local/bin/monitor_ventasfull.sh

DB_NAME="${config.database_name}"
DB_USER="${config.username}"
DB_HOST="${config.host}"
DB_PORT="${config.port}"

echo "=== Monitor de VentasFULL PostgreSQL ==="
echo "Fecha: $(date)"
echo ""

# Verificar estado del servicio
echo "📊 Estado del servicio PostgreSQL:"
if systemctl is-active --quiet postgresql; then
    echo "   ✅ PostgreSQL está ejecutándose"
else
    echo "   ❌ PostgreSQL no está ejecutándose"
    exit 1
fi

# Verificar conexión a la base de datos
echo ""
echo "🔗 Verificando conexión a la base de datos:"
if PGPASSWORD='${config.password}' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    echo "   ✅ Conexión exitosa a $DB_NAME"
else
    echo "   ❌ Error de conexión a $DB_NAME"
    exit 1
fi

# Estadísticas de la base de datos
echo ""
echo "📈 Estadísticas de la base de datos:"
PGPASSWORD='${config.password}' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC 
LIMIT 10;
"

# Tamaño de la base de datos
echo ""
echo "💾 Tamaño de la base de datos:"
PGPASSWORD='${config.password}' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    pg_database.datname as database_name,
    pg_size_pretty(pg_database_size(pg_database.datname)) as size
FROM pg_database 
WHERE datname = '$DB_NAME';
"

# Conexiones activas
echo ""
echo "👥 Conexiones activas:"
PGPASSWORD='${config.password}' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    count(*) as active_connections,
    state
FROM pg_stat_activity 
WHERE datname = '$DB_NAME'
GROUP BY state;
"

# Consultas lentas (si hay)
echo ""
echo "🐌 Consultas activas (>1 segundo):"
PGPASSWORD='${config.password}' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '1 second'
AND datname = '$DB_NAME'
AND state = 'active';
"

# Espacio en disco
echo ""
echo "💿 Espacio en disco:"
df -h /var/lib/postgresql

# Verificar backups recientes
echo ""
echo "💾 Backups recientes:"
if [ -d "/backup/ventasfull" ]; then
    ls -lah /backup/ventasfull/ | tail -5
else
    echo "   ⚠️  Directorio de backup no encontrado"
fi

echo ""
echo "=== Monitoreo completado ==="

# Agregar a crontab para ejecución cada hora:
# 0 * * * * /usr/local/bin/monitor_ventasfull.sh >> /var/log/ventasfull_monitor.log 2>&1
`;
};

// Función para generar script de mantenimiento
export const generateMaintenanceScript = (config: PostgreSQLSetupConfig): string => {
  return `#!/bin/bash
# Script de mantenimiento para VentasFULL PostgreSQL
# Ejecutar semanalmente para mantener rendimiento óptimo

DB_NAME="${config.database_name}"
DB_USER="${config.username}"
DB_HOST="${config.host}"
DB_PORT="${config.port}"

echo "=== Mantenimiento de VentasFULL PostgreSQL ==="
echo "Fecha: $(date)"
echo ""

# Función para ejecutar SQL
run_sql() {
    PGPASSWORD='${config.password}' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$1"
}

# Actualizar estadísticas de tablas
echo "📊 Actualizando estadísticas..."
run_sql "ANALYZE;"

# Limpiar tablas (vacuum)
echo "🧹 Limpiando tablas..."
run_sql "VACUUM ANALYZE;"

# Reindexar tablas críticas
echo "🔧 Reindexando tablas críticas..."
run_sql "REINDEX TABLE sales;"
run_sql "REINDEX TABLE products;"
run_sql "REINDEX TABLE cash_movements;"

# Limpiar logs antiguos de auditoría (mantener 90 días)
echo "🗑️  Limpiando logs antiguos..."
run_sql "DELETE FROM cash_register_audit_logs WHERE performed_at < NOW() - INTERVAL '90 days';"

# Limpiar sesiones expiradas
echo "🔐 Limpiando sesiones expiradas..."
run_sql "DELETE FROM employee_sessions WHERE expires_at < NOW();"

# Verificar integridad de datos
echo "🔍 Verificando integridad..."
run_sql "
SELECT 
    'products' as tabla,
    COUNT(*) as total_registros,
    COUNT(*) FILTER (WHERE stock < 0) as stock_negativo,
    COUNT(*) FILTER (WHERE sale_price <= 0) as precios_invalidos
FROM products
UNION ALL
SELECT 
    'sales' as tabla,
    COUNT(*) as total_registros,
    COUNT(*) FILTER (WHERE total_amount <= 0) as montos_invalidos,
    COUNT(*) FILTER (WHERE payment_status NOT IN ('pending', 'partial', 'paid')) as estados_invalidos
FROM sales;
"

# Estadísticas de rendimiento
echo ""
echo "⚡ Estadísticas de rendimiento:"
run_sql "
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;
"

echo ""
echo "=== Mantenimiento completado ==="
echo "Próximo mantenimiento recomendado: $(date -d '+1 week')"

# Agregar a crontab para ejecución semanal:
# 0 3 * * 0 /usr/local/bin/maintenance_ventasfull.sh >> /var/log/ventasfull_maintenance.log 2>&1
`;
};

// Función para validar requisitos del sistema
export const validateSystemRequirements = (): {
  isValid: boolean;
  requirements: Array<{
    name: string;
    status: 'ok' | 'warning' | 'error';
    message: string;
  }>;
} => {
  const requirements = [
    {
      name: 'Sistema Operativo',
      status: 'ok' as const,
      message: 'Ubuntu Server 20.04+ recomendado'
    },
    {
      name: 'RAM Mínima',
      status: 'warning' as const,
      message: '2GB RAM mínimo, 4GB recomendado'
    },
    {
      name: 'Espacio en Disco',
      status: 'ok' as const,
      message: '10GB mínimo para base de datos y backups'
    },
    {
      name: 'PostgreSQL',
      status: 'ok' as const,
      message: 'Versión 12+ recomendada'
    },
    {
      name: 'Conectividad',
      status: 'ok' as const,
      message: 'Puerto 5432 disponible'
    }
  ];

  const hasErrors = requirements.some(req => req.status === 'error');

  return {
    isValid: !hasErrors,
    requirements
  };
};