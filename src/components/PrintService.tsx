import React from 'react';
import { formatCurrency } from '../lib/currency';
import { SaleWithItems } from '../lib/types';
import { Printer } from 'lucide-react';

interface PrintServiceProps {
  sale: SaleWithItems;
  settings: any;
  onPrint?: () => void;
}

export default function PrintService({ sale, settings, onPrint }: PrintServiceProps) {
  const printReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptHTML = generateReceiptHTML(sale, settings);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprobante de Venta #${sale.id.slice(-8)}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
              margin: 0;
              padding: 10px;
              width: ${settings.receipt_width === '58mm' ? '200px' : 
                      settings.receipt_width === '80mm' ? '280px' : '380px'};
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
            .flex { display: flex; justify-content: space-between; }
            .logo { width: 40px; height: 40px; background: #333; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; }
            @media print {
              body { width: auto; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${receiptHTML}
          <div class="no-print center" style="margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Imprimir
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
              Cerrar
            </button>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Auto-print if enabled
    if (settings.auto_print) {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }

    if (onPrint) {
      onPrint();
    }
  };

  const generateReceiptHTML = (sale: SaleWithItems, settings: any) => {
    let html = '';
    
    // Verificar si es un comprobante de abono
    const isInstallmentReceipt = sale.is_installment_receipt;

    // Aplicar configuración de fuente y espaciado
    const fontSize = settings.font_size === 'small' ? '10px' : 
                    settings.font_size === 'large' ? '14px' : '12px';
    const lineHeight = settings.line_spacing === 'compact' ? '1.2' : 
                      settings.line_spacing === 'relaxed' ? '1.6' : '1.4';

    // Logo
    if (settings.show_logo) {
      html += `
        <div class="center">
          <div class="logo">LOGO</div>
        </div>
      `;
    }

    // Company Info
    if (settings.show_company_info) {
      html += `
        <div class="center border-bottom">
          <div class="bold">${settings.company_name || 'NOMBRE DE LA EMPRESA'}</div>
          ${settings.company_address ? `<div>${settings.company_address}</div>` : ''}
          ${settings.company_phone ? `<div>Tel: ${settings.company_phone}</div>` : ''}
          ${settings.company_email ? `<div>${settings.company_email}</div>` : ''}
          ${settings.company_website ? `<div>${settings.company_website}</div>` : ''}
          ${settings.tax_id ? `<div>NIT: ${settings.tax_id}</div>` : ''}
        </div>
      `;
    }

    // Custom Header
    if (settings.receipt_header) {
      html += `
        <div class="center border-bottom">
          ${settings.receipt_header}
        </div>
      `;
    } else if (isInstallmentReceipt) {
      html += `
        <div class="center border-bottom">
          <div class="bold">COMPROBANTE DE ABONO</div>
        </div>
      `;
    }

    // Sale Info
    if (isInstallmentReceipt) {
      html += `
        <div class="border-bottom">
          <div class="flex">
            <span>ABONO VENTA</span>
            <span>#${sale.id.slice(-8)}</span>
          </div>
          <div>Fecha abono: ${new Date(sale.payment_date || sale.created_at).toLocaleDateString('es-ES')}</div>
          <div>Hora: ${new Date(sale.payment_date || sale.created_at).toLocaleTimeString('es-ES')}</div>
          <div>Fecha venta original: ${new Date(sale.created_at).toLocaleDateString('es-ES')}</div>
          ${sale.user ? `<div>Vendedor: ${sale.user.name}</div>` : ''}
        </div>
      `;
    } else {
      html += `
        <div class="border-bottom">
          <div class="flex">
            <span>COMPROBANTE DE VENTA</span>
            <span>#${sale.id.slice(-8)}</span>
          </div>
          <div>Fecha: ${new Date(sale.created_at).toLocaleDateString('es-ES')}</div>
          <div>Hora: ${new Date(sale.created_at).toLocaleTimeString('es-ES')}</div>
          ${sale.user ? `<div>Vendedor: ${sale.user.name}</div>` : ''}
        </div>
      `;
    }

    // Customer Info
    if (settings.show_customer_info && sale.customer) {
      html += `
        <div class="border-bottom">
          <div>Cliente: ${sale.customer.name}</div>
          ${sale.customer.cedula ? `<div>CC: ${sale.customer.cedula}</div>` : ''}
          ${sale.customer.phone ? `<div>Tel: ${sale.customer.phone}</div>` : ''}
          ${sale.customer.email ? `<div>Email: ${sale.customer.email}</div>` : ''}
        </div>
      `;
    }

    // Products (solo para ventas completas, no para abonos)
    if (!isInstallmentReceipt && sale.sale_items) {
      html += '<div class="border-bottom">';
      sale.sale_items.forEach(item => {
        html += `
          <div class="flex">
            <span>${item.product.name}</span>
            <span>${formatCurrency(item.total_price)}</span>
          </div>
          <div class="flex">
            <span>Cant: ${item.quantity} x ${formatCurrency(item.unit_price)}</span>
            <span></span>
          </div>
        `;
      });
      html += '</div>';
    }

    // Totals
    if (isInstallmentReceipt) {
      html += `
        <div class="border-bottom">
          <div class="flex">
            <span>TOTAL VENTA:</span>
            <span>${formatCurrency(sale.total_amount)}</span>
          </div>
          <div class="flex">
            <span>TOTAL PAGADO:</span>
            <span>${formatCurrency(sale.total_paid_after || sale.total_paid)}</span>
          </div>
          <div class="flex bold">
            <span>ABONO ACTUAL:</span>
            <span>${formatCurrency(sale.payment_amount)}</span>
          </div>
          <div class="flex">
            <span>SALDO RESTANTE:</span>
            <span>${formatCurrency(sale.remaining_balance || 0)}</span>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="border-bottom">
          ${sale.subtotal !== sale.total_amount ? `
            <div class="flex">
              <span>SUBTOTAL:</span>
              <span>${formatCurrency(sale.subtotal)}</span>
            </div>
          ` : ''}
          ${sale.discount_amount > 0 ? `
            <div class="flex">
              <span>DESCUENTO:</span>
              <span>-${formatCurrency(sale.discount_amount)}</span>
            </div>
          ` : ''}
          <div class="flex bold">
            <span>TOTAL:</span>
            <span>${formatCurrency(sale.total_amount)}</span>
          </div>
        </div>
      `;
    }

    // Payment Details
    if (settings.show_payment_details) {
      if (isInstallmentReceipt) {
        html += `
          <div class="border-bottom">
            <div>Método de pago: Efectivo</div>
            <div>Fecha del abono: ${new Date(sale.payment_date || sale.created_at).toLocaleDateString('es-ES')}</div>
            ${sale.payment_notes ? `<div>Notas: ${sale.payment_notes}</div>` : ''}
          </div>
        `;
      } else {
        html += `
          <div class="border-bottom">
            <div>Método de pago: ${sale.payment_type === 'cash' ? 'Efectivo' : 'Abonos'}</div>
            ${sale.payment_type === 'cash' ? `
              <div>Recibido: ${formatCurrency(sale.total_paid)}</div>
              <div>Cambio: ${formatCurrency(Math.max(0, sale.total_paid - sale.total_amount))}</div>
            ` : `
              <div>Pagado: ${formatCurrency(sale.total_paid)}</div>
              <div>Saldo: ${formatCurrency(sale.total_amount - sale.total_paid)}</div>
              <div>Estado: ${sale.payment_status === 'paid' ? 'Pagada' : 
                             sale.payment_status === 'partial' ? 'Parcial' : 'Pendiente'}</div>
            `}
          </div>
        `;
      }
    }

    // Códigos de barras y QR
    if (settings.show_barcode || settings.show_qr_code) {
      html += '<div class="center" style="margin-top: 10px;">';
      
      if (settings.show_barcode) {
        html += `
          <div style="background: #000; height: 30px; width: 120px; margin: 5px auto;"></div>
          <div style="font-size: 10px;">${sale.id.slice(-8)}</div>
        `;
      }
      
      if (settings.show_qr_code) {
        html += `
          <div style="background: #000; height: 60px; width: 60px; margin: 5px auto;"></div>
          <div style="font-size: 10px;">Código QR</div>
        `;
      }
      
      html += '</div>';
    }

    // Footer Message
    if (settings.show_footer_message && settings.footer_message) {
      html += `
        <div class="center">
          ${isInstallmentReceipt ? (settings.footer_message.replace('compra', 'abono') || '¡Gracias por su abono!') : settings.footer_message}
        </div>
      `;
    }

    // Custom Footer
    if (settings.receipt_footer) {
      html += `
        <div class="center" style="border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px;">
          ${settings.receipt_footer}
        </div>
      `;
    }

    // Aplicar CSS personalizado si existe
    if (settings.custom_css) {
      html = `<style>${settings.custom_css}</style>` + html;
    }

    return html;
  };

  return (
    <button
      onClick={printReceipt}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center text-sm"
    >
      <Printer className="h-4 w-4 mr-2" />
      Imprimir Comprobante
    </button>
  );
}