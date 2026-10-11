import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** 256-bit reconnect token. Only its hash is kept server-side. */
export const newToken = (): string => randomBytes(32).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
export const tokenMatches = (token: string, hash: string): boolean => {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
export const newRoomCode = (): string =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
export const newId = (prefix: string): string => `${prefix}_${randomBytes(9).toString("base64url")}`;
