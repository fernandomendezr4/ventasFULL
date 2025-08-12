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
}

export interface SessionData {
  user: AuthUser;
  sessionToken: string;
  expiresAt: Date;
}

// Simple password hashing for demo purposes (in production, use proper bcrypt)
const hashPassword = (password: string): string => {
  // This is a simple hash for demo - in production use proper bcrypt
  return `$2b$10$K8QVQqQqQqQqQqQqQqQqQOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQq${btoa(password).slice(0, 10)}`;
};

const verifyPassword = (password: string, hash: string): boolean => {
  // Simple verification for demo
  const expectedHash = hashPassword(password);
  return hash === expectedHash || 
         hash === '$2b$10$K8QVQqQqQqQqQqQqQqQqQOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ' && password === 'admin123' ||
         hash === '$2b$10$K8QVQqQqQqQqQqQqQqQqQOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqR' && password === 'gerente123' ||
         hash === '$2b$10$K8QVQqQqQqQqQqQqQqQqQOzJqQqQqQqQqQqQqQqQqQqQqQqQqQqQqS' && password === 'empleado123';
};

const generateSessionToken = (): string => {
  return btoa(Math.random().toString(36).substring(2) + Date.now().toString(36));
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

    // Buscar usuario por email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .maybeSingle();

    if (userError || !userData) {
      return {
        success: false,
        error: 'Usuario no encontrado o inactivo'
      };
    }

    // Verificar contraseña
    const { data: passwordData, error: passwordError } = await supabase
      .from('employee_passwords')
      .select('password_hash')
      .eq('user_id', userData.id)
      .maybeSingle();

    if (passwordError || !passwordData) {
      return {
        success: false,
        error: 'Contraseña no configurada para este usuario'
      };
    }

    // Verificar contraseña
    if (!verifyPassword(password, passwordData.password_hash)) {
      return {
        success: false,
        error: 'Contraseña incorrecta'
      };
    }

    // Crear sesión
    const sessionToken = generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8); // 8 horas de sesión

    const { error: sessionError } = await supabase
      .from('employee_sessions')
      .insert({
        user_id: userData.id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString()
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
        is_active: userData.is_active
      },
      sessionToken,
      expiresAt
    };

    localStorage.setItem('employee_session', JSON.stringify(sessionData));

    return {
      success: true,
      user: sessionData.user,
      sessionToken
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

    // Verificar que la sesión sigue siendo válida en la base de datos
    const { data: sessionExists, error } = await supabase
      .from('employee_sessions')
      .select('id')
      .eq('session_token', sessionData.sessionToken)
      .eq('user_id', sessionData.user.id)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (error || !sessionExists) {
      localStorage.removeItem('employee_session');
      return null;
    }

    // Actualizar último acceso
    await supabase
      .from('employee_sessions')
      .update({ last_accessed: new Date().toISOString() })
      .eq('session_token', sessionData.sessionToken);

    return sessionData;
  } catch (error) {
    console.error('Error getting current session:', error);
    localStorage.removeItem('employee_session');
    return null;
  }
};

export const logoutEmployee = async (): Promise<void> => {
  try {
    if (isDemoMode || !supabase) {
      localStorage.removeItem('employee_session');
      return;
    }

    const sessionStr = localStorage.getItem('employee_session');
    if (sessionStr) {
      const sessionData: SessionData = JSON.parse(sessionStr);
      
      // Eliminar sesión de la base de datos
      await supabase
        .from('employee_sessions')
        .delete()
        .eq('session_token', sessionData.sessionToken);
    }

    localStorage.removeItem('employee_session');
  } catch (error) {
    console.error('Error in logoutEmployee:', error);
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
    const passwordHash = hashPassword(password);
    
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

export const updateEmployeePassword = async (userId: string, newPassword: string): Promise<boolean> => {
  try {
    if (isDemoMode || !supabase) {
      return false;
    }

    const passwordHash = hashPassword(newPassword);
    
    const { error } = await supabase
      .from('employee_passwords')
      .upsert({
        user_id: userId,
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      });

    return !error;
  } catch (error) {
    console.error('Error updating employee password:', error);
    return false;
  }
};

// Alias for updateEmployeePassword to match import expectations
export const setEmployeePassword = updateEmployeePassword;

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
      return false;
    }

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
      .select('*')
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

export const cleanupExpiredSessions = async (): Promise<boolean> => {
  try {
    if (isDemoMode || !supabase) {
      return false;
    }

    const { error } = await supabase
      .from('employee_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());

    return !error;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    return false;
  }
};