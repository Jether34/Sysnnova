const DB_NAME = "sysnnova-offline";
const DB_VERSION = 1;
const STORES = ["cache", "outbox", "meta"];

let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
    });
  }
  return dbPromise;
}

function run(store, mode, work) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let result;
        try {
          result = work(s);
        } catch (err) {
          reject(err);
          return;
        }
        if (result && typeof result === "object" && "onsuccess" in result) {
          result.onsuccess = () => resolve(result.result);
          result.onerror = () => reject(result.error);
        } else {
          t.oncomplete = () => resolve();
          t.onerror = () => reject(t.error);
          t.onabort = () => reject(t.error);
        }
      })
  );
}

export const idb = {
  async put(store, value) {
    await run(store, "readwrite", (s) => s.put(value));
  },
  async bulkPut(store, values) {
    if (!values.length) return;
    await run(store, "readwrite", (s) => {
      for (const v of values) s.put(v);
    });
  },
  async get(store, key) {
    return run(store, "readonly", (s) => s.get(key));
  },
  async getAll(store) {
    return run(store, "readonly", (s) => s.getAll());
  },
  async count(store) {
    try {
      return await run(store, "readonly", (s) => s.count());
    } catch (err) {
      if (err.name === "NotFoundError" || err.message?.includes("object store") || err.message?.includes("undefined")) {
        return 0;
      }
      throw err;
    }
  },
  async delete(store, key) {
    await run(store, "readwrite", (s) => s.delete(key));
  },
  async clear(store) {
    await run(store, "readwrite", (s) => s.clear());
  },
};

// Force this module to be included in the bundle
// This is a side effect that prevents tree-shaking
if (typeof window !== "undefined") {
  window.__IDB_MODULE_LOADED__ = true;
}