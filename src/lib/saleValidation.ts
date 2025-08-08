// Validaciones específicas para el proceso de ventas

import { supabase, isDemoMode } from './supabase';
import { validateStockAvailability, validateImeiSerialIntegrity, reserveImeiSerials, releaseImeiSerialReservations } from './productValidation';
import { SaleWithItems } from './types';

export interface SaleTransactionData {
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    selectedImeiSerials?: string[];
  }>;
  customerId?: string;
  paymentType: 'cash' | 'installment';
  paymentMethod?: string;
  amountReceived?: number;
  discountAmount?: number;
  notes?: string;
}

export interface SaleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  reservationToken?: string;
  validatedItems: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    availableStock: number;
    selectedImeiSerials?: string[];
  }>;
}

export interface SaleProcessResult {
  success: boolean;
  saleId?: string;
  error?: string;
  warnings?: string[];
}

// Validar transacción de venta completa
export const validateSaleTransaction = async (
  transactionData: SaleTransactionData
): Promise<SaleValidationResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validatedItems: SaleValidationResult['validatedItems'] = [];
  const reservationToken = `SALE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Validaciones básicas
    if (!transactionData.items || transactionData.items.length === 0) {
      errors.push('La venta debe incluir al menos un producto');
      return { isValid: false, errors, warnings, validatedItems };
    }

    // Validar cada item del carrito
    for (const item of transactionData.items) {
      try {
        // Validar stock disponible
        const stockValidation = await validateStockAvailability(item.productId, item.quantity);
        
        if (!stockValidation.isValid) {
          errors.push(stockValidation.error || `Error de stock para producto ${item.productId.slice(-8)}`);
          continue;
        }

        // Obtener información del producto
        let productInfo: any = null;
        
        if (isDemoMode) {
          // Demo mode: simular información del producto
          productInfo = {
            id: item.productId,
            name: `Producto Demo ${item.productId.slice(-8)}`,
            requires_imei_serial: item.selectedImeiSerials && item.selectedImeiSerials.length > 0,
            imei_serial_type: 'imei'
          };
        } else if (supabase) {
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, requires_imei_serial, imei_serial_type, sale_price')
            .eq('id', item.productId)
            .single();

          if (productError || !product) {
            errors.push(`Producto ${item.productId.slice(-8)}: No encontrado`);
            continue;
          }

          productInfo = product;
        }

        if (!productInfo) {
          errors.push(`Producto ${item.productId.slice(-8)}: Error al obtener información`);
          continue;
        }

        // Validar IMEI/Serial si es requerido
        if (productInfo.requires_imei_serial) {
          if (!item.selectedImeiSerials || item.selectedImeiSerials.length !== item.quantity) {
            errors.push(`${productInfo.name}: Debe seleccionar ${item.quantity} ${productInfo.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'}`);
            continue;
          }

          // Validar integridad de IMEI/Serial seleccionados
          const imeiValidation = await validateImeiSerialIntegrity(
            item.productId,
            item.selectedImeiSerials
          );

          if (!imeiValidation.isValid) {
            errors.push(`${productInfo.name}: ${imeiValidation.errors.join(', ')}`);
            continue;
          }
        }

        // Validar precios
        if (item.unitPrice <= 0) {
          errors.push(`${productInfo.name}: Precio unitario debe ser mayor a 0`);
          continue;
        }

        if (item.unitPrice > 999999999) {
          errors.push(`${productInfo.name}: Precio unitario demasiado alto`);
          continue;
        }

        // Item validado exitosamente
        validatedItems.push({
          productId: item.productId,
          productName: productInfo.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
          availableStock: stockValidation.availableStock,
          selectedImeiSerials: item.selectedImeiSerials
        });

      } catch (error) {
        console.error(`Error validating item ${item.productId}:`, error);
        errors.push(`Producto ${item.productId.slice(-8)}: Error interno de validación`);
      }
    }

    // Validaciones de pago
    if (transactionData.paymentType === 'cash') {
      const total = validatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const discount = transactionData.discountAmount || 0;
      const finalTotal = total - discount;
      const received = transactionData.amountReceived || 0;

      if (received < finalTotal) {
        errors.push(`Monto recibido insuficiente. Total: $${finalTotal.toLocaleString()}, Recibido: $${received.toLocaleString()}`);
      }

      if (discount > total) {
        errors.push('El descuento no puede ser mayor al subtotal');
      }
    }

    // Validar cliente si se proporciona
    if (transactionData.customerId && !isDemoMode && supabase) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, name, is_active')
        .eq('id', transactionData.customerId)
        .single();

      if (customerError || !customer) {
        warnings.push('Cliente seleccionado no encontrado, se procesará como venta sin cliente');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      reservationToken,
      validatedItems
    };

  } catch (error) {
    console.error('Error in sale transaction validation:', error);
    return {
      isValid: false,
      errors: ['Error interno al validar la transacción de venta'],
      warnings,
      validatedItems
    };
  }
};

