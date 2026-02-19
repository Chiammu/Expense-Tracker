import React from 'react';

export const SkeletonLoader: React.FC = () => {
  return (
    <div className="min-h-screen bg-background p-4 space-y-8 animate-fade-in">
      <div className="max-w-xl mx-auto space-y-8">
        {/* Header Skeleton */}
        <div className="relative w-full h-32 rounded-3xl bg-gray-100 dark:bg-white/5 overflow-hidden border border-gray-200 dark:border-white/5">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
        </div>

        {/* Action Row Skeleton */}
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-[24px] bg-gray-100 dark:bg-white/5 relative overflow-hidden border border-gray-200 dark:border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
          </div>
          <div className="flex-1 h-16 rounded-[24px] bg-gray-100 dark:bg-white/5 relative overflow-hidden border border-gray-200 dark:border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 rounded-[24px] bg-gray-100 dark:bg-white/5 relative overflow-hidden border border-gray-200 dark:border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
          </div>
          <div className="h-32 rounded-[24px] bg-gray-100 dark:bg-white/5 relative overflow-hidden border border-gray-200 dark:border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
          </div>
        </div>

        {/* List Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-[24px] bg-gray-100 dark:bg-white/5 relative overflow-hidden border border-gray-200 dark:border-white/5">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
