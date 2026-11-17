/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  X, RefreshCw, Smartphone, Upload, Download, UserPlus, Search, CheckCircle2,
  MessageSquare, Trash2, Share2, Users, Phone, AlertCircle, FileSpreadsheet
} from 'lucide-react';
import { SyncedContact, UserAccount } from '../types';
import { Avatar } from './Avatar';
import {
  IncomingContactDraft,
  isContactPickerSupported,
  pickDeviceContacts,
  parseVCard,
  parseCsvContacts,
  parseBulkTextContacts,
  downloadVCardBackup,
} from '../utils/contactSync';

interface ContactSyncModalProps {
  syncedContacts: SyncedContact[];
  users: UserAccount[];
  lastSyncAt: number | null;
  autoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  onSyncBatch: (contacts: IncomingContactDraft[]) => void;
  onResync: () => void;
  onDeleteContact: (contactId: string) => void;
  onClearAll: () => void;
  onStartChatWithUser: (userId: string) => void;
  onOnboardAndChat: (contact: SyncedContact) => Promise<void>;
  onCopyInvite: (contact: SyncedContact) => void;
  onClose: () => void;
}

const SOURCE_LABELS: Record<SyncedContact['source'], string> = {
  device: 'الهاتف',
  vcf: 'vCard',
  csv: 'CSV',
  manual: 'يدوي',
  sync: 'متزامن',
};

