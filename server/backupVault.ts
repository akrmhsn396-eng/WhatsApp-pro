/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import type { StoredConversation, StoredStatus, StoredSyncedContact } from './store.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'email-backups');
const VAULT_KEY_FILE = path.join(DATA_DIR, '.backup-vault.key');

export interface BackupSettingsSnapshot {
  darkMode: boolean;
  readReceipts: boolean;
  soundsEnabled: boolean;
  enterToSend: boolean;
  lastSeenPrivacy: 'everyone' | 'contacts' | 'nobody';
  wallpaper: 'default' | 'emerald' | 'slate' | 'sand';
  chatLockPin?: string;
  autoSyncContacts?: boolean;
  desktopNotifications?: boolean;
  autoBackupOnExit?: boolean;
}

export interface EmailBackupPayload {
  version: number;
  appVersion: string;
  email: string;
  userId: string;
  deviceName: string;
  createdAt: number;
  updatedAt: number;
  autoBackupOnExit: boolean;
  profile: {
    name: string;
    about: string;
    avatar: string;
    phone: string;
    lastSeenPrivacy?: string;
  };
  settings?: BackupSettingsSnapshot;
  conversations: StoredConversation[];
  syncedContacts: StoredSyncedContact[];
  statuses: StoredStatus[];
}

export interface EmailBackupSummary {
  exists: boolean;
  email: string;
  updatedAt?: number;
  createdAt?: number;
  deviceName?: string;
  appVersion?: string;
  autoBackupOnExit?: boolean;
  checksum?: string;
  stats?: {
    conversationsCount: number;
    messagesCount: number;
    contactsCount: number;
    statusesCount: number;
    sizeBytes: number;
  };
}

interface EncryptedVaultEnvelope {
  alg: 'aes-256-gcm';
  email: string;
  userId: string;
  appVersion: string;
  deviceName: string;
  createdAt: number;
  updatedAt: number;
  autoBackupOnExit: boolean;
  checksum: string;
  stats: {
    conversationsCount: number;
    messagesCount: number;
    contactsCount: number;
    statusesCount: number;
    sizeBytes: number;
  };
  iv: string;
  tag: string;
  ciphertext: string;
}

function ensureVaultDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function getMasterKey(): Buffer {
  ensureVaultDirs();
  const envSecret = process.env.BACKUP_VAULT_SECRET;
  if (envSecret && envSecret.trim().length >= 16) {
    return crypto.createHash('sha256').update(envSecret.trim()).digest();
  }
  if (fs.existsSync(VAULT_KEY_FILE)) {
    const hex = fs.readFileSync(VAULT_KEY_FILE, 'utf8').trim();
    if (/^[a-f0-9]{64}$/i.test(hex)) {
      return Buffer.from(hex, 'hex');
    }
  }
  const generated = crypto.randomBytes(32);
  fs.writeFileSync(VAULT_KEY_FILE, generated.toString('hex'), { encoding: 'utf8', mode: 0o600 });
  return generated;
}

function getEmailFilePath(email: string): string {
  ensureVaultDirs();
  const clean = email.trim().toLowerCase();
  const digest = crypto.createHash('sha256').update(clean).digest('hex');
  return path.join(BACKUPS_DIR, `${digest}.enc.json`);
}

function deriveKeyForEmail(email: string): Buffer {
  const master = getMasterKey();
  return crypto
    .createHmac('sha256', master)
    .update(`wa-email-backup:${email.trim().toLowerCase()}`)
    .digest();
}

export function computePayloadChecksum(payload: EmailBackupPayload): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function saveEncryptedEmailBackup(payload: EmailBackupPayload): EmailBackupSummary {
  const cleanEmail = payload.email.trim().toLowerCase();
  const filePath = getEmailFilePath(cleanEmail);

  let existingCreatedAt = payload.createdAt;
  if (fs.existsSync(filePath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(filePath, 'utf8')) as EncryptedVaultEnvelope;
      if (prev.createdAt) existingCreatedAt = prev.createdAt;
    } catch {
      // ignore corrupted header
    }
  }

  const finalPayload: EmailBackupPayload = {
    ...payload,
    email: cleanEmail,
    createdAt: existingCreatedAt,
  };

  const plaintext = JSON.stringify(finalPayload);
  const checksum = crypto.createHash('sha256').update(plaintext).digest('hex');

  const key = deriveKeyForEmail(cleanEmail);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const messagesCount = finalPayload.conversations.reduce((acc, c) => acc + (c.messages?.length || 0), 0);
  const stats = {
    conversationsCount: finalPayload.conversations.length,
    messagesCount,
    contactsCount: finalPayload.syncedContacts.length,
    statusesCount: finalPayload.statuses.length,
    sizeBytes: Buffer.byteLength(plaintext, 'utf8'),
  };

  const envelope: EncryptedVaultEnvelope = {
    alg: 'aes-256-gcm',
    email: cleanEmail,
    userId: finalPayload.userId,
    appVersion: finalPayload.appVersion,
    deviceName: finalPayload.deviceName,
    createdAt: finalPayload.createdAt,
    updatedAt: finalPayload.updatedAt,
    autoBackupOnExit: finalPayload.autoBackupOnExit,
    checksum,
    stats,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('base64'),
  };

  fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf8');

  return {
    exists: true,
    email: cleanEmail,
    createdAt: envelope.createdAt,
    updatedAt: envelope.updatedAt,
    deviceName: envelope.deviceName,
    appVersion: envelope.appVersion,
    autoBackupOnExit: envelope.autoBackupOnExit,
    checksum: envelope.checksum,
    stats: envelope.stats,
  };
}

export function getEncryptedEmailBackupStatus(email: string): EmailBackupSummary {
  const cleanEmail = email.trim().toLowerCase();
  const filePath = getEmailFilePath(cleanEmail);
  if (!fs.existsSync(filePath)) {
    return { exists: false, email: cleanEmail };
  }
  try {
    const env = JSON.parse(fs.readFileSync(filePath, 'utf8')) as EncryptedVaultEnvelope;
    return {
      exists: true,
      email: cleanEmail,
      createdAt: env.createdAt,
      updatedAt: env.updatedAt,
      deviceName: env.deviceName,
      appVersion: env.appVersion,
      autoBackupOnExit: env.autoBackupOnExit,
      checksum: env.checksum,
      stats: env.stats,
    };
  } catch {
    return { exists: false, email: cleanEmail };
  }
}

export function loadDecryptedEmailBackup(email: string): {
  payload: EmailBackupPayload;
  checksum: string;
} | null {
  const cleanEmail = email.trim().toLowerCase();
  const filePath = getEmailFilePath(cleanEmail);
  if (!fs.existsSync(filePath)) return null;

  const env = JSON.parse(fs.readFileSync(filePath, 'utf8')) as EncryptedVaultEnvelope;
  const key = deriveKeyForEmail(cleanEmail);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(env.tag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(env.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');

  const computed = crypto.createHash('sha256').update(decrypted).digest('hex');
  if (env.checksum && computed !== env.checksum) {
    throw new Error('فشل التحقق من سلامة النسخة الاحتياطية (Checksum mismatch)');
  }

  const payload = JSON.parse(decrypted) as EmailBackupPayload;
  return { payload, checksum: computed };
}

export function deleteEncryptedEmailBackup(email: string): boolean {
  const filePath = getEmailFilePath(email);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}
