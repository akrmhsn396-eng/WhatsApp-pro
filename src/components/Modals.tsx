/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Users, UserPlus, BarChart2, Image, Settings, Sparkles, X, Forward, Trash2,
  Lock, Eye, Send, Upload, Check, ShieldAlert, Phone, PhoneOff,
  Clock, Calendar, Mail, Search, CheckCircle2,
  Pin, PinOff, Video, Volume2, VolumeX, Play, Pause, ChevronLeft, ChevronRight, Globe, Type
} from 'lucide-react';
import { ChatContact, Message, StatusStory, UserAccount } from '../types';
import { Avatar } from './Avatar';

export { NewGroupModal, AddGroupMembersModal } from './NewGroupModal';

/* ---------- 2. New Contact Modal ---------- */
export const NewContactModal: React.FC<{
  availableUsers?: UserAccount[];
  currentUserId?: string;
  onClose: () => void;
  onAdd: (name: string, phoneOrEmail: string) => Promise<void> | void;
}> = ({ availableUsers = [], currentUserId = '', onClose, onAdd }) => {
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [emailQuery, setEmailQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serverMatchedUsers, setServerMatchedUsers] = useState<UserAccount[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingServer, setIsSearchingServer] = useState(false);

  const countryPrefixes = ['+966', '+20', '+971', '+1', '+44', '+967'];

  // Query server when typing in email search
  useEffect(() => {
    const q = emailQuery.trim().toLowerCase();
    if (!q || mode !== 'email') {
      setServerMatchedUsers([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingServer(true);
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setServerMatchedUsers(data.users.filter((u: UserAccount) => u.id !== currentUserId));
        }
      } catch (e) {
        console.error('Failed searching users by email:', e);
      } finally {
        setIsSearchingServer(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [emailQuery, mode, currentUserId]);

  const localMatches = availableUsers.filter(u => {
    if (u.id === currentUserId) return false;
    const q = emailQuery.trim().toLowerCase();
    if (!q) return false;
    const matchEmail = u.email ? u.email.toLowerCase().includes(q) : false;
    const matchPhone = u.phone ? u.phone.toLowerCase().includes(q) : false;
    const matchName = u.name ? u.name.toLowerCase().includes(q) : false;
    return matchEmail || matchPhone || matchName;
  });

  const combinedMatches = [
    ...localMatches,
    ...serverMatchedUsers.filter(s => !localMatches.some(l => l.id === s.id)),
  ];

  const handleStartChatWithUser = async (user: UserAccount) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onAdd(user.name, user.email || user.phone);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    if (mode === 'email') {
      const cleanEmail = emailQuery.trim();
      if (!cleanEmail || !cleanEmail.includes('@')) return;
      const finalName = name.trim() || cleanEmail.split('@')[0];
      try {
        setIsSubmitting(true);
        await onAdd(finalName, cleanEmail);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!name.trim() || !phone.trim()) return;
      try {
        setIsSubmitting(true);
        await onAdd(name.trim(), phone.trim());
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#222e35] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#00a884]" /> محادثة / جهة اتصال جديدة
          </h2>
          <button onClick={onClose} disabled={isSubmitting} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex p-1 bg-slate-100 dark:bg-[#1a242a] rounded-2xl mb-4 text-xs">
          <button
            type="button"
            onClick={() => setMode('email')}
            className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              mode === 'email'
                ? 'bg-white dark:bg-[#2a3942] text-[#00a884] shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>البحث بالبريد الإلكتروني</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('phone')}
            className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              mode === 'phone'
                ? 'bg-white dark:bg-[#2a3942] text-[#00a884] shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>إضافة برقم الهاتف</span>
          </button>
        </div>

        {mode === 'email' ? (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1.5 font-medium">البريد الإلكتروني للمستخدم</label>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#2a3942] px-3 py-2.5 rounded-xl border border-transparent focus-within:border-[#00a884]">
                <Mail className="w-4 h-4 text-[#00a884] shrink-0" />
                <input
                  type="email"
                  value={emailQuery}
                  onChange={e => setEmailQuery(e.target.value)}
                  placeholder="ابحث بالبريد (مثال: user@example.com)..."
                  disabled={isSubmitting}
                  autoFocus
                  className="w-full bg-transparent outline-none dir-ltr text-right disabled:opacity-60 text-xs"
                />
                {isSearchingServer && (
                  <span className="w-3.5 h-3.5 border-2 border-[#00a884]/30 border-t-[#00a884] rounded-full animate-spin shrink-0" />
                )}
              </div>
            </div>

            {/* Matched Users List */}
            {combinedMatches.length > 0 && (
              <div className="space-y-2 p-2.5 bg-slate-50 dark:bg-[#1a242a] rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <p className="text-[11px] font-bold text-[#00a884] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>المستخدمون المسجلون المطابقون ({combinedMatches.length})</span>
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {combinedMatches.map(u => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#202c33] border border-slate-200 dark:border-slate-700/70 hover:border-[#00a884] transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar src={u.avatar} name={u.name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">{u.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate dir-ltr text-right">
                            {u.email || u.phone}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartChatWithUser(u)}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 rounded-xl bg-[#00a884] text-white font-bold text-[11px] hover:bg-[#008f72] shrink-0 shadow-sm"
                      >
                        بدء محادثة
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom / Non-registered Email Info */}
            {emailQuery.trim().includes('@') && combinedMatches.length === 0 && (
              <div className="space-y-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  سيتم إنشاء وفتح محادثة مباشرة مع البريد الإلكتروني <span className="font-bold font-mono dir-ltr">{emailQuery.trim()}</span> فوراً.
                </p>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">اسم العرض (اختياري)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={emailQuery.split('@')[0] || 'اسم جهة الاتصال'}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-[#2a3942] border border-transparent focus:border-[#00a884] outline-none text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!emailQuery.trim() || !emailQuery.includes('@') || isSubmitting}
                className="px-5 py-2 rounded-xl bg-[#00a884] disabled:opacity-50 text-white font-bold hover:bg-[#008f72] flex items-center gap-2 transition-all shadow"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري فتح المحادثة...</span>
                  </>
                ) : (
                  <span>حفظ وبدء المحادثة</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1.5 font-medium">الاسم الكامل</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: سارة المنصور"
                disabled={isSubmitting}
                autoFocus
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-[#2a3942] border border-transparent focus:border-[#00a884] outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-500 dark:text-slate-400 font-medium">رقم الهاتف</label>
                <div className="flex items-center gap-1">
                  {countryPrefixes.map(code => (
                    <button
                      key={code}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        const clean = phone.replace(/^\+\d+\s*/, '');
                        setPhone(`${code} ${clean}`);
                      }}
                      className="px-1.5 py-0.5 bg-slate-100 dark:bg-[#2a3942] hover:bg-emerald-500/20 text-[10px] font-mono rounded text-slate-600 dark:text-slate-300 disabled:opacity-50"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+966 5x xxx xxxx"
                disabled={isSubmitting}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-[#2a3942] border border-transparent focus:border-[#00a884] outline-none dir-ltr text-right disabled:opacity-60"
              />
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
              💡 سيتم ربط رقم الهاتف ومزامنة جهة الاتصال، ثم فتح نافذة المحادثة الفورية مباشرة لبدء الدردشة مع الطرف الآخر.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!name.trim() || !phone.trim() || isSubmitting}
                className="px-5 py-2 rounded-xl bg-[#00a884] disabled:opacity-50 text-white font-bold hover:bg-[#008f72] flex items-center gap-2 transition-all shadow"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري فتح المحادثة...</span>
                  </>
                ) : (
                  <span>حفظ وبدء المحادثة</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

/* ---------- 3. Poll Modal ---------- */
export const PollModal: React.FC<{
  onClose: () => void;
  onCreate: (question: string, options: string[], allowMultiple: boolean) => void;
}> = ({ onClose, onCreate }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(true);

  const validOptions = options.map(o => o.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#222e35] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-amber-500" /> إنشاء استطلاع رأي
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1">السؤال</label>
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="اطرح سؤالاً..."
              className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] border border-transparent focus:border-[#00a884] outline-none"
            />
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <label className="block text-slate-500 dark:text-slate-400">الخيارات</label>
            {options.map((opt, i) => (
              <input
                key={i}
                type="text"
                value={opt}
                onChange={e => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                placeholder={`الخيار ${i + 1}`}
                className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] border border-transparent focus:border-[#00a884] outline-none"
              />
            ))}
            {options.length < 6 && (
              <button onClick={() => setOptions([...options, ''])} className="text-[#00a884] font-bold">
                + إضافة خيار
              </button>
            )}
          </div>
          <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] cursor-pointer">
            <span>السماح بإجابات متعددة</span>
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={e => setAllowMultiple(e.target.checked)}
              className="w-4 h-4 accent-[#00a884]"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700">إلغاء</button>
            <button
              onClick={() => question.trim() && validOptions.length >= 2 && onCreate(question.trim(), validOptions, allowMultiple)}
              disabled={!question.trim() || validOptions.length < 2}
              className="px-5 py-2 rounded-xl bg-[#00a884] disabled:opacity-50 text-white font-bold hover:bg-[#008f72]"
            >
              إرسال الاستطلاع
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- 4. Media Upload / Multi-Image Album / View Once Modal ---------- */
interface SelectedMediaItem {
  id: string;
  previewUrl: string;
  file?: File;
}

export const MediaModal: React.FC<{
  onClose: () => void;
  onSend: (urls: string[], caption: string, isViewOnce: boolean) => void;
}> = ({ onClose, onSend }) => {
  const [items, setItems] = useState<SelectedMediaItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [caption, setCaption] = useState('');
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;
    setErrorMsg('');

    const imageFiles = fileList.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setErrorMsg('يرجى اختيار ملفات صور صالحة (PNG, JPG, WEBP)');
      return;
    }

    imageFiles.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const previewUrl = reader.result;
          setItems(prev => {
            if (prev.length >= 20) return prev;
            return [
              ...prev,
              {
                id: `img-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
                previewUrl,
                file,
              },
            ];
          });
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input so selecting the same files again still triggers onChange
    e.target.value = '';
  };

  const handleAddUrl = () => {
    const clean = urlInput.trim();
    if (!clean) return;
    setItems(prev => [
      ...prev,
      { id: `url-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, previewUrl: clean },
    ]);
    setUrlInput('');
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  useEffect(() => {
    if (items.length > 1 && isViewOnce) {
      setIsViewOnce(false);
    }
  }, [items.length, isViewOnce]);

  const handleSendAll = async () => {
    if (isUploading) return;
    const pendingList =
      items.length > 0
        ? items
        : urlInput.trim()
        ? [{ id: 'single-url', previewUrl: urlInput.trim() }]
        : [];
    if (pendingList.length === 0) return;

    setIsUploading(true);
    setErrorMsg('');
    try {
      const finalUrls: string[] = [];
      for (const item of pendingList) {
        if (item.file && (pendingList.length > 1 || item.file.size > 400 * 1024)) {
          const res = await fetch('/api/media/upload', {
            method: 'POST',
            headers: {
              'Content-Type': item.file.type || 'image/jpeg',
              'x-file-name': encodeURIComponent(item.file.name || 'chat-image.jpg'),
            },
            body: item.file,
          });
          const data = await res.json();
          if (!res.ok || !data.url) {
            throw new Error(data.error || 'فشل رفع إحدى الصور');
          }
          finalUrls.push(data.url);
        } else {
          finalUrls.push(item.previewUrl);
        }
      }
      onSend(finalUrls, caption.trim(), pendingList.length === 1 ? isViewOnce : false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء تجهيز الصور');
    } finally {
      setIsUploading(false);
    }
  };

  const totalCount = items.length + (items.length === 0 && urlInput.trim() ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-[#222e35] rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 my-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Image className="w-5 h-5 text-purple-500" />
            {items.length > 1 ? `إرسال ألبوم صور (${items.length})` : 'إرسال صورة أو مجموعة صور'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl cursor-pointer hover:border-[#00a884] transition-colors">
            <Upload className="w-6 h-6 text-[#00a884] mb-1.5" />
            <span className="font-semibold">
              {items.length > 0 ? 'إضافة صور أخرى من جهازك' : 'اختر صورة أو عدة صور دفعة واحدة'}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, WEBP · حتى 20 صورة مجمعة</span>
            <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
          </label>

          {items.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#00a884]">
                  {items.length > 1
                    ? `تم اختيار ${items.length} صور · ستظهر مجمعة في شبكة مصغرة`
                    : 'تم اختيار صورة واحدة'}
                </span>
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="text-rose-500 hover:underline font-semibold"
                >
                  مسح الكل
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group"
                  >
                    <img src={item.previewUrl} alt={`صورة ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center"
                      title="إزالة الصورة"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-black/60 text-white text-[9px] font-bold tabular-nums">
                      {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1">أو أضف رابط صورة</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && urlInput.trim()) {
                    e.preventDefault();
                    handleAddUrl();
                  }
                }}
                placeholder="https://..."
                className="flex-1 p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none"
              />
              {urlInput.trim() && (
                <button
                  type="button"
                  onClick={handleAddUrl}
                  className="px-3 py-2.5 rounded-xl bg-[#00a884]/15 text-[#00a884] font-bold hover:bg-[#00a884]/25 shrink-0"
                >
                  إضافة
                </button>
              )}
            </div>
          </div>

          <input
            type="text"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="أضف تعليقاً (اختياري)..."
            className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none"
          />

          {items.length <= 1 && (
            <button
              type="button"
              onClick={() => setIsViewOnce(!isViewOnce)}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                isViewOnce
                  ? 'border-[#00a884] bg-[#00a884]/15 text-[#00a884]'
                  : 'border-transparent bg-slate-100 dark:bg-[#2a3942]'
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <span className="w-5 h-5 rounded-full border-2 border-dashed border-current flex items-center justify-center text-[10px]">1</span>
                عرض لمرة واحدة (View Once)
              </span>
              <span className="text-[11px]">{isViewOnce ? 'مُفعّل' : 'إيقاف'}</span>
            </button>
          )}

          {errorMsg && (
            <p className="text-[11px] text-rose-500 font-semibold">{errorMsg}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700">
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSendAll}
              disabled={totalCount === 0 || isUploading}
              className="px-5 py-2 rounded-xl bg-[#00a884] disabled:opacity-50 text-white font-bold hover:bg-[#008f72] flex items-center gap-1.5"
            >
              {isUploading ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  جاري الرفع...
                </>
              ) : (
                <span>{totalCount > 1 ? `إرسال ${totalCount} صور` : 'إرسال'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- 5. Forward Message Modal ---------- */
export const ForwardModal: React.FC<{
  contacts: ChatContact[];
  message: Message;
  onClose: () => void;
  onForwardTo: (targetId: string) => void;
}> = ({ contacts, message, onClose, onForwardTo }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#222e35] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Forward className="w-5 h-5 text-[#00a884]" /> إعادة توجيه إلى
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#2a3942] p-2.5 rounded-xl mb-3 line-clamp-2">
          {message.text || 'رسالة وسائط'}
        </p>
        <div className="max-h-64 overflow-y-auto space-y-1.5 text-xs">
          {contacts.map(c => (
            <button
              key={c.id}
              onClick={() => onForwardTo(c.id)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2a3942] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar src={c.avatar} name={c.name} size="sm" isAI={c.isAI} isGroup={c.isGroup} />
                <span className="font-semibold">{c.name}</span>
              </div>
              <span className="text-[#00a884] font-bold">إرسال</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ---------- 6. Delete Message Confirmation Modal ---------- */
export const DeleteMessageModal: React.FC<{
  message: Message;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}> = ({ message, onClose, onDeleteForMe, onDeleteForEveryone }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-[#222e35] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-rose-500" /> حذف الرسالة؟
        </h3>
        <p className="text-slate-500 dark:text-slate-400 mb-5">اختر طريقة حذف الرسالة المحددة.</p>
        <div className="flex flex-col gap-2">
          {message.sender === 'me' && (
            <button
              onClick={onDeleteForEveryone}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              الحذف لدى الجميع
            </button>
          )}
          <button
            onClick={onDeleteForMe}
            className="w-full py-2.5 rounded-xl bg-slate-200 dark:bg-[#2a3942] hover:bg-slate-300 dark:hover:bg-slate-700 font-semibold"
          >
            الحذف لدي فقط
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- 7. Chat Lock PIN Modal ---------- */
export const PinModal: React.FC<{
  expectedPin: string;
  title: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ expectedPin, title, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === expectedPin) {
      onSuccess();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs bg-white dark:bg-[#222e35] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-[#00a884]/15 text-[#00a884] flex items-center justify-center mx-auto mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold mb-1">{title}</h3>
        <p className="text-[11px] text-slate-400 mb-4">أدخل رمز القفل (الافتراضي: {expectedPin})</p>
        <input
          type="password"
          maxLength={6}
          autoFocus
          value={pin}
          onChange={e => {
            setPin(e.target.value);
            setError(false);
          }}
          placeholder="••••"
          className="w-full text-center tracking-[0.5em] text-lg font-bold p-3 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none border border-transparent focus:border-[#00a884]"
        />
        {error && (
          <p className="text-[11px] text-rose-500 mt-2 flex items-center justify-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> الرمز غير صحيح
          </p>
        )}
        <div className="flex gap-2 mt-4 text-xs">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700">
            إلغاء
          </button>
          <button type="submit" className="flex-1 py-2.5 rounded-xl bg-[#00a884] text-white font-bold hover:bg-[#008f72]">
            فتح
          </button>
        </div>
      </form>
    </div>
  );
};

function formatStatusDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const STATUS_FONT_CLASSES: Record<NonNullable<StatusStory['fontStyle']>, string> = {
  classic: 'font-bold tracking-normal',
  bold: 'font-extrabold tracking-wide text-lg',
  typewriter: 'font-mono font-semibold',
  serif: 'font-serif font-bold italic',
};

const QUICK_STATUS_EMOJIS = ['❤️', '🔥', '😂', '😮', '👏', '👍'];

/* ---------- 8. View Status Story Modal ---------- */
export const StatusViewerModal: React.FC<{
  status: StatusStory;
  statuses?: StatusStory[];
  onSelectStatus?: (st: StatusStory) => void;
  onClose: () => void;
  onReplyToStatus: (status: StatusStory, replyText: string) => void;
  onTogglePin?: (statusId: string) => void;
  onReactStatus?: (statusId: string, emoji: string) => void;
  onDeleteStatus?: (statusId: string) => void;
}> = ({
  status,
  statuses = [],
  onSelectStatus,
  onClose,
  onReplyToStatus,
  onTogglePin,
  onReactStatus,
  onDeleteStatus,
}) => {
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [videoTotal, setVideoTotal] = useState(status.videoDuration || 0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isVideo =
    status.mediaType === 'video' ||
    (!!status.mediaUrl && (/\.(mp4|webm|mov|ogv|3gp)(\?|$)/i.test(status.mediaUrl) || status.mediaUrl.startsWith('data:video/')));

  const currentIdx = statuses.findIndex(s => s.id === status.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < statuses.length - 1;

  const goNext = () => {
    if (hasNext && onSelectStatus) {
      onSelectStatus(statuses[currentIdx + 1]);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (hasPrev && onSelectStatus) {
      onSelectStatus(statuses[currentIdx - 1]);
    }
  };

  useEffect(() => {
    setProgress(0);
    setVideoTime(0);
    setVideoTotal(status.videoDuration || 0);
    setPaused(false);
    setShowViewers(false);
  }, [status.id, status.videoDuration]);

  useEffect(() => {
    if (isVideo) return;
    if (paused || showViewers) return;
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(timer);
          if (hasNext && onSelectStatus) {
            onSelectStatus(statuses[currentIdx + 1]);
          } else {
            onClose();
          }
          return 100;
        }
        return p + 1.5;
      });
    }, 90);
    return () => clearInterval(timer);
  }, [isVideo, paused, showViewers, status.id, hasNext, currentIdx]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!isVideo || !vid) return;
    if (paused || showViewers) {
      vid.pause();
    } else {
      vid.play().catch(() => {});
    }
  }, [isVideo, paused, showViewers, status.id]);

  const sendReply = () => {
    if (!replyText.trim()) return;
    onReplyToStatus(status, replyText.trim());
    setReplyText('');
    onClose();
  };

  const viewers = status.viewedByNames || [];
  const privacyLabel =
    status.privacy === 'private' ? 'خاصة' : status.privacy === 'contacts' ? 'جهات الاتصال' : 'الكل';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center p-3 sm:p-4">
      <div
        className={`relative w-full max-w-md h-[86vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-5 ${
          status.bgGradient ? `bg-gradient-to-br ${status.bgGradient}` : 'bg-slate-900'
        }`}
      >
        {/* Top segmented progress bar */}
        <div className="flex items-center gap-1 z-20 pt-0.5">
          {(statuses.length > 1 ? statuses : [status]).map((stItem, idx) => {
            const isPast = statuses.length > 1 && idx < currentIdx;
            const isCurrent = statuses.length <= 1 || idx === currentIdx;
            const widthVal = isPast ? 100 : isCurrent ? progress : 0;
            return (
              <div key={stItem.id} className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-100"
                  style={{ width: `${widthVal}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-2 z-20 pt-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar src={status.avatar} name={status.contactName} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-white truncate">{status.contactName}</h4>
                {status.isPinned && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-400/25 text-amber-200 border border-amber-300/30 text-[9px] font-bold flex items-center gap-0.5">
                    <Pin className="w-2.5 h-2.5" /> مثبتة
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-white/75">
                <span>{status.timestamp}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5">
                  {status.privacy === 'private' ? (
                    <Lock className="w-2.5 h-2.5" />
                  ) : status.privacy === 'contacts' ? (
                    <Users className="w-2.5 h-2.5" />
                  ) : (
                    <Globe className="w-2.5 h-2.5" />
                  )}
                  {privacyLabel}
                </span>
                {isVideo && (
                  <>
                    <span>·</span>
                    <span className="tabular-nums font-semibold text-emerald-300">
                      {formatStatusDuration(videoTime)} / {formatStatusDuration(videoTotal)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onTogglePin && (
              <button
                type="button"
                onClick={() => onTogglePin(status.id)}
                className={`p-1.5 rounded-full transition-colors ${
                  status.isPinned
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                    : 'bg-black/35 hover:bg-black/55 text-white'
                }`}
                title={status.isPinned ? 'إلغاء تثبيت الحالة' : 'تثبيت الحالة'}
              >
                {status.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
            )}
            {isVideo && (
              <button
                type="button"
                onClick={() => setMuted(m => !m)}
                className="p-1.5 rounded-full bg-black/35 hover:bg-black/55 text-white"
                title={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPaused(p => !p)}
              className="p-1.5 rounded-full bg-black/35 hover:bg-black/55 text-white"
              title={paused ? 'استئناف' : 'إيقاف مؤقت'}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            {status.contactId === 'me' && onDeleteStatus && (
              <button
                type="button"
                onClick={() => {
                  onDeleteStatus(status.id);
                  onClose();
                }}
                className="p-1.5 rounded-full bg-black/35 hover:bg-rose-600 text-white"
                title="حذف الحالة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-black/35 hover:bg-black/55 text-white"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation arrows when playlist has > 1 item */}
        {statuses.length > 1 && (
          <>
            {hasPrev && (
              <button
                type="button"
                onClick={goPrev}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 hover:bg-black/65 text-white"
                title="الحالة السابقة"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                onClick={goNext}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 hover:bg-black/65 text-white"
                title="الحالة التالية"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </>
        )}

        {/* Main Media / Text Content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center my-auto px-2 min-h-0">
          {status.mediaUrl && isVideo ? (
            <div className="relative w-full flex flex-col items-center justify-center max-h-[54vh]">
              <video
                ref={videoRef}
                key={status.id}
                src={status.mediaUrl}
                autoPlay
                playsInline
                muted={muted}
                onClick={() => setPaused(p => !p)}
                onLoadedMetadata={e => {
                  const dur = e.currentTarget.duration;
                  if (Number.isFinite(dur) && dur > 0) setVideoTotal(dur);
                }}
                onTimeUpdate={e => {
                  const vid = e.currentTarget;
                  const dur = vid.duration || videoTotal || 1;
                  setVideoTime(vid.currentTime);
                  setProgress(Math.min(100, (vid.currentTime / dur) * 100));
                }}
                onEnded={goNext}
                className="max-h-[50vh] w-full rounded-2xl object-contain bg-black/70 shadow-xl cursor-pointer"
              />
              {paused && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center">
                    <Play className="w-6 h-6" />
                  </div>
                </div>
              )}
            </div>
          ) : status.mediaUrl ? (
            <img
              src={status.mediaUrl}
              alt={status.contactName}
              referrerPolicy="no-referrer"
              className="max-h-[50vh] rounded-2xl object-cover mb-3 shadow-lg"
            />
          ) : null}

          {status.text && (
            <p
              className={`text-white leading-relaxed mt-2 px-2 ${
                status.mediaUrl
                  ? 'text-sm font-semibold bg-black/40 px-3 py-1.5 rounded-xl'
                  : `text-lg ${STATUS_FONT_CLASSES[status.fontStyle || 'classic']}`
              }`}
            >
              {status.text}
            </p>
          )}
        </div>

        {/* Bottom Reactions + Reply / Viewers */}
        <div className="z-20 space-y-2.5">
          {/* Quick Emoji Reactions */}
          {onReactStatus && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {QUICK_STATUS_EMOJIS.map(emoji => {
                const match = status.reactions?.find(r => r.emoji === emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onReactStatus(status.id, emoji)}
                    className={`px-2.5 py-1 rounded-full text-xs flex items-center gap-1 transition-all border ${
                      match?.byMe
                        ? 'bg-[#00a884] border-emerald-300 text-white scale-105 shadow-md'
                        : 'bg-black/40 border-white/15 text-white hover:bg-black/60'
                    }`}
                  >
                    <span>{emoji}</span>
                    {match && match.count > 0 && (
                      <span className="text-[10px] font-bold tabular-nums">{match.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {status.contactId !== 'me' ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendReply()}
                placeholder={`الرد على حالة ${status.contactName}...`}
                className="flex-1 bg-black/45 border border-white/25 text-white placeholder-white/60 text-xs px-4 py-2.5 rounded-full outline-none focus:border-[#00a884]"
              />
              <button
                type="button"
                onClick={sendReply}
                className="p-2.5 rounded-full bg-[#00a884] text-white hover:bg-[#008f72]"
                title="إرسال الرد"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative space-y-2">
              {showViewers && (
                <div className="p-3 rounded-2xl bg-black/80 border border-white/15 text-white text-xs space-y-1.5 max-h-36 overflow-y-auto">
                  <p className="font-bold text-[#00a884]">المشاهدون ({viewers.length})</p>
                  {viewers.length === 0 ? (
                    <p className="text-[11px] text-white/60">لم يشاهد أحد حالتك بعد</p>
                  ) : (
                    viewers.map((viewerName, i) => (
                      <div key={i} className="text-[11px] text-white/90">
                        • {viewerName}
                      </div>
                    ))
                  )}
                </div>
              )}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowViewers(v => !v)}
                  className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full bg-black/45 hover:bg-black/65 text-white text-xs font-semibold"
                >
                  <Eye className="w-4 h-4" />
                  <span>{viewers.length} مشاهدة</span>
                </button>
                {onTogglePin && (
                  <button
                    type="button"
                    onClick={() => onTogglePin(status.id)}
                    className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      status.isPinned
                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                        : 'bg-black/45 hover:bg-black/65 text-white'
                    }`}
                  >
                    {status.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    <span>{status.isPinned ? 'إلغاء التثبيت' : 'تثبيت الحالة'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export interface PublishStatusPayload {
  text: string;
  mediaUrl?: string;
  mediaType: 'text' | 'image' | 'video';
  videoDuration?: number;
  bgGradient?: string;
  fontStyle?: 'classic' | 'bold' | 'typewriter' | 'serif';
  privacy?: 'everyone' | 'contacts' | 'private';
  pinImmediately?: boolean;
}

/* ---------- 9. Add Status Story Modal ---------- */
export const AddStatusModal: React.FC<{
  onClose: () => void;
  onPublish: (payload: PublishStatusPayload) => void;
}> = ({ onClose, onPublish }) => {
  const [mode, setMode] = useState<'text' | 'image' | 'video'>('text');
  const [text, setText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [mediaError, setMediaError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [bgGradient, setBgGradient] = useState('from-emerald-700 via-teal-700 to-cyan-800');
  const [fontStyle, setFontStyle] = useState<'classic' | 'bold' | 'typewriter' | 'serif'>('classic');
  const [privacy, setPrivacy] = useState<'everyone' | 'contacts' | 'private'>('everyone');
  const [pinImmediately, setPinImmediately] = useState(false);

  const gradients = [
    'from-emerald-700 via-teal-700 to-cyan-800',
    'from-indigo-700 via-purple-700 to-pink-700',
    'from-amber-600 via-orange-600 to-rose-600',
    'from-sky-700 via-blue-800 to-indigo-900',
    'from-fuchsia-700 via-rose-700 to-amber-700',
    'from-slate-800 via-slate-900 to-black',
  ];

  const fontOptions: Array<{ id: 'classic' | 'bold' | 'typewriter' | 'serif'; label: string }> = [
    { id: 'classic', label: 'قياسي' },
    { id: 'bold', label: 'عريض' },
    { id: 'typewriter', label: 'رقمي' },
    { id: 'serif', label: 'كلاسيكي' },
  ];

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(mediaPreviewUrl);
      }
    };
  }, [mediaPreviewUrl]);

  const clearMedia = () => {
    if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreviewUrl);
    }
    setMediaFile(null);
    setMediaPreviewUrl('');
    setVideoDuration(0);
    setMediaError('');
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaError('');
    if (!file.type.startsWith('image/')) {
      setMediaError('يرجى اختيار ملف صورة صالح');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMediaFile(file);
        setMediaPreviewUrl(reader.result);
        setVideoDuration(0);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearMedia();
    if (!file.type.startsWith('video/')) {
      setMediaError('يرجى اختيار ملف فيديو صالح (MP4 أو WebM)');
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      setMediaError('حجم الفيديو كبير جداً (الحد الأقصى 80 ميجابايت)');
      return;
    }

    const objUrl = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const dur = probe.duration;
      if (!Number.isFinite(dur) || dur <= 0) {
        URL.revokeObjectURL(objUrl);
        setMediaError('تعذر قراءة مدة مقطع الفيديو');
        return;
      }
      if (dur > 180.5) {
        URL.revokeObjectURL(objUrl);
        setMediaError(
          `مدة الفيديو (${formatStatusDuration(dur)}) تتجاوز الحد الأقصى المسموح به وهو 3 دقائق (03:00). يرجى اختيار مقطع أقصر.`
        );
        return;
      }
      setMediaFile(file);
      setMediaPreviewUrl(objUrl);
      setVideoDuration(Math.round(dur));
      setMediaError('');
    };
    probe.onerror = () => {
      URL.revokeObjectURL(objUrl);
      setMediaError('تعذر تحميل معاينة الفيديو. جرّب صيغة MP4 أو WebM.');
    };
    probe.src = objUrl;
  };

  const handleSubmit = async () => {
    if (isUploading) return;
    if (mode === 'text' && !text.trim()) return;
    if ((mode === 'image' || mode === 'video') && !mediaPreviewUrl) return;
    if (mediaError) return;

    let finalMediaUrl: string | undefined = undefined;
    try {
      if (mode === 'video' && mediaFile) {
        setIsUploading(true);
        const res = await fetch('/api/media/upload', {
          method: 'POST',
          headers: {
            'Content-Type': mediaFile.type || 'video/mp4',
            'x-file-name': encodeURIComponent(mediaFile.name || 'status-video.mp4'),
          },
          body: mediaFile,
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'فشل رفع مقطع الفيديو');
        }
        finalMediaUrl = data.url;
      } else if (mode === 'image' && mediaFile && mediaFile.size > 1.5 * 1024 * 1024) {
        setIsUploading(true);
        const res = await fetch('/api/media/upload', {
          method: 'POST',
          headers: {
            'Content-Type': mediaFile.type || 'image/jpeg',
            'x-file-name': encodeURIComponent(mediaFile.name || 'status-image.jpg'),
          },
          body: mediaFile,
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'فشل رفع الصورة');
        }
        finalMediaUrl = data.url;
      } else if (mode === 'image') {
        finalMediaUrl = mediaPreviewUrl;
      }

      onPublish({
        text: text.trim(),
        mediaUrl: finalMediaUrl,
        mediaType: mode,
        videoDuration: mode === 'video' ? videoDuration : undefined,
        bgGradient: mode === 'text' ? bgGradient : 'from-slate-900 via-slate-950 to-black',
        fontStyle,
        privacy,
        pinImmediately,
      });
    } catch (err: any) {
      setMediaError(err?.message || 'حدث خطأ أثناء رفع الوسائط');
    } finally {
      setIsUploading(false);
    }
  };

  const canSubmit =
    !isUploading &&
    !mediaError &&
    ((mode === 'text' && !!text.trim()) || ((mode === 'image' || mode === 'video') && !!mediaPreviewUrl));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-[#222e35] rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 my-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#00a884]" /> نشر حالة متطورة
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Type Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-[#111b21] mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('text');
              clearMedia();
            }}
            className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'text' ? 'bg-[#00a884] text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Type className="w-3.5 h-3.5" /> كتابة
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('image');
              clearMedia();
            }}
            className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'image' ? 'bg-[#00a884] text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Image className="w-3.5 h-3.5" /> صورة
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('video');
              clearMedia();
            }}
            className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'video' ? 'bg-[#00a884] text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Video className="w-3.5 h-3.5" /> فيديو (3 د)
          </button>
        </div>

        <div className="space-y-3.5 text-xs">
          {mode === 'text' && (
            <>
              <div
                className={`p-4 rounded-2xl bg-gradient-to-br ${bgGradient} min-h-[125px] flex items-center justify-center shadow-inner`}
              >
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  maxLength={350}
                  placeholder="اكتب حالتك هنا..."
                  rows={3}
                  className={`w-full bg-transparent text-white placeholder-white/70 text-center text-sm outline-none resize-none ${STATUS_FONT_CLASSES[fontStyle]}`}
                />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">الخلفية:</span>
                  {gradients.map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setBgGradient(g)}
                      className={`w-5 h-5 rounded-full bg-gradient-to-br ${g} ${
                        bgGradient === g ? 'ring-2 ring-[#00a884] ring-offset-1' : ''
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums">{text.length}/350</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">الخط:</span>
                {fontOptions.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFontStyle(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                      fontStyle === f.id
                        ? 'bg-[#00a884]/15 border-[#00a884] text-[#00a884]'
                        : 'bg-slate-100 dark:bg-[#2a3942] border-transparent text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === 'image' && (
            <div className="space-y-3">
              {mediaPreviewUrl ? (
                <div className="relative rounded-2xl overflow-hidden bg-slate-950">
                  <img src={mediaPreviewUrl} alt="معاينة الصورة" className="w-full max-h-52 object-contain mx-auto" />
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="absolute top-2 left-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-rose-600"
                    title="إزالة الصورة"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#111b21] cursor-pointer hover:border-[#00a884]">
                  <Image className="w-8 h-8 text-[#00a884]" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">اختر صورة للحالة</span>
                  <span className="text-[11px] text-slate-400">PNG, JPG, WEBP</span>
                  <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                </label>
              )}
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="أضف تعليقاً على الصورة (اختياري)..."
                className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none"
              />
            </div>
          )}

          {mode === 'video' && (
            <div className="space-y-3">
              {mediaPreviewUrl ? (
                <div className="space-y-2">
                  <div className="relative rounded-2xl overflow-hidden bg-black">
                    <video
                      src={mediaPreviewUrl}
                      controls
                      playsInline
                      className="w-full max-h-52 object-contain mx-auto"
                    />
                    <button
                      type="button"
                      onClick={clearMedia}
                      className="absolute top-2 left-2 p-1.5 rounded-full bg-black/65 text-white hover:bg-rose-600"
                      title="إزالة الفيديو"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] px-1">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      المدة: {formatStatusDuration(videoDuration)} / 03:00
                    </span>
                    {mediaFile && (
                      <span className="text-slate-400 tabular-nums">
                        {(mediaFile.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#111b21] cursor-pointer hover:border-[#00a884]">
                  <Video className="w-8 h-8 text-[#00a884]" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">اختر مقطع فيديو قصير للحالة</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    يدعم مقاطع الفيديو حتى 3 دقائق (03:00) · MP4 / WebM
                  </span>
                  <input type="file" accept="video/*" onChange={handleVideoFile} className="hidden" />
                </label>
              )}
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="أضف وصفاً لمقطع الفيديو (اختياري)..."
                className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none"
              />
            </div>
          )}

          {mediaError && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-[11px] font-semibold">
              {mediaError}
            </div>
          )}

          {/* Privacy & Pin Immediately */}
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#111b21] space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#00a884]" /> خصوصية الحالة:
              </span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'everyone', label: 'الكل' },
                    { id: 'contacts', label: 'جهات اتصالي' },
                    { id: 'private', label: 'أنا فقط' },
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPrivacy(opt.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                      privacy === opt.id
                        ? 'bg-[#00a884] text-white'
                        : 'bg-white dark:bg-[#202c33] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between cursor-pointer pt-1 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5 text-amber-500" />
                تثبيت الحالة في الأعلى بعد النشر
              </span>
              <input
                type="checkbox"
                checked={pinImmediately}
                onChange={e => setPinImmediately(e.target.checked)}
                className="w-4 h-4 accent-[#00a884] rounded"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-semibold">
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-5 py-2 rounded-xl bg-[#00a884] disabled:opacity-50 text-white font-bold hover:bg-[#008f72] flex items-center gap-1.5"
            >
              {isUploading ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  جاري الرفع...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  نشر الحالة
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- 10. Edit Profile Modal ---------- */
export const EditProfileModal: React.FC<{
  profile: { name: string; about: string; phone: string; avatar: string };
  onClose: () => void;
  onSave: (updated: { name: string; about: string; phone: string; avatar: string }) => void;
}> = ({ profile, onClose, onSave }) => {
  const [name, setName] = useState(profile.name);
  const [about, setAbout] = useState(profile.about);
  const [phone, setPhone] = useState(profile.phone);
  const [avatar, setAvatar] = useState(profile.avatar);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && setAvatar(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#222e35] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#00a884]" /> الملف الشخصي
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4 text-xs">
          <div className="flex flex-col items-center gap-2">
            <Avatar src={avatar} name={name} size="xl" />
            <label className="text-[#00a884] font-bold cursor-pointer hover:underline">
              تغيير الصورة الشخصية
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>
          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1">الاسم</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1">الأخبار / النبذة (About)</label>
            <input
              type="text"
              value={about}
              onChange={e => setAbout(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1">رقم الهاتف</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+966 5xxxxxxxx"
              className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none dir-ltr text-right"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700">إلغاء</button>
            <button
              onClick={() => name.trim() && onSave({ name: name.trim(), about: about.trim(), phone: phone.trim(), avatar })}
              className="px-5 py-2 rounded-xl bg-[#00a884] text-white font-bold hover:bg-[#008f72]"
            >
              حفظ التغييرات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- 12. Incoming Real-Time Call Modal ---------- */
export const IncomingCallModal: React.FC<{
  caller: UserAccount;
  callType: 'voice' | 'video';
  onAccept: () => void;
  onReject: () => void;
}> = ({ caller, callType, onAccept, onReject }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#111b21] border border-slate-800 rounded-3xl p-8 text-center text-white shadow-2xl space-y-5">
        <div className="relative inline-block">
          <Avatar src={caller.avatar} name={caller.name} size="xl" />
          <span className="absolute inset-0 rounded-full border-4 border-[#00a884] animate-ping pointer-events-none" />
        </div>
        <div>
          <h3 className="text-lg font-bold">{caller.name}</h3>
          <p className="text-xs text-slate-400 mt-1">
            {callType === 'video' ? 'مكالمة فيديو واردة...' : 'مكالمة صوتية واردة...'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-8 pt-2">
          <button
            onClick={onReject}
            className="p-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition-transform hover:scale-105"
            title="رفض"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
          <button
            onClick={onAccept}
            className="p-4 rounded-full bg-[#00a884] hover:bg-[#008f72] text-white shadow-lg transition-transform hover:scale-105 animate-bounce"
            title="رد"
          >
            <Phone className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- 13. Schedule Message Modal ---------- */
function toLocalDateTimeInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const ScheduleMessageModal: React.FC<{
  initialText: string;
  recipientName: string;
  onClose: () => void;
  onSchedule: (text: string, scheduledAt: number) => void;
}> = ({ initialText, recipientName, onClose, onSchedule }) => {
  const [text, setText] = useState(initialText);
  const [targetMs, setTargetMs] = useState<number>(() => Date.now() + 5 * 60 * 1000);
  const [dateTimeInput, setDateTimeInput] = useState<string>(() => toLocalDateTimeInputValue(Date.now() + 5 * 60 * 1000));
  const [error, setError] = useState('');

  const applyPreset = (ms: number) => {
    setTargetMs(ms);
    setDateTimeInput(toLocalDateTimeInputValue(ms));
    setError('');
  };

  const handleDateTimeChange = (val: string) => {
    setDateTimeInput(val);
    const parsed = new Date(val).getTime();
    if (!Number.isNaN(parsed)) {
      setTargetMs(parsed);
      setError('');
    }
  };

  const handleConfirm = () => {
    if (!text.trim()) {
      setError('يرجى كتابة نص الرسالة أولاً');
      return;
    }
    if (!targetMs || targetMs <= Date.now() + 1000) {
      setError('يرجى اختيار وقت مستقبلي للإرسال');
      return;
    }
    onSchedule(text.trim(), targetMs);
  };

  const tomorrowNineAm = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  };

  const formattedTarget = new Date(targetMs).toLocaleString('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#222e35] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#00a884]" /> جدولة إرسال رسالة
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          إلى: <span className="font-bold text-slate-700 dark:text-slate-200">{recipientName}</span>
        </p>

        <div>
          <label className="block text-slate-500 dark:text-slate-400 mb-1.5">نص الرسالة</label>
          <textarea
            value={text}
            onChange={e => {
              setText(e.target.value);
              setError('');
            }}
            placeholder="اكتب الرسالة المراد جدولتها..."
            rows={3}
            className="w-full p-3 rounded-xl bg-slate-100 dark:bg-[#2a3942] border border-transparent focus:border-[#00a884] outline-none resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-slate-500 dark:text-slate-400">اختصارات سريعة</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => applyPreset(Date.now() + 15 * 1000)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-[#2a3942] hover:bg-[#00a884]/15 hover:text-[#00a884] font-semibold transition-colors"
            >
              ⏱️ بعد 15 ثانية
            </button>
            <button
              type="button"
              onClick={() => applyPreset(Date.now() + 5 * 60 * 1000)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-[#2a3942] hover:bg-[#00a884]/15 hover:text-[#00a884] font-semibold transition-colors"
            >
              بعد 5 دقائق
            </button>
            <button
              type="button"
              onClick={() => applyPreset(Date.now() + 60 * 60 * 1000)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-[#2a3942] hover:bg-[#00a884]/15 hover:text-[#00a884] font-semibold transition-colors"
            >
              بعد ساعة
            </button>
            <button
              type="button"
              onClick={() => applyPreset(tomorrowNineAm())}
              className="p-2 rounded-xl bg-slate-100 dark:bg-[#2a3942] hover:bg-[#00a884]/15 hover:text-[#00a884] font-semibold transition-colors"
            >
              غداً 9:00 ص
            </button>
          </div>
        </div>

        <div>
          <label className="block text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#00a884]" /> أو حدد التاريخ والوقت بدقة
          </label>
          <input
            type="datetime-local"
            value={dateTimeInput}
            min={toLocalDateTimeInputValue(Date.now())}
            onChange={e => handleDateTimeChange(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] border border-transparent focus:border-[#00a884] outline-none dir-ltr text-right"
          />
        </div>

        <div className="p-2.5 rounded-xl bg-[#00a884]/10 border border-[#00a884]/25 text-[#00a884] text-[11px] flex items-center gap-2">
          <Clock className="w-4 h-4 shrink-0" />
          <span>سيتم الإرسال تلقائياً في: {formattedTarget}</span>
        </div>

        {error && (
          <p className="text-[11px] text-rose-500 font-semibold">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700">
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl bg-[#00a884] text-white font-bold hover:bg-[#008f72] flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" />
            تأكيد الجدولة
          </button>
        </div>
      </div>
    </div>
  );
};

