import axios from "axios";
import {
  isOnline,
  isQueuable,
  enqueueWrite,
  applyWriteToCache,
  readCache,
  syntheticResponse,
  cacheResponse,
  setOnline,
  objectId,
  uuid,
} from "../offline/engine.js";
import { apiBaseURL } from "../utils/platform.js";
import { tokenManager } from "../auth/tokenManager.js";

const baseURL = apiBaseURL();

const api = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use((config) => {
  const headers = tokenManager.getAuthHeaders();
  Object.assign(config.headers, headers);
  return config;
});

let isRefreshing = false;
let refreshQueue = [];

function processQueue(error, token = null) {
  refreshQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  refreshQueue = [];
}

api.interceptors.response.use(
  (r) => {
    setOnline(true);
    return r;
  },
  async (err) => {
    const cfg = err.config || {};
    if (cfg.skipQueue && !err.response) {
      setOnline(false);
    }
    if (err.response?.status === 401 && !cfg.skipQueue) {
      if (isRefreshing) {
        try {
          const token = await new Promise((resolve, reject) => {
            refreshQueue.push({ resolve, reject });
          });
          cfg.headers.Authorization = `Bearer ${token}`;
          return api(cfg);
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }

      if (!tokenManager.getRefreshToken()) {
        tokenManager.clearTokens();
        return Promise.reject(err);
      }

      isRefreshing = true;
      try {
        const newToken = await tokenManager.refresh();
        processQueue(null, newToken);
        cfg.headers.Authorization = `Bearer ${newToken}`;
        return api(cfg);
      } catch (refreshError) {
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    const msg = err.response?.data?.error || err.response?.data?.message || err.message || "Something went wrong";
    const error = new Error(msg);
    error.response = err.response;
    error.config = cfg;
    error.status = err.response?.status;
    return Promise.reject(error);
  }
);

const defaultAdapter = Array.isArray(axios.defaults.adapter) ? axios.getAdapter(axios.defaults.adapter) : axios.defaults.adapter;

function mutateData(config, fn) {
  let data = config.data;
  let wasString = typeof data === "string";
  if (wasString) {
    try {
      data = JSON.parse(data);
    } catch {
      return;
    }
  }
  if (!data || typeof data !== "object") return;
  fn(data);
  config.data = wasString ? JSON.stringify(data) : data;
}

function injectClientIds(config) {
  const url = config.url || "";
  if (url === "/assessments" && (config.method || "").toUpperCase() === "POST") {
    mutateData(config, (data) => {
      if (!data._id) data._id = objectId();
    });
  } else if (url === "/messages" && (config.method || "").toUpperCase() === "POST") {
    mutateData(config, (data) => {
      if (!data.clientOpId) data.clientOpId = uuid();
    });
  }
}

function offlineError() {
  const err = new Error("You are offline. Showing saved data — reconnect to get the latest.");
  err.isOffline = true;
  return err;
}

async function offlineAdapter(config) {
  if (config.skipQueue) {
    return defaultAdapter(config);
  }

  const method = (config.method || "get").toLowerCase();
  const isWrite = method !== "get";

  if (isWrite) {
    injectClientIds(config);
    if (!isOnline()) {
      if (!isQueuable(config)) {
        return syntheticResponse({ message: "Saved offline — will sync when you're back online." }, config);
      }
      try {
        return await enqueueWrite(config);
      } catch (err) {
        console.error("[offline] enqueueWrite failed:", err);
        return syntheticResponse({ message: "Saved offline — will sync when you're back online." }, config);
      }
    }
    try {
      const res = await defaultAdapter(config);
      try { await applyWriteToCache(config); } catch { /* ignore */ }
      return res;
    } catch (err) {
      if (!err.response && isQueuable(config)) {
        setOnline(false);
        try { return await enqueueWrite(config); } catch { return syntheticResponse({ message: "Saved offline — will sync when you're back online." }, config); }
      }
      throw err;
    }
  }

  if (!isOnline()) {
    const cached = await readCache(config);
    if (cached) return syntheticResponse(cached, config);
    // Return synthetic response instead of throwing for GET requests when offline
    return syntheticResponse({ 
      isOffline: true, 
      message: "You are offline. Showing saved data — reconnect to get the latest.",
      data: [] 
    }, config);
  }

  try {
    const res = await defaultAdapter(config);
    try { await cacheResponse(config, res.data); } catch { /* ignore */ }
    return res;
  } catch (err) {
    if (!err.response) {
      setOnline(false);
      const cached = await readCache(config);
      if (cached) return syntheticResponse(cached, config);
      return syntheticResponse({ isOffline: true, data: [] }, config);
    }
    throw err;
  }
}

api.defaults.adapter = offlineAdapter;

export async function downloadFile(url, params, fallbackName) {
  const res = await api.get(url, { params, responseType: "blob" });
  const type = res.data?.type || "";
  if (type === "application/json" || type.startsWith("text/")) {
    const text = await res.data.text();
    let msg = "Download failed";
    try {
      msg = JSON.parse(text).error || msg;
    } catch {
      msg = `Unexpected response from server (${type}).`;
    }
    throw new Error(msg);
  }
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fallbackName || "download.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

export default api;
