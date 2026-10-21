import { hash, verify } from "@node-rs/argon2";

// Argon2id with OWASP-recommended settings (19 MiB memory, 2 passes).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function hashPassword(password: string) {
  return hash(password, OPTIONS);
}

export async function verifyPassword({ hash: stored, password }: { hash: string; password: string }) {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}
