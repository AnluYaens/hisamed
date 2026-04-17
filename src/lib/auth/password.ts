import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

const OPTIONS: argon2.Options = {
  type: argon2.argon2id,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

// Cached dummy hash so login can pay the argon2id cost even when the user does
// not exist. Prevents user-enumeration via response-time differences. Computed
// once per process, lazily, on first use.
let dummyHashPromise: Promise<string> | null = null;

export function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(`__timing_normalizer__${randomBytes(16).toString('hex')}`);
  }
  return dummyHashPromise;
}