export const ContactSyncModal: React.FC<ContactSyncModalProps> = ({
  syncedContacts,
  users,
  lastSyncAt,
  autoSyncEnabled,
  onToggleAutoSync,
  onSyncBatch,
  onResync,
  onDeleteContact,
  onClearAll,
  onStartChatWithUser,
  onOnboardAndChat,
  onCopyInvite,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'registered' | 'unregistered'>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showManualPanel, setShowManualPanel] = useState<'none' | 'single' | 'bulk'>('none');
  const [singleName, setSingleName] = useState('');
  const [singlePhone, setSinglePhone] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pickerSupported = useMemo(() => isContactPickerSupported(), []);

  const stats = useMemo(() => {
    const registered = syncedContacts.filter(c => !!c.registeredUserId).length;
    return {
      total: syncedContacts.length,
      registered,
      unregistered: syncedContacts.length - registered,
    };
  }, [syncedContacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return syncedContacts.filter(c => {
      if (filterTab === 'registered' && !c.registeredUserId) return false;
      if (filterTab === 'unregistered' && c.registeredUserId) return false;
      if (!q) return true;
      const matched = c.registeredUserId ? users.find(u => u.id === c.registeredUserId) : undefined;
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.normalizedPhone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (matched?.email && matched.email.toLowerCase().includes(q))
      );
    });
  }, [syncedContacts, users, search, filterTab]);

  const formatLastSync = (ts: number | null) => {
    if (!ts) return 'لم تتم المزامنة بعد';
    return new Date(ts).toLocaleString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  };

  const handleResync = () => {
    setIsSyncing(true);
    onResync();
    setStatusMessage({ type: 'success', text: 'تمت إعادة فحص ومطابقة جميع جهات الاتصال مع الخادم' });
    setTimeout(() => setIsSyncing(false), 700);
  };

  const handleDevicePick = async () => {
    setStatusMessage(null);
    if (!pickerSupported) {
      setStatusMessage({
        type: 'info',
        text: 'متصفح سطح المكتب لا يدعم واجهة جهات اتصال النظام مباشرة؛ يمكنك استيراد ملف .vcf أو .csv أو لصق الأرقام أدناه.',
      });
      return;
    }
    try {
      setIsSyncing(true);
      const picked = await pickDeviceContacts();
      if (picked.length === 0) {
        setStatusMessage({ type: 'info', text: 'لم يتم تحديد أي جهة اتصال تحتوي على رقم هاتف' });
      } else {
        onSyncBatch(picked);
        setStatusMessage({ type: 'success', text: `تمت مزامنة ${picked.length} جهة اتصال من جهازك بنجاح` });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setStatusMessage({ type: 'error', text: 'تعذر الوصول إلى جهات اتصال الجهاز' });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const content = await file.text();
      const isVcf = file.name.toLowerCase().endsWith('.vcf') || file.name.toLowerCase().endsWith('.vcard') || content.includes('BEGIN:VCARD');
      const parsed = isVcf ? parseVCard(content) : parseCsvContacts(content);

      if (parsed.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'لم يتم العثور على أرقام هواتف صالحة داخل الملف. تأكد من أن الملف بصيغة vCard (.vcf) أو CSV.',
        });
        return;
      }

      onSyncBatch(parsed);
      setStatusMessage({
        type: 'success',
        text: `تم استيراد ومزامنة ${parsed.length} جهة اتصال من "${file.name}"`,
      });
    } catch {
      setStatusMessage({ type: 'error', text: 'حدث خطأ أثناء قراءة الملف' });
    }
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim() || !singlePhone.trim()) return;
    onSyncBatch([
      {
        displayName: singleName.trim(),
        phone: singlePhone.trim(),
        email: singleEmail.trim() || undefined,
        source: 'manual',
      },
    ]);
    setStatusMessage({ type: 'success', text: `تمت مزامنة "${singleName.trim()}" مع الخادم` });
    setSingleName('');
    setSinglePhone('');
    setSingleEmail('');
    setShowManualPanel('none');
  };

  const handleSingleSaveAndChat = async () => {
    if (!singleName.trim() || !singlePhone.trim()) return;
    const name = singleName.trim();
    const phone = singlePhone.trim();
    setSingleName('');
    setSinglePhone('');
    setSingleEmail('');
    setShowManualPanel('none');
    await onOnboardAndChat({
      id: 'sc-manual-' + Date.now(),
      ownerUserId: '',
      displayName: name,
      phone,
      normalizedPhone: phone.replace(/\D/g, ''),
      source: 'manual',
      syncedAt: Date.now(),
    });
  };

  const handleBulkSubmit = () => {
    const parsed = parseBulkTextContacts(bulkText);
    if (parsed.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'الصيغة غير واضحة. اكتب كل جهة في سطر بالشكل: الاسم - رقم الهاتف',
      });
      return;
    }
    onSyncBatch(parsed);
    setStatusMessage({ type: 'success', text: `تمت مزامنة ${parsed.length} جهة اتصال بنجاح` });
    setBulkText('');
    setShowManualPanel('none');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" dir="rtl">
      <div className="w-full max-w-2xl bg-white dark:bg-[#222e35] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00a884]/15 text-[#00a884] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold">مركز مزامنة جهات الاتصال</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                آخر مزامنة: {formatLastSync(lastSyncAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResync}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl bg-[#00a884] hover:bg-[#008f72] text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>مزامنة الآن</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats + Auto-sync toggle */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-[#1a242a] border-b border-slate-200 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-[#2a3942] font-bold">
              الإجمالي: <span className="text-[#00a884] tabular-nums">{stats.total}</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
              على واتساب: <span className="tabular-nums">{stats.registered}</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
              غير مسجل: <span className="tabular-nums">{stats.unregistered}</span>
            </span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={e => onToggleAutoSync(e.target.checked)}
              className="w-4 h-4 accent-[#00a884]"
            />
            مزامنة تلقائية عند الاتصال
          </label>
        </div>

        {/* Sync Sources Toolbar */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700/70 space-y-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".vcf,.vcard,.csv,text/vcard,text/csv"
            onChange={handleFileImport}
            className="hidden"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <button
              onClick={handleDevicePick}
              className="p-2.5 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] hover:bg-[#00a884]/15 hover:text-[#00a884] font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Smartphone className="w-4 h-4 text-[#00a884]" />
              <span>جهات الجهاز</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] hover:bg-[#00a884]/15 hover:text-[#00a884] font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Upload className="w-4 h-4 text-sky-500" />
              <span>ملف VCF / CSV</span>
            </button>

            <button
              onClick={() => setShowManualPanel(prev => (prev === 'single' ? 'none' : 'single'))}
              className={`p-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                showManualPanel === 'single'
                  ? 'bg-[#00a884] text-white'
                  : 'bg-[#f0f2f5] dark:bg-[#2a3942] hover:bg-[#00a884]/15 hover:text-[#00a884]'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة جهة</span>
            </button>

            <button
              onClick={() => setShowManualPanel(prev => (prev === 'bulk' ? 'none' : 'bulk'))}
              className={`p-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                showManualPanel === 'bulk'
                  ? 'bg-[#00a884] text-white'
                  : 'bg-[#f0f2f5] dark:bg-[#2a3942] hover:bg-[#00a884]/15 hover:text-[#00a884]'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>استيراد نصي</span>
            </button>
          </div>

          {statusMessage && (
            <div
              className={`p-2.5 rounded-xl text-[11px] flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                  : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          {showManualPanel === 'single' && (
            <form
              onSubmit={handleSingleSubmit}
              className="p-3 rounded-2xl bg-[#f0f2f5] dark:bg-[#1a242a] grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs"
            >
              <input
                type="text"
                value={singleName}
                onChange={e => setSingleName(e.target.value)}
                placeholder="الاسم الكامل *"
                className="p-2.5 rounded-xl bg-white dark:bg-[#2a3942] outline-none"
                required
              />
              <input
                type="text"
                value={singlePhone}
                onChange={e => setSinglePhone(e.target.value)}
                placeholder="رقم الهاتف (+966...) *"
                className="p-2.5 rounded-xl bg-white dark:bg-[#2a3942] outline-none dir-ltr text-right"
                required
              />
              <div className="flex gap-2">
                <input
                  type="email"
                  value={singleEmail}
                  onChange={e => setSingleEmail(e.target.value)}
                  placeholder="البريد (اختياري)"
                  className="flex-1 min-w-0 p-2.5 rounded-xl bg-white dark:bg-[#2a3942] outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold shrink-0"
                  title="حفظ إلى جهات الاتصال فقط"
                >
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={handleSingleSaveAndChat}
                  className="px-3.5 py-2 rounded-xl bg-[#00a884] text-white font-bold hover:bg-[#008f72] shrink-0 flex items-center gap-1.5 shadow"
                  title="حفظ جهة الاتصال وبدء محادثة فورية معها"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>بدء محادثة</span>
                </button>
              </div>
            </form>
          )}

          {showManualPanel === 'bulk' && (
            <div className="p-3 rounded-2xl bg-[#f0f2f5] dark:bg-[#1a242a] space-y-2 text-xs">
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={'أدخل كل جهة اتصال في سطر واحد، مثال:\nسارة المنصور - +966501112233\nطارق العلي, 0558889900'}
                className="w-full h-24 p-2.5 rounded-xl bg-white dark:bg-[#2a3942] outline-none resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowManualPanel('none')}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleBulkSubmit}
                  className="px-4 py-1.5 rounded-xl bg-[#00a884] text-white font-bold"
                >
                  مزامنة القائمة
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-[#f0f2f5] dark:bg-[#2a3942] px-3 py-2 rounded-xl">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الهاتف أو البريد الإلكتروني..."
              className="w-full bg-transparent outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {(
              [
                ['all', 'الكل'],
                ['registered', 'على واتساب'],
                ['unregistered', 'غير مسجل'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterTab(key)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                  filterTab === key
                    ? 'bg-[#00a884] text-white'
                    : 'bg-[#f0f2f5] dark:bg-[#2a3942] text-slate-600 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Synced Contacts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Phone className="w-8 h-8 mx-auto opacity-40" />
              <p>لا توجد جهات اتصال متزامنة مطابقة لبحثك</p>
            </div>
          ) : (
            filtered.map(contact => {
              const matchedUser = contact.registeredUserId
                ? users.find(u => u.id === contact.registeredUserId)
                : undefined;

              return (
                <div
                  key={contact.id}
                  className="p-3 rounded-2xl bg-[#f0f2f5] dark:bg-[#2a3942] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={matchedUser?.avatar || ''}
                      name={contact.displayName}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[13px] truncate">{contact.displayName}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#111b21] text-[10px] text-slate-500 dark:text-slate-400">
                          {SOURCE_LABELS[contact.source]}
                        </span>
                        {matchedUser ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-[#00a884] text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> على واتساب
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                            غير مسجل
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-300 dir-ltr text-right truncate mt-0.5">
                        {contact.phone}
                      </p>
                      {matchedUser?.about && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{matchedUser.about}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {matchedUser ? (
                      <button
                        onClick={() => onStartChatWithUser(matchedUser.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#00a884] hover:bg-[#008f72] text-white font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>مراسلة</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onOnboardAndChat(contact)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#00a884]/15 hover:bg-[#00a884] text-[#00a884] hover:text-white font-bold transition-colors"
                          title="تسجيل الحساب وبدء محادثة مباشرة"
                        >
                          تفعيل ومراسلة
                        </button>
                        <button
                          onClick={() => onCopyInvite(contact)}
                          className="p-2 rounded-xl bg-white dark:bg-[#111b21] hover:text-[#00a884] text-slate-500 transition-colors"
                          title="نسخ رابط دعوة"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => onDeleteContact(contact.id)}
                      className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                      title="حذف من القائمة المتزامنة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {syncedContacts.length > 0 && (
              <button
                onClick={() => downloadVCardBackup(syncedContacts)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#2a3942] hover:text-[#00a884] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير نسخة .vcf</span>
              </button>
            )}

            {syncedContacts.length > 0 && (
              confirmClear ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      onClearAll();
                      setConfirmClear(false);
                      setStatusMessage({ type: 'info', text: 'تم مسح جميع جهات الاتصال المتزامنة' });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold"
                  >
                    تأكيد المسح
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700"
                  >
                    تراجع
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-semibold"
                >
                  مسح القائمة
                </button>
              )
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
