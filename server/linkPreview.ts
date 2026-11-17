/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LinkPreviewPayload {
  url: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  domain?: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_SIZE = 250;
const previewCache = new Map<string, { data: LinkPreviewPayload; expiresAt: number }>();

const URL_EXTRACT_REGEX = /((?:https?:\/\/|www\.)[^\s<>"'`\u060C\u061B\u061F]+)/i;

export function extractFirstUrlFromText(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(URL_EXTRACT_REGEX);
  if (!match) return null;
  let candidate = match[1].replace(/[.,!?;:'")\]\u060C\u061B\u061F]+$/g, '');
  if (!candidate) return null;
  if (/^www\./i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  return candidate;
}

function isPrivateOrBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    return true;
  }

  // IPv4 private / loopback / link-local ranges
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      return true;
    }
  }

  // IPv6 ULA / link-local
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) {
    return true;
  }

  return false;
}

export function validatePublicHttpUrl(rawUrl: string): URL | null {
  try {
    const trimmed = String(rawUrl || '').trim();
    if (!trimmed) return null;
    const normalized = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (isPrivateOrBlockedHost(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveMaybeRelativeUrl(candidate: string | undefined, baseUrl: string): string | undefined {
  if (!candidate) return undefined;
  const cleaned = decodeHtmlEntities(candidate).trim();
  if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('javascript:')) return undefined;
  try {
    const resolved = new URL(cleaned, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return undefined;
    return resolved.toString();
  } catch {
    return undefined;
  }
}

function getMetaTagContent(html: string, attrName: 'property' | 'name', attrValue: string): string | undefined {
  const escaped = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagRegex = new RegExp(
    `<meta\\b[^>]*\\b${attrName}\\s*=\\s*["']${escaped}["'][^>]*>`,
    'i'
  );
  const tagMatch = html.match(tagRegex);
  if (!tagMatch) return undefined;
  const contentMatch = tagMatch[0].match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const raw = contentMatch?.[1] ?? contentMatch?.[2] ?? contentMatch?.[3];
  return raw ? decodeHtmlEntities(raw) : undefined;
}

function getLinkHref(html: string, relPattern: RegExp): string | undefined {
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of linkTags) {
    const relMatch = tag.match(/\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const relVal = (relMatch?.[1] ?? relMatch?.[2] ?? relMatch?.[3] ?? '').toLowerCase();
    if (relVal && relPattern.test(relVal)) {
      const hrefMatch = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const hrefVal = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3];
      if (hrefVal) return hrefVal;
    }
  }
  return undefined;
}

function getHtmlTitle(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) return undefined;
  return decodeHtmlEntities(titleMatch[1]);
}

function buildFallbackPreview(parsedUrl: URL): LinkPreviewPayload {
  const domain = parsedUrl.hostname.replace(/^www\./i, '');
  const pathPart = parsedUrl.pathname && parsedUrl.pathname !== '/' ? decodeURIComponent(parsedUrl.pathname).slice(0, 100) : '';
  return {
    url: parsedUrl.toString(),
    title: domain,
    description: pathPart ? `${domain}${pathPart}` : parsedUrl.toString(),
    siteName: domain,
    domain,
    favicon: `${parsedUrl.origin}/favicon.ico`,
  };
}

async function readHtmlChunk(res: Response, maxBytes = 260 * 1024): Promise<string> {
  if (!res.body) {
    const txt = await res.text();
    return txt.slice(0, maxBytes);
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.byteLength;
      const joinedPreview = Buffer.concat(chunks).toString('utf8');
      if (/<\/head>/i.test(joinedPreview)) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).toString('utf8').slice(0, maxBytes);
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreviewPayload | null> {
  const parsedUrl = validatePublicHttpUrl(rawUrl);
  if (!parsedUrl) return null;

  const cacheKey = parsedUrl.toString();
  const cached = previewCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const domain = parsedUrl.hostname.replace(/^www\./i, '');
  let preview: LinkPreviewPayload = buildFallbackPreview(parsedUrl);

  try {
    const response = await fetch(cacheKey, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(5500),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppProAI/2.2; +https://whatsapp.com)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      },
    });

    const finalUrlStr = response.url || cacheKey;
    const finalParsed = validatePublicHttpUrl(finalUrlStr) || parsedUrl;
    const finalDomain = finalParsed.hostname.replace(/^www\./i, '');
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();

    if (response.ok && contentType.startsWith('image/')) {
      const fileLabel = decodeURIComponent(finalParsed.pathname.split('/').pop() || finalDomain);
      preview = {
        url: finalParsed.toString(),
        title: fileLabel || finalDomain,
        description: `صورة من ${finalDomain}`,
        image: finalParsed.toString(),
        siteName: finalDomain,
        domain: finalDomain,
        favicon: `${finalParsed.origin}/favicon.ico`,
      };
    } else if (response.ok && contentType.includes('application/pdf')) {
      const fileLabel = decodeURIComponent(finalParsed.pathname.split('/').pop() || 'مستند PDF');
      preview = {
        url: finalParsed.toString(),
        title: fileLabel,
        description: `مستند PDF من ${finalDomain}`,
        siteName: finalDomain,
        domain: finalDomain,
        favicon: `${finalParsed.origin}/favicon.ico`,
      };
    } else if (response.ok && (contentType.includes('text/html') || contentType.includes('application/xhtml') || !contentType)) {
      const html = await readHtmlChunk(response);
      const rawTitle =
        getMetaTagContent(html, 'property', 'og:title') ||
        getMetaTagContent(html, 'name', 'twitter:title') ||
        getHtmlTitle(html);

      const rawDesc =
        getMetaTagContent(html, 'property', 'og:description') ||
        getMetaTagContent(html, 'name', 'twitter:description') ||
        getMetaTagContent(html, 'name', 'description');

      const rawImage =
        getMetaTagContent(html, 'property', 'og:image:secure_url') ||
        getMetaTagContent(html, 'property', 'og:image') ||
        getMetaTagContent(html, 'name', 'twitter:image') ||
        getMetaTagContent(html, 'name', 'twitter:image:src') ||
        getLinkHref(html, /\bimage_src\b/i);

      const rawSiteName =
        getMetaTagContent(html, 'property', 'og:site_name') ||
        getMetaTagContent(html, 'name', 'application-name');

      const rawFavicon = getLinkHref(html, /\b(shortcut icon|icon|apple-touch-icon)\b/i);

      const resolvedImage = resolveMaybeRelativeUrl(rawImage, finalParsed.toString());
      const resolvedFavicon = resolveMaybeRelativeUrl(rawFavicon, finalParsed.toString()) || `${finalParsed.origin}/favicon.ico`;

      preview = {
        url: finalParsed.toString(),
        title: (rawTitle || finalDomain).slice(0, 180),
        description: rawDesc ? rawDesc.slice(0, 280) : undefined,
        image: resolvedImage,
        siteName: (rawSiteName || finalDomain).slice(0, 80),
        domain: finalDomain,
        favicon: resolvedFavicon,
      };
    } else {
      preview = {
        url: finalParsed.toString(),
        title: finalDomain || domain,
        description: finalParsed.pathname !== '/' ? `${finalDomain}${finalParsed.pathname}` : finalParsed.toString(),
        siteName: finalDomain || domain,
        domain: finalDomain || domain,
        favicon: `${finalParsed.origin}/favicon.ico`,
      };
    }
  } catch {
    preview = buildFallbackPreview(parsedUrl);
  }

  if (previewCache.size >= MAX_CACHE_SIZE) {
    const firstKey = previewCache.keys().next().value;
    if (firstKey) previewCache.delete(firstKey);
  }
  previewCache.set(cacheKey, { data: preview, expiresAt: Date.now() + CACHE_TTL_MS });
  return preview;
}
