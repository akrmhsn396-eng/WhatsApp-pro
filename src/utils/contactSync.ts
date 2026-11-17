/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SyncedContact } from '../types';

export interface IncomingContactDraft {
  displayName: string;
  phone: string;
  email?: string;
  source: SyncedContact['source'];
}

export function isContactPickerSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    typeof (navigator as any).contacts?.select === 'function'
  );
}

export async function pickDeviceContacts(): Promise<IncomingContactDraft[]> {
  if (!isContactPickerSupported()) {
    throw new Error('UNSUPPORTED_CONTACT_PICKER');
  }

  const contactsApi = (navigator as any).contacts;
  const supportedProps: string[] =
    typeof contactsApi.getProperties === 'function'
      ? await contactsApi.getProperties()
      : ['name', 'tel', 'email'];

  const requestedProps = ['name', 'tel', 'email'].filter(p => supportedProps.includes(p));
  if (!requestedProps.includes('tel')) requestedProps.push('tel');

  const rawContacts = await contactsApi.select(requestedProps, { multiple: true });
  const results: IncomingContactDraft[] = [];

  for (const item of rawContacts || []) {
    const displayName =
      Array.isArray(item.name) && item.name[0]
        ? String(item.name[0]).trim()
        : Array.isArray(item.tel) && item.tel[0]
        ? String(item.tel[0]).trim()
        : '';
    const email = Array.isArray(item.email) && item.email[0] ? String(item.email[0]).trim() : undefined;
    const tels: string[] = Array.isArray(item.tel) ? item.tel : [];

    for (const phone of tels) {
      const cleanPhone = String(phone || '').trim();
      if (!cleanPhone) continue;
      results.push({
        displayName: displayName || cleanPhone,
        phone: cleanPhone,
        email,
        source: 'device',
      });
    }
  }

  return results;
}

function decodeQuotedPrintable(input: string): string {
  try {
    const cleaned = input.replace(/=\r?\n/g, '');
    const bytes: number[] = [];
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === '=' && i + 2 < cleaned.length && /^[0-9A-Fa-f]{2}$/.test(cleaned.slice(i + 1, i + 3))) {
        bytes.push(parseInt(cleaned.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(cleaned.charCodeAt(i));
      }
    }
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch {
    return input;
  }
}

export function parseVCard(text: string): IncomingContactDraft[] {
  // Unfold folded lines (RFC 6350 / 2425)
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);
  const contacts: IncomingContactDraft[] = [];

  for (const block of blocks) {
    const endIdx = block.search(/END:VCARD/i);
    const body = endIdx >= 0 ? block.slice(0, endIdx) : block;
    const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    let fnName = '';
    let nName = '';
    let email = '';
    const phones: string[] = [];

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) continue;
      const meta = line.slice(0, colonIdx).toUpperCase();
      let val = line.slice(colonIdx + 1).trim();

      if (meta.includes('ENCODING=QUOTED-PRINTABLE')) {
        val = decodeQuotedPrintable(val);
      }

      if (meta === 'FN' || meta.startsWith('FN;')) {
        fnName = val;
      } else if (meta === 'N' || meta.startsWith('N;')) {
        const parts = val
          .split(';')
          .map(p => p.trim())
          .filter(Boolean);
        // N format: Last;First;Middle;Prefix;Suffix
        if (parts.length >= 2) {
          nName = `${parts[1]} ${parts[0]}`.trim();
        } else if (parts.length === 1) {
          nName = parts[0];
        }
      } else if (meta === 'TEL' || meta.startsWith('TEL;')) {
        if (val) phones.push(val);
      } else if ((meta === 'EMAIL' || meta.startsWith('EMAIL;')) && !email) {
        email = val;
      }
    }

    const displayName = (fnName || nName || '').trim();
    for (const phone of phones) {
      contacts.push({
        displayName: displayName || phone,
        phone,
        email: email || undefined,
        source: 'vcf',
      });
    }
  }

  return contacts;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsvContacts(text: string): IncomingContactDraft[] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const firstCols = splitCsvLine(lines[0], delimiter).map(c => c.toLowerCase());

  const nameHeaders = ['name', 'display name', 'full name', 'given name', 'first name', 'الاسم', 'الاسم الكامل'];
  const phoneHeaders = ['phone', 'mobile', 'tel', 'telephone', 'phone 1 - value', 'الجوال', 'الهاتف', 'رقم الهاتف'];
  const emailHeaders = ['email', 'e-mail', 'e-mail 1 - value', 'البريد', 'البريد الإلكتروني'];

  let nameIdx = firstCols.findIndex(c => nameHeaders.some(h => c.includes(h)));
  let phoneIdx = firstCols.findIndex(c => phoneHeaders.some(h => c.includes(h)));
  const emailIdx = firstCols.findIndex(c => emailHeaders.some(h => c.includes(h)));

  const hasHeader = nameIdx >= 0 || phoneIdx >= 0;
  if (!hasHeader) {
    nameIdx = 0;
    phoneIdx = 1;
  } else if (phoneIdx < 0) {
    phoneIdx = nameIdx === 0 ? 1 : 0;
  }

  const startRow = hasHeader ? 1 : 0;
  const results: IncomingContactDraft[] = [];

  for (let i = startRow; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const phone = (cols[phoneIdx] || '').trim();
    const displayName = (cols[nameIdx] || phone).trim();
    const email = emailIdx >= 0 ? (cols[emailIdx] || '').trim() : undefined;
    if (!phone || !/\d{5,}/.test(phone.replace(/[^\d]/g, ''))) continue;

    results.push({
      displayName: displayName || phone,
      phone,
      email: email || undefined,
      source: 'csv',
    });
  }

  return results;
}

export function parseBulkTextContacts(text: string): IncomingContactDraft[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results: IncomingContactDraft[] = [];

  for (const line of lines) {
    // Support separators: ",", ";", "|", " - ", ":" (only if followed by digits/+)
    const match = line.match(/^(.+?)\s*(?:,|;|\|| - |:\s*(?=[+\d٠-٩]))\s*(.+)$/);
    if (match) {
      const part1 = match[1].trim();
      const part2 = match[2].trim();
      const p1Digits = part1.replace(/[^\d٠-٩]/g, '').length;
      const p2Digits = part2.replace(/[^\d٠-٩]/g, '').length;
      if (p2Digits >= 6) {
        results.push({ displayName: part1, phone: part2, source: 'manual' });
      } else if (p1Digits >= 6) {
        results.push({ displayName: part2, phone: part1, source: 'manual' });
      }
    }
  }

  return results;
}

export function exportContactsToVCard(contacts: SyncedContact[]): string {
  return contacts
    .map(c => {
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${c.displayName}`,
        `N:${c.displayName};;;;`,
        `TEL;TYPE=CELL:${c.phone}`,
      ];
      if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${c.email}`);
      lines.push('END:VCARD');
      return lines.join('\r\n');
    })
    .join('\r\n');
}

export function downloadVCardBackup(contacts: SyncedContact[]) {
  const vcfContent = exportContactsToVCard(contacts);
  const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `whatsapp-contacts-${new Date().toISOString().slice(0, 10)}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}
