// Utilidades para generar códigos de barras y QR funcionales

// Función para generar código de barras usando JsBarcode
export const generateBarcode = (text: string, elementId: string, options?: any) => {
  // Importación dinámica para evitar problemas de SSR
  import('jsbarcode').then((JsBarcode) => {
    const element = document.getElementById(elementId);
    if (element) {
      try {
        JsBarcode.default(element, text, {
          format: "CODE128",
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 5,
          background: "#ffffff",
          lineColor: "#000000",
          ...options
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
        // Fallback: mostrar el texto
        element.innerHTML = `<div style="text-align: center; padding: 10px; border: 1px solid #ccc; font-family: monospace;">${text}</div>`;
      }
    }
  }).catch(error => {
    console.error('Error loading JsBarcode:', error);
  });
};

// Función para generar código QR usando la librería qrcode
export const generateQRCode = async (text: string, size: number = 100): Promise<string> => {
  try {
    // Importación dinámica de la librería qrcode
    const QRCode = await import('qrcode');
    
    // Generar el código QR como data URL
    const qrDataURL = await QRCode.default.toDataURL(text, {
      width: size,
      height: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    
    return qrDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    // Fallback: crear una imagen simple con texto
    return generateFallbackQR(text, size);
  }
};

// Función fallback para crear QR simple cuando falla la librería
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
  ctx.font = `${Math.floor(size / 12)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Dividir texto en líneas si es muy largo
  const maxCharsPerLine = Math.floor(size / 8);
  const lines = [];
  for (let i = 0; i < text.length; i += maxCharsPerLine) {
    lines.push(text.substr(i, maxCharsPerLine));
  }
  
  const lineHeight = size / (lines.length + 2);
  lines.forEach((line, index) => {
    ctx.fillText(line, size / 2, (index + 1.5) * lineHeight);
  });
  
  return canvas.toDataURL('image/png');
};

// Generar código de barras único para una venta
export const generateSaleBarcode = (saleId: string): string => {
  // Crear un código único basado en el ID de la venta
  // Formato: SALE + últimos 8 caracteres del ID + timestamp corto
  const saleNumber = saleId.slice(-8).toUpperCase();
  const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos del timestamp
  return `SALE${saleNumber}${timestamp}`;
};

// Generar contenido para código QR basado en configuración
export const generateQRContent = (sale: any, settings: any): string => {
  const baseInfo = {
    company: settings.company_name || 'VentasFULL',
    saleId: sale.id.slice(-8),
    date: new Date(sale.created_at).toLocaleDateString('es-ES'),
    time: new Date(sale.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    total: sale.total_amount
  };

  switch (settings.qr_content) {
    case 'sale_id':
      return `Venta #${baseInfo.saleId}\n${baseInfo.company}\nFecha: ${baseInfo.date}\nTotal: $${baseInfo.total.toLocaleString('es-CO')}`;
    
    case 'company_info':
      let companyInfo = baseInfo.company;
      if (settings.company_phone) companyInfo += `\nTel: ${settings.company_phone}`;
      if (settings.company_email) companyInfo += `\nEmail: ${settings.company_email}`;
      if (settings.company_address) companyInfo += `\nDir: ${settings.company_address}`;
      if (settings.company_website) companyInfo += `\nWeb: ${settings.company_website}`;
      return companyInfo;
    
    case 'sale_details':
      let details = `${baseInfo.company}\nVenta #${baseInfo.saleId}\nFecha: ${baseInfo.date} ${baseInfo.time}\nTotal: $${baseInfo.total.toLocaleString('es-CO')}`;
      if (sale.customer?.name) details += `\nCliente: ${sale.customer.name}`;
      if (sale.user?.name) details += `\nVendedor: ${sale.user.name}`;
      if (sale.payment_type) details += `\nPago: ${sale.payment_type === 'cash' ? 'Efectivo' : 'Abonos'}`;
      return details;
    
    case 'verification_url':
      const baseUrl = settings.company_website || 'https://ventasfull.com';
      return `${baseUrl}/verify/${sale.id}`;
    
    case 'custom':
      return settings.qr_custom_text || `Venta #${baseInfo.saleId} - ${baseInfo.company}`;
    
    default:
      return `${baseInfo.company}\nVenta #${baseInfo.saleId}\nFecha: ${baseInfo.date}\nTotal: $${baseInfo.total.toLocaleString('es-CO')}`;
  }
};

// Función para validar si un código de barras es válido
export const validateBarcode = (code: string): boolean => {
  // Validar que el código tenga el formato correcto
  if (!code || code.length < 8) return false;
  
  // Validar que contenga solo caracteres válidos para CODE128
  const validChars = /^[A-Za-z0-9\-\.\ \$\/\+\%]+$/;
  return validChars.test(code);
};

// Función para generar código de barras para productos
export const generateProductBarcode = (productId?: string): string => {
  if (productId) {
    // Usar ID del producto si está disponible
    const productNumber = productId.slice(-8).toUpperCase();
    return `PROD${productNumber}`;
  } else {
    // Generar código único basado en timestamp
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PROD${timestamp.slice(-8)}${random}`;
  }
};

// Función para generar código EAN-13 (más estándar para productos)
export const generateEAN13 = (): string => {
  // Generar 12 dígitos aleatorios
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  
  // Calcular dígito de verificación
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i]);
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return code + checkDigit;
};

// Función para leer código QR (usando la API de la cámara si está disponible)
export const scanQRCode = async (): Promise<string | null> => {
  try {
    // Verificar si el navegador soporta la API de la cámara
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported');
    }
    
    // Esta función requeriría una implementación más compleja con una librería de escaneo
    // Por ahora, retornamos null para indicar que no está implementado
    console.log('QR scanning would be implemented here');
    return null;
  } catch (error) {
    console.error('Error scanning QR code:', error);
    return null;
  }
};

// Función para descargar código de barras como imagen
export const downloadBarcode = (text: string, filename: string = 'barcode.png') => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return;
  
  // Configurar canvas
  canvas.width = 300;
  canvas.height = 100;
  
  // Fondo blanco
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Generar código de barras usando JsBarcode
  import('jsbarcode').then((JsBarcode) => {
    JsBarcode.default(canvas, text, {
      format: "CODE128",
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 14,
      margin: 10
    });
    
    // Descargar imagen
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL();
    link.click();
  }).catch(error => {
    console.error('Error downloading barcode:', error);
  });
};

// Función para descargar código QR como imagen
export const downloadQRCode = async (text: string, filename: string = 'qrcode.png') => {
  try {
    const qrDataURL = await generateQRCode(text, 200);
    
    const link = document.createElement('a');
    link.download = filename;
    link.href = qrDataURL;
    link.click();
  } catch (error) {
    console.error('Error downloading QR code:', error);
  }
};