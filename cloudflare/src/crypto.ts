const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 100_000;

export function bytesToHex(bytes: ArrayBuffer | ArrayBufferView): string {
  const view = bytes instanceof ArrayBuffer
    ? new Uint8Array(bytes)
    : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from(view, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(value: string): Uint8Array {
  if (!/^[a-f0-9]*$/i.test(value) || value.length % 2 !== 0) {
    throw new Error("Invalid hexadecimal value");
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function sha256Hex(value: string): Promise<string> {
  return bytesToHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function derivePasswordHash(
  password: string,
  saltHex: string,
  pepper: string,
  iterations = PASSWORD_ITERATIONS,
): Promise<string> {
  const pepperKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"],
  );
  const passwordMaterial = await crypto.subtle.sign(
    "HMAC",
    pepperKey,
    encoder.encode(password),
  );
  const material = await crypto.subtle.importKey(
    "raw",
    passwordMaterial,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: { name: "SHA-256" },
      salt: hexToBytes(saltHex),
      iterations,
    },
    material,
    256,
  );
  return bytesToHex(bits);
}

export async function createPasswordRecord(password: string, pepper: string): Promise<{
  salt: string;
  hash: string;
  iterations: number;
}> {
  const salt = randomToken(16);
  return {
    salt,
    hash: await derivePasswordHash(password, salt, pepper, PASSWORD_ITERATIONS),
    iterations: PASSWORD_ITERATIONS,
  };
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHash: string,
  iterations: number,
  pepper: string,
): Promise<boolean> {
  const actualHash = await derivePasswordHash(password, saltHex, pepper, iterations);
  const actual = hexToBytes(actualHash);
  const expected = hexToBytes(expectedHash);
  return actual.byteLength === expected.byteLength
    && crypto.subtle.timingSafeEqual(actual, expected);
}

export function timingSafeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length || !/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false;
  }
  return crypto.subtle.timingSafeEqual(hexToBytes(left), hexToBytes(right));
}
