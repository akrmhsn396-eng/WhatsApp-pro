/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  MessageSquare, CircleDashed, Users, Phone, Sparkles, Star, Archive, Lock, Settings, Moon, Sun
} from 'lucide-react';
import { NavTab } from '../types';
import { Avatar } from './Avatar';

interface NavigationRailProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  unreadChatsCount: number;
  unviewedStatusCount: number;
  missedCallsCount: number;
  lockedCount: number;
  archivedCount: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenAI: () => void;
  onOpenProfile: () => void;
  myProfile: { name: string; avatar: string };
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeTab,
  setActiveTab,
  unreadChatsCount,
  unviewedStatusCount,
  missedCallsCount,
  lockedCount,
  archivedCount,
  darkMode,
  onToggleDarkMode,
  onOpenAI,
  onOpenProfile,
  myProfile,
}) => {
  const navBtn = (
    tab: NavTab,
    label: string,
    icon: React.ReactNode,
    badge?: number,
    dot?: boolean
  ) => {
    const active = activeTab === tab;
    return (
      <button
        onClick={() => setActiveTab(tab)}
        title={label}
        aria-label={label}
        className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
          active
            ? 'bg-[#00a884]/15 text-[#00a884] dark:bg-[#00a884]/20 dark:text-[#00a884]'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-[#2a3942]'
        }`}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 bg-[#00a884] text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
            {badge}
          </span>
        )}
        {dot && (
          <span className="absolute top-2 left-2 w-2 h-2 bg-[#00a884] rounded-full" />
        )}
      </button>
    );
  };

  return (
    <aside className="hidden md:flex flex-col items-center justify-between w-[64px] py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-l border-slate-200 dark:border-slate-800 shrink-0 z-20">
      {/* Top primary tabs */}
      <div className="flex flex-col items-center gap-2">
        {navBtn('chats', 'الدردشات', <MessageSquare className="w-5 h-5" />, unreadChatsCount)}
        {navBtn('updates', 'المستجدات والحالات', <CircleDashed className="w-5 h-5" />, undefined, unviewedStatusCount > 0)}
        {navBtn('communities', 'المجتمعات', <Users className="w-5 h-5" />)}
        {navBtn('calls', 'المكالمات', <Phone className="w-5 h-5" />, missedCallsCount)}

        <div className="w-7 h-px bg-slate-300 dark:bg-slate-700 my-1" />

        <button
          onClick={onOpenAI}
          title="Meta AI · المساعد الذكي"
          aria-label="Meta AI"
          className="w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-tr from-[#00a884]/15 to-sky-500/15 hover:from-[#00a884]/25 hover:to-sky-500/25 text-[#00a884] transition-all"
        >
          <Sparkles className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom utility tabs */}
      <div className="flex flex-col items-center gap-2">
        {navBtn('starred', 'الرسائل المميزة بنجمة', <Star className="w-5 h-5" />)}
        {navBtn('locked', 'الدردشات المقفلة', <Lock className="w-5 h-5" />, lockedCount > 0 ? lockedCount : undefined)}
        {navBtn('archive', 'المؤرشفة', <Archive className="w-5 h-5" />, archivedCount > 0 ? archivedCount : undefined)}

        <button
          onClick={onToggleDarkMode}
          title={darkMode ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}
          aria-label="تبديل المظهر"
          className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-[#2a3942] transition-colors"
        >
          {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
        </button>

        {navBtn('settings', 'الإعدادات', <Settings className="w-5 h-5" />)}

        <button
          onClick={onOpenProfile}
          title="الملف الشخصي"
          aria-label="الملف الشخصي"
          className="mt-1 rounded-full hover:ring-2 hover:ring-[#00a884] transition-all"
        >
          <Avatar src={myProfile.avatar} name={myProfile.name} size="sm" />
        </button>
      </div>
    </aside>
  );
};
