import SecureStorage, { TOKEN_KEY_NAME } from "../utils/secureStorage.js";

const secureStorage = new SecureStorage();

export const PERSISTED_USER_KEY = "agrimind_user";

export async function setSecureItem(key, value) {
  await secureStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
}

export async function getSecureItem(key) {
  const value = await secureStorage.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function removeSecureItem(key) {
  await secureStorage.removeItem(key);
}

export async function getPersistedUser() {
  return getSecureItem(PERSISTED_USER_KEY);
}

export { secureStorage, TOKEN_KEY_NAME };