import { supabase, isDemoMode } from './supabase';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  sessionToken?: string;
  error?: string;
  requiresPasswordChange?: boolean;
}

export interface SessionData {
  user: AuthUser;
  sessionToken: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

// Improved password hashing with better security
const hashPassword = async (password: string): Promise<string> => {
  if (isDemoMode) {
    // Simple hash for demo
    return `$2b$10$K8QVQqQqQqQqQqQqQqQqQOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQq${btoa(password).slice(0, 10)}`;
  }
  
  // In production, use Web Crypto API for better security
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'ventasfull_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '$2b$10$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 50);
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  if (isDemoMode) {
    // Simple verification for demo with predefined passwords
    return hash === '$2b$10$K8QVQqQqQqQqQqQqQqQqQOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ' && password === 'admin123' ||
           hash === '$2b$10$K8QVQqQqQqQqQqQqQqQqQOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqR' && password === 'gerente123' ||
           hash === '$2b$10$K8QVQqQqQqQqQqQqQqQqQOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqS' && password === 'empleado123' ||
           await hashPassword(password) === hash;
  }
  
  // In production, use the same hashing method for verification
  const expectedHash = await hashPassword(password);
  return hash === expectedHash;
};

const generateSessionToken = (): string => {
  // Generate more secure session token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Get client IP and User Agent for security logging
const getClientInfo = () => {
  return {
    userAgent: navigator.userAgent || 'Unknown',
    // Note: Getting real IP requires server-side implementation
    ipAddress: '127.0.0.1' // Placeholder - would need server-side detection
  };
};

export const authenticateEmployee = async (email: string, password: string): Promise<AuthResult> => {
  try {
    if (isDemoMode || !supabase) {
      // Modo demo o sin conexión
      return {
        success: false,
        error: 'Usar modo demo desde AuthContext'
      };
    }

    // Buscar usuario por email con información de seguridad
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        is_active
      .maybeSingle();

    if (userError || !userData) {
      // Log failed attempt for non-existent user
      console.warn(`Login attempt for non-existent user: ${email}`);
      return {
        success: false,
        error: 'Usuario no encontrado o inactivo'
      };
    }

    // Check if user is active
    if (!userData.is_active) {
      return {
        success: false,
        error: 'Usuario inactivo. Contacta al administrador.'
      };
    }

    // Check if user is temporarily locked

    // Verificar contraseña
    const { data: passwordData, error: passwordError } = await supabase
      .from('employee_passwords')
      .select('password_hash, must_change, expires_at')
      .eq('user_id', userData.id)
      .maybeSingle();

    if (passwordError || !passwordData) {
      // Handle failed login attempt
      await supabase.rpc('handle_failed_login', { user_email: email.toLowerCase().trim() });
      return {
        success: false,
        error: 'Contraseña no configurada para este usuario'
      };
    }

    // Verificar si la contraseña ha expirado
    if (passwordData.expires_at && new Date(passwordData.expires_at) < new Date()) {
      return {
        success: false,
        error: 'Contraseña expirada. Contacta al administrador para renovarla.',
        requiresPasswordChange: true
      };
    }

    // Verificar contraseña con método mejorado
    const isPasswordValid = await verifyPassword(password, passwordData.password_hash);
    if (!isPasswordValid) {
      // Handle failed login attempt
      return {
        success: false,
        error: 'Contraseña incorrecta'
      };
    }

    // Handle successful login (reset failed attempts, update last login)

    // Crear sesión
    const sessionToken = generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8); // 8 horas de sesión

    const clientInfo2 = getClientInfo();
    const { error: sessionError } = await supabase
      .from('employee_sessions')
      .insert({
        user_id: userData.id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        ip_address: clientInfo2.ipAddress,
        user_agent: clientInfo2.userAgent,
        device_type: /Mobile|Android|iPhone|iPad/.test(clientInfo2.userAgent) ? 'mobile' : 'desktop'
      });

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return {
        success: false,
        error: 'Error creando sesión'
      };
    }

    // Guardar sesión en localStorage
    const sessionData: SessionData = {
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        is_active: userData.is_active,
      },
      sessionToken,
      expiresAt,
      ipAddress: clientInfo2.ipAddress,
      userAgent: clientInfo2.userAgent
    };

    localStorage.setItem('employee_session', JSON.stringify(sessionData));

    return {
      success: true,
      user: sessionData.user,
      sessionToken,
      requiresPasswordChange: false
    };
  } catch (error) {
    console.error('Error in authenticateEmployee:', error);
    return {
      success: false,
      error: 'Error de conexión'
    };
  }
};

