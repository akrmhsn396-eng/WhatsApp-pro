/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Download, Smartphone, Share, X, WifiOff, ExternalLink,
  CheckCircle2, Copy, Check, RefreshCw, MonitorSmartphone, Package
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';
import { APP_VERSION } from '../data/version';
import { PWABuilderModal } from './PWABuilderModal';

export const PWAInstallButton: React.FC<{
  variant?: 'compact' | 'full' | 'pill';
  onNotify?: (msg: string) => void;
}> = ({ variant = 'full', onNotify }) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, updateReady, install, checkForUpdate } =
    usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showApkModal, setShowApkModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleAction = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        onNotify?.('تم تثبيت التطبيق على جهازك بنجاح');
        setShowGuideModal(false);
        return;
      }
    }
    setShowGuideModal(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      onNotify?.('تم نسخ رابط التطبيق');
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleRefreshVersion = async () => {
    setCheckingUpdate(true);
    const result = await checkForUpdate();
    setCheckingUpdate(false);
    if (result === 'updated' || updateReady) {
      onNotify?.('تم تحديث النسخة — جاري إعادة التحميل...');
      setTimeout(() => window.location.reload(), 500);
    } else {
      onNotify?.(`تستخدم أحدث إصدار (${APP_VERSION})`);
    }
  };

  // Already running in standalone installed PWA mode
  if (isInstalled) {
    if (variant !== 'full') {
      return null;
    }
    return (
      <div className="w-full flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs">
        <span className="flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-4 h-4 text-[#00a884]" />
          <span>التطبيق مثبت ويعمل بنسخة مستقلة (v{APP_VERSION})</span>
        </span>
        <button
          type="button"
          onClick={handleRefreshVersion}
          disabled={checkingUpdate}
          className="px-2.5 py-1 rounded-lg bg-[#00a884] text-white font-bold text-[11px] hover:bg-[#008f72] flex items-center gap-1 disabled:opacity-60"
        >
          <RefreshCw className={`w-3 h-3 ${checkingUpdate ? 'animate-spin' : ''}`} />
          <span>{updateReady ? 'تطبيق التحديث' : 'تحديث'}</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleAction}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#00a884]/15 hover:bg-[#00a884]/25 text-[#00a884] font-bold text-[11px] transition-colors shrink-0"
          title="تثبيت التطبيق على الجهاز"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
        </button>
      ) : variant === 'pill' ? (
        <button
          type="button"
          onClick={handleAction}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f72] text-white font-bold text-xs shadow-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>تثبيت تطبيق WhatsApp Pro (v{APP_VERSION})</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleAction}
          className="w-full flex items-center justify-between p-3 bg-[#00a884]/15 text-[#00a884] rounded-xl font-bold hover:bg-[#00a884]/25 transition-colors text-xs"
          title="تثبيت التطبيق على الجهاز"
        >
          <span className="flex items-center gap-2.5">
            {isIOS ? <Smartphone className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            <span>
              {isInstallable
                ? `تثبيت التطبيق على جهازك (v${APP_VERSION})`
                : isIOS
                ? 'تثبيت التطبيق على iPhone / iPad'
                : `تثبيت التطبيق كنسخة مستقلة (v${APP_VERSION})`}
            </span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#00a884] text-white text-[11px]">
            {isInstallable ? 'تثبيت فوري' : 'تثبيت'}
          </span>
        </button>
      )}

      {showGuideModal && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#222e35] p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <MonitorSmartphone className="w-5 h-5 text-[#00a884]" />
                <span>تثبيت WhatsApp Pro · الإصدار {APP_VERSION}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInstallable && (
              <div className="p-3.5 rounded-2xl bg-[#00a884]/10 border border-[#00a884]/30 space-y-2.5">
                <p className="font-bold text-[#00a884]">التثبيت الفوري جاهز على هذا الجهاز</p>
                <button
                  type="button"
                  onClick={handleAction}
                  className="w-full py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f72] text-white font-bold flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>تثبيت الآن بنقرة واحدة</span>
                </button>
              </div>
            )}

            {isInIframe && !isInstallable && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                <p className="font-bold text-amber-600 dark:text-amber-400">
                  التطبيق يعمل حالياً داخل إطار معاينة
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  المتصفحات تمنع نافذة التثبيت التلقائي داخل الإطارات المدمجة. افتح التطبيق في تبويب مستقل لتظهر لك أيقونة التثبيت الفوري مباشرة.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#00a884] hover:bg-[#008f72] text-white font-bold flex items-center justify-center gap-1.5 text-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح في تبويب مستقل</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-[#2a3942] font-bold flex items-center gap-1.5 hover:opacity-90"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#00a884]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'تم النسخ' : 'نسخ الرابط'}</span>
                  </button>
                </div>
              </div>
            )}

            {isIOS ? (
              <div className="space-y-2.5 bg-slate-50 dark:bg-[#111b21] p-4 rounded-2xl">
                <p className="font-bold text-slate-800 dark:text-slate-100">خطوات التثبيت على iPhone و iPad:</p>
                <ol className="space-y-2 text-slate-600 dark:text-slate-300 leading-relaxed list-decimal list-inside">
                  <li>
                    اضغط على زر{' '}
                    <strong className="inline-flex items-center gap-1 text-[#00a884]">
                      المشاركة <Share className="w-3.5 h-3.5 inline" />
                    </strong>{' '}
                    في شريط متصفح Safari.
                  </li>
                  <li>
                    مرّر للأسفل واختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
                  </li>
                  <li>
                    اضغط <strong>إضافة</strong> لتشغيل التطبيق كتطبيق مستقل بالكامل.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2.5 bg-slate-50 dark:bg-[#111b21] p-4 rounded-2xl">
                <p className="font-bold text-slate-800 dark:text-slate-100">خطوات التثبيت على الكمبيوتر والأندرويد:</p>
                <ul className="space-y-2 text-slate-600 dark:text-slate-300 leading-relaxed list-disc list-inside">
                  <li>
                    <strong>Chrome / Edge (كمبيوتر):</strong> اضغط على أيقونة التثبيت في شريط العنوان أو قائمة المتصفح (⋮) ثم اختر <strong>تثبيت WhatsApp Pro AI</strong>.
                  </li>
                  <li>
                    <strong>Android (Chrome):</strong> افتح قائمة المتصفح (⋮) واختر <strong>التثبيت على الشاشة الرئيسية</strong> أو <strong>تثبيت التطبيق</strong>.
                  </li>
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowGuideModal(false);
                setShowApkModal(true);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[#00a884] font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Package className="w-4 h-4" />
              <span>توليد وتحميل حزمة Android APK عبر PWABuilder</span>
            </button>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full rounded-xl bg-slate-100 dark:bg-[#2a3942] py-2.5 font-bold hover:opacity-90"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      <PWABuilderModal
        open={showApkModal}
        onClose={() => setShowApkModal(false)}
        onNotify={onNotify}
      />
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-amber-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      <span>وضع عدم الاتصال — يتم عرض البيانات المخزنة مؤقتاً</span>
    </div>
  );
};
