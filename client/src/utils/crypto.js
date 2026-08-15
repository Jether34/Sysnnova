const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bufToB64(buf) {
  let bin = "";
  for (let i = 0; i < buf.length; i += 1) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importPublicKey(publicKeyB64) {
  return crypto.subtle.importKey("spki", b64ToBuf(publicKeyB64), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
}

async function importPrivateKey(privateKeyPkcs8) {
  return crypto.subtle.importKey("pkcs8", b64ToBuf(privateKeyPkcs8), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
}

// Hybrid encryption: AES-GCM for the message, RSA-OAEP wraps the AES key.
export async function encryptForRecipient(plaintext, recipientPublicKeyB64) {
  const pubKey = await importPublicKey(recipientPublicKeyB64);
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encoder.encode(plaintext));
  const rawAes = await crypto.subtle.exportKey("raw", aesKey);
  const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubKey, rawAes);
  return {
    ciphertext: bufToB64(new Uint8Array(ct)),
    iv: bufToB64(iv),
    wrappedKey: bufToB64(new Uint8Array(wrapped)),
  };
}

export async function decryptFromSender(payload, myPrivateKeyPkcs8) {
  const privKey = await importPrivateKey(myPrivateKeyPkcs8);
  const rawAes = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, b64ToBuf(payload.wrappedKey));
  const aesKey = await crypto.subtle.importKey("raw", rawAes, { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBuf(payload.iv) }, aesKey, b64ToBuf(payload.ciphertext));
  return decoder.decode(pt);
}
