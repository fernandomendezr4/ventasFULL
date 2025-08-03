import React from 'react';
import { Shield, Check, X, AlertTriangle } from 'lucide-react';
import { validatePasswordStrength } from '../lib/employeeAuth';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export default function PasswordStrengthIndicator({ 
  password, 
  className = '' 
}: PasswordStrengthIndicatorProps) {
  const { isValid, score, feedback } = validatePasswordStrength(password);

  if (!password) return null;

  const getStrengthColor = (score: number) => {
    if (score <= 1) return 'bg-red-500';
    if (score <= 2) return 'bg-orange-500';
    if (score <= 3) return 'bg-yellow-500';
    if (score <= 4) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStrengthText = (score: number) => {
    if (score <= 1) return 'Muy débil';
    if (score <= 2) return 'Débil';
    if (score <= 3) return 'Regular';
    if (score <= 4) return 'Fuerte';
    return 'Muy fuerte';
  };

  const getStrengthTextColor = (score: number) => {
    if (score <= 1) return 'text-red-600';
    if (score <= 2) return 'text-orange-600';
    if (score <= 3) return 'text-yellow-600';
    if (score <= 4) return 'text-blue-600';
    return 'text-green-600';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Strength Bar */}
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-slate-500" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-600">Fortaleza:</span>
            <span className={`text-xs font-medium ${getStrengthTextColor(score)}`}>
              {getStrengthText(score)}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(score)}`}
              style={{ width: `${(score / 5) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Validation Feedback */}
      {feedback.length > 0 && (
        <div className="space-y-1">
          {feedback.map((message, index) => (
            <div key={index} className="flex items-center text-xs">
              <X className="h-3 w-3 text-red-500 mr-1 flex-shrink-0" />
              <span className="text-red-600">{message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Success Indicators */}
      {isValid && (
        <div className="flex items-center text-xs text-green-600">
          <Check className="h-3 w-3 mr-1" />
          <span>Contraseña válida</span>
        </div>
      )}

      {/* Security Tips */}
      {score < 4 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <div className="flex items-start">
            <AlertTriangle className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800">
              <p className="font-medium mb-1">Consejos para una contraseña más segura:</p>
              <ul className="space-y-0.5">
                <li>• Usa al menos 8 caracteres</li>
                <li>• Combina mayúsculas, minúsculas, números y símbolos</li>
                <li>• Evita palabras comunes o información personal</li>
                <li>• Considera usar una frase de contraseña</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}