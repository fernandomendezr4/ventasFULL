import React, { useState } from 'react';
import { Shield, BarChart3, Bell, FileText, Settings, AlertTriangle, Database, Activity, CheckCircle } from 'lucide-react';
import AuditDashboard from './AuditDashboard';
import AuditReportGenerator from './AuditReportGenerator';
import AuditAlertManager from './AuditAlertManager';
import AuditComplianceReports from './AuditComplianceReports';
import { useAuth } from '../contexts/AuthContext';
import { isDemoMode } from '../lib/supabase';

export default function AuditSystemManager() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [showAlertManager, setShowAlertManager] = useState(false);

  // Verificar permisos de auditoría
  if (!user || !['admin', 'manager'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <div className="text-red-600 mb-4">
            <Shield className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Acceso Restringido</h2>
          <p className="text-slate-600 mb-4">
            No tienes permisos para acceder al sistema de auditoría.
          </p>
          <p className="text-sm text-slate-500">
            Solo administradores y gerentes pueden acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: BarChart3, 
      description: 'Vista general de la actividad de auditoría' 
    },
    { 
      id: 'compliance', 
      label: 'Cumplimiento', 
      icon: Shield, 
      description: 'Reportes de cumplimiento normativo' 
    },
    { 
      id: 'reports', 
      label: 'Reportes', 
      icon: FileText, 
      description: 'Generación y gestión de reportes' 
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AuditDashboard />;
      case 'compliance':
        return <AuditComplianceReports />;
      case 'reports':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900">Gestión de Reportes</h3>
              <button
                onClick={() => setShowReportGenerator(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
              >
                <FileText className="h-4 w-4 mr-2" />
                Nuevo Reporte
              </button>
            </div>
            <AuditDashboard />
          </div>
        );
      default:
        return <AuditDashboard />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-sm text-white p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center">
              <Shield className="h-8 w-8 mr-3" />
              Sistema de Auditoría
              {isDemoMode && (
                <span className="ml-3 text-sm bg-yellow-500 text-yellow-900 px-3 py-1 rounded-full">
                  MODO DEMO
                </span>
              )}
            </h1>
            <p className="text-blue-100 text-lg">
              Monitoreo, análisis y cumplimiento normativo integral
            </p>
            <div className="flex items-center gap-6 mt-4 text-sm">
              <div className="flex items-center">
                <Database className="h-4 w-4 mr-2" />
                <span>Auditoría automática {isDemoMode ? 'simulada' : 'activa'}</span>
              </div>
              <div className="flex items-center">
                <Bell className="h-4 w-4 mr-2" />
                <span>Sistema de alertas {isDemoMode ? 'demo' : 'funcionando'}</span>
              </div>
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                <span>Reportes en tiempo real</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm">Usuario:</p>
            <p className="font-semibold">{user.name}</p>
            <p className="text-blue-200 text-sm">Rol: {user.role}</p>
          </div>
        </div>
      </div>

      {/* Navegación por Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center px-6 py-4 text-sm font-medium transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-5 w-5 mb-1" />
                  <span>{tab.label}</span>
                  <span className="text-xs text-slate-500 mt-1 text-center">
                    {tab.description}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Contenido de la Tab Activa */}
        <div className="p-6">
          {renderContent()}
        </div>
      </div>

      {/* Modales */}
      <AuditReportGenerator
        isOpen={showReportGenerator}
        onClose={() => setShowReportGenerator(false)}
        onReportGenerated={() => {
          setShowReportGenerator(false);
        }}
      />

      <AuditAlertManager
        isOpen={showAlertManager}
        onClose={() => setShowAlertManager(false)}
        onUpdate={() => {
          // Recargar datos de alertas si es necesario
        }}
      />

      {/* Información del Sistema */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Database className="h-5 w-5 mr-2 text-blue-600" />
          Estado del Sistema de Auditoría
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Auditoría Automática</p>
                <p className="font-bold text-green-900">{isDemoMode ? 'Demo' : 'Activa'}</p>
              </div>
              <Shield className="h-6 w-6 text-green-600" />
            </div>
          </div>

          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Retención de Datos</p>
                <p className="font-bold text-blue-900">365 días</p>
              </div>
              <Database className="h-6 w-6 text-blue-600" />
            </div>
          </div>

          <div className="bg-white border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Mantenimiento</p>
                <p className="font-bold text-purple-900">Automático</p>
              </div>
              <Settings className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Características del Sistema</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Auditoría en tiempo real de todas las operaciones</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Detección de patrones sospechosos</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Reportes de cumplimiento automáticos</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Retención y archivado automático</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Configuración granular por entidad</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-3 w-3 mr-2" />
              <span>Integración completa con cajas registradoras</span>
            </div>
          </div>
        </div>

        {isDemoMode && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">Modo Demo Activo</h4>
            <p className="text-sm text-yellow-800">
              Estás viendo datos de demostración. Para usar el sistema de auditoría completo, 
              configura las variables de entorno de Supabase y conecta una base de datos real.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}