/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Package,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  KeyRound,
  FileArchive,
  ExternalLink,
  Smartphone,
  Copy,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { APP_VERSION } from '../data/version';

export interface ApkBuildMetaClient {
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

interface PwaAuditSummaryClient {
  analysisId: string;
  url: string;
  status: string;
  canPackage: boolean;
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

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const PWABuilderModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onNotify?: (msg: string) => void;
}> = ({ open, onClose, onNotify }) => {
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const [targetUrl, setTargetUrl] = useState('');
  const [appName, setAppName] = useState('WhatsApp Pro AI');
  const [launcherName, setLauncherName] = useState('واتساب AI');
  const [packageId, setPackageId] = useState('com.whatsappproai.app');
  const [appVersion, setAppVersion] = useState(`${APP_VERSION}.0`);
  const [customIconUrl, setCustomIconUrl] = useState('');

  const [buildMeta, setBuildMeta] = useState<ApkBuildMetaClient | null>(null);
  const [audit, setAudit] = useState<PwaAuditSummaryClient | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError('');
    setLoadingStatus(true);

    fetch('/api/pwa/apk-status')
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        const defaultUrl =
          data.defaultTargetUrl ||
          (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
            ? window.location.origin
            : '');
        setTargetUrl(prev => prev || data.build?.targetUrl || defaultUrl);
        if (data.build) {
          setBuildMeta(data.build);
          setAppName(data.build.appName || 'WhatsApp Pro AI');
          setLauncherName(data.build.launcherName || 'واتساب AI');
          setPackageId(data.build.packageId || 'com.whatsappproai.app');
          setAppVersion(data.build.appVersion || `${APP_VERSION}.0`);
        }
      })
      .catch(() => {
        if (!active) return;
        if (typeof window !== 'undefined') {
          setTargetUrl(prev => prev || window.location.origin);
        }
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  const handleAnalyze = async () => {
    setError('');
    setAnalyzing(true);
    try {
      const res = await fetch('/api/pwa/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: targetUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'فشل فحص التطبيق عبر PWABuilder');
      }
      setAudit(data);
      onNotify?.(
        data.canPackage
          ? 'التطبيق جاهز بالكامل لبناء حزمة APK عبر PWABuilder'
          : 'اكتمل فحص PWABuilder — راجع المتطلبات أدناه'
      );
    } catch (err: any) {
      setError(err?.message || 'تعذر الاتصال بخادم PWABuilder');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateApk = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setGenerating(true);
    try {
      const res = await fetch('/api/pwa/generate-apk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          appName: appName.trim(),
          launcherName: launcherName.trim(),
          packageId: packageId.trim(),
          appVersion: appVersion.trim(),
          iconUrl: customIconUrl.trim() || undefined,
          enableNotifications: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.build) {
        throw new Error(data?.error || 'تعذر توليد حزمة APK عبر PWABuilder');
      }
      setBuildMeta(data.build);
      onNotify?.('تم توليد وتوقيع حزمة APK عبر PWABuilder بنجاح — جاهز للتحميل');
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء بناء الحزمة');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopySha = async () => {
    if (!buildMeta?.sha256Fingerprint) return;
    try {
      await navigator.clipboard.writeText(buildMeta.sha256Fingerprint);
      setCopiedSha(true);
      onNotify?.('تم نسخ بصمة SHA-256');
      setTimeout(() => setCopiedSha(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const reportCardUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(
    targetUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  )}`;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-xl my-auto rounded-3xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-700/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00a884]/15 text-[#00a884] flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>توليد وتحميل حزمة APK عبر PWABuilder</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                بناء حزمة Android موقّعة (.apk و .aab) بتقنية Trusted Web Activity
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
          {/* Existing Built APK Ready Card */}
          {loadingStatus ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#202c33] flex items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#00a884]" />
              <span>جاري التحقق من الحزم المتوفرة...</span>
            </div>
          ) : (
            buildMeta?.files?.apk && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-[#00a884] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-emerald-700 dark:text-emerald-300 text-[13px]">
                        حزمة APK جاهزة للتحميل والتثبيت
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                        {buildMeta.packageId} · الإصدار {buildMeta.appVersion} ·{' '}
                        {new Date(buildMeta.generatedAt).toLocaleString('ar-SA')}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold tabular-nums shrink-0">
                    {formatBytes(buildMeta.files.apk.size)}
                  </span>
                </div>

                {/* Primary APK & Full Package Downloads */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={`/api/pwa/download/apk?t=${buildMeta.generatedAt}`}
                    download="WhatsApp-Pro-AI.apk"
                    className="py-2.5 px-3 rounded-xl bg-[#00a884] hover:bg-[#008f72] text-white font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل APK مباشرة ({formatBytes(buildMeta.files.apk.size)})</span>
                  </a>

                  {buildMeta.files.zip && (
                    <a
                      href={`/api/pwa/download/zip?t=${buildMeta.generatedAt}`}
                      download="WhatsApp-Pro-AI-PWABuilder.zip"
                      className="py-2.5 px-3 rounded-xl bg-white dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#2a3942] font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <FileArchive className="w-4 h-4 text-[#00a884]" />
                      <span>الحزمة الكاملة ZIP ({formatBytes(buildMeta.files.zip.size)})</span>
                    </a>
                  )}
                </div>

                {/* Secondary Play Store & Signing Artifacts */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {buildMeta.files.aab && (
                    <a
                      href={`/api/pwa/download/aab?t=${buildMeta.generatedAt}`}
                      download="WhatsApp-Pro-AI.aab"
                      className="px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 hover:border-[#00a884]"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-[#00a884]" />
                      <span>Google Play (.aab · {formatBytes(buildMeta.files.aab.size)})</span>
                    </a>
                  )}
                  {buildMeta.files.keystore && (
                    <a
                      href={`/api/pwa/download/keystore?t=${buildMeta.generatedAt}`}
                      download="signing.keystore"
                      className="px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 hover:border-[#00a884]"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                      <span>مفتاح التوقيع (.keystore)</span>
                    </a>
                  )}
                  {buildMeta.files.assetlinks && (
                    <a
                      href="/.well-known/assetlinks.json"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 hover:border-[#00a884]"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>assetlinks.json (مفعّل تلقائياً)</span>
                    </a>
                  )}
                </div>

                {buildMeta.sha256Fingerprint && (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/70 dark:bg-[#111b21]/80 border border-slate-200/70 dark:border-slate-700/70 text-[10px]">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-500 dark:text-slate-400 block">
                        بصمة SHA-256 للتوقيع الرقمي:
                      </span>
                      <code className="font-mono text-slate-700 dark:text-slate-300 truncate block" dir="ltr">
                        {buildMeta.sha256Fingerprint}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopySha}
                      className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 shrink-0"
                      title="نسخ SHA-256"
                    >
                      {copiedSha ? (
                        <Check className="w-3.5 h-3.5 text-[#00a884]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}

                {buildMeta.usedPreviewIconFallback && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 leading-relaxed">
                    ملاحظة: نظراً لأن رابط المعاينة يتطلب تحقق الجلسة للطلبات الخارجية، تم استخدام أيقونة عامة بديلة أثناء بناء هذه النسخة. عند النشر على نطاق عام أو إدخال رابط أيقونة عام مباشر سيتم تضمين أيقونة التطبيق المخصصة.
                  </p>
                )}
              </div>
            )
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Configuration & Build Form */}
          <form onSubmit={handleGenerateApk} className="space-y-3 bg-slate-50 dark:bg-[#202c33]/70 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#00a884]" />
                <span>إعدادات حزمة Android (PWABuilder)</span>
              </h4>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || generating}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-[11px] font-bold hover:border-[#00a884] flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${analyzing ? 'animate-spin text-[#00a884]' : ''}`} />
                <span>{analyzing ? 'جاري الفحص...' : 'فحص الجاهزية'}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  رابط التطبيق المستهدف (PWA URL)
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                  placeholder="https://your-app-domain.com"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-[#00a884]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    اسم التطبيق الكامل
                  </label>
                  <input
                    type="text"
                    value={appName}
                    onChange={e => setAppName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-[#00a884]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    اسم الأيقونة المختصر (≤ 12 حرف)
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={launcherName}
                    onChange={e => setLauncherName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-[#00a884]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    معرّف الحزمة (Package ID)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={packageId}
                    onChange={e => setPackageId(e.target.value)}
                    placeholder="com.whatsappproai.app"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs font-mono focus:outline-none focus:border-[#00a884]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    رقم الإصدار (App Version)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={appVersion}
                    onChange={e => setAppVersion(e.target.value)}
                    placeholder="2.2.0.0"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs font-mono focus:outline-none focus:border-[#00a884]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  رابط أيقونة PNG عامة 512×512 (اختياري)
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={customIconUrl}
                  onChange={e => setCustomIconUrl(e.target.value)}
                  placeholder="يُترك فارغاً لاستخدام أيقونة التطبيق أو البديل التلقائي"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            {/* Audit Results if checked */}
            {audit && (
              <div className="p-3 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      تقرير PWABuilder: المتطلبات الأساسية {audit.passedRequiredCount}/
                      {audit.totalRequiredCount}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00a884]/15 text-[#00a884]">
                    {audit.canPackage ? 'جاهز للتغليف APK' : 'يحتاج مراجعة'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {audit.highlights.slice(0, 8).map(item => (
                    <span
                      key={item.id}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        item.status === 'Passed'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {item.status === 'Passed' ? '✓' : '•'} {item.id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={generating}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#00a884] hover:bg-[#008f72] text-white font-bold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري توليد وتوقيع APK عبر PWABuilder...</span>
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    <span>{buildMeta?.files?.apk ? 'إعادة توليد حزمة APK جديدة' : 'توليد وبناء حزمة APK الآن'}</span>
                  </>
                )}
              </button>

              <a
                href={reportCardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3.5 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 font-bold flex items-center justify-center gap-1.5 hover:border-[#00a884] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#00a884]" />
                <span>موقع PWABuilder</span>
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
