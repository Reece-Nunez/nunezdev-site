import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_HEX = process.env.ENCRYPTION_KEY ?? "";

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY env var must be a 64-character hex string (32 bytes)"
    );
  }
  return Buffer.from(KEY_HEX, "hex");
}

/**
 * Encrypts plaintext with AES-256-GCM.
 * Returns a colon-delimited string: "iv_hex:tag_hex:ciphertext_hex"
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypts a value produced by encrypt().
 * Returns the original plaintext string, or null if decryption fails.
 */
export function decrypt(ciphertext: string): string | null {
  try {
    const key = getKey();
    const [ivHex, tagHex, encryptedHex] = ciphertext.split(":");
    if (!ivHex || !tagHex || !encryptedHex) return null;

    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/** Mask showing only last N chars: "****5678" */
export function maskEnd(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars) return value;
  return "*".repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

/** SSN mask: "***-**-1234" */
export function maskSSN(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) return "***-**-????";
  return `***-**-${digits.slice(5)}`;
}

/** EIN mask: "**-***6789" */
export function maskEIN(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) return "**-*******";
  return `**-***${digits.slice(5)}`;
}

/** Routing number mask: last 4 visible */
export function maskRouting(value: string): string {
  return maskEnd(value.replace(/\D/g, ""), 4);
}

/** Account number mask: last 4 visible */
export function maskAccount(value: string): string {
  return maskEnd(value.replace(/\D/g, ""), 4);
}