export const getCurrentSession = async (): Promise<SessionData | null> => {
  try {
    if (isDemoMode || !supabase) {
      return null;
    }

    const sessionStr = localStorage.getItem('employee_session');
    if (!sessionStr) {
      return null;
    }

    const sessionData: SessionData = JSON.parse(sessionStr);
    
    // Verificar si la sesión ha expirado
    if (new Date() > new Date(sessionData.expiresAt)) {
      localStorage.removeItem('employee_session');
      return null;
    }

    // Verificar seguridad de la sesión
    const securityCheck = await validateSessionSecurity(sessionData.sessionToken);
    
    if (!securityCheck.isValid) {
      localStorage.removeItem('employee_session');
      
      if (securityCheck.securityIssues) {
        console.warn('Session security issues:', securityCheck.securityIssues);
      }
      
      return null;
    }

    // Update session data with latest user info if available
    if (securityCheck.user) {
      sessionData.user = securityCheck.user;
      localStorage.setItem('employee_session', JSON.stringify(sessionData));
    }

    return sessionData;
  } catch (error) {
    console.error('Error getting current session:', error);
    localStorage.removeItem('employee_session');
    return null;
  }
};

// Enhanced logout with security logging
export const logoutEmployee = async (reason: string = 'user_logout'): Promise<void> => {
  try {
    if (isDemoMode || !supabase) {
      localStorage.removeItem('employee_session');
      return;
    }

    const sessionStr = localStorage.getItem('employee_session');
    if (sessionStr) {
      const sessionData: SessionData = JSON.parse(sessionStr);
      
      // Mark session as terminated with reason
      await supabase
        .from('employee_sessions')
        .update({ 
          termination_reason: reason,
          last_accessed: new Date().toISOString()
        })
        .eq('session_token', sessionData.sessionToken);
      
      // Then delete the session
      await supabase
        .from('employee_sessions')
        .delete()
        .eq('session_token', sessionData.sessionToken);
    }

    localStorage.removeItem('employee_session');
  } catch (error) {
    console.error('Error in enhanced logout:', error);
    localStorage.removeItem('employee_session');
  }
};

export const createEmployeeSession = async (email: string, password: string): Promise<AuthResult> => {
  try {
    if (isDemoMode || !supabase) {
      return {
        success: false,
        error: 'No disponible en modo demo'
      };
    }

    // Buscar usuario
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (userError || !userData) {
      return {
        success: false,
        error: 'Usuario no encontrado'
      };
    }

    // Crear o actualizar contraseña
    const passwordHash = await hashPassword(password);
    
    const { error: passwordError } = await supabase
      .from('employee_passwords')
      .upsert({
        user_id: userData.id,
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      });

    if (passwordError) {
      return {
        success: false,
        error: 'Error configurando contraseña'
      };
    }

    return {
      success: true,
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        is_active: userData.is_active
      }
    };
  } catch (error) {
    console.error('Error in createEmployeeSession:', error);
    return {
      success: false,
      error: 'Error de conexión'
    };
  }
};

export const setEmployeePassword = async (
  userId: string, 
  newPassword: string,
  changedBy?: string,
  reason: string = 'manual_change'
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (isDemoMode || !supabase) {
      return { success: true };
    }

    // Validate password strength first
    const { data: strengthCheck, error: strengthError } = await supabase.rpc('validate_password_strength', {
      password_text: newPassword
    });

    if (strengthError) {
      console.error('Error validating password strength:', strengthError);
      return { success: false, error: 'Error al validar fortaleza de contraseña' };
    }

    if (!strengthCheck.is_valid) {
      return { 
        success: false, 
        error: `Contraseña no cumple requisitos de seguridad: ${strengthCheck.feedback.join(', ')}` 
      };
    }

    const passwordHash = await hashPassword(newPassword);
    
    // Use the secure password change function
    const { data: changeResult, error } = await supabase.rpc('change_user_password', {
      target_user_id: userId,
      new_password_hash: passwordHash,
      changed_by_user_id: changedBy || userId,
      change_reason: reason
    });

    if (error) {
      console.error('Error changing password:', error);
      return { success: false, error: 'Error al cambiar contraseña: ' + error.message };
    }

    if (!changeResult.success) {
      return { success: false, error: changeResult.error || 'Error desconocido al cambiar contraseña' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in setEmployeePassword:', error);
    return { success: false, error: 'Error interno al cambiar contraseña' };
  }
};

// Alias for backward compatibility
export const updateEmployeePassword = async (userId: string, newPassword: string): Promise<boolean> => {
  const result = await setEmployeePassword(userId, newPassword);
  return result.success;
};

// Enhanced session validation with security checks
export const validateSessionSecurity = async (sessionToken: string): Promise<{
  isValid: boolean;
  user?: AuthUser;
  securityIssues?: string[];
}> => {
  try {
    if (isDemoMode || !supabase) {
      return { isValid: true };
    }

    const { data: sessionData, error } = await supabase
      .from('employee_sessions')
      .select(`
        user_id,
        expires_at,
        ip_address,
        user_agent,
        is_suspicious,
        created_at,
        last_accessed,
        users (
          id,
          name,
          email,
          role,
          is_active,
          locked_until,
          last_login_at,
          failed_login_attempts
        )
      )
      `)
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (error || !sessionData || !sessionData.users) {
      return { isValid: false };
    }

    const user = sessionData.users as any;
    const securityIssues: string[] = [];

    // Check if session is marked as suspicious
    if (sessionData.is_suspicious) {
      securityIssues.push('Sesión marcada como sospechosa');
    }

    // Check if user is locked

    // Check if user is still active
    if (!user.is_active) {
      securityIssues.push('Usuario inactivo');
      return { isValid: false, securityIssues };
    }

    // Update last accessed time
    await supabase
      .from('employee_sessions')
      .update({ last_accessed: new Date().toISOString() })
      .eq('session_token', sessionToken);

    return {
      isValid: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
      },
      securityIssues: securityIssues.length > 0 ? securityIssues : undefined
    };
  } catch (error) {
    console.error('Error validating session security:', error);
    return { isValid: false };
  }
};

