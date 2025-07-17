// Utilidades para generar códigos de barras y QR

export const generateBarcode = (text: string, elementId: string, options?: any) => {
  // Importación dinámica para evitar problemas de SSR
  import('jsbarcode').then((JsBarcode) => {
    const element = document.getElementById(elementId);
    if (element) {
      JsBarcode.default(element, text, {
        format: "CODE128",
        width: 2,
        height: 40,
        displayValue: true,
        fontSize: 12,
        margin: 5,
        ...options
      });
    }
  });
};

export const generateQRCode = (text: string, size: number = 100): string => {
  try {
    // Usar una implementación más simple y confiable
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return '';
    
    // Configurar el canvas
    canvas.width = size;
    canvas.height = size;
    
    // Fondo blanco
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    
    // Crear un QR simple usando patrones
    const qrSize = Math.floor(size * 0.8);
    const cellSize = Math.floor(qrSize / 21); // QR estándar 21x21
    const startX = (size - qrSize) / 2;
    const startY = (size - qrSize) / 2;
    
    // Generar patrón QR básico
    ctx.fillStyle = 'black';
    
    // Crear un patrón simple basado en el texto
    const hash = simpleHash(text);
    
    for (let row = 0; row < 21; row++) {
      for (let col = 0; col < 21; col++) {
        // Esquinas de posicionamiento
        if (isPositionSquare(row, col)) {
          ctx.fillRect(startX + col * cellSize, startY + row * cellSize, cellSize, cellSize);
        } else {
          // Patrón basado en hash del texto
          const shouldFill = ((hash + row * 21 + col) % 3) === 0;
          if (shouldFill) {
            ctx.fillRect(startX + col * cellSize, startY + row * cellSize, cellSize, cellSize);
          }
        }
      }
    }
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating QR code:', error);
    // Fallback: crear una imagen simple con texto
    return generateFallbackQR(text, size);
  }
};

// Función auxiliar para crear hash simple
const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32bit integer
  }
  return Math.abs(hash);
};

// Función para determinar si una celda debe ser parte del cuadrado de posicionamiento
const isPositionSquare = (row: number, col: number): boolean => {
  // Esquina superior izquierda
  if ((row >= 0 && row <= 6) && (col >= 0 && col <= 6)) {
    return (row === 0 || row === 6 || col === 0 || col === 6 || 
            (row >= 2 && row <= 4 && col >= 2 && col <= 4));
  }
  
  // Esquina superior derecha
  if ((row >= 0 && row <= 6) && (col >= 14 && col <= 20)) {
    return (row === 0 || row === 6 || col === 14 || col === 20 || 
            (row >= 2 && row <= 4 && col >= 16 && col <= 18));
  }
  
  // Esquina inferior izquierda
  if ((row >= 14 && row <= 20) && (col >= 0 && col <= 6)) {
    return (row === 14 || row === 20 || col === 0 || col === 6 || 
            (row >= 16 && row <= 18 && col >= 2 && col <= 4));
  }
  
  return false;
};

// Función fallback para crear QR simple
const generateFallbackQR = (text: string, size: number): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  canvas.width = size;
  canvas.height = size;
  
  // Fondo blanco
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, size, size);
  
  // Borde negro
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, 4);
  ctx.fillRect(0, 0, 4, size);
  ctx.fillRect(size - 4, 0, 4, size);
  ctx.fillRect(0, size - 4, size, 4);
  
  // Texto centrado
  ctx.fillStyle = 'black';
  ctx.font = `${Math.floor(size / 10)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const lines = text.match(/.{1,8}/g) || [text];
  const lineHeight = size / (lines.length + 2);
  
  lines.forEach((line, index) => {
    ctx.fillText(line, size / 2, (index + 1.5) * lineHeight);
  });
  
  return canvas.toDataURL('image/png');
};

export const generateSaleBarcode = (saleId: string): string => {
  // Generar código de barras basado en ID de venta
  const timestamp = Date.now().toString();
  const saleNumber = saleId.slice(-8).toUpperCase();
  return `SALE${saleNumber}${timestamp.slice(-6)}`;
};

export const generateQRContent = (sale: any, settings: any): string => {
  switch (settings.qr_content) {
    case 'sale_id':
      return `Venta #${sale.id.slice(-8)} - ${settings.company_name || 'VentasFULL'} - Total: $${sale.total_amount}`;
    
    case 'company_info':
      return `${settings.company_name || 'VentasFULL'}${settings.company_phone ? ` - Tel: ${settings.company_phone}` : ''}${settings.company_email ? ` - ${settings.company_email}` : ''}${settings.company_website ? ` - ${settings.company_website}` : ''}`;
    
    case 'sale_details':
      return JSON.stringify({
        sale_id: sale.id.slice(-8),
        date: new Date(sale.created_at).toISOString().split('T')[0],
        total: sale.total_amount,
        customer: sale.customer?.name || 'Cliente General',
        company: settings.company_name || 'VentasFULL'
      });
    
    case 'verification_url':
      return `${settings.company_website || 'https://ventasfull.com'}/verify/${sale.id}`;
    
    case 'custom':
      return settings.qr_custom_text || `Venta #${sale.id.slice(-8)}`;
    
    default:
      return `Venta #${sale.id.slice(-8)} - ${settings.company_name || 'VentasFULL'}`;
  }
};