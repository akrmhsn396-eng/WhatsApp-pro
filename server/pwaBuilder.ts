/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const APK_DIR = path.join(DATA_DIR, 'apk');
const META_FILE = path.join(APK_DIR, 'build-meta.json');

function toReachablePwaUrl(raw: string): string {
  return raw.replace('://ais-dev-', '://ais-pre-');
}

export const DEFAULT_PUBLIC_PWA_URL = toReachablePwaUrl(
  process.env.SHARED_APP_URL ||
    process.env.APP_URL ||
    'https://ais-pre-zfijwt3apy46cpn45ag6uk-425685275819.europe-west2.run.app'
);

const FALLBACK_PUBLIC_ICON_URL =
  'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji/color/618x618/1F4AC.png';

const PWABUILDER_ANALYZE_ENQUEUE = 'https://pwabuilder.com/api/analyses/enqueue';
const PWABUILDER_ANALYZE_STATUS = 'https://pwabuilder.com/api/analyses';
const PWABUILDER_CLOUDAPK_URL = 'https://pwabuilder-cloudapk.azurewebsites.net/generateAppPackage';

export interface ApkBuildMeta {
  packageId: string;
  appName: string;
  launcherName: string;
  appVersion: string;
  appVersionCode: number;
  targetUrl: string;
  analysisId: string;
  iconUrlUsed: string;
  usedPreviewIconFallback: boolean;
  sha256Fingerprint: string | null;
  generatedAt: number;
  files: {
    apk?: { filename: string; size: number };
    zip?: { filename: string; size: number };
    aab?: { filename: string; size: number };
    keystore?: { filename: string; size: number };
    assetlinks?: { filename: string; size: number };
    keyinfo?: { filename: string; size: number };
  };
}

export interface PwaAuditSummary {
  analysisId: string;
  url: string;
  status: string;
  canPackage: boolean;
  webManifestUrl?: string;
  serviceWorkerUrl?: string;
  appIcon?: string;
  passedRequiredCount: number;
  totalRequiredCount: number;
  passedRecommendedCount: number;
  totalRecommendedCount: number;
  highlights: Array<{
    id: string;
    category: string;
    level: string;
    status: string;
    description: string;
  }>;
}

export interface GenerateApkInput {
  targetUrl?: string;
  appName?: string;
  launcherName?: string;
  packageId?: string;
  appVersion?: string;
  iconUrl?: string;
  enableNotifications?: boolean;
  themeColor?: string;
  backgroundColor?: string;
}

function ensureApkDir() {
  if (!fs.existsSync(APK_DIR)) {
    fs.mkdirSync(APK_DIR, { recursive: true });
  }
}

export function normalizeTargetUrl(rawUrl?: string, requestOrigin?: string): string {
  const candidate = (rawUrl || '').trim();
  const base =
    candidate ||
    (requestOrigin && !requestOrigin.includes('localhost') && !requestOrigin.includes('127.0.0.1')
      ? requestOrigin
      : DEFAULT_PUBLIC_PWA_URL);

  try {
    const u = new URL(base.startsWith('http') ? base : `https://${base}`);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return DEFAULT_PUBLIC_PWA_URL;
    }
    return toReachablePwaUrl(`${u.protocol}//${u.host}`);
  } catch {
    return DEFAULT_PUBLIC_PWA_URL;
  }
}

export function sanitizePackageId(raw?: string): string {
  const cleaned = (raw || 'com.whatsappproai.app')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '');
  const parts = cleaned
    .split('.')
    .map(p => p.replace(/^[^a-z]+/, ''))
    .filter(Boolean);
  if (parts.length < 2) {
    return 'com.whatsappproai.app';
  }
  return parts.join('.');
}

