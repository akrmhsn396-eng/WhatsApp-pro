/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Users, UserPlus, X, Check, Shield, ShieldCheck, Search, Crown } from 'lucide-react';
import { UserAccount } from '../types';
import { Avatar } from './Avatar';

interface NewGroupModalProps {
  users: UserAccount[];
  currentUserId: string;
  onClose: () => void;
  onCreate: (name: string, memberIds: string[], adminIds: string[], about?: string) => void;
  onQuickRegisterUser?: (name: string, phone: string) => Promise<UserAccount | null>;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({
  users,
  currentUserId,
  onClose,
  onCreate,
  onQuickRegisterUser,
}) => {
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [adminIds, setAdminIds] = useState<string[]>([]);

  // Inline quick-add new participant state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const eligible = users.filter(u => u.id !== currentUserId);
  const filtered = eligible.filter(
    u =>
      !search.trim() ||
      u.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(search.trim().toLowerCase())) ||
      u.phone.toLowerCase().includes(search.trim().toLowerCase())
  );

  const toggleMember = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(x => x !== id));
      setAdminIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const toggleAdmin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedIds.includes(id)) {
      setSelectedIds(prev => [...prev, id]);
    }
    setAdminIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleQuickAddParticipant = async () => {
    if (!onQuickRegisterUser || !newMemberName.trim() || !newMemberPhone.trim()) return;
    setAddingMember(true);
    try {
      const created = await onQuickRegisterUser(newMemberName.trim(), newMemberPhone.trim());
      if (created && created.id !== currentUserId) {
        setSelectedIds(prev => (prev.includes(created.id) ? prev : [...prev, created.id]));
        setNewMemberName('');
        setNewMemberPhone('');
        setShowQuickAdd(false);
      }
    } finally {
      setAddingMember(false);
    }
  };

  const selectAllFiltered = () => {
    const ids = filtered.map(u => u.id);
    setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#222e35] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-[#00a884]" /> إنشاء مجموعة جديدة
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs overflow-y-auto pr-0.5 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">اسم المجموعة *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: فريق المشروع الجديد"
                className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] border border-transparent focus:border-[#00a884] outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">وصف المجموعة (اختياري)</label>
              <input
                type="text"
                value={about}
                onChange={e => setAbout(e.target.value)}
                placeholder="نبذة عن هدف المجموعة..."
                className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-[#2a3942] border border-transparent focus:border-[#00a884] outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-200">
                المشاركون ({selectedIds.length + 1})
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 font-bold text-[10px] flex items-center gap-1">
                <Crown className="w-3 h-3" /> {adminIds.length + 1} مشرف
              </span>
            </div>
            <div className="flex items-center gap-2">
              {filtered.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-[11px] font-bold text-[#00a884] hover:underline"
                >
                  تحديد الكل
                </button>
              )}
              {onQuickRegisterUser && (
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(!showQuickAdd)}
                  className="px-2.5 py-1 rounded-lg bg-[#00a884]/15 text-[#00a884] font-bold text-[11px] flex items-center gap-1 hover:bg-[#00a884]/25"
                >
                  <UserPlus className="w-3.5 h-3.5" /> مشارك جديد
                </button>
              )}
            </div>
          </div>

          {showQuickAdd && onQuickRegisterUser && (
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#2a3942] border border-[#00a884]/30 space-y-2">
              <p className="font-bold text-[11px] text-[#00a884]">إضافة مشارك جديد غير مسجل بعد</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  placeholder="الاسم الكامل..."
                  className="p-2 rounded-xl bg-white dark:bg-[#111b21] outline-none"
                />
                <input
                  type="text"
                  value={newMemberPhone}
                  onChange={e => setNewMemberPhone(e.target.value)}
                  placeholder="+966 5x..."
                  className="p-2 rounded-xl bg-white dark:bg-[#111b21] outline-none dir-ltr text-right"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="px-3 py-1 rounded-lg text-slate-500 hover:bg-black/5"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  disabled={addingMember || !newMemberName.trim() || !newMemberPhone.trim()}
                  onClick={handleQuickAddParticipant}
                  className="px-3.5 py-1 rounded-lg bg-[#00a884] disabled:opacity-50 text-white font-bold"
                >
                  {addingMember ? 'جاري الإضافة...' : 'إضافة وتحديد'}
                </button>
              </div>
            </div>
          )}

          {/* Search input */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#2a3942] px-3 py-2 rounded-xl">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالاسم، البريد الإلكتروني، أو الهاتف..."
              className="w-full bg-transparent outline-none"
            />
          </div>

          {/* Creator row */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#00a884]/10 border border-[#00a884]/25">
            <span className="font-bold text-[#00a884]">أنت (منشئ المجموعة)</span>
            <span className="px-2 py-0.5 rounded-full bg-[#00a884] text-white text-[10px] font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> مشرف رئيسي
            </span>
          </div>

          {/* Eligible participants list */}
          <div className="max-h-52 overflow-y-auto space-y-1.5">
            {filtered.length === 0 ? (
              <p className="text-center text-slate-400 py-4">لا توجد نتائج مطابقة</p>
            ) : (
              filtered.map(u => {
                const active = selectedIds.includes(u.id);
                const isAdmin = adminIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleMember(u.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#00a884]/15 border border-[#00a884]/40'
                        : 'bg-slate-50 dark:bg-[#2a3942]/60 hover:bg-slate-100 dark:hover:bg-[#2a3942]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar src={u.avatar} name={u.name} size="sm" />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-400 dir-ltr text-right truncate">
                          {u.email && u.email !== u.phone ? `${u.email} · ${u.phone}` : u.email || u.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={e => toggleAdmin(u.id, e)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
                          isAdmin
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-white dark:bg-[#111b21] text-slate-500 hover:text-amber-500 border border-slate-200 dark:border-slate-700'
                        }`}
                        title={isAdmin ? 'إزالة صلاحية المشرف' : 'تعيين كمشرف للمجموعة'}
                      >
                        {isAdmin ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                        <span>{isAdmin ? 'مشرف' : 'تعيين مشرف'}</span>
                      </button>

                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          active ? 'bg-[#00a884] text-white' : 'border border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-slate-200 dark:border-slate-700 shrink-0 text-xs">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            إلغاء
          </button>
          <button
            onClick={() => name.trim() && onCreate(name.trim(), selectedIds, adminIds, about.trim())}
            disabled={!name.trim()}
            className="px-5 py-2 rounded-xl bg-[#00a884] disabled:opacity-50 text-white font-bold hover:bg-[#008f72]"
          >
            إنشاء المجموعة ({selectedIds.length + 1})
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- Add Members & Admins to Existing Group Modal ---------- */
interface AddGroupMembersModalProps {
  groupName: string;
  users: UserAccount[];
  existingMemberIds: string[];
  onClose: () => void;
  onAddMembers: (memberIds: string[], adminIds: string[]) => void;
  onQuickRegisterUser?: (name: string, phone: string) => Promise<UserAccount | null>;
}

export const AddGroupMembersModal: React.FC<AddGroupMembersModalProps> = ({
  groupName,
  users,
  existingMemberIds,
  onClose,
  onAddMembers,
  onQuickRegisterUser,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [adminIds, setAdminIds] = useState<string[]>([]);

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const candidates = users.filter(u => !existingMemberIds.includes(u.id));
  const filtered = candidates.filter(
    u =>
      !search.trim() ||
      u.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(search.trim().toLowerCase())) ||
      u.phone.toLowerCase().includes(search.trim().toLowerCase())
  );

  const toggleMember = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(x => x !== id));
      setAdminIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const toggleAdmin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedIds.includes(id)) {
      setSelectedIds(prev => [...prev, id]);
    }
    setAdminIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleQuickAdd = async () => {
    if (!onQuickRegisterUser || !newMemberName.trim() || !newMemberPhone.trim()) return;
    setAddingMember(true);
    try {
      const created = await onQuickRegisterUser(newMemberName.trim(), newMemberPhone.trim());
      if (created && !existingMemberIds.includes(created.id)) {
        setSelectedIds(prev => (prev.includes(created.id) ? prev : [...prev, created.id]));
        setNewMemberName('');
        setNewMemberPhone('');
        setShowQuickAdd(false);
      }
    } finally {
      setAddingMember(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#222e35] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#00a884]" /> إضافة مشاركين إلى {groupName}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-[#2a3942] px-3 py-2 rounded-xl">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالاسم، البريد الإلكتروني، أو الهاتف..."
              className="w-full bg-transparent outline-none"
            />
          </div>
          {onQuickRegisterUser && (
            <button
              type="button"
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="px-3 py-2 rounded-xl bg-[#00a884]/15 text-[#00a884] font-bold flex items-center gap-1 hover:bg-[#00a884]/25 shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" /> رقم جديد
            </button>
          )}
        </div>

        {showQuickAdd && onQuickRegisterUser && (
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#2a3942] border border-[#00a884]/30 space-y-2">
            <p className="font-bold text-[11px] text-[#00a884]">تسجيل وإضافة مشارك جديد</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                placeholder="الاسم..."
                className="p-2 rounded-xl bg-white dark:bg-[#111b21] outline-none"
              />
              <input
                type="text"
                value={newMemberPhone}
                onChange={e => setNewMemberPhone(e.target.value)}
                placeholder="+966 5x..."
                className="p-2 rounded-xl bg-white dark:bg-[#111b21] outline-none dir-ltr text-right"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowQuickAdd(false)} className="px-3 py-1 text-slate-500">
                إغلاق
              </button>
              <button
                type="button"
                disabled={addingMember || !newMemberName.trim() || !newMemberPhone.trim()}
                onClick={handleQuickAdd}
                className="px-3 py-1 rounded-lg bg-[#00a884] text-white font-bold disabled:opacity-50"
              >
                {addingMember ? 'جاري...' : 'إضافة'}
              </button>
            </div>
          </div>
        )}

        <div className="max-h-56 overflow-y-auto space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-slate-400 space-y-2">
              <p>جميع المستخدمين المسجلين موجودون بالفعل في المجموعة</p>
              {onQuickRegisterUser && (
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(true)}
                  className="text-[#00a884] font-bold hover:underline"
                >
                  + إضافة مشارك جديد بالاسم والهاتف
                </button>
              )}
            </div>
          ) : (
            filtered.map(u => {
              const active = selectedIds.includes(u.id);
              const isAdmin = adminIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => toggleMember(u.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#00a884]/15 border border-[#00a884]/40'
                      : 'bg-slate-50 dark:bg-[#2a3942]/60 hover:bg-slate-100 dark:hover:bg-[#2a3942]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={u.avatar} name={u.name} size="sm" />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{u.name}</p>
                      <p className="text-[10px] text-slate-400 dir-ltr text-right truncate">
                        {u.email && u.email !== u.phone ? `${u.email} · ${u.phone}` : u.email || u.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={e => toggleAdmin(u.id, e)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                        isAdmin
                          ? 'bg-amber-500 text-white'
                          : 'bg-white dark:bg-[#111b21] text-slate-500 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {isAdmin ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                      <span>{isAdmin ? 'مشرف' : 'مشرف؟'}</span>
                    </button>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        active ? 'bg-[#00a884] text-white' : 'border border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700">
            إلغاء
          </button>
          <button
            onClick={() => selectedIds.length > 0 && onAddMembers(selectedIds, adminIds)}
            disabled={selectedIds.length === 0}
            className="px-5 py-2 rounded-xl bg-[#00a884] disabled:opacity-50 text-white font-bold hover:bg-[#008f72]"
          >
            إضافة ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  );
};
