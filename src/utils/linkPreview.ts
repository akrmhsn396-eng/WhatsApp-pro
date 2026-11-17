/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const URL_EXTRACT_REGEX = /((?:https?:\/\/|www\.)[^\s<>"'`\u060C\u061B\u061F]+)/i;
const URL_SPLIT_REGEX = /((?:https?:\/\/|www\.)[^\s<>"'`\u060C\u061B\u061F]+)/gi;

export function extractFirstUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(URL_EXTRACT_REGEX);
  if (!match) return null;
  let candidate = match[1].replace(/[.,!?;:'")\]\u060C\u061B\u061F]+$/g, '');
  if (!candidate) return null;
  if (/^www\./i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractAllUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_SPLIT_REGEX) || [];
  const urls: string[] = [];
  for (const raw of matches) {
    let candidate = raw.replace(/[.,!?;:'")\]\u060C\u061B\u061F]+$/g, '');
    if (!candidate) continue;
    if (/^www\./i.test(candidate)) candidate = `https://${candidate}`;
    try {
      const parsed = new URL(candidate);
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !urls.includes(parsed.toString())) {
        urls.push(parsed.toString());
      }
    } catch {
      // ignore invalid URLs
    }
  }
  return urls;
}

export function splitTextWithUrls(text: string): Array<{ type: 'text' | 'url'; value: string; href?: string }> {
  if (!text) return [];
  const segments: Array<{ type: 'text' | 'url'; value: string; href?: string }> = [];
  let lastIndex = 0;
  const regex = new RegExp(URL_SPLIT_REGEX.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const rawMatch = match[0];
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }

    const cleaned = rawMatch.replace(/[.,!?;:'")\]\u060C\u061B\u061F]+$/g, '');
    const trailing = rawMatch.slice(cleaned.length);
    const normalized = /^www\./i.test(cleaned) ? `https://${cleaned}` : cleaned;

    let validHref: string | undefined;
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        validHref = parsed.toString();
      }
    } catch {
      validHref = undefined;
    }

    if (validHref) {
      segments.push({ type: 'url', value: cleaned, href: validHref });
      if (trailing) segments.push({ type: 'text', value: trailing });
    } else {
      segments.push({ type: 'text', value: rawMatch });
    }

    lastIndex = start + rawMatch.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}
