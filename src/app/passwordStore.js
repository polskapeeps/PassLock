const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const ITERATIONS = 100000;

const STORE_FILE = path.join(app.getPath('userData'), 'passwords.enc');
const MASTER_PASSWORD = process.env.PASSLOCK_MASTER_KEY || 'change_this_key';

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

function encrypt(data) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(MASTER_PASSWORD, salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

function decrypt(encoded) {
  const buffer = Buffer.from(encoded, 'base64');
  const salt = buffer.slice(0, SALT_LENGTH);
  const iv = buffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const text = buffer.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const key = deriveKey(MASTER_PASSWORD, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(text), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

function readStore() {
  if (!fs.existsSync(STORE_FILE)) {
    return [];
  }
  const enc = fs.readFileSync(STORE_FILE, 'utf8');
  return decrypt(enc);
}

function writeStore(entries) {
  const enc = encrypt(entries);
  fs.writeFileSync(STORE_FILE, enc, { mode: 0o600 });
}

function initStore() {
  if (!fs.existsSync(STORE_FILE)) {
    writeStore([]);
  }
}

function getPasswords() {
  return readStore();
}

function addPassword(entry) {
  const entries = readStore();
  const newEntry = { id: crypto.randomUUID(), ...entry, createdAt: new Date().toISOString() };
  entries.push(newEntry);
  writeStore(entries);
  return newEntry;
}

function removePassword(id) {
  const entries = readStore();
  const filtered = entries.filter(e => e.id !== id);
  writeStore(filtered);
  return filtered;
}

module.exports = { initStore, getPasswords, addPassword, removePassword };
