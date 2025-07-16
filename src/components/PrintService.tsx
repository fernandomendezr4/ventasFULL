import React from 'react';
import { formatCurrency } from '../lib/currency';
import { SaleWithItems } from '../lib/types';
import { Printer } from 'lucide-react';
import { generateBarcode, generateQRCode, generateSaleBarcode, generateQRContent } from '../lib/barcodeGenerator';

interface PrintServiceProps {
  sale: SaleWithItems;
  settings: any;
  onPrint?: () => void;
}

export default function PrintService({ sale, settings, onPrint }: PrintServiceProps) {
  const printReceipt = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      alert('No se pudo abrir la ventana de impresión. Verifica que no esté bloqueada por el navegador.');
      return;
    }

    const receiptHTML = generateReceiptHTML(sale, settings);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprobante de Venta #${sale.id.slice(-8)}</title>
          <meta charset="UTF-8">
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Roboto', 'Courier New', monospace;
              font-size: ${getFontSize()};
              line-height: ${getLineHeight()};
              margin: 0;
              padding: 10px;
              width: ${getReceiptWidth()};
              background: white;
              color: black;
            }
            
            .center { 
              text-align: center; 
            }
            
            .bold { 
              font-weight: bold; 
            }
            
            .border-bottom { 
              border-bottom: 1px dashed #000; 
              padding-bottom: 5px; 
              margin-bottom: 5px; 
            }
            
            .flex { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start;
            }
            
            .logo { 
              width: ${getLogoSize()}; 
              height: ${getLogoSize()}; 
              background: #333; 
              color: white; 
              border-radius: 50%; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              margin: 0 auto 10px;
              font-weight: bold;
              font-size: ${getLogoFontSize()};
            }
            
            .product-line {
              margin-bottom: 2px;
            }
            
            .product-details {
              font-size: 10px;
              color: #666;
              margin-left: 10px;
            }
            
            .total-section {
              margin-top: 10px;
              padding-top: 5px;
              border-top: 1px solid #000;
            }
            
            .payment-section {
              margin-top: 8px;
              padding-top: 5px;
              border-top: 1px dashed #000;
            }
            
            .footer-section {
              margin-top: 10px;
              padding-top: 5px;
              border-top: 1px dashed #000;
            }
            
            .barcode-container {
              text-align: center;
              margin: 10px 0;
            }
            
            .qr-container {
              text-align: center;
              margin: 10px 0;
            }
            
            .qr-container img {
              max-width: 80px;
              max-height: 80px;
            }
            
            .barcode-container svg {
              max-width: 200px;
              height: auto;
            }
            
            @media print {
              body { 
                width: auto; 
                margin: 0;
                padding: 5px;
              }
              .no-print { 
                display: none !important; 
              }
              @page {
                margin: 0;
                size: ${settings.receipt_width === '58mm' ? '58mm auto' : 
                        settings.receipt_width === '80mm' ? '80mm auto' : '110mm auto'};
              }
            }
            
            ${settings.custom_css || ''}
          </style>
        </head>
        <body>
          ${receiptHTML}
          <div class="no-print center" style="margin-top: 20px; padding: 10px; border-top: 2px solid #ccc;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px; font-size: 14px;">
              🖨️ Imprimir
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
              ❌ Cerrar
            </button>
          </div>
          <script>
            // Generar código de barras después de cargar la página
            window.onload = function() {
              ${settings.show_barcode ? `
                if (typeof JsBarcode !== 'undefined') {
                  const barcodeElement = document.getElementById('sale-barcode');
                  if (barcodeElement) {
                    JsBarcode(barcodeElement, '${generateSaleBarcode(sale.id)}', {
                      format: "CODE128",
                      width: 1.5,
                      height: 30,
                      displayValue: true,
                      fontSize: 10,
                      margin: 2
                    });
                  }
                }
              ` : ''}
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Esperar a que se cargue completamente antes de imprimir automáticamente
    printWindow.onload = () => {
      if (settings.auto_print) {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    };

    if (onPrint) {
      onPrint();
    }
  };

  const getFontSize = () => {
    switch (settings.font_size) {
      case 'small': return '10px';
      case 'large': return '14px';
      default: return '12px';
    }
  };

  const getLineHeight = () => {
    switch (settings.line_spacing) {
      case 'compact': return '1.2';
      case 'relaxed': return '1.6';
      default: return '1.4';
    }
  };

  const getReceiptWidth = () => {
    switch (settings.receipt_width) {
      case '58mm': return '200px';
      case '110mm': return '380px';
      default: return '280px'; // 80mm
    }
  };

  const getLogoSize = () => {
    switch (settings.logo_size) {
      case 'small': return '30px';
      case 'large': return '70px';
      default: return '50px';
    }
  };

  const getLogoFontSize = () => {
    switch (settings.logo_size) {
      case 'small': return '12px';
      case 'large': return '20px';
      default: return '16px';
    }
  };

  const generateReceiptHTML = (sale: SaleWithItems, settings: any) => {
    let html = '';
    
    // Verificar si es un comprobante de abono
    const isInstallmentReceipt = sale.is_installment_receipt;

    // Logo
    if (settings.show_logo) {
      if (settings.logo_url) {
        html += `
          <div class="center">
            <img src="${settings.logo_url}" alt="Logo" style="width: ${getLogoSize()}; height: ${getLogoSize()}; object-fit: contain; margin: 0 auto 10px;" onerror="this.style.display='none'" />
          </div>
        `;
      } else {
        html += `
          <div class="center">
            <div class="logo">${(settings.company_name?.charAt(0) || 'L').toUpperCase()}</div>
          </div>
        `;
      }
    }

    // Company Info
    if (settings.show_company_info) {
      html += `
        <div class="center border-bottom">
          <div class="bold">${settings.company_name || 'NOMBRE DE LA EMPRESA'}</div>
      `;
      
      if (settings.company_address) {
        html += `<div>${settings.company_address}</div>`;
      }
      if (settings.company_phone) {
        html += `<div>Tel: ${settings.company_phone}</div>`;
      }
      if (settings.company_email) {
        html += `<div>${settings.company_email}</div>`;
      }
      if (settings.company_website) {
        html += `<div>${settings.company_website}</div>`;
      }
      if (settings.tax_id) {
        html += `<div>NIT: ${settings.tax_id}</div>`;
      }
      
      html += '</div>';
    }

    // Custom Header
    if (settings.receipt_header) {
      html += `
        <div class="center border-bottom">
          ${settings.receipt_header}
        </div>
      `;
    }

    // Sale Info
    if (isInstallmentReceipt) {
      html += `
        <div class="border-bottom">
          <div class="center bold">COMPROBANTE DE ABONO</div>
          <div class="flex">
            <span>VENTA:</span>
            <span>#${sale.id.slice(-8)}</span>
          </div>
          <div>Fecha abono: ${new Date(sale.payment_date || sale.created_at).toLocaleDateString('es-ES')}</div>
          <div>Hora: ${new Date(sale.payment_date || sale.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
          <div>Fecha venta: ${new Date(sale.created_at).toLocaleDateString('es-ES')}</div>
      `;
      
      if (sale.user) {
        html += `<div>Vendedor: ${sale.user.name}</div>`;
      }
      
      html += '</div>';
    } else {
      html += `
        <div class="border-bottom">
          <div class="flex">
            <span>COMPROBANTE DE VENTA</span>
            <span>#${sale.id.slice(-8)}</span>
          </div>
          <div>Fecha: ${new Date(sale.created_at).toLocaleDateString('es-ES')}</div>
          <div>Hora: ${new Date(sale.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
      `;
      
      if (sale.user) {
        html += `<div>Vendedor: ${sale.user.name}</div>`;
      }
      
      html += '</div>';
    }

    // Customer Info
    if (settings.show_customer_info && sale.customer) {
      html += `
        <div class="border-bottom">
          <div>Cliente: ${sale.customer.name}</div>
      `;
      
      if (sale.customer.cedula) {
        html += `<div>CC: ${sale.customer.cedula}</div>`;
      }
      if (sale.customer.phone) {
        html += `<div>Tel: ${sale.customer.phone}</div>`;
      }
      if (sale.customer.email) {
        html += `<div>Email: ${sale.customer.email}</div>`;
      }
      
      html += '</div>';
    }

    // Products (solo para ventas completas, no para abonos)
    if (!isInstallmentReceipt && sale.sale_items && sale.sale_items.length > 0) {
      html += '<div class="border-bottom">';
      
      sale.sale_items.forEach(item => {
        html += `
          <div class="product-line">
            <div class="flex">
              <span>${item.product.name}</span>
              <span>${formatCurrency(item.total_price)}</span>
            </div>
            <div class="product-details">
              ${item.quantity} x ${formatCurrency(item.unit_price)}
            </div>
          </div>
        `;
      });
      
      html += '</div>';
    }

    // Totals
    if (isInstallmentReceipt) {
      html += `
        <div class="total-section">
          <div class="flex">
            <span>TOTAL VENTA:</span>
            <span>${formatCurrency(sale.total_amount)}</span>
          </div>
          <div class="flex">
            <span>PAGADO ANTES:</span>
            <span>${formatCurrency((sale.total_paid_after || sale.total_paid) - (sale.payment_amount || 0))}</span>
          </div>
          <div class="flex bold">
            <span>ABONO ACTUAL:</span>
            <span>${formatCurrency(sale.payment_amount || 0)}</span>
          </div>
          <div class="flex">
            <span>TOTAL PAGADO:</span>
            <span>${formatCurrency(sale.total_paid_after || sale.total_paid)}</span>
          </div>
          <div class="flex bold">
            <span>SALDO RESTANTE:</span>
            <span>${formatCurrency(sale.remaining_balance || 0)}</span>
          </div>
        </div>
      `;
    } else {
      html += '<div class="total-section">';
      
      if (sale.subtotal && sale.subtotal !== sale.total_amount) {
        html += `
          <div class="flex">
            <span>SUBTOTAL:</span>
            <span>${formatCurrency(sale.subtotal)}</span>
          </div>
        `;
      }
      
      if (sale.discount_amount && sale.discount_amount > 0) {
        html += `
          <div class="flex">
            <span>DESCUENTO:</span>
            <span>-${formatCurrency(sale.discount_amount)}</span>
          </div>
        `;
      }
      
      html += `
        <div class="flex bold">
          <span>TOTAL:</span>
          <span>${formatCurrency(sale.total_amount)}</span>
        </div>
      `;
      
      html += '</div>';
    }

    // Payment Details
    if (settings.show_payment_details) {
      html += '<div class="payment-section">';
      
      if (isInstallmentReceipt) {
        html += `
          <div>Método de pago: Efectivo</div>
          <div>Fecha del abono: ${new Date(sale.payment_date || sale.created_at).toLocaleDateString('es-ES')}</div>
        `;
        
        if (sale.payment_notes) {
          html += `<div>Notas: ${sale.payment_notes}</div>`;
        }
      } else {
        html += `<div>Método de pago: ${sale.payment_type === 'cash' ? 'Efectivo' : 'Abonos'}</div>`;
        
        if (sale.payment_type === 'cash') {
          const received = sale.total_paid || sale.total_amount;
          const change = Math.max(0, received - sale.total_amount);
          
          html += `
            <div>Recibido: ${formatCurrency(received)}</div>
            <div>Cambio: ${formatCurrency(change)}</div>
          `;
        } else {
          html += `
            <div>Pagado: ${formatCurrency(sale.total_paid || 0)}</div>
            <div>Saldo: ${formatCurrency(sale.total_amount - (sale.total_paid || 0))}</div>
            <div>Estado: ${
              sale.payment_status === 'paid' ? 'Pagada' : 
              sale.payment_status === 'partial' ? 'Parcial' : 'Pendiente'
            }</div>
          `;
        }
      }
      
      html += '</div>';
    }

    // Códigos de barras y QR
    if (settings.show_barcode || settings.show_qr_code) {
      html += '<div class="border-t border-slate-300 pt-2 mt-2">';
      
      if (settings.show_barcode) {
        const barcodeData = generateSaleBarcode(sale.id);
        html += `
          <div class="barcode-container">
            <svg id="sale-barcode"></svg>
            <div class="text-xs text-slate-600 mt-1">${barcodeData}</div>
          </div>
        `;
      }
      
      if (settings.show_qr_code) {
        const qrContent = generateQRContent(sale, settings);
        const qrImage = generateQRCode(qrContent, 80);
        if (qrImage) {
          html += `
            <div class="qr-container">
              <img src="${qrImage}" alt="Código QR" />
              <div class="text-xs text-slate-600 mt-1">
                ${settings.qr_content === 'sale_id' ? 'Información de Venta' :
                  settings.qr_content === 'company_info' ? 'Datos de la Empresa' :
                  settings.qr_content === 'sale_details' ? 'Detalles Completos' :
                  settings.qr_content === 'verification_url' ? 'Verificar Venta' :
                  'Información Personalizada'}
              </div>
            </div>
          `;
        }
      }
      
      html += '</div>';
    }

    // Footer Message
    if (settings.show_footer_message && settings.footer_message) {
      html += `
        <div class="center footer-section">
          ${isInstallmentReceipt ? 
            (settings.footer_message.replace('compra', 'abono') || '¡Gracias por su abono!') : 
            settings.footer_message
          }
        </div>
      `;
    }

    // Custom Footer
    if (settings.receipt_footer) {
      html += `
        <div class="center footer-section">
          ${settings.receipt_footer}
        </div>
      `;
    }

    return html;
  };

  return (
    <button
      onClick={printReceipt}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center text-sm"
      title="Imprimir comprobante"
    >
      <Printer className="h-4 w-4 mr-2" />
      Imprimir
    </button>
  );
}