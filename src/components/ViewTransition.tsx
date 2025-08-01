import React, { useEffect, useState } from 'react';

interface ViewTransitionProps {
  children: React.ReactNode;
  transitionKey: string;
  type?: 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'scale' | 'dashboard' | 'form';
  duration?: number;
  delay?: number;
  className?: string;
}

export default function ViewTransition({
  children,
  transitionKey,
  type = 'fade',
  duration = 200, // Reducir duración de animaciones
  delay = 0,
  className = ''
}: ViewTransitionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentKey, setCurrentKey] = useState(transitionKey);

  useEffect(() => {
    if (transitionKey !== currentKey) {
      // Salida de la vista anterior
      setIsVisible(false);
      
      // Entrada de la nueva vista después de un breve delay
      const timer = setTimeout(() => {
        setCurrentKey(transitionKey);
        setIsVisible(true);
      }, 50); // Reducir delay entre transiciones

      return () => clearTimeout(timer);
    } else {
      // Primera carga
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [transitionKey, currentKey, delay]);

  const getTransitionClasses = () => {
    const baseClasses = 'transition-gpu';
    
    switch (type) {
      case 'slide-left':
        return `${baseClasses} ${isVisible ? 'slide-left-enter-active' : 'slide-left-enter'}`;
      case 'slide-right':
        return `${baseClasses} ${isVisible ? 'slide-right-enter-active' : 'slide-right-enter'}`;
      case 'slide-up':
        return `${baseClasses} ${isVisible ? 'content-slide-up' : 'opacity-0 translate-y-8'}`;
      case 'scale':
        return `${baseClasses} ${isVisible ? 'smooth-appear' : 'opacity-0 scale-95'}`;
      case 'dashboard':
        return `${baseClasses} ${isVisible ? 'dashboard-enter-active' : 'dashboard-enter'}`;
      case 'form':
        return `${baseClasses} ${isVisible ? 'form-enter-active' : 'form-enter'}`;
      case 'fade':
      default:
        return `${baseClasses} ${isVisible ? 'content-fade-in' : 'opacity-0'}`;
    }
  };

  return (
    <div 
      className={`view-transition-container ${getTransitionClasses()} ${className}`}
      style={{ 
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
}

// Hook personalizado para manejar transiciones de vista
export function useViewTransition(initialView: string) {
  const [currentView, setCurrentView] = useState(initialView);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const changeView = (newView: string, delay: number = 0) => {
    if (newView === currentView) return;

    setIsTransitioning(true);
    
    setTimeout(() => {
      setCurrentView(newView);
      
      // Finalizar transición después de que se complete la animación
      setTimeout(() => {
        setIsTransitioning(false);
      }, 400);
    }, delay);
  };

  return {
    currentView,
    isTransitioning,
    changeView
  };
}

// Componente para transiciones de lista
interface ListTransitionProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  className?: string;
}

export function ListTransition({ 
  children, 
  staggerDelay = 100,
  className = '' 
}: ListTransitionProps) {
  const [visibleItems, setVisibleItems] = useState<boolean[]>([]);

  useEffect(() => {
    const newVisibleItems = new Array(children.length).fill(false);
    setVisibleItems(newVisibleItems);

    // Mostrar elementos con stagger
    children.forEach((_, index) => {
      setTimeout(() => {
        setVisibleItems(prev => {
          const updated = [...prev];
          updated[index] = true;
          return updated;
        });
      }, index * staggerDelay);
    });
  }, [children.length, staggerDelay]);

  return (
    <div className={`space-y-2 ${className}`}>
      {children.map((child, index) => (
        <div
          key={index}
          className={`transition-gpu ${
            visibleItems[index] 
              ? 'list-item-enter-active' 
              : 'list-item-enter'
          }`}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

// Componente para transiciones de tabs
interface TabTransitionProps {
  children: React.ReactNode;
  activeTab: string;
  tabKey: string;
  className?: string;
}

export function TabTransition({ 
  children, 
  activeTab, 
  tabKey,
  className = '' 
}: TabTransitionProps) {
  const [isActive, setIsActive] = useState(activeTab === tabKey);

  useEffect(() => {
    if (activeTab === tabKey) {
      setIsActive(true);
    } else {
      const timer = setTimeout(() => {
        setIsActive(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [activeTab, tabKey]);

  if (!isActive && activeTab !== tabKey) {
    return null;
  }

  return (
    <div
      className={`transition-gpu ${
        activeTab === tabKey
          ? 'tab-content-enter-active'
          : 'tab-content-exit-active'
      } ${className}`}
    >
      {children}
    </div>
  );
}