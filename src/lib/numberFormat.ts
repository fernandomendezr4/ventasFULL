// Utilidades para formateo de números con separadores colombianos

export const formatNumberInput = (value: string): string => {
  // Remover todos los caracteres que no sean números o punto decimal
  const cleanValue = value.replace(/[^\d.]/g, '');
  
  // Dividir en parte entera y decimal
  const parts = cleanValue.split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Formatear la parte entera con separadores de miles (apostrofe)
  if (integerPart.length > 3) {
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }
  
  // Reconstruir el número
  if (decimalPart !== undefined) {
    return `${integerPart}.${decimalPart}`;
  }
  
  return integerPart;
};

export const parseFormattedNumber = (formattedValue: string): number => {
  // Remover separadores de miles y convertir a número
  const cleanValue = formattedValue.replace(/'/g, '');
  return parseFloat(cleanValue) || 0;
};

export const formatNumberDisplay = (value: number): string => {
  // Formatear número para mostrar con separadores colombianos
  const parts = value.toString().split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Agregar separadores de miles
  if (integerPart.length > 3) {
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }
  
  // Reconstruir con decimales si existen
  if (decimalPart) {
    return `${integerPart}.${decimalPart}`;
  }
  
  return integerPart;
};

// Hook personalizado para campos numéricos con formateo
export const useFormattedNumberInput = (initialValue: string = '') => {
  const [displayValue, setDisplayValue] = React.useState(() => 
    initialValue ? formatNumberInput(initialValue) : ''
  );
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatted = formatNumberInput(inputValue);
    setDisplayValue(formatted);
  };
  
  const getValue = (): number => {
    return parseFormattedNumber(displayValue);
  };
  
  const setValue = (value: string | number) => {
    const stringValue = typeof value === 'number' ? value.toString() : value;
    setDisplayValue(formatNumberInput(stringValue));
  };
  
  return {
    displayValue,
    handleChange,
    getValue,
    setValue
  };
};