function normalizeFourPartVersion(version?: string): { version: string; code: number } {
  const parts = (version || '2.2.0.0')
    .trim()
    .replace(/[^0-9.]/g, '')
    .split('.')
    .filter(Boolean)
    .map(n => Math.max(0, Math.min(999, parseInt(n, 10) || 0)));

  while (parts.length < 4) parts.push(0);
  const four = parts.slice(0, 4);
  const code = Math.max(1, four[0] * 10000 + four[1] * 100 + four[2] * 10 + four[3]);
  return { version: four.join('.'), code };
}

async function isImageUrlDirectlyFetchable(imageUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(imageUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    return ct.startsWith('image/png') || ct.startsWith('image/jpeg') || ct.startsWith('image/webp');
  } catch {
    return false;
  }
}

export async function runPwabuilderAnalysis(targetUrl: string): Promise<PwaAuditSummary> {
  const cleanUrl = normalizeTargetUrl(targetUrl);
  const enqueueRes = await fetch(`${PWABUILDER_ANALYZE_ENQUEUE}?url=${encodeURIComponent(cleanUrl)}`, {
    method: 'POST',
  });

  if (!enqueueRes.ok) {
    throw new Error(`فشل بدء فحص PWABuilder (${enqueueRes.status})`);
  }

  const analysisId = (await enqueueRes.text()).trim();
  if (!analysisId) {
    throw new Error('لم يُرجع PWABuilder معرّف الفحص');
  }

  let report: any = null;
  for (let attempt = 0; attempt < 18; attempt++) {
    await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 1500 : 1200));
    const pollRes = await fetch(`${PWABUILDER_ANALYZE_STATUS}?id=${encodeURIComponent(analysisId)}`);
    if (!pollRes.ok) continue;
    const data = await pollRes.json();
    report = data;
    if (data.status === 'Completed' || data.status === 'Failed') {
      break;
    }
  }

  if (!report) {
    throw new Error('انتهت مهلة انتظار تقرير PWABuilder');
  }

  const caps: any[] = Array.isArray(report.capabilities) ? report.capabilities : [];
  const required = caps.filter(c => c.level === 'Required');
  const recommended = caps.filter(c => c.level === 'Recommended');

  const keyIds = new Set([
    'ServesHtml',
    'IsHttps',
    'HasManifest',
    'HasServiceWorker',
    'HasIcons',
    'HasName',
    'HasStartUrl',
    'Display',
    'Shortcuts',
  ]);

  const highlights = caps
    .filter(c => c.level === 'Required' || keyIds.has(c.id))
    .slice(0, 12)
    .map(c => ({
      id: String(c.id || ''),
      category: String(c.category || ''),
      level: String(c.level || ''),
      status: String(c.status || ''),
      description: String(c.description || ''),
    }));

  return {
    analysisId,
    url: cleanUrl,
    status: String(report.status || 'Completed'),
    canPackage: Boolean(report.canPackage),
    webManifestUrl: report.webManifest?.url,
    serviceWorkerUrl: report.serviceWorker?.url,
    appIcon: report.webManifest?.appIcon,
    passedRequiredCount: required.filter(c => c.status === 'Passed').length,
    totalRequiredCount: required.length,
    passedRecommendedCount: recommended.filter(c => c.status === 'Passed').length,
    totalRecommendedCount: recommended.length,
    highlights,
  };
}

