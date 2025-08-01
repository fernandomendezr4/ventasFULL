import React, { useState, useEffect, useRef } from 'react';

interface LazyLoaderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}

export default function LazyLoader({ 
  children, 
  fallback = <div className="animate-pulse bg-slate-200 rounded h-32"></div>,
  threshold = 0.1,
  rootMargin = '50px'
}: LazyLoaderProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          setIsVisible(true);
          setHasLoaded(true);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin, hasLoaded]);

  return (
    <div ref={ref} className="lazy-load">
      {isVisible ? children : fallback}
    </div>
  );
}

// Hook para lazy loading de datos
export function useLazyData<T>(
  loadFunction: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasLoaded = useRef(false);

  const loadData = async () => {
    if (hasLoaded.current) return;
    
    try {
      setLoading(true);
      setError(null);
      const result = await loadFunction();
      setData(result);
      hasLoaded.current = true;
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    loadData,
    hasLoaded: hasLoaded.current
  };
}