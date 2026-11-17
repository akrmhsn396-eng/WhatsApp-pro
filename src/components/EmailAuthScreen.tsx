/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Mail, Lock, User, ArrowRight, MessageSquare, ShieldCheck, Sparkles,
  Upload, CheckCircle2, RefreshCw, Eye, EyeOff, KeyRound
} from 'lucide-react';
import { AuthSessionInfo, UserAccount } from '../types';
import { Avatar } from './Avatar';
import {
  signInWithGooglePopup,
  sendPasswordReset,
  signInWithFirebaseEmail,
  registerWithFirebaseEmail,
} from '../utils/firebaseAuth';
import { PWAInstallButton, OfflineIndicator } from './PWAComponents';
import { APP_VERSION } from '../data/version';
import { getClientDeviceName } from '../utils/countries';

interface EmailAuthScreenProps {
  onAuthenticated: (payload: {
    token: string;
    user: UserAccount;
    session: AuthSessionInfo;
    remember: boolean;
  }) => void;
  onCancelSwitch?: () => void;
  onNotify?: (msg: string) => void;
}

export const EmailAuthScreen: React.FC<EmailAuthScreenProps> = ({
  onAuthenticated,
  onCancelSwitch,
  onNotify,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [about, setAbout] = useState('مرحباً! أستخدم WhatsApp Pro AI');
  const [avatar, setAvatar] = useState('');
  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password states
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSentEmail, setResetSentEmail] = useState('');
  const [resetCooldown, setResetCooldown] = useState(0);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = setTimeout(() => setResetCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resetCooldown]);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setError('يرجى إدخال الاسم الكامل.');
      return;
    }
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const deviceName = getClientDeviceName();

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        mode === 'login'
          ? { email: cleanEmail, password, deviceName }
          : { email: cleanEmail, password, name: name.trim(), about, avatar, deviceName };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        // If login failed against local SQLite hash (e.g. user reset password via Firebase email link),
        // verify credentials against Firebase Auth and sync the new password to the server session.
        if (mode === 'login' && res.status === 401) {
          const fbCheck = await signInWithFirebaseEmail(cleanEmail, password);
          if (fbCheck.success && fbCheck.idToken) {
            const syncRes = await fetch('/api/auth/firebase-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                idToken: fbCheck.idToken,
                password,
                deviceName,
              }),
            });
            const syncData = await syncRes.json();
            if (syncRes.ok) {
              onAuthenticated({
                token: syncData.token,
                user: syncData.user,
                session: syncData.session,
                remember,
              });
              return;
            }
          }
        }

        setError(data.error || (mode === 'login' ? 'فشل تسجيل الدخول' : 'فشل إنشاء الحساب'));
        setLoading(false);
        return;
      }

      if (mode === 'register') {
        // Best-effort sync to Firebase Auth so future sendPasswordResetEmail works cleanly
        registerWithFirebaseEmail(cleanEmail, password, name.trim()).catch(() => {});
      }

      onAuthenticated({
        token: data.token,
        user: data.user,
        session: data.session,
        remember,
      });
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ في الاتصال بالخادم');
      setLoading(false);
    }
  };

  const handlePasswordResetSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('يرجى إدخال البريد الإلكتروني المرتبط بحسابك.');
      return;
    }

    setResetLoading(true);
    try {
      const result = await sendPasswordReset(cleanEmail);
      if (!result.success) {
        setError(result.error || 'تعذر إرسال رابط إعادة تعيين كلمة المرور.');
        return;
      }

      setResetSentEmail(cleanEmail);
      setResetCooldown(30);
      onNotify?.(`تم إرسال رابط استعادة كلمة المرور إلى ${cleanEmail}`);

      // Best-effort audit trail on backend
      fetch('/api/auth/password-reset-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, deviceName: getClientDeviceName() }),
      }).catch(() => {});
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع أثناء إرسال رابط الاستعادة.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await signInWithGooglePopup();
      if (!res.success || !res.user) {
        setError(res.error || 'فشل تسجيل الدخول عبر جوجل');
        setLoading(false);
        return;
      }
      const apiRes = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: res.user.email,
          name: res.user.displayName,
          avatar: res.user.photoURL,
          googleUid: res.user.uid,
          deviceName: getClientDeviceName(),
        }),
      });
      const data = await apiRes.json();
      if (!apiRes.ok) {
        setError(data.error || 'تعذر المصادقة مع الخادم عبر حساب جوجل');
        setLoading(false);
        return;
      }
      onAuthenticated({
        token: data.token,
        user: data.user,
        session: data.session,
        remember: true,
      });
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول عبر جوجل');
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-[#eae6df] dark:bg-[#0b141a] text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 md:p-8 overflow-y-auto"
    >
      {/* Top Header Strip */}
      <header className="max-w-xl w-full mx-auto flex items-center justify-between gap-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00a884] text-white flex items-center justify-center shadow-sm">
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            WhatsApp Pro AI
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <PWAInstallButton variant="compact" onNotify={onNotify} />
          {onCancelSwitch && (
            <button
              onClick={onCancelSwitch}
              className="px-4 py-2 rounded-xl bg-white dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#2a3942] transition-colors whitespace-nowrap"
            >
              العودة للجلسة الحالية
            </button>
          )}
        </div>
      </header>

      {/* Main Centered Single Card */}
      <main className="max-w-md w-full mx-auto my-auto py-6">
        <div className="bg-white dark:bg-[#111b21] rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-[#00a884]/15 text-[#00a884] flex items-center justify-center shadow-sm">
              {mode === 'forgot' ? <KeyRound className="w-7 h-7" /> : <MessageSquare className="w-7 h-7" />}
            </div>
          </div>

          {mode === 'forgot' ? (
            <div className="space-y-4">
              <div className="text-center space-y-1.5">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  استعادة كلمة المرور
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً عبر Firebase لإعادة تعيين كلمة المرور بأمان.
                </p>
              </div>

              {resetSentEmail ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-5 h-5 text-[#00a884] shrink-0" />
                      <span>تم إرسال رابط إعادة التعيين</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      تحقق من صندوق الوارد للبريد الإلكتروني{' '}
                      <strong dir="ltr" className="text-slate-900 dark:text-white">
                        {resetSentEmail}
                      </strong>{' '}
                      (أو مجلد الرسائل غير المرغوب فيها Spam)، ثم افتح الرابط لتعيين كلمة مرور جديدة وعد لتسجيل الدخول.
                    </p>
                  </div>

                  {error && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3.5 py-2.5 font-medium">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError('');
                        setResetSentEmail('');
                      }}
                      className="w-full min-h-[46px] py-3 px-6 rounded-xl bg-[#00a884] hover:bg-[#008f72] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <span>العودة لتسجيل الدخول</span>
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </button>

                    <button
                      type="button"
                      disabled={resetLoading || resetCooldown > 0}
                      onClick={() => handlePasswordResetSubmit()}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-[#202c33] hover:bg-slate-200 dark:hover:bg-[#2a3942] disabled:opacity-50 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${resetLoading ? 'animate-spin' : ''}`} />
                      <span>
                        {resetCooldown > 0
                          ? `إعادة الإرسال بعد ${resetCooldown} ثانية`
                          : 'إعادة إرسال رابط الاستعادة'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      البريد الإلكتروني
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => {
                          setEmail(e.target.value);
                          setError('');
                        }}
                        placeholder="name@example.com"
                        className="w-full min-h-[44px] px-4 pl-10 rounded-xl bg-slate-100 dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 focus:border-[#00a884] outline-none text-xs dir-ltr text-right"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {error && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3.5 py-2.5 font-medium">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={resetLoading || !email.trim()}
                    className="w-full min-h-[46px] py-3 px-6 rounded-xl bg-[#00a884] hover:bg-[#008f72] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    {resetLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري إرسال الرابط...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>إرسال رابط إعادة التعيين</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                    }}
                    className="w-full py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#00a884] transition-colors"
                  >
                    العودة إلى تسجيل الدخول
                  </button>
                </form>
              )}
            </div>
          ) : (
            <>
              {/* Mode Switcher Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-[#202c33]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-colors ${
                    mode === 'login'
                      ? 'bg-white dark:bg-[#111b21] text-[#00a884] shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-colors ${
                    mode === 'register'
                      ? 'bg-white dark:bg-[#111b21] text-[#00a884] shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  حساب جديد
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <>
                    <div className="flex flex-col items-center gap-2 py-1">
                      <Avatar src={avatar} name={name || 'مستخدم جديد'} size="lg" />
                      <label className="text-xs font-bold text-[#00a884] cursor-pointer hover:underline flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>صورة شخصية</span>
                        <input type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                        الاسم الكامل
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={e => {
                          setName(e.target.value);
                          setError('');
                        }}
                        placeholder="اسمك الكامل..."
                        className="w-full min-h-[44px] px-4 rounded-xl bg-slate-100 dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 focus:border-[#00a884] outline-none text-xs"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="name@example.com"
                    className="w-full min-h-[44px] px-4 rounded-xl bg-slate-100 dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 focus:border-[#00a884] outline-none text-xs dir-ltr text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      placeholder="••••••••"
                      className="w-full min-h-[44px] px-4 pl-10 rounded-xl bg-slate-100 dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 focus:border-[#00a884] outline-none text-xs dir-ltr text-right"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                      title={showPassword ? 'إخفاء' : 'إظهار'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      className="w-4 h-4 accent-[#00a884]"
                    />
                    <span>تذكر الجلسة</span>
                  </label>

                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setResetSentEmail('');
                        setMode('forgot');
                      }}
                      className="text-xs font-semibold text-[#00a884] hover:underline"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  )}
                </div>

                {error && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3.5 py-2.5 font-medium">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim() || !password}
                  className="w-full min-h-[46px] py-3 px-6 rounded-xl bg-[#00a884] hover:bg-[#008f72] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري المعالجة...</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}</span>
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </>
                  )}
                </button>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-[11px]">أو</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full bg-slate-50 dark:bg-[#202c33] hover:bg-slate-100 dark:hover:bg-[#2a3942] text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 font-bold py-3 px-6 rounded-xl transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-50 text-xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.15 21.32 7.23 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.18C.43 8.13 0 9.83 0 12s.43 3.87 1.18 5.39l4.09-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.15 2.68 1.18 6.61l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>الدخول باستخدام Google</span>
              </button>
            </>
          )}
        </div>
      </main>

      <footer className="max-w-xl w-full mx-auto text-center text-[11px] text-slate-500 dark:text-slate-400 py-2 shrink-0">
        WhatsApp Pro · الإصدار {APP_VERSION}
      </footer>
      <OfflineIndicator />
    </div>
  );
};
