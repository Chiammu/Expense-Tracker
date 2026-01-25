/**
 * Security utilities for PIN hashing and input sanitization
 */

/**
 * Hash a PIN using Web Crypto API
 * @param pin - The PIN to hash
 * @returns Promise<string> - Hex string of hashed PIN
 */
export async function hashPIN(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Verify a PIN against a hash
 * @param pin - The PIN to verify
 * @param hash - The stored hash
 * @returns Promise<boolean> - True if PIN matches
 */
export async function verifyPIN(pin: string, hash: string): Promise<boolean> {
  const pinHash = await hashPIN(pin);
  return pinHash === hash;
}

/**
 * Sanitize user input to prevent injection attacks
 * @param input - User input string
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeInput(input: string, maxLength: number = 200): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Remove potential HTML tags
}

/**
 * Validate expense amount
 * @param amount - The amount to validate
 * @returns boolean - True if valid
 */
export function validateAmount(amount: number): boolean {
  return !isNaN(amount) && amount > 0 && amount <= 10000000 && Number.isFinite(amount);
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private calls: number[] = [];
  private limit: number;
  private windowMs: number;

  constructor(limit: number = 5, windowMs: number = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /**
   * Check if action is allowed
   * @returns boolean - True if allowed, false if rate limited
   */
  public isAllowed(): boolean {
    const now = Date.now();
    // Remove old calls outside the window
    this.calls = this.calls.filter(time => now - time < this.windowMs);
    
    if (this.calls.length >= this.limit) {
      return false;
    }
    
    this.calls.push(now);
    return true;
  }

  /**
   * Get time until next allowed call
   * @returns number - Milliseconds until allowed
   */
  public getTimeUntilAllowed(): number {
    if (this.calls.length < this.limit) return 0;
    const oldest = this.calls[0];
    const timeUntilExpiry = this.windowMs - (Date.now() - oldest);
    return Math.max(0, timeUntilExpiry);
  }

  /**
   * Reset the rate limiter
   */
  public reset(): void {
    this.calls = [];
  }
}