// Procesar venta con validaciones y rollback automático
export const processSaleTransaction = async (
  transactionData: SaleTransactionData,
  userId: string
): Promise<SaleProcessResult> => {
  let reservationToken: string | null = null;
  let saleId: string | null = null;
  let createdSaleItems: string[] = [];

  try {
    // Validar transacción completa
    const validation = await validateSaleTransaction(transactionData);
    
    if (!validation.isValid) {
      return {
        success: false,
        error: `Errores de validación: ${validation.errors.join(', ')}`,
        warnings: validation.warnings
      };
    }

    reservationToken = validation.reservationToken!;

    if (isDemoMode) {
      // En modo demo, simular venta exitosa
      return {
        success: true,
        saleId: `demo-sale-${Date.now()}`,
        warnings: validation.warnings
      };
    }

    if (!supabase) {
      return {
        success: false,
        error: 'Sistema de base de datos no disponible'
      };
    }

    // Reservar IMEI/Serial temporalmente
    const imeiSerialIds = validation.validatedItems
      .filter(item => item.selectedImeiSerials)
      .flatMap(item => item.selectedImeiSerials!);

    if (imeiSerialIds.length > 0) {
      const reservationResult = await reserveImeiSerials(imeiSerialIds, reservationToken);
      if (!reservationResult.success) {
        return {
          success: false,
          error: `Error al reservar IMEI/Serial: ${reservationResult.error}`
        };
      }
    }

    // Calcular totales
    const subtotal = validation.validatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountAmount = transactionData.discountAmount || 0;
    const totalAmount = subtotal - discountAmount;

    // Crear la venta
    const saleData = {
      total_amount: totalAmount,
      subtotal: subtotal,
      discount_amount: discountAmount,
      customer_id: transactionData.customerId || null,
      user_id: userId,
      payment_type: transactionData.paymentType,
      total_paid: transactionData.paymentType === 'cash' ? totalAmount : 0,
      payment_status: transactionData.paymentType === 'cash' ? 'paid' : 'pending',
      created_at: new Date().toISOString()
    };

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([saleData])
      .select()
      .single();

    if (saleError) {
      throw new Error(`Error al crear venta: ${saleError.message}`);
    }

    saleId = sale.id;

    // Crear items de venta
    const saleItemsData = validation.validatedItems.map(item => ({
      sale_id: sale.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice
    }));

    const { data: saleItems, error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItemsData)
      .select();

    if (itemsError) {
      throw new Error(`Error al crear items de venta: ${itemsError.message}`);
    }

    createdSaleItems = saleItems.map(item => item.id);

    // Marcar IMEI/Serial como vendidos
    for (let i = 0; i < validation.validatedItems.length; i++) {
      const item = validation.validatedItems[i];
      const saleItem = saleItems[i];

      if (item.selectedImeiSerials && item.selectedImeiSerials.length > 0) {
        const { error: imeiUpdateError } = await supabase
          .from('product_imei_serials')
          .update({
            status: 'sold',
            sale_id: sale.id,
            sale_item_id: saleItem.id,
            sold_at: new Date().toISOString(),
            notes: `Vendido en venta #${sale.id.slice(-8)}`,
            updated_at: new Date().toISOString()
          })
          .in('id', item.selectedImeiSerials);

        if (imeiUpdateError) {
          throw new Error(`Error al marcar IMEI/Serial como vendidos: ${imeiUpdateError.message}`);
        }
      }
    }

    // Actualizar stock para productos sin IMEI/Serial requerido
    for (const item of validation.validatedItems) {
      const { data: product } = await supabase
        .from('products')
        .select('requires_imei_serial, stock')
        .eq('id', item.productId)
        .single();

      if (product && !product.requires_imei_serial) {
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: product.stock - item.quantity })
          .eq('id', item.productId);

        if (stockError) {
          console.error('Error updating stock:', stockError);
          // No lanzar error aquí, solo loggearlo
        }
      }
    }

    return {
      success: true,
      saleId: sale.id,
      warnings: validation.warnings
    };

  } catch (error) {
    console.error('Error processing sale transaction:', error);

    // Rollback automático
    try {
      if (reservationToken) {
        await releaseImeiSerialReservations(reservationToken);
      }

      if (saleId && !isDemoMode && supabase) {
        // Eliminar items de venta creados
        if (createdSaleItems.length > 0) {
          await supabase
            .from('sale_items')
            .delete()
            .in('id', createdSaleItems);
        }

        // Eliminar venta
        await supabase
          .from('sales')
          .delete()
          .eq('id', saleId);
      }
    } catch (rollbackError) {
      console.error('Error in rollback:', rollbackError);
    }

    return {
      success: false,
      error: (error as Error).message || 'Error interno al procesar la venta'
    };
  }
};

