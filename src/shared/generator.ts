import { DEFAULT_GENERATOR_OPTIONS } from "./constants";
import type { GeneratorOptions, PasswordStrength } from "./types";

const AMBIGUOUS_CHARACTERS = "0O1Il|";
const CHARACTER_SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/<>~",
} as const;

function getCrypto() {
  if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== "function") {
    throw new Error("Web Crypto is unavailable in this environment.");
  }

  return globalThis.crypto;
}

export function resolveGeneratorOptions(
  partial: Partial<GeneratorOptions> = {}
): GeneratorOptions {
  return {
    ...DEFAULT_GENERATOR_OPTIONS,
    ...partial,
  };
}

export function createGeneratorPolicy(options: GeneratorOptions) {
  const exclusions = new Set(
    `${options.excludeCharacters}${options.avoidAmbiguous ? AMBIGUOUS_CHARACTERS : ""}`.split("")
  );

  const selectedSets = {
    uppercase: options.uppercase
      ? [...CHARACTER_SETS.uppercase].filter((character) => !exclusions.has(character)).join("")
      : "",
    lowercase: options.lowercase
      ? [...CHARACTER_SETS.lowercase].filter((character) => !exclusions.has(character)).join("")
      : "",
    numbers: options.numbers
      ? [...CHARACTER_SETS.numbers].filter((character) => !exclusions.has(character)).join("")
      : "",
    symbols: options.symbols
      ? [...CHARACTER_SETS.symbols].filter((character) => !exclusions.has(character)).join("")
      : "",
  };

  const groups = Object.values(selectedSets).filter(Boolean);
  const alphabet = groups.join("");

  return {
    selectedSets,
    groups,
    alphabet,
  };
}

export function secureRandomIndex(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("maxExclusive must be a positive integer.");
  }

  const crypto = getCrypto();
  const randomBuffer = new Uint32Array(1);
  const maxUint32 = 0xffffffff;
  const threshold = maxUint32 - (maxUint32 % maxExclusive);

  while (true) {
    crypto.getRandomValues(randomBuffer);
    const candidate = randomBuffer[0];
    if (candidate < threshold) {
      return candidate % maxExclusive;
    }
  }
}

export function shuffleCharacters(characters: string): string {
  const values = [...characters];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const randomIndex = secureRandomIndex(index + 1);
    [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
  }
  return values.join("");
}

export function generatePassword(partialOptions: Partial<GeneratorOptions> = {}): string {
  const options = resolveGeneratorOptions(partialOptions);
  const { alphabet, groups } = createGeneratorPolicy(options);

  if (!alphabet) {
    throw new Error("Select at least one character set.");
  }

  if (options.length < 12 || options.length > 128) {
    throw new Error("Password length must be between 12 and 128 characters.");
  }

  if (options.requireEverySelectedType && options.length < groups.length) {
    throw new Error("Password length is too short to satisfy every selected character type.");
  }

  let result = "";

  if (options.requireEverySelectedType) {
    groups.forEach((group) => {
      result += group[secureRandomIndex(group.length)];
    });
  }

  while (result.length < options.length) {
    result += alphabet[secureRandomIndex(alphabet.length)];
  }

  return options.requireEverySelectedType ? shuffleCharacters(result) : result;
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: "Very Weak",
      entropyBits: 0,
      feedback: "Generate a password to preview its strength.",
    };
  }

  let alphabetSize = 0;
  if (/[a-z]/.test(password)) alphabetSize += 26;
  if (/[A-Z]/.test(password)) alphabetSize += 26;
  if (/\d/.test(password)) alphabetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) alphabetSize += 33;

  const entropyBits = password.length * Math.log2(Math.max(alphabetSize, 1));
  let score = Math.min(100, Math.round((entropyBits / 120) * 100));

  if (password.length < 16) score -= 12;
  if (/(.)\1{2,}/.test(password)) score -= 15;
  if (/^[a-z]+$/i.test(password) || /^\d+$/.test(password)) score -= 20;

  score = Math.max(0, Math.min(100, score));

  if (score < 25) {
    return {
      score,
      label: "Very Weak",
      entropyBits,
      feedback: "Increase length and use more than one character type.",
    };
  }

  if (score < 45) {
    return {
      score,
      label: "Weak",
      entropyBits,
      feedback: "Aim for at least 16 characters and mix letters, numbers, and symbols.",
    };
  }

  if (score < 65) {
    return {
      score,
      label: "Fair",
      entropyBits,
      feedback: "This is usable, but longer passphrases or more variety would be stronger.",
    };
  }

  if (score < 85) {
    return {
      score,
      label: "Strong",
      entropyBits,
      feedback: "Strong overall. Avoid reusing it anywhere else.",
    };
  }

  return {
    score,
    label: "Very Strong",
    entropyBits,
    feedback: "Excellent length and variety for a generated secret.",
  };
}
