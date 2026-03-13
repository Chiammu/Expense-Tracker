import { Variants, Transition } from 'framer-motion';

// --- Durations ---
export const duration = {
  fast: 0.16,
  normal: 0.24,
  slow: 0.32,
};

// --- Easings ---
export const ease = {
  standard: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number], // smooth, professional feel
  out: 'easeOut',
};

// --- Springs ---
export const spring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30, // low bounce
};

// --- Shared Transition Configurations ---
export const standardTransition: Transition = {
  duration: duration.normal,
  ease: ease.standard,
};

export const slowTransition: Transition = {
  duration: duration.slow,
  ease: ease.standard,
};

export const fastTransition: Transition = {
  duration: duration.fast,
  ease: ease.standard,
};

// --- Variants ---

export const pageVariant: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: slowTransition },
  exit: { opacity: 0, y: -12, transition: standardTransition },
};

export const fadeUpVariant: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: standardTransition },
  exit: { opacity: 0, y: 10, transition: fastTransition },
};

export const fadeVariant: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: standardTransition },
  exit: { opacity: 0, transition: fastTransition },
};

export const cardVariant: Variants = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: standardTransition },
  exit: { opacity: 0, y: -10, scale: 0.98, transition: fastTransition },
};

export const modalVariant: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: standardTransition },
  exit: { opacity: 0, y: 20, scale: 0.95, transition: fastTransition },
};

export const overlayVariant: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: standardTransition },
  exit: { opacity: 0, transition: fastTransition },
};
