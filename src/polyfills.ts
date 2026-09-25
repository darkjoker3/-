/**
 * Compatibility polyfills and runtime patches for older operating systems and legacy browsers:
 * - iOS 11 - 15 (iPhone 6, 6s, 7, 8, X, older iPads)
 * - macOS 10.11 - 10.15 (Safari 11 - 14)
 * - Android 5.0 - 11 (Legacy Android WebView, Chrome 50-80)
 * - Windows 7 / 8.1 / 10 (Legacy Edge, older Chrome / Firefox)
 */

// 1. globalThis polyfill
if (typeof globalThis === 'undefined') {
  (function () {
    if (typeof self !== 'undefined') {
      // @ts-ignore
      self.globalThis = self;
    } else if (typeof window !== 'undefined') {
      // @ts-ignore
      window.globalThis = window;
    } else if (typeof global !== 'undefined') {
      // @ts-ignore
      global.globalThis = global;
    }
  })();
}

// 2. crypto.randomUUID polyfill
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    // @ts-ignore
    window.crypto = {};
  }
  if (typeof window.crypto.randomUUID !== 'function') {
    window.crypto.randomUUID = function () {
      if (typeof window.crypto.getRandomValues === 'function') {
        const buf = new Uint8Array(16);
        window.crypto.getRandomValues(buf);
        buf[6] = (buf[6] & 0x0f) | 0x40; // Version 4
        buf[8] = (buf[8] & 0x3f) | 0x80; // Variant 10
        const hex: string[] = [];
        for (let i = 0; i < 16; i++) {
          hex.push((buf[i] < 16 ? '0' : '') + buf[i].toString(16));
        }
        return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}` as `${string}-${string}-${string}-${string}-${string}`;
      }
      // Fallback using Math.random
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }) as `${string}-${string}-${string}-${string}-${string}`;
    };
  }
}

// 3. Array.prototype.at & String.prototype.at
if (!Array.prototype.at) {
  Array.prototype.at = function (n: number) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    if (n < 0 || n >= this.length) return undefined;
    return this[n];
  };
}
if (!String.prototype.at) {
  String.prototype.at = function (n: number) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    if (n < 0 || n >= this.length) return '';
    return this.charAt(n);
  };
}

// 4. Array.prototype.flat & flatMap
if (!(Array.prototype as any).flat) {
  (Array.prototype as any).flat = function (depth = 1) {
    const flatten = (arr: any[], d: number): any[] => {
      return d > 0
        ? arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val, d - 1) : val), [])
        : arr.slice();
    };
    return flatten(this, depth);
  };
}
if (!(Array.prototype as any).flatMap) {
  (Array.prototype as any).flatMap = function (callback: any, thisArg?: any) {
    return (this as any).map(callback, thisArg).flat();
  };
}

// 5. Object.fromEntries
if (!Object.fromEntries) {
  Object.fromEntries = function (entries: any) {
    if (!entries) return {};
    const obj: Record<string, any> = {};
    if (Array.isArray(entries)) {
      for (let i = 0; i < entries.length; i++) {
        const pair = entries[i];
        if (pair && pair.length >= 2) {
          obj[pair[0]] = pair[1];
        }
      }
    } else if (typeof entries[Symbol.iterator] === 'function') {
      for (const [key, value] of entries) {
        obj[key] = value;
      }
    }
    return obj;
  };
}

// 6. Object.hasOwn
if (!Object.hasOwn) {
  Object.hasOwn = function (obj: any, prop: PropertyKey): boolean {
    return obj != null && Object.prototype.hasOwnProperty.call(obj, prop);
  };
}

// 7. String.prototype.replaceAll
if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function (searchValue: any, replaceValue: any) {
    if (searchValue instanceof RegExp) {
      if (!searchValue.global) {
        throw new TypeError('String.prototype.replaceAll called with a non-global RegExp');
      }
      return this.replace(searchValue, replaceValue);
    }
    const escaped = String(searchValue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.replace(new RegExp(escaped, 'g'), replaceValue);
  };
}

// 8. Promise.allSettled
if (!Promise.allSettled) {
  Promise.allSettled = function <T>(promises: Iterable<Promise<T>>) {
    return Promise.all(
      Array.from(promises).map((p) =>
        Promise.resolve(p).then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason) => ({ status: 'rejected' as const, reason })
        )
      )
    );
  };
}

// 9. structuredClone polyfill
if (typeof window !== 'undefined' && typeof window.structuredClone !== 'function') {
  window.structuredClone = function <T>(value: T): T {
    if (value === undefined) return undefined as any;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  };
}

// 10. queueMicrotask fallback
if (typeof window !== 'undefined' && typeof window.queueMicrotask !== 'function') {
  window.queueMicrotask = function (callback: () => void) {
    Promise.resolve()
      .then(callback)
      .catch((err) =>
        setTimeout(() => {
          throw err;
        }, 0)
      );
  };
}

// 11. requestIdleCallback fallback (Not supported on Safari iOS < 16.4)
if (typeof window !== 'undefined') {
  if (typeof (window as any).requestIdleCallback !== 'function') {
    (window as any).requestIdleCallback = function (cb: any) {
      const start = Date.now();
      return setTimeout(function () {
        cb({
          didTimeout: false,
          timeRemaining: function () {
            return Math.max(0, 50 - (Date.now() - start));
          },
        });
      }, 1);
    };
  }
  if (typeof (window as any).cancelIdleCallback !== 'function') {
    (window as any).cancelIdleCallback = function (id: number) {
      clearTimeout(id);
    };
  }
}

// 12. Safe navigator.clipboard fallback for older browsers or insecure contexts
if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
  if (!navigator.clipboard) {
    (navigator as any).clipboard = {
      writeText: async function (text: string) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.width = '2em';
        textarea.style.height = '2em';
        textarea.style.padding = '0';
        textarea.style.border = 'none';
        textarea.style.outline = 'none';
        textarea.style.boxShadow = 'none';
        textarea.style.background = 'transparent';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
          const successful = document.execCommand('copy');
          if (!successful) throw new Error('execCommand copy failed');
        } finally {
          document.body.removeChild(textarea);
        }
      },
      readText: async function () {
        return '';
      },
    };
  }
}

// 13. Safe ResizeObserver fallback
if (typeof window !== 'undefined' && typeof (window as any).ResizeObserver !== 'function') {
  (window as any).ResizeObserver = class ResizeObserverPolyfill {
    cb: any;
    constructor(cb: any) {
      this.cb = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// 14. Safe IntersectionObserver fallback
if (typeof window !== 'undefined' && typeof (window as any).IntersectionObserver !== 'function') {
  (window as any).IntersectionObserver = class IntersectionObserverPolyfill {
    cb: any;
    constructor(cb: any) {
      this.cb = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// 15. Safe scrollTo options support check
if (typeof window !== 'undefined') {
  const originalScrollTo = window.scrollTo;
  window.scrollTo = function (...args: any[]) {
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      const top = args[0].top ?? window.pageYOffset;
      const left = args[0].left ?? window.pageXOffset;
      try {
        originalScrollTo.call(window, left, top);
      } catch {
        // Fallback for very old engines
        window.scroll(left, top);
      }
    } else {
      // @ts-ignore
      originalScrollTo.apply(window, args);
    }
  };
}

export {};
