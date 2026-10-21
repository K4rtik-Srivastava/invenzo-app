// Readable temporary passwords like "kq4m-p9xt-7wbe" (no 0/O, 1/l/I).
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateTempPassword() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((group) => group.join("")).join("-");
}
