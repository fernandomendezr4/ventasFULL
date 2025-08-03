// Sistema de autenticación para empleados con contraseñas propias

import { supabase, isDemoMode } from './supabase';

export interface EmployeeAuthResult {
  success: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
  };
  session_token?: string;
  error?: string;
}

export interface EmployeeSessionData {
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  is_active: boolean;
}

// Función para crear hash de contraseña (simplificada para demo)
export const hashPassword = async (password: string): Promise<string> => {
  if (isDemoMode) {
    // En modo demo, usar hash simple
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'demo_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // En producción, usar una librería como bcrypt
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'secure_salt_' + Date.now());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Error al procesar la contraseña');
  }
};

// Función para verificar contraseña
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
};

// Autenticar empleado con email y contraseña
export const authenticateEmployee = async (
  email: string, 
  password: string
): Promise<EmployeeAuthResult> => {
  try {
    if (isDemoMode) {
      // Demo mode: simulate authentication
      const demoUsers = [
        {
          id: 'demo-user-1',
          name: 'Administrador Demo',
          email: 'admin@ventasfull.com',
          role: 'admin',
          is_active: true,
          password: 'admin123'
        },
        {
          id: 'demo-user-2',
          name: 'Gerente Demo',
          email: 'gerente@ventasfull.com',
          role: 'manager',
          is_active: true,
          password: 'gerente123'
        },
        {
          id: 'demo-user-3',
          name: 'Empleado Demo',
          email: 'empleado@ventasfull.com',
          role: 'employee',
          is_active: true,
          password: 'empleado123'
        }
      ];

      const demoUser = demoUsers.find(u => 
        u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (demoUser) {
        return {
          success: true,
          user: {
            id: demoUser.id,
            name: demoUser.name,
            email: demoUser.email,
            role: demoUser.role,
            is_active: demoUser.is_active
          },
          session_token: `demo_session_${Date.now()}`
        };
      } else {
        return {
          success: false,
          error: 'Credenciales inválidas'
        };
      }
    }

    if (!supabase) {
      return {
        success: false,
        error: 'Sistema de base de datos no disponible'
      };
    }

    // Usar función RPC para validar credenciales
    const { data, error } = await supabase.rpc('validate_employee_password', {
      p_email: email.toLowerCase(),
      p_password: await hashPassword(password)
    });

    if (error) {
      console.error('Error validating password:', error);
      return {
        success: false,
        error: 'Error en la validación de credenciales'
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Credenciales inválidas'
      };
    }

    const userData = data[0];

    // Crear sesión
    const { data: sessionToken, error: sessionError } = await supabase.rpc('create_employee_session', {
      p_user_id: userData.user_id,
      p_session_duration_hours: 8
    });

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return {
        success: false,
        error: 'Error al crear la sesión'
      };
    }

    return {
      success: true,
      user: {
        id: userData.user_id,
        name: userData.user_name,
        email: userData.user_email,
        role: userData.user_role,
        is_active: userData.is_active
      },
      session_token: sessionToken
    };

  } catch (error) {
    console.error('Error in employee authentication:', error);
    return {
      success: false,
      error: 'Error interno del sistema'
    };
  }
};

// Validar sesión de empleado
export const validateEmployeeSession = async (
  sessionToken: string
): Promise<EmployeeSessionData | null> => {
  try {
    if (isDemoMode) {
      // Demo mode: validate demo session
      if (sessionToken.startsWith('demo_session_')) {
        return {
          user_id: 'demo-user-1',
          user_name: 'Usuario Demo',
          user_email: 'demo@ventasfull.com',
          user_role: 'admin',
          is_active: true
        };
      }
      return null;
    }

    if (!supabase) return null;

    const { data, error } = await supabase.rpc('validate_employee_session', {
      p_session_token: sessionToken
    });

    if (error || !data || data.length === 0) {
      return null;
    }

    const sessionData = data[0];
    return {
      user_id: sessionData.user_id,
      user_name: sessionData.user_name,
      user_email: sessionData.user_email,
      user_role: sessionData.user_role,
      is_active: sessionData.is_active
    };

  } catch (error) {
    console.error('Error validating session:', error);
    return null;
  }
};

// Cerrar sesión de empleado
export const logoutEmployee = async (sessionToken: string): Promise<boolean> => {
  try {
    if (isDemoMode) {
      // Demo mode: always succeed
      return true;
    }

    if (!supabase) return false;

    const { data, error } = await supabase.rpc('revoke_employee_session', {
      p_session_token: sessionToken
    });

    if (error) {
      console.error('Error revoking session:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in logout:', error);
    return false;
  }
};

// Crear o actualizar contraseña de empleado
export const setEmployeePassword = async (
  userId: string,
  password: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (isDemoMode) {
      // Demo mode: simulate success
      return { success: true };
    }

    if (!supabase) {
      return { success: false, error: 'Sistema de base de datos no disponible' };
    }

    const passwordHash = await hashPassword(password);

    const { error } = await supabase
      .from('employee_passwords')
      .upsert({
        user_id: userId,
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error setting password:', error);
      return { success: false, error: 'Error al guardar la contraseña' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in setEmployeePassword:', error);
    return { success: false, error: 'Error interno del sistema' };
  }
};

// Revocar todas las sesiones de un usuario
export const revokeAllUserSessions = async (userId: string): Promise<boolean> => {
  try {
    if (isDemoMode) {
      return true;
    }

    if (!supabase) return false;

    const { error } = await supabase.rpc('revoke_all_user_sessions', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error revoking user sessions:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in revokeAllUserSessions:', error);
    return false;
  }
};

// Limpiar sesiones expiradas
export const cleanupExpiredSessions = async (): Promise<number> => {
  try {
    if (isDemoMode) {
      return 0;
    }

    if (!supabase) return 0;

    const { data, error } = await supabase.rpc('cleanup_expired_sessions');

    if (error) {
      console.error('Error cleaning up sessions:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('Error in cleanupExpiredSessions:', error);
    return 0;
  }
};

// Obtener sesiones activas de un usuario
export const getUserActiveSessions = async (userId: string) => {
  try {
    if (isDemoMode) {
      return [{
        id: 'demo-session-1',
        session_token: 'demo_session_token',
        created_at: new Date().toISOString(),
        last_accessed: new Date().toISOString(),
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
      }];
    }

    if (!supabase) return [];

    const { data, error } = await supabase
      .from('employee_sessions')
      .select('id, session_token, created_at, last_accessed, expires_at')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('last_accessed', { ascending: false });

    if (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserActiveSessions:', error);
    return [];
  }
};

// Validar fortaleza de contraseña
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 6) {
    feedback.push('La contraseña debe tener al menos 6 caracteres');
  } else if (password.length >= 8) {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('Debe incluir al menos una letra minúscula');
  } else {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('Debe incluir al menos una letra mayúscula');
  } else {
    score += 1;
  }

  if (!/\d/.test(password)) {
    feedback.push('Debe incluir al menos un número');
  } else {
    score += 1;
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push('Se recomienda incluir símbolos especiales');
  } else {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  const isValid = password.length >= 6 && 
                  /[a-z]/.test(password) && 
                  /[A-Z]/.test(password) && 
                  /\d/.test(password);

  return {
    isValid,
    score: Math.min(score, 5),
    feedback
  };
};

// Generar contraseña segura
export const generateSecurePassword = (length: number = 12): string => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // Asegurar al menos un carácter de cada tipo
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Completar con caracteres aleatorios
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Mezclar los caracteres
  return password.split('').sort(() => Math.random() - 0.5).join('');
};