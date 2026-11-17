/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Send,
  Trash2,
  X,
  CornerUpLeft,
  Image as ImageIcon,
  Mic,
  FileText,
  BarChart2,
  MapPin,
  Contact as ContactIcon,
} from 'lucide-react';
import { Avatar } from './Avatar';

export interface AppNotification {
  id: string;
  kind: 'message' | 'info' | 'success' | 'warning';
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  conversationId?: string;
  senderAvatar?: string;
  isGroup?: boolean;
  isAI?: boolean;
  messageType?: 'text' | 'image' | 'audio' | 'document' | 'poll' | 'contact' | 'location';
}

interface BannerCardProps {
  item: AppNotification;
  onDismiss: (id: string) => void;
  onOpenChat?: (conversationId: string, notifId: string) => void;
  onQuickReply?: (conversationId: string, text: string, notifId: string) => void;
  reducedMotion: boolean;
}

function getMessageTypeLabel(type?: AppNotification['messageType']) {
  switch (type) {
    case 'image':
      return { icon: <ImageIcon className="w-3.5 h-3.5 text-[#00a884] shrink-0" />, label: 'صورة' };
    case 'audio':
      return { icon: <Mic className="w-3.5 h-3.5 text-[#00a884] shrink-0" />, label: 'رسالة صوتية' };
    case 'document':
      return { icon: <FileText className="w-3.5 h-3.5 text-[#00a884] shrink-0" />, label: 'مستند' };
    case 'poll':
      return { icon: <BarChart2 className="w-3.5 h-3.5 text-[#00a884] shrink-0" />, label: 'استطلاع رأي' };
    case 'location':
      return { icon: <MapPin className="w-3.5 h-3.5 text-[#00a884] shrink-0" />, label: 'موقع جغرافي' };
    case 'contact':
      return { icon: <ContactIcon className="w-3.5 h-3.5 text-[#00a884] shrink-0" />, label: 'جهة اتصال' };
    default:
      return null;
  }
}

