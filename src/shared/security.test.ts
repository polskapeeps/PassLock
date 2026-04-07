import { describe, expect, it } from "vitest";

import {
  decryptJson,
  deriveMasterKey,
  encryptJson,
  generateVaultKey,
  unwrapVaultKey,
  wrapVaultKey,
} from "./security";

describe("security", () => {
  it("derives the same key when reusing the saved KDF config", async () => {
    const first = await deriveMasterKey("correct horse battery staple", {
      opsLimit: 2,
      memLimitBytes: 8 * 1024 * 1024,
    });
    const second = await deriveMasterKey("correct horse battery staple", first.config);

    expect(Buffer.from(second.key)).toEqual(Buffer.from(first.key));
    expect(second.config).toEqual(first.config);
  });

  it("encrypts and decrypts JSON payloads with the expected context", async () => {
    const { key } = await deriveMasterKey("hunter2-but-better", {
      opsLimit: 2,
      memLimitBytes: 8 * 1024 * 1024,
    });
    const envelope = await encryptJson({ label: "PassLock", count: 2 }, key, "test:payload");
    const value = await decryptJson<{ label: string; count: number }>(envelope, key, "test:payload");

    expect(value).toEqual({ label: "PassLock", count: 2 });
    await expect(decryptJson(envelope, key, "wrong:context")).rejects.toThrow(/context/i);
  });

  it("wraps and unwraps the vault key with the master key", async () => {
    const { key: masterKey } = await deriveMasterKey("this is a strong enough master password", {
      opsLimit: 2,
      memLimitBytes: 8 * 1024 * 1024,
    });
    const vaultKey = await generateVaultKey();
    const wrapped = await wrapVaultKey(vaultKey, masterKey);
    const unwrapped = await unwrapVaultKey(wrapped, masterKey);

    expect(Buffer.from(unwrapped)).toEqual(Buffer.from(vaultKey));
  });
});
