export function isNativeApp() {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("app") === "1") return true;
  if (window.desktop?.platform || window.desktop?.versions?.electron) return true;
  if (window.Capacitor?.isNativePlatform?.()) return true;
  if (/Electron/i.test(navigator.userAgent)) return true;
  return false;
}

export function isDesktopApp() {
  if (typeof window === "undefined") return false;
  if (window.desktop?.platform || window.desktop?.versions?.electron) return true;
  if (/Electron/i.test(navigator.userAgent)) return true;
  return false;
}

const PROD_API = "https://pns-sysnnova.cloud/api";

export function apiBaseURL() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return isNativeApp() ? PROD_API : "/api";
}