function formatRelativeArabic(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 15) return 'الآن';
  if (diffSec < 60) return `منذ ${diffSec} ث`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} د`;
  return new Date(ts).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

const NotificationBannerCard: React.FC<BannerCardProps> = ({
  item,
  onDismiss,
  onOpenChat,
  onQuickReply,
  reducedMotion,
}) => {
  const [paused, setPaused] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');

  const durationMs = item.kind === 'message' ? 6000 : 3200;

  useEffect(() => {
    if (paused || replyOpen) return;
    const timer = window.setTimeout(() => {
      onDismiss(item.id);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [item.id, durationMs, paused, replyOpen, onDismiss]);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || !item.conversationId || !onQuickReply) return;
    onQuickReply(item.conversationId, trimmed, item.id);
    setReplyText('');
    setReplyOpen(false);
  };

  const mediaMeta = item.kind === 'message' ? getMessageTypeLabel(item.messageType) : null;

  return (
    <motion.div
      layout={!reducedMotion}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -36, scale: 0.96 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -28, scale: 0.96 }}
      transition={
        reducedMotion
          ? { duration: 0.12 }
          : { type: 'spring', stiffness: 420, damping: 32, mass: 0.85 }
      }
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      dir="rtl"
      role="status"
      aria-live="polite"
      className="pointer-events-auto relative overflow-hidden rounded-2xl bg-white/95 dark:bg-[#202c33]/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/90 shadow-2xl text-slate-900 dark:text-slate-100"
    >
      <div className="p-3.5 flex items-start gap-3">
        {item.kind === 'message' ? (
          <Avatar
            src={item.senderAvatar}
            name={item.title}
            size="md"
            isAI={item.isAI}
            isGroup={item.isGroup}
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              item.kind === 'warning'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : item.kind === 'success'
                ? 'bg-[#00a884]/15 text-[#00a884]'
                : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
            }`}
          >
            {item.kind === 'warning' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : item.kind === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-xs font-bold truncate text-slate-900 dark:text-white">
                {item.title}
              </p>
              <span className="text-[11px] text-slate-400 shrink-0" aria-hidden="true">
                ·
              </span>
              <span className="text-[11px] text-[#00a884] font-semibold whitespace-nowrap shrink-0">
                {formatRelativeArabic(item.timestamp)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors shrink-0"
              aria-label="إغلاق الإشعار"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            {mediaMeta?.icon}
            <p className="line-clamp-2 leading-relaxed">
              {item.body || mediaMeta?.label || 'رسالة جديدة'}
            </p>
          </div>

          {item.kind === 'message' && item.conversationId && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {onOpenChat && (
                <button
                  type="button"
                  onClick={() => onOpenChat(item.conversationId!, item.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#008f72] text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>فتح المحادثة</span>
                </button>
              )}

              {onQuickReply && (
                <button
                  type="button"
                  onClick={() => setReplyOpen(v => !v)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#2a3942] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <CornerUpLeft className="w-3.5 h-3.5" />
                  <span>{replyOpen ? 'إلغاء الرد' : 'رد سريع'}</span>
                </button>
              )}
            </div>
          )}

          {replyOpen && item.conversationId && onQuickReply && (
            <form onSubmit={handleSendReply} className="mt-2.5 flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="اكتب رداً سريعاً..."
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 focus:border-[#00a884] outline-none text-xs"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="p-2 rounded-xl bg-[#00a884] hover:bg-[#008f72] disabled:opacity-50 text-white transition-colors shrink-0"
                aria-label="إرسال الرد السريع"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Auto-dismiss progress bar using compositor transform */}
      {!paused && !replyOpen && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: durationMs / 1000, ease: 'linear' }}
          style={{ transformOrigin: 'right center' }}
          className="h-[2.5px] w-full bg-[#00a884]/75"
        />
      )}
    </motion.div>
  );
};

interface NotificationCenterProps {
  activeBanners: AppNotification[];
  history: AppNotification[];
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  onDismissBanner: (id: string) => void;
  onDismissHistoryItem: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onOpenChat: (conversationId: string, notifId: string) => void;
  onQuickReply: (conversationId: string, text: string, notifId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  activeBanners,
  history,
  drawerOpen,
  onCloseDrawer,
  onDismissBanner,
  onDismissHistoryItem,
  onMarkAllRead,
  onClearAll,
  onOpenChat,
  onQuickReply,
}) => {
  const reducedMotion = !!useReducedMotion();
  const unreadCount = history.filter(n => !n.read).length;

  return (
    <>
      {/* 1. Floating Animated Top Slide-Down Banners */}
      <div
        dir="rtl"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-1.5rem)] max-w-md pointer-events-none flex flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {activeBanners.map(item => (
            <NotificationBannerCard
              key={item.id}
              item={item}
              onDismiss={onDismissBanner}
              onOpenChat={onOpenChat}
              onQuickReply={onQuickReply}
              reducedMotion={reducedMotion}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* 2. Interactive Top Slide-Down Notification Center Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <div
            dir="rtl"
            className="fixed inset-0 z-[75] flex flex-col items-center pt-3 px-3 bg-slate-950/45 backdrop-blur-[2px]"
            onClick={onCloseDrawer}
          >
            <motion.div
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -32, scale: 0.98 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700/90 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
            >
              <div className="flex items-center justify-between px-5 py-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#00a884]/15 text-[#00a884] flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold">مركز الإشعارات</h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {unreadCount > 0 ? `${unreadCount} غير مقروءة · ${history.length} إجمالي` : `${history.length} إشعار محفوظ`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#00a884] hover:bg-[#00a884]/10 flex items-center gap-1 whitespace-nowrap"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>تحديد كمقروء</span>
                    </button>
                  )}
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearAll}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 flex items-center gap-1 whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>مسح الكل</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onCloseDrawer}
                    className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                    aria-label="إغلاق مركز الإشعارات"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                {history.length === 0 ? (
                  <div className="py-12 px-6 text-center space-y-2">
                    <Bell className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">لا توجد إشعارات حالياً</p>
                    <p className="text-[11px] text-slate-400">
                      ستظهر هنا تنبيهات الرسائل الواردة وتحديثات التطبيق فور وصولها.
                    </p>
                  </div>
                ) : (
                  history.map(item => (
                    <div
                      key={item.id}
                      className={`p-4 flex items-start gap-3 transition-colors ${
                        !item.read ? 'bg-[#00a884]/[0.04]' : 'hover:bg-slate-50 dark:hover:bg-[#202c33]/50'
                      }`}
                    >
                      {item.kind === 'message' ? (
                        <Avatar
                          src={item.senderAvatar}
                          name={item.title}
                          size="sm"
                          isAI={item.isAI}
                          isGroup={item.isGroup}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#00a884]/15 text-[#00a884] flex items-center justify-center shrink-0">
                          <Bell className="w-4 h-4" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-bold truncate">{item.title}</span>
                            <span className="text-[10px] text-slate-400" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 tabular-nums">
                              {formatRelativeArabic(item.timestamp)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onDismissHistoryItem(item.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                            aria-label="حذف الإشعار"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{item.body}</p>

                        {item.kind === 'message' && item.conversationId && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                onOpenChat(item.conversationId!, item.id);
                                onCloseDrawer();
                              }}
                              className="text-[11px] font-bold text-[#00a884] hover:underline flex items-center gap-1"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>الانتقال إلى المحادثة</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
