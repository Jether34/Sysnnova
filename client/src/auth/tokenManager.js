import api from "../api/client.js";
import { setSecureItem, getSecureItem, removeSecureItem, TOKEN_KEY_NAME } from "./secureStore.js";

class TokenManager {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.sessionId = null;
    this._refreshPromise = null;
  }

  async init() {
    const stored = await getSecureItem(TOKEN_KEY_NAME);
    if (stored) {
      this.accessToken = stored.accessToken || null;
      this.refreshToken = stored.refreshToken || null;
      this.sessionId = stored.sessionId || null;
    }
  }

  async setTokens(data) {
    this.accessToken = data.token;
    this.refreshToken = data.refresh;
    this.sessionId = data.sessionId || null;
    try {
      await setSecureItem(TOKEN_KEY_NAME, {
        accessToken: data.token,
        refreshToken: data.refresh,
        sessionId: data.sessionId || null,
      });
    } catch {
      /* ignore storage errors */
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.sessionId = null;
    removeSecureItem(TOKEN_KEY_NAME);
  }

  getAccessToken() {
    return this.accessToken;
  }

  getRefreshToken() {
    return this.refreshToken;
  }

  getSessionId() {
    return this.sessionId;
  }

  getAuthHeaders() {
    const headers = {};
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    if (this.refreshToken) headers["X-Refresh-Token"] = this.refreshToken;
    return headers;
  }

  async refresh(force = false) {
    if (!force && this._refreshPromise) {
      return this._refreshPromise;
    }
    if (!this.refreshToken) {
      return Promise.reject(new Error("No refresh token available"));
    }

    this._refreshPromise = api
      .post("/auth/refresh", {}, {
        headers: { "X-Refresh-Token": this.refreshToken },
        skipQueue: true,
      })
      .then(async ({ data }) => {
        if (data.token) {
          this.accessToken = data.token;
          try {
            await setSecureItem(TOKEN_KEY_NAME, {
              accessToken: data.token,
              refreshToken: this.refreshToken,
              sessionId: this.sessionId,
            });
          } catch { /* ignore storage errors */ }
        }
        this._refreshPromise = null;
        return data.token;
      })
      .catch((err) => {
        this._refreshPromise = null;
        this.clearTokens();
        return Promise.reject(err);
      });

    return this._refreshPromise;
  }
}

export const tokenManager = new TokenManager();