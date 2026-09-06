import { DurableObject } from "cloudflare:workers";

const PASSWORD_ITERATIONS = 210_000;
const MAX_PASSWORD_LENGTH = 128;
const MAX_ITERATIONS = 1_000_000;
const encoder = new TextEncoder();

export interface PasswordHash {
  hash: string;
  salt: string;
  iterations: number;
}

const bytesToBase64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes));

const randomSalt = (): string =>
  bytesToBase64(crypto.getRandomValues(new Uint8Array(18)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

function validPassword(password: string): boolean {
  return password.length > 0 && password.length <= MAX_PASSWORD_LENGTH;
}

function validIterations(iterations: number): boolean {
  return (
    Number.isSafeInteger(iterations) &&
    iterations > 0 &&
    iterations <= MAX_ITERATIONS
  );
}

async function derivePasswordHash(
  password: string,
  salt: string,
  iterations: number,
): Promise<string> {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const result = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      iterations,
    },
    material,
    256,
  );
  return bytesToBase64(new Uint8Array(result));
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export class PasswordHasher extends DurableObject {
  async hash(password: string): Promise<PasswordHash> {
    if (!validPassword(password)) throw new Error("Invalid password");
    const salt = randomSalt();
    return {
      hash: await derivePasswordHash(password, salt, PASSWORD_ITERATIONS),
      salt,
      iterations: PASSWORD_ITERATIONS,
    };
  }

  async verify(
    password: string,
    expectedHash: string,
    salt: string,
    iterations: number,
  ): Promise<boolean> {
    if (
      !validPassword(password) ||
      !expectedHash ||
      !salt ||
      !validIterations(iterations)
    ) {
      return false;
    }
    const actualHash = await derivePasswordHash(password, salt, iterations);
    return constantTimeEqual(actualHash, expectedHash);
  }
}
