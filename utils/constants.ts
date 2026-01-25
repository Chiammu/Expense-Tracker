/**
 * Application-wide constants
 * Extracted from magic numbers for better maintainability
 */

// Cloud Sync
export const CLOUD_SAVE_DEBOUNCE_MS = 500;
export const RETRY_DELAY_MS = 1000;
export const MAX_RETRY_ATTEMPTS = 3;

// UI Configuration
export const RECENT_EXPENSES_LIMIT = 10;
export const TOP_CATEGORIES_CHART_LIMIT = 6;
export const TOAST_AUTO_DISMISS_MS = 3000;
export const ROAST_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Security
export const PIN_LENGTH = 4;
export const MAX_LOGIN_ATTEMPTS = 5;
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// API Rate Limiting
export const AI_CALLS_PER_MINUTE = 5;
export const AI_CALLS_WINDOW_MS = 60 * 1000;

// Storage
export const STORAGE_KEY = 'coupleExpenseTrackerV4_React';
export const BACKUP_VERSION = 'v1.0';

// Haptic Patterns
export const HAPTIC = {
  LIGHT: 10,
  MEDIUM: 20,
  HEAVY: 30,
  SUCCESS: [10, 5, 10],
  ERROR: [20, 10, 20, 10, 20],
} as const;

// Validation
export const MAX_EXPENSE_AMOUNT = 10000000; // 1 Crore
export const MAX_NOTE_LENGTH = 200;
export const MAX_CATEGORY_NAME_LENGTH = 30;
export const MIN_BUDGET = 0;

// Features Flags (for gradual rollout)
export const FEATURES = {
  AI_RECEIPT_PARSING: true,
  VOICE_INPUT: true,
  BIOMETRIC_AUTH: true,
  PUSH_NOTIFICATIONS: false, // Not implemented yet
  OFFLINE_MODE: false, // Not implemented yet
} as const;
