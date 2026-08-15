import crypto from "crypto";

export function generateUserKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicExponent: 0x10001,
  });
  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
  };
}