// Verificar disponibilidad de productos antes de mostrar en el carrito
export const checkProductAvailability = async (productId: string): Promise<{
  isAvailable: boolean;
  stock: number;
  requiresImeiSerial: boolean;
  availableImeiSerials: number;
  message?: string;
}> => {
  try {
    if (isDemoMode) {
      return {
        isAvailable: true,
        stock: 15,
        requiresImeiSerial: true,
        availableImeiSerials: 10,
        message: 'Producto disponible en modo demo'
      };
    }

    if (!supabase) {
      return {
        isAvailable: false,
        stock: 0,
        requiresImeiSerial: false,
        availableImeiSerials: 0,
        message: 'Sistema de base de datos no disponible'
      };
    }

    const { data: product, error } = await supabase
      .from('products')
      .select('id, name, stock, requires_imei_serial, imei_serial_type')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return {
        isAvailable: false,
        stock: 0,
        requiresImeiSerial: false,
        availableImeiSerials: 0,
        message: 'Producto no encontrado'
      };
    }

    if (product.stock <= 0) {
      return {
        isAvailable: false,
        stock: product.stock,
        requiresImeiSerial: product.requires_imei_serial,
        availableImeiSerials: 0,
        message: 'Producto sin stock'
      };
    }

    // Si requiere IMEI/Serial, verificar disponibilidad
    if (product.requires_imei_serial) {
      const { data: availableImeiSerials, error: imeiError } = await supabase
        .from('product_imei_serials')
        .select('id')
        .eq('product_id', productId)
        .eq('status', 'available');

      if (imeiError) {
        return {
          isAvailable: false,
          stock: product.stock,
          requiresImeiSerial: true,
          availableImeiSerials: 0,
          message: 'Error al verificar IMEI/Serial disponibles'
        };
      }

      const availableCount = availableImeiSerials?.length || 0;

      if (availableCount === 0) {
        return {
          isAvailable: false,
          stock: product.stock,
          requiresImeiSerial: true,
          availableImeiSerials: 0,
          message: `No hay unidades con ${product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'} disponibles`
        };
      }

      return {
        isAvailable: true,
        stock: product.stock,
        requiresImeiSerial: true,
        availableImeiSerials: availableCount,
        message: `${availableCount} unidades con ${product.imei_serial_type === 'imei' ? 'IMEI' : 'Serial'} disponibles`
      };
    }

    return {
      isAvailable: true,
      stock: product.stock,
      requiresImeiSerial: false,
      availableImeiSerials: 0,
      message: `${product.stock} unidades disponibles`
    };

  } catch (error) {
    console.error('Error checking product availability:', error);
    return {
      isAvailable: false,
      stock: 0,
      requiresImeiSerial: false,
      availableImeiSerials: 0,
      message: 'Error interno al verificar disponibilidad'
    };
  }
};

