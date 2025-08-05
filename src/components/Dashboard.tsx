import React from 'react';
import OptimizedDashboard from './OptimizedDashboard';

interface DashboardProps {
  onTabChange?: (tab: string) => void;
}

export default function Dashboard({ onTabChange }: DashboardProps) {
  return <OptimizedDashboard onTabChange={onTabChange} />;
}