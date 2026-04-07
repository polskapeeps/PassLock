import { describe, expect, it } from "vitest";

import {
  calculatePasswordStrength,
  createGeneratorPolicy,
  generatePassword,
  secureRandomIndex,
} from "./generator";

describe("generator", () => {
  it("removes ambiguous and excluded characters from the policy", () => {
    const policy = createGeneratorPolicy({
      length: 20,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: false,
      avoidAmbiguous: true,
      excludeCharacters: "abcXYZ7",
      requireEverySelectedType: true,
    });

    expect(policy.alphabet).not.toMatch(/[0O1Il|abcXYZ7]/);
    expect(policy.groups).toHaveLength(3);
  });

  it("generates passwords that satisfy every selected type", () => {
    const password = generatePassword({
      length: 24,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
      avoidAmbiguous: true,
      excludeCharacters: "",
      requireEverySelectedType: true,
    });

    expect(password).toHaveLength(24);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[^a-zA-Z0-9]/);
    expect(password).not.toMatch(/[0O1Il|]/);
  });

  it("keeps random indices inside the requested range", () => {
    for (let iteration = 0; iteration < 128; iteration += 1) {
      const index = secureRandomIndex(17);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(17);
    }
  });

  it("scores longer mixed passwords higher than short weak ones", () => {
    const weak = calculatePasswordStrength("password");
    const strong = calculatePasswordStrength("r7V!2mQ#9xLp@4Dt$8Nz");

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.entropyBits).toBeGreaterThan(weak.entropyBits);
  });
});
