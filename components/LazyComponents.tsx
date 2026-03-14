/**
 * Lazy Loading Components for LCP Optimization
 * 
 * These components use React.lazy + Suspense to defer loading of
 * non-critical components (charts, graphs) until after initial render.
 * This improves LCP by prioritizing the main summary card.
 */

import React, { Suspense, lazy, ComponentType } from 'react';

// Lazy load Recharts - this is a large library that slows initial render
// In Next.js this would be: dynamic(() => import('recharts'), { ssr: false })
// For Vite/React, we use React.lazy

// ============================================================================
// Fix #3: Dynamic imports for chart library (equivalent to next/dynamic ssr:false)
// ============================================================================

const RechartsBarChart = lazy(() => import('./charts/RechartsBarChart'));
const RechartsPieChart = lazy(() => import('./charts/RechartsPieChart'));

// Fallback skeleton for charts - renders immediately while chart loads
export const ChartSkeleton = () => (
  <div className="animate-pulse bg-gray-200 dark:bg-white/5 rounded-xl h-40 w-full" />
);

// ============================================================================
// Fix #2: Suspense-wrapped non-critical components
// ============================================================================

interface LazyChartProps {
  data: any[];
  dataKey?: string;
  height?: number;
}

// Bar Chart - lazy loaded with Suspense
export const LazyBarChart: React.FC<LazyChartProps> = (props) => (
  <Suspense fallback={<ChartSkeleton />}>
    <RechartsBarChart {...props} />
  </Suspense>
);

// Pie Chart - lazy loaded with Suspense  
export const LazyPieChart: React.FC<LazyChartProps> = (props) => (
  <Suspense fallback={<ChartSkeleton />}>
    <RechartsPieChart {...props} />
  </Suspense>
);

// ============================================================================
// Generic Lazy Wrapper for any component
// ============================================================================

interface LazyWrapperProps {
  component: () => Promise<{ default: ComponentType<any> }>;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
}

export const LazyWrapper: React.FC<LazyWrapperProps> = ({ 
  component, 
  fallback = <div className="animate-pulse h-20 bg-gray-200 dark:bg-white/5 rounded-xl" />
}) => {
  const LazyComponent = lazy(component);
  return (
    <Suspense fallback={fallback}>
      <LazyComponent />
    </Suspense>
  );
};

// ============================================================================
// Preload helper - prefetch lazy components on idle
// ============================================================================

export const prefetchCharts = () => {
  // Prefetch chart components when browser is idle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      import('./charts/RechartsBarChart');
      import('./charts/RechartsPieChart');
    });
  } {
    // Fallback for Safari/older browsers
    setTimeout(() => {
      import('./charts/RechartsBarChart');
      import('./charts/RechartsPieChart');
    }, 2000);
  }
};
