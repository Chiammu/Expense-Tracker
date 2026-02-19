import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'secondary';
  text?: string;
}

/**
 * Reusable loading spinner component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  text
}) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-[2.5px]',
    md: 'w-10 h-10 border-[3px]',
    lg: 'w-14 h-14 border-[4px]'
  };

  const colorClasses = {
    primary: 'border-primary border-t-transparent',
    white: 'border-white border-t-transparent',
    secondary: 'border-secondary border-t-transparent'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`relative ${size === 'lg' ? 'w-14 h-14' : (size === 'md' ? 'w-10 h-10' : 'w-5 h-5')}`}>
        {/* Track */}
        <div className={`absolute inset-0 rounded-full opacity-20 ${color === 'white' ? 'border-white' : 'border-current'}`} style={{ borderWidth: size === 'sm' ? '2.5px' : (size === 'lg' ? '4px' : '3px') }}></div>
        {/* Spinner */}
        <div
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-spin absolute inset-0`}
          role="status"
          aria-label="Loading"
        />
      </div>
      {text && (<p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] animate-pulse">{text}</p>)}
    </div>
  );
};

/**
 * Full-screen loading overlay
 */
export const LoadingOverlay = ({ text }: { text?: string }) => (
  <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-[inherit] flex-col gap-4 animate-fade-in">
    <LoadingSpinner size="lg" text={text} />
  </div>
);

/**
 * Skeleton loader for list items
 */
export const SkeletonListItem = () => (
  <div className="flex items-center justify-between p-4 mb-3 bg-white dark:bg-[#1a1a1a] rounded-[20px] animate-pulse items-center">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/[0.05]"></div>
      <div className="space-y-2">
        <div className="h-4 w-32 bg-gray-100 dark:bg-white/[0.05] rounded-md"></div>
        <div className="h-3 w-20 bg-gray-100 dark:bg-white/[0.05] rounded-md"></div>
      </div>
    </div>
    <div className="h-5 w-16 bg-gray-100 dark:bg-white/[0.05] rounded-md"></div>
  </div>
);