// Validar que una venta pueda ser modificada o eliminada
export const validateSaleModification = async (
  saleId: string,
  userId: string,
  userRole: string
): Promise<{ canModify: boolean; reason?: string }> => {
  try {
    if (isDemoMode) {
      return { canModify: true };
    }

    if (!supabase) {
      return { canModify: false, reason: 'Sistema de base de datos no disponible' };
    }

    // Obtener información de la venta
    const { data: sale, error } = await supabase
      .from('sales')
      .select('id, user_id, created_at, payment_status')
      .eq('id', saleId)
      .single();

    if (error || !sale) {
      return { canModify: false, reason: 'Venta no encontrada' };
    }

    // Solo admin y manager pueden modificar ventas de otros usuarios
    if (sale.user_id !== userId && !['admin', 'manager'].includes(userRole)) {
      return { canModify: false, reason: 'No tienes permisos para modificar esta venta' };
    }

    // No permitir modificar ventas muy antiguas (más de 24 horas)
    const saleDate = new Date(sale.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24 && userRole !== 'admin') {
      return { canModify: false, reason: 'No se pueden modificar ventas de más de 24 horas' };
    }

    // No permitir modificar ventas pagadas completamente (solo admin)
    if (sale.payment_status === 'paid' && userRole !== 'admin') {
      return { canModify: false, reason: 'No se pueden modificar ventas completamente pagadas' };
    }

    return { canModify: true };

  } catch (error) {
    console.error('Error validating sale modification:', error);
    return { canModify: false, reason: 'Error interno al validar modificación' };
  }
};

