import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";

/**
 * Authenticated encryption (AES-256-GCM, JWE "dir") for cookie payloads.
 * The browser can store the cookie but can neither read nor modify it,
 * which matters because it holds Google OAuth tokens.
 */
function keyFrom(secret: string): Uint8Array {
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters (openssl rand -base64 32)");
  return createHash("sha256").update(secret).digest();
}

export async function seal(payload: Record<string, unknown>, secret: string, maxAgeSeconds: number): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .encrypt(keyFrom(secret));
}

/** Returns null for anything tampered, expired, or encrypted with a different secret. */
export async function unseal<T>(token: string | undefined, secret: string): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, keyFrom(secret));
    return payload as T;
  } catch {
    return null;
  }
}
