import { createHash, randomBytes } from 'node:crypto';

type RandomBytes = (size: number) => Buffer;

const SECRET_BYTES = 32;

export function createPkce(random: RandomBytes = randomBytes): { verifier: string; challenge: string } {
  const verifier = random(SECRET_BYTES).toString('base64url');
  return { verifier, challenge: challengeFor(verifier) };
}

export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export function createState(random: RandomBytes = randomBytes): string {
  return random(SECRET_BYTES).toString('base64url');
}
