import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/client.js";
import { setUser, markNeedsAuth, isOnline, waitForInitialProbe, prefetchUserData } from "../offline/engine.js";
import { tokenManager } from "../auth/tokenManager.js";
import { getSecureItem, removeSecureItem, setSecureItem, PERSISTED_USER_KEY } from "../auth/secureStore.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [privateKey, setPrivateKey] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const applyUser = useCallback((u) => {
    setUserState(u);
    setUser(u);
    if (u) markNeedsAuth(false);
  }, []);

  const clearUser = useCallback(() => {
    setUserState(null);
    setUser(null);
    tokenManager.clearTokens();
    removeSecureItem(PERSISTED_USER_KEY);
    markNeedsAuth(true);
  }, []);

  const persistUser = useCallback((u) => {
    if (u) {
      setSecureItem(PERSISTED_USER_KEY, u);
    }
  }, []);

  const loadPersistedUser = useCallback(async () => {
    const stored = await getSecureItem(PERSISTED_USER_KEY);
    return stored;
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      await tokenManager.init();
    } catch {
      /* ignore token manager init errors */
    }

    // Offline-first: restore the persisted user IMMEDIATELY, before any network
    // probe. Reopening the app must never require re-login, even if the network
    // probe is slow or the device is offline.
    const persistedUser = await loadPersistedUser();

    if (persistedUser) {
      applyUser(persistedUser);
      setPrivateKey(persistedUser?.privateKey || null);
      setIsAuthenticated(true);
      setLoading(false);
      setAuthChecked(true);
    } else {
      setIsAuthenticated(false);
      setLoading(false);
      setAuthChecked(true);
      return;
    }

    // Background revalidation: when online, refresh the session and pull the latest
    // user data. Never force a logout here — the local session always wins offline-first.
    try {
      await waitForInitialProbe();
    } catch {
      /* ignore */
    }
    if (isOnline() && tokenManager.getRefreshToken()) {
      try {
        await tokenManager.refresh(true);
        const { data } = await api.get("/auth/me");
        if (data.user) {
          applyUser(data.user);
          setPrivateKey(data.user?.privateKey || null);
          persistUser(data.user);
          setIsAuthenticated(true);
        }
      } catch (err) {
        /* keep the offline session */
      }
    }

    // Warm the offline cache with all the user's VPS data (double sync).
    prefetchUserData(persistedUser).catch(() => {});
  }, [applyUser, clearUser, loadPersistedUser, persistUser]);

  useEffect(() => {
    let mounted = true;
    const doBootstrap = async () => {
      if (!mounted) return;
      await tokenManager.init();
      await bootstrap();
    };
    doBootstrap();
    return () => { mounted = false; };
  }, [bootstrap]);

  const login = useCallback(
    async (email, password, deviceInfo) => {
      const headers = {
        "x-device-id": deviceInfo?.deviceId || "",
        "x-device-name": deviceInfo?.deviceName || "",
        "x-platform": deviceInfo?.platform || "",
      };
      try {
        const { data } = await api.post("/auth/login", { email, password }, { headers, skipQueue: true });
        if (data.needsVerification) {
          return { needsVerification: true, maskedEmail: data.maskedEmail };
        }
        if (data.token) {
          await tokenManager.setTokens(data);
          await persistUser(data.user);
          applyUser(data.user);
          setPrivateKey(data.user.privateKey || null);
          setIsAuthenticated(true);
          prefetchUserData(data.user).catch(() => {});
          return { user: data.user };
        }
        return { user: data.user };
      } catch (err) {
        const error = new Error(err.message || "Login failed");
        error.response = err.response;
        error.status = err.response?.status;
        throw error;
      }
    },
    [applyUser, persistUser]
  );

  const verifyLogin = useCallback(
    async (email, code, deviceInfo) => {
      const headers = {
        "x-device-id": deviceInfo?.deviceId || "",
        "x-device-name": deviceInfo?.deviceName || "",
        "x-platform": deviceInfo?.platform || "",
      };
      try {
        const { data } = await api.post("/auth/login/verify", { email, code }, { headers, skipQueue: true });
        if (data.token) {
          await tokenManager.setTokens(data);
          await persistUser(data.user);
          applyUser(data.user);
          setPrivateKey(data.user.privateKey || null);
          setIsAuthenticated(true);
          prefetchUserData(data.user).catch(() => {});
          return data.user;
        }
        return data.user;
      } catch (err) {
        const error = new Error(err.message || "Verification failed");
        error.response = err.response;
        error.status = err.response?.status;
        throw error;
      }
    },
    [applyUser, persistUser]
  );

  const signup = useCallback(
    async (payload, deviceInfo) => {
      const headers = {
        "x-device-id": deviceInfo?.deviceId || "",
        "x-device-name": deviceInfo?.deviceName || "",
        "x-platform": deviceInfo?.platform || "",
      };
      try {
        const { data } = await api.post("/auth/signup", payload, { headers, skipQueue: true });
        if (data.token) {
          await tokenManager.setTokens(data);
          await persistUser(data.user);
          applyUser(data.user);
          setPrivateKey(data.user.privateKey || null);
          setIsAuthenticated(true);
          prefetchUserData(data.user).catch(() => {});
          return data.user;
        }
        return data.user;
      } catch (err) {
        const error = new Error(err.message || "Signup failed");
        error.response = err.response;
        error.status = err.response?.status;
        throw error;
      }
    },
    [applyUser, persistUser]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", {}, { skipQueue: true });
    } catch {
    } finally {
      clearUser();
      setIsAuthenticated(false);
      setPrivateKey(null);
    }
  }, [clearUser]);

  const encryptionReady = Boolean(privateKey);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        authChecked,
        privateKey,
        encryptionReady,
        login,
        signup,
        verifyLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}