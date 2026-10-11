import { randomInt } from "node:crypto";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; // no easily confused I, l, O
const DIGITS = "23456789";

/** 12 characters, letters and digits, cryptographically random. Meets the 10+ letters-and-digits rule. */
export function generateTempPassword(): string {
  const chars: string[] = [];
  for (let i = 0; i < 9; i++) chars.push(LETTERS[randomInt(LETTERS.length)]);
  for (let i = 0; i < 3; i++) chars.push(DIGITS[randomInt(DIGITS.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
