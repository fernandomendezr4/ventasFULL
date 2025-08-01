import React, { useEffect, useState } from 'react';
import { Activity, Zap, Clock } from 'lucide-react';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  connectionSpeed: 'fast' | 'slow' | 'offline';
}

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    connectionSpeed: 'fast'
  });
  const [showMetrics, setShowMetrics] = useState(false);

  useEffect(() => {
    // Medir tiempo de carga
    const loadTime = performance.now();
    
    // Medir uso de memoria si está disponible
    const memoryInfo = (performance as any).memory;
    const memoryUsage = memoryInfo ? memoryInfo.usedJSHeapSize / 1024 / 1024 : 0;
    
    // Detectar velocidad de conexión
    const connection = (navigator as any).connection;
    const connectionSpeed = connection?.effectiveType === '4g' ? 'fast' : 
                           connection?.effectiveType === '3g' ? 'slow' : 'fast';

    setMetrics({
      loadTime: loadTime,
      renderTime: performance.now() - loadTime,
      memoryUsage: memoryUsage,
      connectionSpeed: connectionSpeed
    });

    // Optimizaciones automáticas basadas en rendimiento
    if (connectionSpeed === 'slow' || memoryUsage > 100) {
      // Aplicar optimizaciones para dispositivos lentos
      document.documentElement.classList.add('performance-mode');
    }
  }, []);

  // Solo mostrar en desarrollo
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setShowMetrics(!showMetrics)}
        className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-200"
      >
        <Activity className="h-4 w-4" />
      </button>
      
      {showMetrics && (
        <div className="absolute bottom-12 right-0 bg-white rounded-lg shadow-xl p-4 min-w-64 border">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
            <Zap className="h-4 w-4 mr-2 text-yellow-600" />
            Métricas de Rendimiento
          </h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Tiempo de carga:</span>
              <span className="font-mono">{metrics.loadTime.toFixed(2)}ms</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-slate-600">Memoria usada:</span>
              <span className="font-mono">{metrics.memoryUsage.toFixed(1)}MB</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-slate-600">Conexión:</span>
              <span className={`font-medium ${
                metrics.connectionSpeed === 'fast' ? 'text-green-600' : 
                metrics.connectionSpeed === 'slow' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {metrics.connectionSpeed}
              </span>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-slate-200">
            <button
              onClick={() => {
                // Limpiar cache
                localStorage.clear();
                window.location.reload();
              }}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Limpiar Cache y Recargar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}