// Función para limpiar reservas expiradas (debe ejecutarse periódicamente)
export const cleanupExpiredReservations = async (): Promise<number> => {
  if (isDemoMode) {
    return 0;
  }

  if (!supabase) {
    return 0;
  }

  try {
    // Liberar reservas de más de 10 minutos
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('product_imei_serials')
      .update({
        status: 'available',
        notes: 'Liberado automáticamente por expiración de reserva',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'reserved')
      .lt('updated_at', tenMinutesAgo)
      .select('id');

    if (error) {
      console.error('Error cleaning up expired reservations:', error);
      return 0;
    }

    const cleanedCount = data?.length || 0;
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired IMEI/Serial reservations`);
    }

    return cleanedCount;
  } catch (error) {
    console.error('Error in cleanupExpiredReservations:', error);
    return 0;
  }
};

// Ejecutar limpieza automática cada 5 minutos
if (typeof window !== 'undefined') {
  setInterval(() => {
    cleanupExpiredReservations().catch(console.error);
  }, 5 * 60 * 1000);
}
// Función para eliminar venta de forma segura
export const deleteSaleSafely = async (
  saleId: string,
  userId: string,
  userRole: string,
  reason: string = 'Eliminación manual'
): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> => {
  try {
    if (isDemoMode) {
      return {
        success: true,
        details: {
          sale_id: saleId,
          sale_items_deleted: 2,
          stock_restored: 3,
          imei_serials_restored: 1,
          total_amount: 1500000
        }
      };
    }

    if (!supabase) {
      return {
        success: false,
        error: 'Sistema de base de datos no disponible'
      };
    }

    // Intentar usar función RPC primero, con fallback a eliminación directa
    try {
      // Verificar permisos antes de eliminar
      const { data: canDeleteResult, error: permissionError } = await supabase.rpc('can_delete_sale', {
        p_sale_id: saleId,
        p_user_role: userRole
      });

      if (permissionError) {
        // Si la función no existe, usar validación básica
        if (permissionError.message.includes('function') && permissionError.message.includes('does not exist')) {
          console.warn('RPC function can_delete_sale not available, using basic validation');
        } else {
          return {
            success: false,
            error: `Error al verificar permisos: ${permissionError.message}`
          };
        }
      } else if (canDeleteResult && !canDeleteResult.can_delete) {
        return {
          success: false,
          error: canDeleteResult.reason || 'No se puede eliminar esta venta'
        };
      }

      // Ejecutar eliminación segura
      const { data: deleteResult, error: deleteError } = await supabase.rpc('delete_sale_safely', {
        p_sale_id: saleId,
        p_user_id: userId,
        p_reason: reason
      });

      if (deleteError) {
        // Si la función no existe, usar eliminación directa
        if (deleteError.message.includes('function') && deleteError.message.includes('does not exist')) {
          console.warn('RPC function delete_sale_safely not available, using direct deletion');
          return await performDirectSaleDeletion(saleId, userId, reason);
        } else {
          return {
            success: false,
            error: `Error al eliminar venta: ${deleteError.message}`
          };
        }
      }

      if (!deleteResult.success) {
        return {
          success: false,
          error: deleteResult.error || 'Error desconocido al eliminar venta'
        };
      }

      return {
        success: true,
        details: deleteResult
      };
    } catch (rpcError) {
      console.warn('RPC functions not available, using direct deletion method');
      return await performDirectSaleDeletion(saleId, userId, reason);
    }

  } catch (error) {
    console.error('Error in deleteSaleSafely:', error);
    return {
      success: false,
      error: `Error interno: ${(error as Error).message}`
    };
  }
};

// Función para eliminación directa cuando las funciones RPC no están disponibles
const performDirectSaleDeletion = async (
  saleId: string,
  userId: string,
  reason: string
): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> => {
  try {
    // Obtener información de la venta antes de eliminar
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items (
          id,
          product_id,
          quantity,
          product:products (id, name, stock, requires_imei_serial)
        )
      `)
      .eq('id', saleId)
      .single();

    if (saleError || !sale) {
      return {
        success: false,
        error: 'Venta no encontrada'
      };
    }

    let stockRestored = 0;
    let imeiSerialsRestored = 0;

    // Restaurar IMEI/Serial a estado disponible
    const { data: restoredImeiSerials, error: imeiError } = await supabase
      .from('product_imei_serials')
      .update({
        status: 'available',
        sale_id: null,
        sale_item_id: null,
        sold_at: null,
        notes: `Restaurado por eliminación de venta #${saleId.slice(-8)}`,
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .eq('sale_id', saleId)
      .select('id');

    if (!imeiError && restoredImeiSerials) {
      imeiSerialsRestored = restoredImeiSerials.length;
    }

    // Restaurar stock para productos sin IMEI/Serial requerido
    for (const item of sale.sale_items) {
      if (!item.product.requires_imei_serial) {
        const { error: stockError } = await supabase
          .from('products')
          .update({ 
            stock: item.product.stock + item.quantity 
          })
          .eq('id', item.product.id);

        if (!stockError) {
          stockRestored += item.quantity;
        }
      }
    }

    // Eliminar abonos asociados
    const { error: installmentsError } = await supabase
      .from('payment_installments')
      .delete()
      .eq('sale_id', saleId);

    // Eliminar registros de caja registradora
    const { error: cashRegisterError } = await supabase
      .from('cash_register_sales')
      .delete()
      .eq('sale_id', saleId);

    // Eliminar pagos asociados
    const { error: paymentsError } = await supabase
      .from('payments')
      .delete()
      .eq('sale_id', saleId);

    // Eliminar items de venta
    const { error: itemsError } = await supabase
      .from('sale_items')
      .delete()
      .eq('sale_id', saleId);

    if (itemsError) {
      throw new Error(`Error al eliminar items: ${itemsError.message}`);
    }

    // Finalmente eliminar la venta
    const { error: deleteSaleError } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId);

    if (deleteSaleError) {
      throw new Error(`Error al eliminar venta: ${deleteSaleError.message}`);
    }

    return {
      success: true,
      details: {
        sale_id: saleId,
        sale_items_deleted: sale.sale_items.length,
        stock_restored: stockRestored,
        imei_serials_restored: imeiSerialsRestored,
        total_amount: sale.total_amount,
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        reason: reason
      }
    };

  } catch (error) {
    console.error('Error in direct sale deletion:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

// Función para obtener el impacto de eliminar una venta
export const getSaleDeletionImpact = async (saleId: string): Promise<{
  success: boolean;
  impact?: any;
  error?: string;
}> => {
  try {
    if (isDemoMode) {
      return {
        success: true,
        impact: {
          sale_info: {
            id: saleId,
            total_amount: 1500000,
            payment_type: 'cash',
            payment_status: 'paid'
          },
          items: [
            {
              product_name: 'Producto Demo',
              quantity: 1,
              requires_imei_serial: true,
              current_stock: 5
            }
          ],
          imei_serials: [
            {
              imei_number: '123456789012345',
              product_name: 'Producto Demo',
              status: 'sold'
            }
          ],
          impact_summary: {
            stock_to_restore: 0,
            imei_serials_to_restore: 1
          }
        }
      };
    }

    if (!supabase) {
      return {
        success: false,
        error: 'Sistema de base de datos no disponible'
      };
    }

    try {
      const { data: impactData, error } = await supabase.rpc('get_sale_deletion_impact', {
        p_sale_id: saleId
      });

      if (error) {
        // Si la función no existe, calcular impacto manualmente
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          return await calculateDeletionImpactManually(saleId);
        } else {
          return {
            success: false,
            error: error.message
          };
        }
      }

      return {
        success: true,
        impact: impactData
      };
    } catch (rpcError) {
      console.warn('RPC function not available, calculating impact manually');
      return await calculateDeletionImpactManually(saleId);
    }

  } catch (error) {
    console.error('Error getting sale deletion impact:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

// Función para calcular impacto manualmente
const calculateDeletionImpactManually = async (saleId: string): Promise<{
  success: boolean;
  impact?: any;
  error?: string;
}> => {
  try {
    // Obtener información de la venta
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        *,
        customer:customers(name),
        sale_items (
          id,
          quantity,
          unit_price,
          total_price,
          product:products (id, name, requires_imei_serial, stock)
        )
      `)
      .eq('id', saleId)
      .single();

    if (saleError || !sale) {
      return {
        success: false,
        error: 'Venta no encontrada'
      };
    }

    // Obtener IMEI/Serial asociados
    const { data: imeiSerials, error: imeiError } = await supabase
      .from('product_imei_serials')
      .select(`
        id,
        imei_number,
        serial_number,
        status,
        product:products(name)
      `)
      .eq('sale_id', saleId);

    // Contar abonos
    const { data: installments, error: installmentsError } = await supabase
      .from('payment_installments')
      .select('id')
      .eq('sale_id', saleId);

    // Calcular impacto
    const stockToRestore = sale.sale_items
      .filter(item => !item.product.requires_imei_serial)
      .reduce((sum, item) => sum + item.quantity, 0);

    const imeiSerialsToRestore = imeiSerials?.length || 0;

    return {
      success: true,
      impact: {
        sale_info: {
          id: sale.id,
          total_amount: sale.total_amount,
          payment_type: sale.payment_type,
          payment_status: sale.payment_status,
          created_at: sale.created_at,
          customer_name: sale.customer?.name || 'Sin cliente'
        },
        items: sale.sale_items.map(item => ({
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          requires_imei_serial: item.product.requires_imei_serial,
          current_stock: item.product.stock
        })),
        imei_serials: (imeiSerials || []).map(imei => ({
          id: imei.id,
          imei_number: imei.imei_number,
          serial_number: imei.serial_number,
          product_name: imei.product?.name || 'Producto desconocido',
          status: imei.status
        })),
        installments_count: installments?.length || 0,
        impact_summary: {
          stock_to_restore: stockToRestore,
          imei_serials_to_restore: imeiSerialsToRestore
        }
      }
    };

  } catch (error) {
    console.error('Error calculating deletion impact manually:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

// Función para limpiar datos huérfanos
export const cleanupOrphanedSaleData = async (): Promise<{
  success: boolean;
  cleaned?: any;
  error?: string;
}> => {
  try {
    if (isDemoMode) {
      return {
        success: true,
        cleaned: {
          orphaned_items_cleaned: 0,
          orphaned_imei_serials_restored: 0,
          orphaned_payments_cleaned: 0
        }
      };
    }

    if (!supabase) {
      return {
        success: false,
        error: 'Sistema de base de datos no disponible'
      };
    }

    try {
      const { data: cleanupResult, error } = await supabase.rpc('cleanup_orphaned_sale_data');

      if (error) {
        // Si la función no existe, hacer limpieza manual
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          return await performManualCleanup();
        } else {
          return {
            success: false,
            error: error.message
          };
        }
      }

      return {
        success: true,
        cleaned: cleanupResult
      };
    } catch (rpcError) {
      console.warn('RPC function not available, performing manual cleanup');
      return await performManualCleanup();
    }

  } catch (error) {
    console.error('Error in cleanupOrphanedSaleData:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

// Función para limpieza manual de datos huérfanos
const performManualCleanup = async (): Promise<{
  success: boolean;
  cleaned?: any;
  error?: string;
}> => {
  try {
    let orphanedItemsCleaned = 0;
    let orphanedImeiSerialsRestored = 0;
    let orphanedPaymentsCleaned = 0;
    let orphanedInstallmentsCleaned = 0;

    // Limpiar sale_items huérfanos
    const { data: orphanedItems, error: itemsError } = await supabase
      .from('sale_items')
      .delete()
      .not('sale_id', 'in', `(SELECT id FROM sales)`)
      .select('id');

    if (!itemsError && orphanedItems) {
      orphanedItemsCleaned = orphanedItems.length;
    }

    // Restaurar IMEI/Serial huérfanos
    const { data: restoredImeiSerials, error: imeiError } = await supabase
      .from('product_imei_serials')
      .update({
        status: 'available',
        sale_id: null,
        sale_item_id: null,
        sold_at: null,
        notes: 'Restaurado por limpieza automática - venta eliminada',
        updated_at: new Date().toISOString()
      })
      .not('sale_id', 'in', `(SELECT id FROM sales)`)
      .not('sale_id', 'is', null)
      .select('id');

    if (!imeiError && restoredImeiSerials) {
      orphanedImeiSerialsRestored = restoredImeiSerials.length;
    }

    // Limpiar pagos huérfanos
    const { data: orphanedPayments, error: paymentsError } = await supabase
      .from('payments')
      .delete()
      .not('sale_id', 'in', `(SELECT id FROM sales)`)
      .select('id');

    if (!paymentsError && orphanedPayments) {
      orphanedPaymentsCleaned = orphanedPayments.length;
    }

    // Limpiar abonos huérfanos
    const { data: orphanedInstallments, error: installmentsError } = await supabase
      .from('payment_installments')
      .delete()
      .not('sale_id', 'in', `(SELECT id FROM sales)`)
      .select('id');

    if (!installmentsError && orphanedInstallments) {
      orphanedInstallmentsCleaned = orphanedInstallments.length;
    }

    return {
      success: true,
      cleaned: {
        orphaned_items_cleaned: orphanedItemsCleaned,
        orphaned_imei_serials_restored: orphanedImeiSerialsRestored,
        orphaned_payments_cleaned: orphanedPaymentsCleaned,
        orphaned_installments_cleaned: orphanedInstallmentsCleaned,
        cleanup_timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('Error in manual cleanup:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};