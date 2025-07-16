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
    // Importación dinámica de qrcode-generator
    const qr = require('qrcode-generator');
    const qrCode = qr(0, 'M');
    qrCode.addData(text);
    qrCode.make();
    
    // Generar SVG del QR
    const cellSize = Math.floor(size / qrCode.getModuleCount());
    const margin = cellSize;
    const svgSize = qrCode.getModuleCount() * cellSize + margin * 2;
    
    let svg = `<svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${svgSize}" height="${svgSize}" fill="white"/>`;
    
    for (let row = 0; row < qrCode.getModuleCount(); row++) {
      for (let col = 0; col < qrCode.getModuleCount(); col++) {
        if (qrCode.isDark(row, col)) {
          const x = col * cellSize + margin;
          const y = row * cellSize + margin;
          svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
        }
      }
    }
    
    svg += '</svg>';
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return '';
  }
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