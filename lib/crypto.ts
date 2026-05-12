import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// AES-256-GCM with key derived from MASTER_ENCRYPTION_KEY via scrypt.
// MASTER_ENCRYPTION_KEY env var must be ≥ 32 chars. If absent, encryption disabled (with clear error).

const ALGO = 'aes-256-gcm';
const SALT = 'cadence-v7-static-salt'; // static is fine because the master key carries the entropy

function key(): Buffer {
  const master = process.env.MASTER_ENCRYPTION_KEY;
  if (!master || master.length < 32) {
    throw new Error('MASTER_ENCRYPTION_KEY env var manquante ou trop courte (≥ 32 chars requis). Ajoutez-la dans Vercel.');
  }
  return scryptSync(master, SALT, 32);
}

export function encryptSecret(plain: string): { ciphertext: string; iv: string; auth_tag: string; masked: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const masked = plain.length <= 8
    ? '•'.repeat(plain.length)
    : '•'.repeat(Math.max(plain.length - 4, 4)) + plain.slice(-4);
  return {
    ciphertext: ct.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: tag.toString('base64'),
    masked
  };
}

export function decryptSecret(ciphertext: string, iv: string, auth_tag: string): string {
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(auth_tag, 'base64'));
  const pt = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
  return pt.toString('utf8');
}
