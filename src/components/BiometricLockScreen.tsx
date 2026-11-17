import React, { useState, useEffect } from 'react';
import { Lock, Fingerprint, ShieldCheck, KeyRound, AlertCircle } from 'lucide-react';
import { authenticateBiometric, isBiometricSupported } from '../utils/biometric';
import { PWAInstallButton } from './PWAComponents';
import { APP_VERSION } from '../data/version';

interface BiometricLockScreenProps {
  onUnlock: () => void;
  credentialId?: string;
  onOpenPinModal?: () => void;
}

export const BiometricLockScreen: React.FC<BiometricLockScreenProps> = ({
  onUnlock,
  credentialId,
  onOpenPinModal,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [usePinFallback, setUsePinFallback] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const handleBiometricAuth = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authenticateBiometric(credentialId);
      if (res.success) {
        onUnlock();
      } else {
        setErrorMsg(res.error || 'فشل التحقق البيومتري');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء المصادقة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isBiometricSupported()) {
      handleBiometricAuth();
    }
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length >= 4) {
      onUnlock();
    } else {
      setErrorMsg('الرجاء إدخال رمز PIN مكون من 4 أرقام على الأقل');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-white dir-rtl">
      <div className="absolute top-4 left-4">
        <PWAInstallButton variant="compact" />
      </div>
      <div className="max-w-md w-full bg-slate-800/90 border border-slate-700 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-emerald-600/20 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6 text-emerald-400 animate-pulse">
          <Fingerprint className="w-10 h-10" />
        </div>

        <h2 className="text-2xl font-bold mb-2">التطبيق مقفل بالحماية البيومترية</h2>
        <p className="text-slate-400 text-sm mb-8">
          الرجاء تأكيد بصمة الإصبع أو الوجه أو استخدام رمز الأمان لفتح واتساب برو.
        </p>

        {errorMsg && (
          <div className="mb-6 bg-red-500/20 border border-red-500/40 text-red-300 text-sm p-3 rounded-xl flex items-center gap-2 w-full text-right">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!usePinFallback ? (
          <div className="w-full space-y-4">
            <button
              onClick={handleBiometricAuth}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3.5 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Fingerprint className="w-5 h-5" />
              <span>{loading ? 'جاري التحقق...' : 'إعادة محاولة البصمة / الوجه'}</span>
            </button>

            <button
              onClick={() => {
                setUsePinFallback(true);
                setErrorMsg(null);
              }}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
            >
              <KeyRound className="w-4 h-4" />
              <span>استخدام رمز PIN البديل</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handlePinSubmit} className="w-full space-y-4 text-right">
            <div>
              <label className="block text-xs text-slate-400 mb-1">أدخل رمز الأمان (PIN)</label>
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-center tracking-widest text-lg text-white focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3.5 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>فتح القفل</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUsePinFallback(false);
                setErrorMsg(null);
              }}
              className="w-full text-slate-400 hover:text-white text-xs text-center py-2"
            >
              العودة إلى المصادقة البيومترية
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-700/60 w-full flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>مشفر ومحمي بواسطة WebAuthn API · الإصدار {APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
};