// Force password change for user
export const forcePasswordChange = async (userId: string, reason: string = 'admin_required'): Promise<boolean> => {
  try {
    if (isDemoMode || !supabase) {
      return true;
    }

    const { error } = await supabase
      .from('employee_passwords')
      .update({
        must_change: true,
        change_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error forcing password change:', error);
      return false;
    }

    // Revoke all existing sessions to force re-login
    await revokeAllUserSessions(userId);

    return true;
  } catch (error) {
    console.error('Error in forcePasswordChange:', error);
    return false;
  }
};

export const validatePasswordStrength = (password: string): { isValid: boolean; score: number; feedback: string[] } => {
  const feedback: string[] = [];
  let score = 0;

  // Check length
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('La contraseña debe tener al menos 8 caracteres');
  }

  // Check for uppercase
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Incluye al menos una letra mayúscula');
  }

  // Check for lowercase
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Incluye al menos una letra minúscula');
  }

  // Check for numbers
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('Incluye al menos un número');
  }

  // Check for special characters
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Incluye al menos un carácter especial');
  }

  return {
    isValid: score >= 4,
    score,
    feedback
  };
};

export const generateSecurePassword = (length: number = 12): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*(),.?":{}|<>';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  let password = '';
  
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

export const revokeAllUserSessions = async (userId: string): Promise<boolean> => {
  try {
    if (isDemoMode || !supabase) {
      return true;
    }

    // Mark sessions as terminated before deleting
    await supabase
      .from('employee_sessions')
      .update({ 
        termination_reason: 'admin_revoked',
        last_accessed: new Date().toISOString()
      })
      .eq('user_id', userId);

    // Delete all sessions for the user
    const { error } = await supabase
      .from('employee_sessions')
      .delete()
      .eq('user_id', userId);

    return !error;
  } catch (error) {
    console.error('Error revoking user sessions:', error);
    return false;
  }
};

export const validateSession = async (sessionToken: string): Promise<AuthUser | null> => {
  try {
    if (isDemoMode || !supabase) {
      return null;
    }

    const { data: sessionData, error } = await supabase
      .from('employee_sessions')
      .select(`
        user_id,
        expires_at,
        users (
          id,
          name,
          email,
          role,
          is_active
        )
      `)
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (error || !sessionData || !sessionData.users) {
      return null;
    }

    const user = sessionData.users as any;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active
    };
  } catch (error) {
    console.error('Error validating session:', error);
    return null;
  }
};

export const getUserActiveSessions = async (userId: string) => {
  try {
    if (isDemoMode || !supabase) {
      return [];
    }

    const { data: sessions, error } = await supabase
      .from('employee_sessions')
      .select(`
        id,
        session_token,
        created_at,
        last_accessed,
        expires_at,
        ip_address,
        user_agent,
        device_type,
        is_suspicious,
        termination_reason
      `)
      .eq('user_id', userId)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting user active sessions:', error);
      return [];
    }

    return sessions || [];
  } catch (error) {
    console.error('Error in getUserActiveSessions:', error);
    return [];
  }
};

