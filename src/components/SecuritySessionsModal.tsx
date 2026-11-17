import React, { useEffect, useState } from 'react';
import {
  X, Laptop, Smartphone, ShieldCheck, KeyRound, Phone,
  LogOut, Trash2, CheckCircle2, RefreshCw, MessageSquare, History, Database
} from 'lucide-react';
import { AuthAuditLogItem, AuthDbStats, AuthSessionInfo, CountryDialOption, UserAccount } from '../types';
import { COUNTRY_DIAL_OPTIONS } from '../utils/countries';

interface SecuritySessionsModalProps {
  authToken: string;
  currentUser: UserAccount;
  initialTab?: 'sessions' | 'two_factor' | 'change_phone' | 'audit';
  onClose: () => void;
  onUserUpdated: (user: UserAccount) => void;
  onLoggedOutCurrent: () => void;
  onNotify: (msg: string) => void;
}

export const SecuritySessionsModal: React.FC<SecuritySessionsModalProps> = ({
  authToken,
  currentUser,
  initialTab = 'sessions',
  onClose,
  onUserUpdated,
  onLoggedOutCurrent,
  onNotify,
}) => {
  const [tab, setTab] = useState<'sessions' | 'two_factor' | 'change_phone' | 'audit'>(initialTab);
  const [sessions, setSessions] = useState<AuthSessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuthAuditLogItem[]>([]);
  const [dbStats, setDbStats] = useState<AuthDbStats | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Two-Factor State
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [saving2fa, setSaving2fa] = useState(false);

  // Change Phone State
  const [country, setCountry] = useState<CountryDialOption>(COUNTRY_DIAL_OPTIONS[0]);
  const [newLocalPhone, setNewLocalPhone] = useState('');
  const [chgChallengeId, setChgChallengeId] = useState('');
  const [chgNormalizedPhone, setChgNormalizedPhone] = useState('');
  const [chgOtpPreview, setChgOtpPreview] = useState('');
  const [chgCode, setChgCode] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const [error, setError] = useState('');

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/auth/sessions', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch('/api/auth/audit-logs', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data.logs)) setAuditLogs(data.logs);
        if (data.dbStats) setDbStats(data.dbStats);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchAuditLogs();
  }, [authToken]);

  const handleRevokeSession = async (sessionId: string) => {
    setError('');
    try {
      const res = await fetch(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر إنهاء الجلسة');
        return;
      }
      if (data.revokedCurrent) {
        onLoggedOutCurrent();
        return;
      }
      setSessions(data.sessions || []);
      onNotify('تم تسجيل خروج الجهاز المحدد');
    } catch {
      setError('تعذر الاتصال بالخادم');
    }
  };

  const handleRevokeOthers = async () => {
    setError('');
    try {
      const res = await fetch('/api/auth/sessions/revoke-others', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSessions(data.sessions || []);
        onNotify(`تم إنهاء ${data.revokedCount || 0} جلسات أخرى`);
      }
    } catch {
      setError('تعذر إنهاء الجلسات الأخرى');
    }
  };

  const handleSaveTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const clean = pinInput.replace(/\D/g, '');
    if (clean.length !== 6) {
      setError('يجب أن يتكون رمز التحقق بخطوتين من 6 أرقام.');
      return;
    }
    if (clean !== confirmPinInput.replace(/\D/g, '')) {
      setError('الرمزان غير متطابقين.');
      return;
    }
    setSaving2fa(true);
    try {
      const res = await fetch('/api/auth/two-factor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ enabled: true, pin: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر حفظ الرمز');
        return;
      }
      if (data.user) onUserUpdated(data.user);
      setPinInput('');
      setConfirmPinInput('');
      onNotify('تم تفعيل وتحديث التحقق بخطوتين');
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setSaving2fa(false);
    }
  };

  const handleDisableTwoFactor = async () => {
    setSaving2fa(true);
    setError('');
    try {
      const res = await fetch('/api/auth/two-factor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ enabled: false }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onUserUpdated(data.user);
        onNotify('تم تعطيل التحقق بخطوتين');
      }
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setSaving2fa(false);
    }
  };

  const handleRequestChangePhone = async () => {
    setError('');
    if (!newLocalPhone.trim()) {
      setError('أدخل رقم الهاتف الجديد');
      return;
    }
    setSavingPhone(true);
    try {
      const res = await fetch('/api/auth/change-phone/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ countryCode: country.dial, phone: newLocalPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر إرسال رمز التحقق');
        return;
      }
      setChgChallengeId(data.challengeId);
      setChgNormalizedPhone(data.normalizedPhone);
      setChgOtpPreview(data.devOtpPreview || '');
      setChgCode('');
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setSavingPhone(false);
    }
  };

  const handleConfirmChangePhone = async () => {
    setError('');
    if (chgCode.trim().length !== 6) {
      setError('أدخل رمز التحقق المكون من 6 أرقام');
      return;
    }
    setSavingPhone(true);
    try {
      const res = await fetch('/api/auth/change-phone/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ challengeId: chgChallengeId, code: chgCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'رمز التحقق غير صحيح');
        return;
      }
      if (data.user) {
        onUserUpdated(data.user);
      }
      setChgChallengeId('');
      setNewLocalPhone('');
      setChgCode('');
      setChgOtpPreview('');
      fetchSessions();
      onNotify('تم تغيير رقم الهاتف والتحقق منه بنجاح');
    } catch {
      setError('تعذر تغيير رقم الهاتف');
    } finally {
      setSavingPhone(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#222e35] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#00a884]" /> الأمان والأجهزة المرتبطة
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#111b21] text-[11px]">
          <button
            type="button"
            onClick={() => {
              setTab('sessions');
              setError('');
            }}
            className={`py-2 px-1.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-1 ${
              tab === 'sessions'
                ? 'bg-white dark:bg-[#202c33] text-[#00a884] shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">الأجهزة ({sessions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('two_factor');
              setError('');
            }}
            className={`py-2 px-1.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-1 ${
              tab === 'two_factor'
                ? 'bg-white dark:bg-[#202c33] text-[#00a884] shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">خطوتين</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('change_phone');
              setError('');
            }}
            className={`py-2 px-1.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-1 ${
              tab === 'change_phone'
                ? 'bg-white dark:bg-[#202c33] text-[#00a884] shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">الرقم</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('audit');
              setError('');
              fetchAuditLogs();
            }}
            className={`py-2 px-1.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-1 ${
              tab === 'audit'
                ? 'bg-white dark:bg-[#202c33] text-[#00a884] shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">السجل</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
          {/* TAB 1: SESSIONS */}
          {tab === 'sessions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  الجلسات النشطة المرتبطة بالرقم{' '}
                  <span className="dir-ltr inline-block font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                    {currentUser.phone}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={fetchSessions}
                  className="text-[#00a884] font-semibold flex items-center gap-1 hover:underline"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingSessions ? 'animate-spin' : ''}`} />
                  <span>تحديث</span>
                </button>
              </div>

              <div className="space-y-2">
                {sessions.map(sess => (
                  <div
                    key={sess.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                      sess.isCurrent
                        ? 'bg-[#00a884]/10 border-[#00a884]/35'
                        : 'bg-slate-100 dark:bg-[#2a3942] border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#111b21] flex items-center justify-center text-[#00a884] shrink-0">
                        {sess.deviceName.includes('iPhone') || sess.deviceName.includes('Android') ? (
                          <Smartphone className="w-4 h-4" />
                        ) : (
                          <Laptop className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate">
                          {sess.deviceName}{' '}
                          {sess.isCurrent && <span className="text-[#00a884]">(هذا الجهاز)</span>}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                          آخر نشاط: {new Date(sess.lastActiveAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(sess.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>{sess.isCurrent ? 'خروج' : 'إنهاء'}</span>
                    </button>
                  </div>
                ))}
              </div>

              {sessions.filter(s => !s.isCurrent).length > 0 && (
                <button
                  type="button"
                  onClick={handleRevokeOthers}
                  className="w-full py-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-500/25 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>تسجيل الخروج من جميع الأجهزة الأخرى</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 2: TWO-STEP VERIFICATION */}
          {tab === 'two_factor' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#2a3942] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2
                    className={`w-5 h-5 ${currentUser.hasTwoFactor ? 'text-[#00a884]' : 'text-slate-400'}`}
                  />
                  <div>
                    <p className="font-bold">
                      حالة التحقق بخطوتين: {currentUser.hasTwoFactor ? 'مفعّل' : 'غير مفعّل'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      يطلب رمز PIN من 6 أرقام عند تسجيل الدخول برقم هاتفك على جهاز جديد.
                    </p>
                  </div>
                </div>
                {currentUser.hasTwoFactor && (
                  <button
                    type="button"
                    disabled={saving2fa}
                    onClick={handleDisableTwoFactor}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[11px]"
                  >
                    تعطيل
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveTwoFactor} className="space-y-3">
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">
                    {currentUser.hasTwoFactor ? 'رمز PIN الجديد (6 أرقام)' : 'تعيين رمز PIN (6 أرقام)'}
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full text-center tracking-[0.4em] text-base font-bold tabular-nums p-3 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">تأكيد رمز PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmPinInput}
                    onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full text-center tracking-[0.4em] text-base font-bold tabular-nums p-3 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving2fa || pinInput.length !== 6 || confirmPinInput.length !== 6}
                  className="w-full py-2.5 rounded-xl bg-[#00a884] disabled:opacity-50 text-white font-bold hover:bg-[#008f72]"
                >
                  {currentUser.hasTwoFactor ? 'تحديث رمز التحقق بخطوتين' : 'تفعيل التحقق بخطوتين'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: CHANGE PHONE NUMBER */}
          {tab === 'change_phone' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                سيتم نقل ملفك الشخصي ومحادثاتك ومجموعاتك وإعداداتك إلى رقم الهاتف الجديد بعد التحقق منه برمز OTP.
              </p>

              {!chgChallengeId ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 mb-1">الرقم الحالي</label>
                    <input
                      type="text"
                      disabled
                      value={currentUser.phone}
                      className="w-full p-2.5 rounded-xl bg-slate-100/60 dark:bg-[#2a3942]/60 text-slate-400 dir-ltr text-left tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-slate-400 mb-1">رقم الهاتف الجديد</label>
                    <div className="flex gap-2">
                      <select
                        value={country.code}
                        onChange={e => {
                          const found = COUNTRY_DIAL_OPTIONS.find(c => c.code === e.target.value);
                          if (found) setCountry(found);
                        }}
                        className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none dir-ltr tabular-nums"
                      >
                        {COUNTRY_DIAL_OPTIONS.map(c => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.dial}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={newLocalPhone}
                        onChange={e => setNewLocalPhone(e.target.value)}
                        placeholder={country.placeholder}
                        className="flex-1 p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none dir-ltr text-left tabular-nums"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={savingPhone || !newLocalPhone.trim()}
                    onClick={handleRequestChangePhone}
                    className="w-full py-2.5 rounded-xl bg-[#00a884] disabled:opacity-50 text-white font-bold hover:bg-[#008f72]"
                  >
                    {savingPhone ? 'جاري إرسال الرمز...' : 'إرسال رمز التحقق للرقم الجديد'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold">
                    أدخل رمز التحقق المرسل إلى{' '}
                    <span className="dir-ltr inline-block text-[#00a884] tabular-nums">{chgNormalizedPhone}</span>
                  </p>
                  {chgOtpPreview && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-[#00a884]/30 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <MessageSquare className="w-3.5 h-3.5 text-[#00a884]" />
                        رمز SMS التجريبي: <strong className="font-mono tracking-widest">{chgOtpPreview}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setChgCode(chgOtpPreview)}
                        className="text-[11px] font-bold text-[#00a884] hover:underline"
                      >
                        تعبئة
                      </button>
                    </div>
                  )}
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={chgCode}
                    onChange={e => setChgCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="أدخل الرمز (6 أرقام)"
                    className="w-full text-center tracking-[0.4em] text-base font-bold tabular-nums p-3 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setChgChallengeId('')}
                      className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 font-semibold"
                    >
                      تعديل الرقم
                    </button>
                    <button
                      type="button"
                      disabled={savingPhone || chgCode.length !== 6}
                      onClick={handleConfirmChangePhone}
                      className="flex-1 py-2.5 rounded-xl bg-[#00a884] disabled:opacity-50 text-white font-bold"
                    >
                      تأكيد وتغيير الرقم
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SQLITE AUTH AUDIT LOGS & DB STATS */}
          {tab === 'audit' && (
            <div className="space-y-3">
              {dbStats && (
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#2a3942] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-[#00a884]">
                      <Database className="w-4 h-4" /> قاعدة بيانات المصادقة ({dbStats.engine.toUpperCase()})
                    </span>
                    <button
                      type="button"
                      onClick={fetchAuditLogs}
                      className="text-[11px] font-bold text-[#00a884] flex items-center gap-1 hover:underline"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingAudit ? 'animate-spin' : ''}`} />
                      <span>تحديث</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                    <span>الحسابات: {dbStats.accountsCount}</span>
                    <span>·</span>
                    <span>الجلسات النشطة: {dbStats.activeSessionsCount}</span>
                    <span>·</span>
                    <span>أحداث السجل: {dbStats.auditLogsCount}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {auditLogs.length === 0 ? (
                  <p className="text-center py-8 text-slate-400">لا توجد أحداث مسجلة حتى الآن</p>
                ) : (
                  auditLogs.map(item => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#2a3942]/70 border border-slate-200/70 dark:border-slate-700/50 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-bold text-xs">
                          {item.details || item.eventType}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {item.deviceName || 'جهاز غير محدد'} ·{' '}
                          <span className="dir-ltr inline-block tabular-nums">{item.phone}</span>
                        </p>
                      </div>
                      <div className="text-left shrink-0 space-y-0.5">
                        <span
                          className={`block text-[10px] font-bold ${
                            item.status === 'success'
                              ? 'text-[#00a884]'
                              : item.status === 'blocked'
                              ? 'text-amber-500'
                              : 'text-rose-500'
                          }`}
                        >
                          {item.status === 'success' ? 'ناجح' : item.status === 'blocked' ? 'محظور' : 'فاشل'}
                        </span>
                        <span className="block text-[10px] text-slate-400 tabular-nums">
                          {new Date(item.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 font-medium">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
