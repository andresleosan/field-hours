import { ApiError } from "./http";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PREFIX = "v1";

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesFromBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function configuredKey(env: Env): Promise<CryptoKey> {
  const raw = (env as Env & { PAYROLL_ENCRYPTION_KEY?: unknown }).PAYROLL_ENCRYPTION_KEY;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new ApiError(503, "PAYROLL_NOT_CONFIGURED", "Payroll security is not configured yet.");
  }

  let keyBytes: Uint8Array;
  try {
    keyBytes = /^[a-f0-9]{64}$/i.test(raw) ? hexToBytes(raw) : bytesFromBase64(raw);
  } catch {
    throw new ApiError(503, "PAYROLL_NOT_CONFIGURED", "Payroll security is not configured yet.");
  }
  if (keyBytes.byteLength !== 32) {
    throw new ApiError(503, "PAYROLL_NOT_CONFIGURED", "Payroll security is not configured yet.");
  }
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function hexToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

export async function encryptPayrollValue(env: Env, value: string): Promise<string> {
  const key = await configuredKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(value),
  );
  return `${PREFIX}.${base64FromBytes(iv)}.${base64FromBytes(new Uint8Array(ciphertext))}`;
}

export async function decryptPayrollValue(env: Env, value: string): Promise<string> {
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    throw new ApiError(500, "PAYROLL_DATA_INVALID", "A payroll record could not be read.");
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytesFromBase64(parts[1]!) },
      await configuredKey(env),
      bytesFromBase64(parts[2]!),
    );
    return decoder.decode(plaintext);
  } catch {
    throw new ApiError(500, "PAYROLL_DATA_INVALID", "A payroll record could not be read.");
  }
}
