import React from 'react';
import { CheckCircle, AlertCircle, XCircle, Info, X } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  autoClose?: boolean;
  duration?: number;
}

export default function NotificationModal({
  isOpen,
  onClose,
  type,
  title,
  message,
  autoClose = true,
  duration = 3000
}: NotificationModalProps) {
  React.useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, duration, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-600" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-8 w-8 text-yellow-600" />;
      case 'info':
        return <Info className="h-8 w-8 text-blue-600" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-900',
          button: 'bg-green-600 hover:bg-green-700'
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-900',
          button: 'bg-red-600 hover:bg-red-700'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-900',
          button: 'bg-yellow-600 hover:bg-yellow-700'
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-900',
          button: 'bg-blue-600 hover:bg-blue-700'
        };
    }
  };

  const colors = getColors();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
      <div className={`bg-white rounded-xl shadow-xl max-w-md w-full mx-4 border-2 ${colors.border} animate-slideIn`}>
        <div className={`p-6 ${colors.bg} rounded-t-xl border-b ${colors.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {getIcon()}
              <h3 className={`text-lg font-semibold ml-3 ${colors.text}`}>
                {title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <p className="text-slate-700 text-base leading-relaxed">
            {message}
          </p>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className={`px-6 py-2 text-white rounded-lg transition-colors duration-200 font-medium ${colors.button}`}
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}