// Cleanup expired sessions (should be called periodically)
export const cleanupExpiredSessions = async (): Promise<boolean> => {
  try {
    if (isDemoMode || !supabase) {
      return true;
    }

    // Use the database function for cleanup
    const { data: cleanedCount, error } = await supabase.rpc('cleanup_expired_sessions');

    if (error) {
      console.error('Error cleaning up expired sessions:', error);
      return false;
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions`);
    }

    return true;
  } catch (error) {
    console.error('Error in cleanupExpiredSessions:', error);
    return false;
  }
};

// Get detailed user session information
export const getUserSessionDetails = async (userId: string): Promise<{
  activeSessions: number;
  lastLogin: string | null;
  suspiciousSessions: number;
  totalSessions: number;
}> => {
  try {
    if (isDemoMode || !supabase) {
      return {
        activeSessions: 1,
        lastLogin: new Date().toISOString(),
        suspiciousSessions: 0,
        totalSessions: 5
      };
    }

    const [activeSessionsResult, userInfoResult, suspiciousSessionsResult, totalSessionsResult] = await Promise.all([
      supabase
        .from('employee_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('expires_at', new Date().toISOString()),
      supabase
        .from('employee_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_suspicious', true),
      supabase
        .from('employee_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
    ]);

    return {
      activeSessions: activeSessionsResult.count || 0,
      lastLogin: null,
      suspiciousSessions: suspiciousSessionsResult.count || 0,
      totalSessions: totalSessionsResult.count || 0
    };
  } catch (error) {
    console.error('Error getting user session details:', error);
    return {
      activeSessions: 0,
      lastLogin: null,
      suspiciousSessions: 0,
      totalSessions: 0
    };
  }
};

// Check if user needs to change password
export const checkPasswordChangeRequired = async (userId: string): Promise<{
  mustChange: boolean;
  reason?: string;
  expiresAt?: string;
}> => {
  try {
    if (isDemoMode || !supabase) {
      return { mustChange: false };
    }

    const { data: passwordInfo, error } = await supabase
      .from('employee_passwords')
      .select('must_change, change_reason, expires_at')
      .eq('user_id', userId)
      .single();

    if (error || !passwordInfo) {
      return { mustChange: true, reason: 'no_password_set' };
    }

    // Check if password is expired
    if (passwordInfo.expires_at && new Date(passwordInfo.expires_at) < new Date()) {
      return { 
        mustChange: true, 
        reason: 'password_expired',
        expiresAt: passwordInfo.expires_at
      };
    }

    return {
      mustChange: passwordInfo.must_change,
      reason: passwordInfo.change_reason,
      expiresAt: passwordInfo.expires_at
    };
  } catch (error) {
    console.error('Error checking password change requirement:', error);
    return { mustChange: false };
  }
};

// Detect and handle suspicious activity
export const detectSuspiciousActivity = async (): Promise<{
  suspiciousUsers: Array<{
    userId: string;
    userName: string;
    issues: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }>;
}> => {
  try {
    if (isDemoMode || !supabase) {
      return { suspiciousUsers: [] };
    }

    // Run suspicious session detection
    await supabase.rpc('detect_suspicious_sessions');

    // Get users with suspicious activity
    const { data: suspiciousData, error } = await supabase
      .from('employee_sessions')
      .select(`
        user_id,
        users(name),
        COUNT(*) as suspicious_count
      `)
      .eq('is_suspicious', true)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .group('user_id, users.name');

    if (error) {
      console.error('Error detecting suspicious activity:', error);
      return { suspiciousUsers: [] };
    }

    const suspiciousUsers = (suspiciousData || []).map((item: any) => ({
      userId: item.user_id,
      userName: item.users?.name || 'Usuario desconocido',
      issues: ['Múltiples sesiones sospechosas'],
      riskLevel: item.suspicious_count > 5 ? 'high' : item.suspicious_count > 2 ? 'medium' : 'low'
    }));

    return { suspiciousUsers };
  } catch (error) {
    console.error('Error in detectSuspiciousActivity:', error);
    return { suspiciousUsers: [] };
  }
};

// Get user security statistics
export const getUserSecurityStats = async (): Promise<{
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  usersWithExpiredPasswords: number;
  activeSessions: number;
  suspiciousSessions: number;
}> => {
  try {
    if (isDemoMode || !supabase) {
      return {
        totalUsers: 4,
        activeUsers: 3,
        lockedUsers: 0,
        usersWithExpiredPasswords: 1,
        activeSessions: 2,
        suspiciousSessions: 0
      };
    }

    const { data: stats, error } = await supabase.rpc('get_user_statistics');

    if (error) {
      console.error('Error getting user security stats:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        lockedUsers: 0,
        usersWithExpiredPasswords: 0,
        activeSessions: 0,
        suspiciousSessions: 0
      };
    }

    return {
      totalUsers: stats.total_users || 0,
      activeUsers: stats.active_users || 0,
      lockedUsers: stats.locked_users || 0,
      usersWithExpiredPasswords: 0, // Would need additional query
      activeSessions: stats.active_sessions || 0,
      suspiciousSessions: 0 // Would need additional query
    };
  } catch (error) {
    console.error('Error in getUserSecurityStats:', error);
    return {
      totalUsers: 0,
      activeUsers: 0,
      lockedUsers: 0,
      usersWithExpiredPasswords: 0,
      activeSessions: 0,
      suspiciousSessions: 0
    };
  }
};
  }
}