export async function generateApkWithPwabuilder(
  input: GenerateApkInput,
  requestOrigin?: string
): Promise<ApkBuildMeta> {
  ensureApkDir();

  const targetUrl = normalizeTargetUrl(input.targetUrl, requestOrigin);
  const appName = (input.appName || 'WhatsApp Pro AI').trim().slice(0, 50) || 'WhatsApp Pro AI';
  const launcherName = (input.launcherName || 'واتساب AI').trim().slice(0, 12) || 'واتساب AI';
  const packageId = sanitizePackageId(input.packageId);
  const { version: appVersion, code: appVersionCode } = normalizeFourPartVersion(input.appVersion || '2.2.0.0');
  const themeColor = /^#[0-9a-fA-F]{6}$/.test(input.themeColor || '') ? input.themeColor! : '#00a884';
  const backgroundColor = /^#[0-9a-fA-F]{6}$/.test(input.backgroundColor || '')
    ? input.backgroundColor!
    : '#111b21';

  // 1. Run official PWABuilder analysis to obtain verified analysisId
  const audit = await runPwabuilderAnalysis(targetUrl);

  // 2. Resolve publicly reachable 512x512 PNG icon
  const candidateIcons = [
    (input.iconUrl || '').trim(),
    `${targetUrl}/pwa-512x512.png`,
    FALLBACK_PUBLIC_ICON_URL,
  ].filter(Boolean);

  let resolvedIconUrl = FALLBACK_PUBLIC_ICON_URL;
  let usedPreviewIconFallback = true;

  for (const candidate of candidateIcons) {
    if (await isImageUrlDirectlyFetchable(candidate)) {
      resolvedIconUrl = candidate;
      usedPreviewIconFallback = candidate === FALLBACK_PUBLIC_ICON_URL;
      break;
    }
  }

  // 3. Call PWABuilder CloudAPK service
  const payload = {
    analysisId: audit.analysisId,
    additionalTrustedOrigins: [],
    appVersion,
    appVersionCode,
    backgroundColor,
    display: 'standalone',
    enableNotifications: input.enableNotifications !== false,
    enableSiteSettingsShortcut: true,
    fallbackType: 'customtabs',
    features: {
      locationDelegation: { enabled: true },
      playBilling: { enabled: false },
    },
    host: targetUrl,
    iconUrl: resolvedIconUrl,
    includeSourceCode: false,
    isChromeOSOnly: false,
    launcherName,
    maskableIconUrl: null,
    monochromeIconUrl: null,
    name: appName,
    navigationColor: backgroundColor,
    navigationColorDark: backgroundColor,
    navigationDividerColor: backgroundColor,
    navigationDividerColorDark: backgroundColor,
    packageId,
    pwaUrl: targetUrl,
    signingMode: 'new',
    signing: {
      file: null,
      alias: 'my-key-alias',
      fullName: appName,
      organization: 'WhatsApp Pro AI',
      organizationalUnit: 'Mobile',
      countryCode: 'SA',
      keyPassword: '',
      storePassword: '',
    },
    splashScreenFadeOutDuration: 300,
    startUrl: '/',
    themeColor,
    webManifestUrl: `${targetUrl}/manifest.json`,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240000);
  let cloudRes: Response;
  try {
    cloudRes = await fetch(
      `${PWABUILDER_CLOUDAPK_URL}?analysisId=${encodeURIComponent(audit.analysisId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!cloudRes.ok) {
    const errText = await cloudRes.text().catch(() => '');
    throw new Error(
      `فشل بناء الحزمة عبر خادم PWABuilder (${cloudRes.status}): ${errText.slice(0, 220)}`
    );
  }

  const zipBuffer = Buffer.from(await cloudRes.arrayBuffer());
  if (zipBuffer.length < 1024) {
    throw new Error('استلم الخادم ملفاً غير مكتمل من PWABuilder');
  }

  // 4. Persist full ZIP and extract individual deliverables
  const zipFilename = 'WhatsApp-Pro-AI-PWABuilder.zip';
  fs.writeFileSync(path.join(APK_DIR, zipFilename), zipBuffer);

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const filesMeta: ApkBuildMeta['files'] = {
    zip: { filename: zipFilename, size: zipBuffer.length },
  };
  let sha256Fingerprint: string | null = null;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const lower = entry.entryName.toLowerCase();
    const content = entry.getData();

    if (lower.endsWith('.apk')) {
      const target = 'WhatsApp-Pro-AI.apk';
      fs.writeFileSync(path.join(APK_DIR, target), content);
      filesMeta.apk = { filename: target, size: content.length };
    } else if (lower.endsWith('.aab')) {
      const target = 'WhatsApp-Pro-AI.aab';
      fs.writeFileSync(path.join(APK_DIR, target), content);
      filesMeta.aab = { filename: target, size: content.length };
    } else if (lower.endsWith('.keystore')) {
      const target = 'signing.keystore';
      fs.writeFileSync(path.join(APK_DIR, target), content);
      filesMeta.keystore = { filename: target, size: content.length };
    } else if (lower.endsWith('assetlinks.json')) {
      const target = 'assetlinks.json';
      fs.writeFileSync(path.join(APK_DIR, target), content);
      filesMeta.assetlinks = { filename: target, size: content.length };
      try {
        const parsed = JSON.parse(content.toString('utf8'));
        const fp = parsed?.[0]?.target?.sha256_cert_fingerprints?.[0];
        if (typeof fp === 'string') sha256Fingerprint = fp;
      } catch {
        // ignore JSON parse issues
      }
    } else if (lower.endsWith('signing-key-info.txt')) {
      const target = 'signing-key-info.txt';
      fs.writeFileSync(path.join(APK_DIR, target), content);
      filesMeta.keyinfo = { filename: target, size: content.length };
    }
  }

  const meta: ApkBuildMeta = {
    packageId,
    appName,
    launcherName,
    appVersion,
    appVersionCode,
    targetUrl,
    analysisId: audit.analysisId,
    iconUrlUsed: resolvedIconUrl,
    usedPreviewIconFallback,
    sha256Fingerprint,
    generatedAt: Date.now(),
    files: filesMeta,
  };

  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf8');
  return meta;
}

export function getStoredApkMeta(): ApkBuildMeta | null {
  try {
    if (!fs.existsSync(META_FILE)) return null;
    const raw = fs.readFileSync(META_FILE, 'utf8');
    const parsed = JSON.parse(raw) as ApkBuildMeta;
    // Verify at least APK or ZIP still exists on disk
    if (parsed?.files?.apk && !fs.existsSync(path.join(APK_DIR, parsed.files.apk.filename))) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function resolveArtifactDownload(artifact: string): {
  filePath: string;
  downloadName: string;
  contentType: string;
} | null {
  const map: Record<string, { file: string; downloadName: string; contentType: string }> = {
    apk: {
      file: 'WhatsApp-Pro-AI.apk',
      downloadName: 'WhatsApp-Pro-AI.apk',
      contentType: 'application/vnd.android.package-archive',
    },
    zip: {
      file: 'WhatsApp-Pro-AI-PWABuilder.zip',
      downloadName: 'WhatsApp-Pro-AI-PWABuilder.zip',
      contentType: 'application/zip',
    },
    aab: {
      file: 'WhatsApp-Pro-AI.aab',
      downloadName: 'WhatsApp-Pro-AI.aab',
      contentType: 'application/octet-stream',
    },
    keystore: {
      file: 'signing.keystore',
      downloadName: 'signing.keystore',
      contentType: 'application/octet-stream',
    },
    assetlinks: {
      file: 'assetlinks.json',
      downloadName: 'assetlinks.json',
      contentType: 'application/json; charset=utf-8',
    },
    keyinfo: {
      file: 'signing-key-info.txt',
      downloadName: 'signing-key-info.txt',
      contentType: 'text/plain; charset=utf-8',
    },
  };

  const entry = map[artifact];
  if (!entry) return null;
  const fullPath = path.join(APK_DIR, entry.file);
  if (!fs.existsSync(fullPath)) return null;
  return {
    filePath: fullPath,
    downloadName: entry.downloadName,
    contentType: entry.contentType,
  };
}

export function getDigitalAssetLinksPayload(): string {
  const assetLinksPath = path.join(APK_DIR, 'assetlinks.json');
  if (fs.existsSync(assetLinksPath)) {
    return fs.readFileSync(assetLinksPath, 'utf8');
  }
  const meta = getStoredApkMeta();
  const packageName = meta?.packageId || 'com.whatsappproai.app';
  const fingerprints = meta?.sha256Fingerprint ? [meta.sha256Fingerprint] : [];
  return JSON.stringify(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    null,
    2
  );
}
