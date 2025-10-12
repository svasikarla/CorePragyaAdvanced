// Performance monitoring utilities for the knowledge base

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface SearchPerformance {
  searchQuery: string;
  resultCount: number;
  searchTime: number;
  searchMethod: 'basic' | 'enhanced';
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private searchMetrics: SearchPerformance[] = [];
  private timers: Map<string, number> = new Map();

  // Start timing an operation
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  // End timing and record the metric
  endTimer(name: string, metadata?: Record<string, any>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      // Only warn in development mode to reduce noise in production
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Timer "${name}" was not started`);
      }
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    this.recordMetric(name, duration, metadata);
    return duration;
  }

  // Record a performance metric
  recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    };

    this.metrics.push(metric);

    // Keep only the last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Log performance issues in development
    if (process.env.NODE_ENV === 'development') {
      this.logPerformanceIssues(metric);
    }
  }

  // Record search performance specifically
  recordSearchPerformance(
    searchQuery: string,
    resultCount: number,
    searchTime: number,
    searchMethod: 'basic' | 'enhanced'
  ): void {
    const searchMetric: SearchPerformance = {
      searchQuery,
      resultCount,
      searchTime,
      searchMethod,
      timestamp: Date.now()
    };

    this.searchMetrics.push(searchMetric);

    // Keep only the last 50 search metrics
    if (this.searchMetrics.length > 50) {
      this.searchMetrics = this.searchMetrics.slice(-50);
    }

    // Record as a general metric too
    this.recordMetric('search_performance', searchTime, {
      query: searchQuery,
      resultCount,
      method: searchMethod
    });
  }

  // Get performance statistics
  getStats(): {
    averageSearchTime: number;
    totalSearches: number;
    enhancedSearchUsage: number;
    slowOperations: PerformanceMetric[];
  } {
    const searchTimes = this.searchMetrics.map(m => m.searchTime);
    const averageSearchTime = searchTimes.length > 0 
      ? searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length 
      : 0;

    const enhancedSearchCount = this.searchMetrics.filter(m => m.searchMethod === 'enhanced').length;
    const enhancedSearchUsage = this.searchMetrics.length > 0 
      ? (enhancedSearchCount / this.searchMetrics.length) * 100 
      : 0;

    const slowOperations = this.metrics.filter(m => m.value > 1000); // Operations taking more than 1 second

    return {
      averageSearchTime,
      totalSearches: this.searchMetrics.length,
      enhancedSearchUsage,
      slowOperations
    };
  }

  // Log performance issues
  private logPerformanceIssues(metric: PerformanceMetric): void {
    const thresholds = {
      search_performance: 500, // 500ms for search
      component_render: 100,   // 100ms for component renders
      data_fetch: 2000,        // 2s for data fetching
      default: 1000            // 1s for other operations
    };

    const threshold = thresholds[metric.name] || thresholds.default;

    if (metric.value > threshold) {
      console.warn(`Performance issue detected: ${metric.name} took ${metric.value.toFixed(2)}ms`, {
        metric,
        threshold
      });
    }
  }

  // Get recent metrics
  getRecentMetrics(count: number = 10): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  // Clear all metrics
  clear(): void {
    this.metrics = [];
    this.searchMetrics = [];
    this.timers.clear();
  }

  // Export metrics for analysis
  exportMetrics(): {
    metrics: PerformanceMetric[];
    searchMetrics: SearchPerformance[];
    stats: ReturnType<typeof this.getStats>;
  } {
    return {
      metrics: [...this.metrics],
      searchMetrics: [...this.searchMetrics],
      stats: this.getStats()
    };
  }
}

// Create a singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const startTimer = (name: string) => performanceMonitor.startTimer(name);
  const endTimer = (name: string, metadata?: Record<string, any>) => 
    performanceMonitor.endTimer(name, metadata);
  const recordMetric = (name: string, value: number, metadata?: Record<string, any>) => 
    performanceMonitor.recordMetric(name, value, metadata);

  return {
    startTimer,
    endTimer,
    recordMetric,
    getStats: () => performanceMonitor.getStats(),
    exportMetrics: () => performanceMonitor.exportMetrics()
  };
}

// Web Vitals monitoring
export function initializeWebVitals(): void {
  // Only run in browser environment
  if (typeof window === 'undefined') return;

  // Monitor Largest Contentful Paint (LCP)
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        performanceMonitor.recordMetric('lcp', lastEntry.startTime, {
          element: lastEntry.element?.tagName
        });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Monitor First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          performanceMonitor.recordMetric('fid', entry.processingStart - entry.startTime, {
            eventType: entry.name
          });
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Monitor Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        performanceMonitor.recordMetric('cls', clsValue);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });

    } catch (error) {
      console.warn('Performance monitoring setup failed:', error);
    }
  }
}

// Memory usage monitoring
export function getMemoryUsage(): {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
} | null {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    };
  }
  return null;
}

// Bundle size analysis helper
export function logBundleInfo(): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('Bundle analysis available at build time');
    console.log('Run "npm run analyze" to see bundle composition');
  }
}
