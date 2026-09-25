/**
 * Safe LocalStorage wrapper with memory fallback.
 * Prevents catastrophic crashes on older Safari (Private Browsing quota error),
 * disabled storage, or corrupted storage environments.
 */

class SafeStorage {
  private memoryStore = new Map<string, string>();
  private isAvailable: boolean;

  constructor() {
    this.isAvailable = this.checkAvailability();
  }

  private checkAvailability(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    try {
      const testKey = '__storage_test_key__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  getItem(key: string): string | null {
    if (this.isAvailable) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        // Fall back to memory
      }
    }
    return this.memoryStore.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.isAvailable) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {
        // Storage is full or disabled (Safari private mode)
        this.isAvailable = false;
      }
    }
    this.memoryStore.set(key, value);
  }

  removeItem(key: string): void {
    if (this.isAvailable) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore
      }
    }
    this.memoryStore.delete(key);
  }

  clear(): void {
    if (this.isAvailable) {
      try {
        window.localStorage.clear();
      } catch {
        // Ignore
      }
    }
    this.memoryStore.clear();
  }
}

export const safeStorage = new SafeStorage();
