import sodium from "libsodium-wrappers-sumo";

import { bytesToBase64, base64ToBytes } from "./base64";
import {
  DEFAULT_ARGON2_MEM_LIMIT_BYTES,
  DEFAULT_ARGON2_OPS_LIMIT,
} from "./constants";
import type { VaultCipherEnvelope, VaultKdfConfig } from "./types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let sodiumPromise: Promise<typeof sodium> | null = null;

export async function getSodium() {
  if (!sodiumPromise) {
    sodiumPromise = sodium.ready.then(() => sodium);
  }

  return sodiumPromise;
}

export function encodeUtf8(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function decodeUtf8(value: Uint8Array): string {
  return textDecoder.decode(value);
}

export async function randomBytes(length: number): Promise<Uint8Array> {
  const sodiumInstance = await getSodium();
  return sodiumInstance.randombytes_buf(length);
}

export async function randomId(prefix = "id"): Promise<string> {
  const bytes = await randomBytes(12);
  return `${prefix}_${bytesToBase64(bytes).replaceAll("/", "_").replaceAll("+", "-")}`;
}

export async function deriveMasterKey(
  password: string,
  config?: Partial<VaultKdfConfig>
): Promise<{ key: Uint8Array; config: VaultKdfConfig }> {
  const sodiumInstance = await getSodium();
  const salt = config?.salt
    ? base64ToBytes(config.salt)
    : await randomBytes(sodiumInstance.crypto_pwhash_SALTBYTES);
  const opsLimit = config?.opsLimit ?? DEFAULT_ARGON2_OPS_LIMIT;
  const memLimitBytes = config?.memLimitBytes ?? DEFAULT_ARGON2_MEM_LIMIT_BYTES;

  const key = sodiumInstance.crypto_pwhash(
    sodiumInstance.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
    password,
    salt,
    opsLimit,
    memLimitBytes,
    sodiumInstance.crypto_pwhash_ALG_ARGON2ID13
  );

  return {
    key,
    config: {
      algorithm: "argon2id13",
      salt: bytesToBase64(salt),
      opsLimit,
      memLimitBytes,
    },
  };
}

export async function generateVaultKey(): Promise<Uint8Array> {
  const sodiumInstance = await getSodium();
  return sodiumInstance.crypto_aead_xchacha20poly1305_ietf_keygen();
}

export async function encryptBytes(
  value: Uint8Array,
  key: Uint8Array,
  context: string
): Promise<VaultCipherEnvelope> {
  const sodiumInstance = await getSodium();
  const nonce = await randomBytes(sodiumInstance.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const cipherText = sodiumInstance.crypto_aead_xchacha20poly1305_ietf_encrypt(
    value,
    encodeUtf8(context),
    null,
    nonce,
    key
  );

  return {
    version: 1,
    algorithm: "xchacha20poly1305-ietf",
    nonce: bytesToBase64(nonce),
    cipherText: bytesToBase64(cipherText),
    context,
  };
}

export async function decryptBytes(
  envelope: VaultCipherEnvelope,
  key: Uint8Array,
  expectedContext: string
): Promise<Uint8Array> {
  const sodiumInstance = await getSodium();

  if (envelope.context !== expectedContext) {
    throw new Error("Encrypted payload context does not match the requested operation.");
  }

  return sodiumInstance.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    base64ToBytes(envelope.cipherText),
    encodeUtf8(expectedContext),
    base64ToBytes(envelope.nonce),
    key
  );
}

export async function encryptJson<T extends object>(
  value: T,
  key: Uint8Array,
  context: string
): Promise<VaultCipherEnvelope> {
  return encryptBytes(encodeUtf8(JSON.stringify(value)), key, context);
}

export async function decryptJson<T>(
  envelope: VaultCipherEnvelope,
  key: Uint8Array,
  context: string
): Promise<T> {
  const bytes = await decryptBytes(envelope, key, context);
  return JSON.parse(decodeUtf8(bytes)) as T;
}

export async function wrapVaultKey(
  vaultKey: Uint8Array,
  masterKey: Uint8Array
): Promise<VaultCipherEnvelope> {
  return encryptJson({ vaultKey: bytesToBase64(vaultKey) }, masterKey, "passlock:vault-key");
}

export async function unwrapVaultKey(
  envelope: VaultCipherEnvelope,
  masterKey: Uint8Array
): Promise<Uint8Array> {
  const payload = await decryptJson<{ vaultKey: string }>(
    envelope,
    masterKey,
    "passlock:vault-key"
  );
  return base64ToBytes(payload.vaultKey);
}
