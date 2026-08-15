const STORAGE_KEY = "agrimind_secure_store_key";
const TOKEN_KEY_NAME = "agrimind_auth_tokens";

function getCrypto() {
  if (typeof window === "undefined") return null;
  if (window.crypto && window.crypto.subtle) return window.crypto;
  if (window.msCrypto && window.msCrypto.subtle) return window.msCrypto;
  return null;
}

function getStorage() {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  return null;
}

export default class SecureStorage {
  constructor() {
    this._key = null;
    this._ready = false;
    this._readyPromise = null;
  }

  async init() {
    if (this._ready) return;
    if (this._readyPromise) return this._readyPromise;

    this._readyPromise = (async () => {
      const crypto = getCrypto();
      const storage = getStorage();
      if (!crypto || !storage) {
        this._ready = true;
        return;
      }
      try {
        const existing = storage.getItem(STORAGE_KEY);
        if (existing) {
          const raw = JSON.parse(existing);
          if (raw.kty === "oct" && raw.k) {
            this._key = await crypto.subtle.importKey(
              "jwk",
              raw,
              { name: "AES-GCM", length: 256 },
              true,
              ["encrypt", "decrypt"]
            );
            this._ready = true;
            return;
          }
        }
        const key = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );
        const jwk = await crypto.subtle.exportKey("jwk", key);
        storage.setItem(STORAGE_KEY, JSON.stringify(jwk));
        this._key = key;
        this._ready = true;
      } catch (err) {
        console.error("[secureStorage] init failed:", err);
        this._ready = true;
      }
    })();

    return this._readyPromise;
  }

  async setItem(key, value) {
    await this.init();
    const storage = getStorage();
    const crypto = getCrypto();
    if (!this._key || !crypto || !storage) {
      storage.setItem(key, value);
      return;
    }
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        this._key,
        new TextEncoder().encode(value)
      );
      const encArr = Array.from(new Uint8Array(enc));
      const ivStr = btoa(String.fromCharCode(...iv));
      const dataStr = btoa(String.fromCharCode(...encArr));
      storage.setItem(
        key,
        JSON.stringify({
          iv: ivStr,
          data: dataStr,
        })
      );
    } catch (err) {
      console.error("[secureStorage] setItem failed:", err);
      storage.setItem(key, value);
    }
  }

  async getItem(key) {
    await this.init();
    const storage = getStorage();
    const crypto = getCrypto();
    if (!this._key || !crypto || !storage) {
      return storage.getItem(key);
    }
    const raw = storage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.iv || !parsed.data) return raw;
      const iv = Uint8Array.from(atob(parsed.iv), (c) => c.charCodeAt(0));
      const data = Uint8Array.from(atob(parsed.data), (c) => c.charCodeAt(0));
      const dec = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        this._key,
        data
      );
      return new TextDecoder().decode(dec);
    } catch (err) {
      console.error("[secureStorage] getItem failed:", err);
      return raw;
    }
  }

  async removeItem(key) {
    await this.init();
    const storage = getStorage();
    if (storage) storage.removeItem(key);
  }

  async clearAll() {
    await this.init();
    const storage = getStorage();
    if (!storage) return;
    const keysToRemove = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && !k.startsWith(STORAGE_KEY)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => storage.removeItem(k));
  }
}

export { TOKEN_KEY_NAME };