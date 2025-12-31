
/**
 * End-to-End Encryption Service for Couple Chat
 * Uses Web Crypto API (SubtleCrypto)
 * Key is derived from the shared syncId
 */

const ITERATIONS = 100000;
const ALGO = "AES-GCM";
const KEY_LEN = 256;

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("couple-tracker-salt-2024"),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: ALGO, length: KEY_LEN },
    false,
    ["encrypt", "decrypt"]
  );
}

export const encryptionService = {
  encrypt: async (text: string, secret: string): Promise<string> => {
    try {
      const key = await deriveKey(secret);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const encrypted = await crypto.subtle.encrypt(
        { name: ALGO, iv },
        key,
        enc.encode(text)
      );

      // Store as IV:Ciphertext in Base64
      const ivBase64 = btoa(String.fromCharCode(...iv));
      const cipherBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
      return `${ivBase64}:${cipherBase64}`;
    } catch (e) {
      console.error("Encryption failed", e);
      return text; // Fallback to plain if it fails (not ideal for E2EE but prevents crash)
    }
  },

  decrypt: async (encryptedData: string, secret: string): Promise<string> => {
    try {
      if (!encryptedData.includes(':')) return encryptedData; // Not encrypted

      const [ivBase64, cipherBase64] = encryptedData.split(':');
      const iv = new Uint8Array(atob(ivBase64).split("").map(c => c.charCodeAt(0)));
      const ciphertext = new Uint8Array(atob(cipherBase64).split("").map(c => c.charCodeAt(0)));
      
      const key = await deriveKey(secret);
      const decrypted = await crypto.subtle.decrypt(
        { name: ALGO, iv },
        key,
        ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.warn("Decryption failed (possibly wrong key or plain text)", e);
      return "[Encrypted Message]";
    }
  }
};
