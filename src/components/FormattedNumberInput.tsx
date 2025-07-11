import React, { useState, useEffect } from 'react';
import { formatNumberInput, parseFormattedNumber } from '../lib/numberFormat';

interface FormattedNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
  disabled?: boolean;
}

export default function FormattedNumberInput({
  value,
  onChange,
  placeholder,
  className,
  required,
  min,
  max,
  step,
  disabled
}: FormattedNumberInputProps) {
  const [displayValue, setDisplayValue] = useState(() => 
    value ? formatNumberInput(value) : ''
  );

  // Sincronizar con el valor externo
  useEffect(() => {
    if (value !== parseFormattedNumber(displayValue).toString()) {
      setDisplayValue(value ? formatNumberInput(value) : '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Permitir campo vacío
    if (inputValue === '') {
      setDisplayValue('');
      onChange('');
      return;
    }
    
    // Formatear el valor
    const formatted = formatNumberInput(inputValue);
    setDisplayValue(formatted);
    
    // Enviar el valor numérico sin formato al componente padre
    const numericValue = parseFormattedNumber(formatted);
    onChange(numericValue.toString());
  };

  const handleBlur = () => {
    // Validar límites al perder el foco
    if (displayValue) {
      const numericValue = parseFormattedNumber(displayValue);
      
      if (min && numericValue < parseFloat(min)) {
        const minFormatted = formatNumberInput(min);
        setDisplayValue(minFormatted);
        onChange(min);
        return;
      }
      
      if (max && numericValue > parseFloat(max)) {
        const maxFormatted = formatNumberInput(max);
        setDisplayValue(maxFormatted);
        onChange(max);
        return;
      }
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      required={required}
      disabled={disabled}
      inputMode="decimal"
    />
  );
}