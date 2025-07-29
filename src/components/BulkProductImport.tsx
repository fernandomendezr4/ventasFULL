import React, { useState } from 'react';
import { Upload, Download, FileText, AlertTriangle, CheckCircle, X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BulkProductData, BulkImportResult, Category, Supplier } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import FormattedNumberInput from './FormattedNumberInput';

interface BulkProductImportProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  suppliers: Supplier[];
}

export default function BulkProductImport({ 
  isOpen, 
  onClose, 
  onSuccess, 
  categories, 
  suppliers 
}: BulkProductImportProps) {
  const { user } = useAuth();
  const [importMethod, setImportMethod] = useState<'file' | 'manual'>('file');
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [manualProducts, setManualProducts] = useState<BulkProductData[]>([
    {
      name: '',
      description: '',
      sale_price: 0,
      purchase_price: 0,
      stock: 0,
      barcode: '',
      category_id: '',
      supplier_id: '',
      has_imei_serial: false,
      imei_serial_type: 'serial',
      requires_imei_serial: false,
      import_notes: ''
    }
  ]);

  if (!isOpen) return null;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const text = await file.text();
      let productsData: BulkProductData[];

      if (file.name.endsWith('.json')) {
        productsData = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        productsData = parseCSV(text);
      } else {
        throw new Error('Formato de archivo no soportado. Use JSON o CSV.');
      }

      await processBulkImport(productsData);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error al procesar archivo: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const parseCSV = (csvText: string): BulkProductData[] => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const products: BulkProductData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length || !values[0]) continue;

      const product: BulkProductData = {
        name: values[0] || '',
        description: values[1] || '',
        sale_price: parseFloat(values[2]) || 0,
        purchase_price: parseFloat(values[3]) || 0,
        stock: parseInt(values[4]) || 0,
        barcode: values[5] || '',
        category_id: values[6] || '',
        supplier_id: values[7] || '',
        has_imei_serial: values[8]?.toLowerCase() === 'true' || false,
        imei_serial_type: (values[9] as 'imei' | 'serial' | 'both') || 'serial',
        requires_imei_serial: values[10]?.toLowerCase() === 'true' || false,
        import_notes: values[11] || ''
      };

      products.push(product);
    }

    return products;
  };

  const processBulkImport = async (productsData: BulkProductData[]) => {
    try {
      const batchId = `BULK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data, error } = await supabase.rpc('bulk_import_products', {
        products_data: productsData,
        batch_id: batchId,
        imported_by_user: user?.id
      });

      if (error) throw error;

      setImportResult(data as BulkImportResult);
    } catch (error) {
      console.error('Error in bulk import:', error);
      alert('Error en importación masiva: ' + (error as Error).message);
    }
  };

  const handleManualImport = async () => {
    const validProducts = manualProducts.filter(p => p.name.trim() !== '');
    if (validProducts.length === 0) {
      alert('Debe agregar al menos un producto válido');
      return;
    }

    setLoading(true);
    await processBulkImport(validProducts);
    setLoading(false);
  };

  const addManualProduct = () => {
    setManualProducts([
      ...manualProducts,
      {
        name: '',
        description: '',
        sale_price: 0,
        purchase_price: 0,
        stock: 0,
        barcode: '',
        category_id: '',
        supplier_id: '',
        has_imei_serial: false,
        imei_serial_type: 'serial',
        requires_imei_serial: false,
        import_notes: ''
      }
    ]);
  };

  const removeManualProduct = (index: number) => {
    if (manualProducts.length > 1) {
      setManualProducts(manualProducts.filter((_, i) => i !== index));
    }
  };

  const updateManualProduct = (index: number, field: keyof BulkProductData, value: any) => {
    const updated = [...manualProducts];
    updated[index] = { ...updated[index], [field]: value };
    setManualProducts(updated);
  };

  const downloadTemplate = () => {
    const template = [
      {
        name: 'Producto Ejemplo 1',
        description: 'Descripción del producto',
        sale_price: 100000,
        purchase_price: 80000,
        stock: 10,
        barcode: '1234567890123',
        category_id: '', // Dejar vacío o usar UUID de categoría
        supplier_id: '', // Dejar vacío o usar UUID de proveedor
        has_imei_serial: false,
        imei_serial_type: 'serial',
        requires_imei_serial: false,
        import_notes: 'Importado desde plantilla'
      },
      {
        name: 'Celular Samsung Galaxy',
        description: 'Smartphone con seguimiento IMEI',
        sale_price: 800000,
        purchase_price: 600000,
        stock: 5,
        barcode: '9876543210987',
        category_id: '',
        supplier_id: '',
        has_imei_serial: true,
        imei_serial_type: 'imei',
        requires_imei_serial: true,
        import_notes: 'Producto con IMEI obligatorio'
      }
    ];
    
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_productos.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSVTemplate = () => {
    const csvContent = `name,description,sale_price,purchase_price,stock,barcode,category_id,supplier_id,has_imei_serial,imei_serial_type,requires_imei_serial,import_notes
Producto Ejemplo,Descripción del producto,100000,80000,10,1234567890123,,,false,serial,false,Importado desde CSV
Celular Samsung,Smartphone con IMEI,800000,600000,5,9876543210987,,,true,imei,true,Producto con IMEI`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_productos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900 flex items-center">
              <Upload className="h-6 w-6 mr-3 text-blue-600" />
              Importación Masiva de Productos
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-2">
            Importa múltiples productos desde un archivo JSON/CSV o agrégalos manualmente
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!importResult ? (
            <div className="p-6">
              {/* Import Method Selection */}
              <div className="mb-6">
                <h4 className="font-medium text-slate-900 mb-3">Método de Importación</h4>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setImportMethod('file')}
                    className={`p-4 border-2 rounded-lg transition-all duration-200 ${
                      importMethod === 'file'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <FileText className="h-6 w-6 mx-auto mb-2" />
                    <h5 className="font-medium">Desde Archivo</h5>
                    <p className="text-sm text-slate-600 mt-1">JSON o CSV</p>
                  </button>
                  <button
                    onClick={() => setImportMethod('manual')}
                    className={`p-4 border-2 rounded-lg transition-all duration-200 ${
                      importMethod === 'manual'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <Plus className="h-6 w-6 mx-auto mb-2" />
                    <h5 className="font-medium">Manual</h5>
                    <p className="text-sm text-slate-600 mt-1">Formulario</p>
                  </button>
                </div>
              </div>

              {importMethod === 'file' ? (
                <div className="space-y-6">
                  {/* Download Templates */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-3">Plantillas de Importación</h4>
                    <div className="flex gap-3">
                      <button
                        onClick={downloadTemplate}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center text-sm"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Descargar JSON
                      </button>
                      <button
                        onClick={downloadCSVTemplate}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center text-sm"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Descargar CSV
                      </button>
                    </div>
                    <p className="text-sm text-blue-800 mt-2">
                      Descarga una plantilla, complétala con tus productos y súbela aquí
                    </p>
                  </div>

                  {/* File Upload */}
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-slate-900 mb-2">
                      Selecciona tu archivo
                    </h4>
                    <p className="text-slate-600 mb-4">
                      Formatos soportados: JSON, CSV
                    </p>
                    <input
                      type="file"
                      accept=".json,.csv"
                      onChange={handleFileUpload}
                      disabled={loading}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 cursor-pointer inline-flex items-center"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Procesando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Seleccionar Archivo
                        </>
                      )}
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-900">Productos a Importar</h4>
                    <button
                      onClick={addManualProduct}
                      className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center text-sm"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </button>
                  </div>

                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {manualProducts.map((product, index) => (
                      <div key={index} className="border border-slate-300 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="font-medium text-slate-900">Producto #{index + 1}</h5>
                          {manualProducts.length > 1 && (
                            <button
                              onClick={() => removeManualProduct(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Nombre *
                            </label>
                            <input
                              type="text"
                              value={product.name}
                              onChange={(e) => updateManualProduct(index, 'name', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              placeholder="Nombre del producto"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Precio de Venta *
                            </label>
                            <FormattedNumberInput
                              value={product.sale_price.toString()}
                              onChange={(value) => updateManualProduct(index, 'sale_price', parseFloat(value) || 0)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              placeholder="0"
                              min="0"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Stock *
                            </label>
                            <FormattedNumberInput
                              value={product.stock.toString()}
                              onChange={(value) => updateManualProduct(index, 'stock', parseInt(value) || 0)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              placeholder="0"
                              min="0"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Precio de Compra
                            </label>
                            <FormattedNumberInput
                              value={product.purchase_price?.toString() || ''}
                              onChange={(value) => updateManualProduct(index, 'purchase_price', parseFloat(value) || 0)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              placeholder="0"
                              min="0"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Categoría
                            </label>
                            <select
                              value={product.category_id || ''}
                              onChange={(e) => updateManualProduct(index, 'category_id', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            >
                              <option value="">Sin categoría</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Proveedor
                            </label>
                            <select
                              value={product.supplier_id || ''}
                              onChange={(e) => updateManualProduct(index, 'supplier_id', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            >
                              <option value="">Sin proveedor</option>
                              {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                  {supplier.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="md:col-span-3">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`has_imei_serial_${index}`}
                                  checked={product.has_imei_serial || false}
                                  onChange={(e) => updateManualProduct(index, 'has_imei_serial', e.target.checked)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                                />
                                <label htmlFor={`has_imei_serial_${index}`} className="ml-2 text-sm text-slate-700">
                                  Requiere IMEI/Serial
                                </label>
                              </div>
                              
                              {product.has_imei_serial && (
                                <>
                                  <select
                                    value={product.imei_serial_type || 'serial'}
                                    onChange={(e) => updateManualProduct(index, 'imei_serial_type', e.target.value)}
                                    className="px-3 py-1 border border-slate-300 rounded text-sm"
                                  >
                                    <option value="serial">Serial</option>
                                    <option value="imei">IMEI</option>
                                    <option value="both">Ambos</option>
                                  </select>
                                  
                                  <div className="flex items-center">
                                    <input
                                      type="checkbox"
                                      id={`requires_imei_serial_${index}`}
                                      checked={product.requires_imei_serial || false}
                                      onChange={(e) => updateManualProduct(index, 'requires_imei_serial', e.target.checked)}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                                    />
                                    <label htmlFor={`requires_imei_serial_${index}`} className="ml-2 text-sm text-slate-700">
                                      Obligatorio
                                    </label>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleManualImport}
                      disabled={loading || manualProducts.every(p => !p.name.trim())}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Importando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Importar Productos
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Import Results */
            <div className="p-6">
              <div className="text-center mb-6">
                {importResult.error_count === 0 ? (
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                ) : (
                  <AlertTriangle className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
                )}
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Importación Completada
                </h3>
                <p className="text-slate-600">
                  Lote: {importResult.batch_id}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2 flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Productos Importados
                  </h4>
                  <p className="text-2xl font-bold text-green-900">{importResult.inserted_count}</p>
                </div>
                
                {importResult.error_count > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 mb-2 flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      Errores
                    </h4>
                    <p className="text-2xl font-bold text-red-900">{importResult.error_count}</p>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-900 mb-3">Detalles de Errores</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium text-red-800">{error.product_name}:</span>
                        <span className="text-red-700 ml-2">{error.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          {importResult ? (
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              Finalizar
            </button>
          ) : (
            <button
              onClick={onClose}
              className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-300 transition-colors duration-200"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}