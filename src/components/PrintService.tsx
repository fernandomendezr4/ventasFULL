import React from 'react';
import { formatCurrency } from '../lib/currency';
import { SaleWithItems } from '../lib/types';
import { Printer } from 'lucide-react';
import { generateSaleBarcode, generateQRContent, generateQRCode } from '../lib/barcodeGenerator';

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
              image-rendering: -webkit-optimize-contrast;
              image-rendering: crisp-edges;
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
                    try {
                      JsBarcode(barcodeElement, '${generateSaleBarcode(sale.id)}', {
                        format: "CODE128",
                        width: 1.5,
                        height: 30,
                        displayValue: true,
                        fontSize: 10,
                        margin: 2,
                        background: "#ffffff",
                        lineColor: "#000000"
                      });
                    } catch (error) {
                      console.error('Error generating barcode:', error);
                      barcodeElement.innerHTML = '<div style="text-align: center; padding: 10px; border: 1px solid #ccc;">${generateSaleBarcode(sale.id)}</div>';
                    }
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
      case 'extra-large': return '16px';
      case 'large': return '14px';
      default: return '12px';
    }
  };

  const getLineHeight = () => {
    switch (settings.line_spacing) {
      case 'compact': return '1.2';
      case 'loose': return '1.8';
      case 'relaxed': return '1.6';
      default: return '1.4';
    }
  };

  const getReceiptWidth = () => {
    switch (settings.receipt_width) {
      case '58mm': return '200px';
      case '110mm': return '380px';
      case 'A4': return '210mm';
      default: return '280px'; // 80mm
    }
  };

  const getLogoSize = () => {
    switch (settings.logo_size) {
      case 'small': return '30px';
      case 'extra-large': return '100px';
      case 'large': return '70px';
      default: return '50px';
    }
  };

  const getLogoFontSize = () => {
    switch (settings.logo_size) {
      case 'small': return '12px';
      case 'extra-large': return '24px';
      case 'large': return '20px';
      default: return '16px';
    }
  };

  const getPaperMargins = () => {
    switch (settings.paper_margins) {
      case 'none': return '0';
      case 'small': return '5mm';
      case 'large': return '15mm';
      default: return '10mm'; // normal
    }
  };

  const getBarcodeHeight = () => {
    switch (settings.barcode_height) {
      case 'small': return 30;
      case 'large': return 60;
      case 'extra-large': return 80;
      default: return 40; // medium
    }
  };

  const getQRSize = () => {
    switch (settings.qr_size) {
      case 'small': return 60;
      case 'large': return 120;
      case 'extra-large': return 160;
      default: return 80; // medium
    }
  };
  const generateReceiptHTML = (sale: SaleWithItems, settings: any) => {
    let html = '';
    
    // Verificar si es un comprobante de abono
    const isInstallmentReceipt = sale.is_installment_receipt;

    // Estilos adicionales basados en configuración
    const additionalStyles = `
      ${settings.show_borders ? '.receipt-section { border: 1px solid #000; margin: 2px 0; padding: 2px; }' : ''}
      ${settings.show_lines ? '.separator-line { border-bottom: 1px solid #000; margin: 2px 0; }' : ''}
      ${settings.bold_totals ? '.total-amount { font-weight: bold; font-size: 1.2em; }' : ''}
      ${settings.highlight_discounts ? '.discount-amount { background-color: #ffeb3b; padding: 1px 3px; }' : ''}
      .paper-margins { margin: ${getPaperMargins()}; }
    `;
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
        <div class="center ${settings.show_borders ? 'receipt-section' : 'border-bottom'}">
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
      if (settings.additional_contact) {
        html += `<div style="margin-top: 5px;">${settings.additional_contact}</div>`;
      }
      
      html += '</div>';
    }

    // Custom Header
    if (settings.receipt_header) {
      html += `
        <div class="center ${settings.show_borders ? 'receipt-section' : 'border-bottom'}">
          ${settings.receipt_header}
        </div>
      `;
    }

    // Sale Info
    if (isInstallmentReceipt) {
      html += `
        <div class="${settings.show_borders ? 'receipt-section' : 'border-bottom'}">
          <div class="center bold">COMPROBANTE DE ABONO</div>
          ${settings.show_sale_number ? `
          <div class="flex">
            <span>VENTA:</span>
            <span>#${sale.id.slice(-8)}</span>
          </div>
          ` : ''}
          ${settings.show_date_time ? `
          <div>Fecha abono: ${new Date(sale.payment_date || sale.created_at).toLocaleDateString('es-ES')}</div>
          <div>Hora: ${new Date(sale.payment_date || sale.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
          <div>Fecha venta: ${new Date(sale.created_at).toLocaleDateString('es-ES')}</div>
          ` : ''}
      `;
      
      if (sale.user && settings.show_seller_info) {
        html += `<div>Vendedor: ${sale.user.name}</div>`;
      }
      
      html += '</div>';
    } else {
      html += `
        <div class="${settings.show_borders ? 'receipt-section' : 'border-bottom'}">
          ${settings.show_sale_number ? `
          <div class="flex">
            <span>COMPROBANTE DE VENTA</span>
            <span>#${sale.id.slice(-8)}</span>
          </div>
          ` : ''}
          ${settings.show_date_time ? `
          <div>Fecha: ${new Date(sale.created_at).toLocaleDateString('es-ES')}</div>
          <div>Hora: ${new Date(sale.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
          ` : ''}
      `;
      
      if (sale.user && settings.show_seller_info) {
        html += `<div>Vendedor: ${sale.user.name}</div>`;
      }
      
      html += '</div>';
    }

    // Customer Info
    if (settings.show_customer_info && sale.customer) {
      html += `
        <div class="${settings.show_borders ? 'receipt-section' : 'border-bottom'}">
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
      html += `<div class="${settings.show_borders ? 'receipt-section' : 'border-bottom'}">`;
      
      sale.sale_items.forEach(item => {
        html += `
          <div class="product-line">
            <div class="flex">
              <span>${item.product.name}</span>
              <span>${formatCurrency(item.total_price)}</span>
            </div>
            <div class="product-details">
              ${item.quantity} x ${settings.show_unit_prices ? formatCurrency(item.unit_price) : ''}
              ${settings.show_product_codes && item.product.barcode ? ` | Código: ${item.product.barcode}` : ''}
              ${settings.show_product_categories && item.product.category ? ` | ${item.product.category.name}` : ''}
            </div>
          </div>
        `;
      });
      
      html += '</div>';
    }

    // Totals
    if (isInstallmentReceipt) {
      html += `
        <div class="total-section ${settings.show_borders ? 'receipt-section' : ''}">
          <div class="flex">
            <span>TOTAL VENTA:</span>
            <span class="${settings.bold_totals ? 'total-amount' : ''}">${formatCurrency(sale.total_amount)}</span>
          </div>
          <div class="flex">
            <span>PAGADO ANTES:</span>
            <span>${formatCurrency((sale.total_paid_after || sale.total_paid) - (sale.payment_amount || 0))}</span>
          </div>
          <div class="flex bold">
            <span>ABONO ACTUAL:</span>
            <span class="${settings.bold_totals ? 'total-amount' : ''}">${formatCurrency(sale.payment_amount || 0)}</span>
          </div>
          <div class="flex">
            <span>TOTAL PAGADO:</span>
            <span>${formatCurrency(sale.total_paid_after || sale.total_paid)}</span>
          </div>
          <div class="flex bold">
            <span>SALDO RESTANTE:</span>
            <span class="${settings.bold_totals ? 'total-amount' : ''}">${formatCurrency(sale.remaining_balance || 0)}</span>
          </div>
        </div>
      `;
    } else {
      html += `<div class="total-section ${settings.show_borders ? 'receipt-section' : ''}">`;
      
      if (settings.show_subtotals && sale.subtotal && sale.subtotal !== sale.total_amount) {
        html += `
          <div class="flex">
            <span>SUBTOTAL:</span>
            <span>${formatCurrency(sale.subtotal)}</span>
          </div>
        `;
      }
      
      if (settings.show_discount_details && sale.discount_amount && sale.discount_amount > 0) {
        html += `
          <div class="flex">
            <span>DESCUENTO:</span>
            <span class="${settings.highlight_discounts ? 'discount-amount' : ''}">-${formatCurrency(sale.discount_amount)}</span>
          </div>
        `;
      }
      
      if (settings.show_tax_details && sale.tax_amount && sale.tax_amount > 0) {
        html += `
          <div class="flex">
            <span>IMPUESTOS:</span>
            <span>${formatCurrency(sale.tax_amount)}</span>
          </div>
        `;
      }
      
      html += `
        <div class="flex bold">
          <span>TOTAL:</span>
          <span class="${settings.bold_totals ? 'total-amount' : ''}">${formatCurrency(sale.total_amount)}</span>
        </div>
      `;
      
      html += '</div>';
    }

    // Payment Details
    if (settings.show_payment_details) {
      html += `<div class="payment-section ${settings.show_borders ? 'receipt-section' : ''}">`;
      
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
          
          if (settings.show_change_details) {
          html += `
            <div>Recibido: ${formatCurrency(received)}</div>
            <div>Cambio: ${formatCurrency(change)}</div>
          `;
          }
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
      html += `<div class="${settings.show_borders ? 'receipt-section' : 'border-t border-slate-300 pt-2 mt-2'}">`;
      
      if (settings.show_barcode) {
        const barcodeData = generateSaleBarcode(sale.id);
        html += `
          <div class="barcode-container">
            <svg id="sale-barcode"></svg>
            ${settings.barcode_show_text ? `<div class="text-xs text-slate-600 mt-1">${barcodeData}</div>` : ''}
          </div>
        `;
      }
      
      if (settings.show_qr_code) {
        html += `
          <div class="qr-container">
            <div id="qr-code-container"></div>
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
      
      html += '</div>';
    }

    // Términos y Condiciones
    if (settings.show_terms_conditions && settings.terms_conditions) {
      html += `
        <div class="center ${settings.show_borders ? 'receipt-section' : 'footer-section'}">
          <div class="bold" style="font-size: 0.9em;">TÉRMINOS Y CONDICIONES</div>
          <div style="font-size: 0.8em; margin-top: 3px;">${settings.terms_conditions}</div>
        </div>
      `;
    }

    // Política de Devoluciones
    if (settings.show_return_policy && settings.return_policy) {
      html += `
        <div class="center ${settings.show_borders ? 'receipt-section' : 'footer-section'}">
          <div class="bold" style="font-size: 0.9em;">POLÍTICA DE DEVOLUCIONES</div>
          <div style="font-size: 0.8em; margin-top: 3px;">${settings.return_policy}</div>
        </div>
      `;
    }
    // Footer Message
    if (settings.show_footer_message && settings.footer_message) {
      html += `
        <div class="center ${settings.show_borders ? 'receipt-section' : 'footer-section'}">
          ${isInstallmentReceipt ? 
            (settings.footer_message.replace('compra', 'abono') || '¡Gracias por su abono!') : 
            settings.footer_message
          }
        </div>
      `;
    }

    // Mensaje de Agradecimiento
    if (settings.thank_you_message) {
      html += `
        <div class="center ${settings.show_borders ? 'receipt-section' : 'footer-section'}">
          <div class="bold">${settings.thank_you_message}</div>
        </div>
      `;
    }
    // Custom Footer
    if (settings.receipt_footer) {
      html += `
        <div class="center ${settings.show_borders ? 'receipt-section' : 'footer-section'}">
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