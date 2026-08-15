import { v4 as uuidv4 } from "uuid";
import { isNativeApp } from "../utils/platform.js";

const DEVICE_ID_KEY = "sysnnova_device_id";
const DEVICE_NAME_KEY = "sysnnova_device_name";
// Legacy keys for migration from previous app versions
const LEGACY_DEVICE_ID_KEY = "agrimind_device_id";
const LEGACY_DEVICE_NAME_KEY = "agrimind_device_name";

export async function getDeviceId() {
  if (typeof window !== "undefined" && window.localStorage) {
    // Check new key first
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    // Check legacy key and migrate
    const legacy = window.localStorage.getItem(LEGACY_DEVICE_ID_KEY);
    if (legacy) {
      window.localStorage.setItem(DEVICE_ID_KEY, legacy);
      return legacy;
    }
  }

  const newId = uuidv4();
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(DEVICE_ID_KEY, newId);
    } catch { /* ignore */ }
  }
  return newId;
}

export async function getDeviceName() {
  if (typeof window !== "undefined" && window.localStorage) {
    const existing = window.localStorage.getItem(DEVICE_NAME_KEY);
    if (existing) return existing;
    // Check legacy key and migrate
    const legacy = window.localStorage.getItem(LEGACY_DEVICE_NAME_KEY);
    if (legacy) {
      window.localStorage.setItem(DEVICE_NAME_KEY, legacy);
      return legacy;
    }
  }

  let name = "Web Browser";
  if (isNativeApp()) {
    name = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "iPhone" : "Android Device";
  }
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(DEVICE_NAME_KEY, name);
    } catch { /* ignore */ }
  }
  return name;
}

export async function getPlatform() {
  if (typeof window === "undefined") return "unknown";
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return "mobile";
  if (/Electron/i.test(navigator.userAgent)) return "desktop";
  return "web";
}

export async function getDeviceInfo() {
  const [deviceId, deviceName, platform] = await Promise.all([getDeviceId(), getDeviceName(), getPlatform()]);
  return { deviceId, deviceName, platform };
}