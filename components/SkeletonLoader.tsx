
import React from 'react';

export const SkeletonLoader: React.FC = () => {
  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="relative w-full h-24 rounded-b-xl bg-gray-200 dark:bg-gray-800 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer"></div>
        </div>

        {/* Action Row Skeleton */}
        <div className="flex gap-2">
           <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-800 relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer"></div>
           </div>
           <div className="flex-1 h-12 rounded-xl bg-gray-200 dark:bg-gray-800 relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer"></div>
           </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 gap-4">
           <div className="h-28 rounded-xl bg-gray-200 dark:bg-gray-800 relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer"></div>
           </div>
           <div className="h-28 rounded-xl bg-gray-200 dark:bg-gray-800 relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer"></div>
           </div>
        </div>

        {/* List Skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 rounded-xl bg-gray-200 dark:bg-gray-800 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
