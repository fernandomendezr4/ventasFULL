import { useState, useCallback } from 'react';

interface ConfirmationState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  loading: boolean;
}

export function useConfirmation() {
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    type: 'danger',
    onConfirm: () => {},
    loading: false
  });

  const showConfirmation = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      type?: 'danger' | 'warning' | 'info';
    }
  ) => {
    setConfirmation({
      isOpen: true,
      title,
      message,
      confirmText: options?.confirmText || 'Confirmar',
      cancelText: options?.cancelText || 'Cancelar',
      type: options?.type || 'danger',
      onConfirm,
      loading: false
    });
  }, []);

  const hideConfirmation = useCallback(() => {
    setConfirmation(prev => ({ ...prev, isOpen: false, loading: false }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setConfirmation(prev => ({ ...prev, loading }));
  }, []);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await confirmation.onConfirm();
      hideConfirmation();
    } catch (error) {
      setLoading(false);
      // El error se manejará en el componente que llama
    }
  }, [confirmation.onConfirm, hideConfirmation, setLoading]);

  return {
    confirmation,
    showConfirmation,
    hideConfirmation,
    handleConfirm,
    setLoading
  };
}