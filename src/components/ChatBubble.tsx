/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Check, CheckCheck, Play, Pause, Star, Reply, Trash2, Copy, Edit3,
  Forward, FileText, Download, MapPin, Eye, Lock, CornerUpRight, Ban, CheckCircle2, Clock, ChevronDown, ExternalLink, Globe
} from 'lucide-react';
import { Message } from '../types';
import { Avatar } from './Avatar';
import { splitTextWithUrls } from '../utils/linkPreview';

interface ChatBubbleProps {
  message: Message;
  groupedImages?: string[];
  isGroup?: boolean;
  readReceipts: boolean;
  highlightQuery?: string;
  isActiveSearchMatch?: boolean;
  onReply: (msg: Message) => void;
  onToggleStar: (msgId: string) => void;
  onEdit: (msg: Message) => void;
  onForward: (msg: Message) => void;
  onDeleteRequest: (msg: Message) => void;
  onReact: (msgId: string, emoji: string) => void;
  onVotePoll: (msgId: string, optionIndex: number) => void;
  onOpenViewOnce: (msg: Message) => void;
  onOpenImage: (url: string, albumUrls?: string[], index?: number) => void;
  onStartChatWithCard: (card: { name: string; phone: string; avatar: string }) => void;
  onSendNow?: (msgId: string) => void;
  onCancelSchedule?: (msgId: string) => void;
  onCopyText?: () => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  groupedImages,
  isGroup,
  readReceipts,
  highlightQuery,
  isActiveSearchMatch,
  onReply,
  onToggleStar,
  onEdit,
  onForward,
  onDeleteRequest,
  onReact,
  onVotePoll,
  onOpenViewOnce,
  onOpenImage,
  onStartChatWithCard,
  onSendNow,
  onCancelSchedule,
  onCopyText,
}) => {
  const isMe = message.sender === 'me';
  const isScheduled = message.status === 'scheduled';
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [previewImgError, setPreviewImgError] = useState(false);
  const [previewFaviconError, setPreviewFaviconError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const simTimerRef = useRef<any>(null);

  useEffect(() => {
    setPreviewImgError(false);
    setPreviewFaviconError(false);
  }, [message.linkPreview?.image, message.linkPreview?.favicon]);

  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const togglePlayAudio = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.pause();
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      return;
    }

    setIsPlaying(true);
    if (message.audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(message.audioUrl);
        audioRef.current.onended = () => {
          setIsPlaying(false);
          setAudioProgress(0);
        };
        audioRef.current.ontimeupdate = () => {
          if (audioRef.current && audioRef.current.duration) {
            setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
          }
        };
      }
      audioRef.current.play().catch(() => {});
    } else {
      const total = Math.max((message.audioDuration || 4) * 10, 20);
      let step = Math.round((audioProgress / 100) * total);
      simTimerRef.current = setInterval(() => {
        step += 1;
        const pct = Math.min((step / total) * 100, 100);
        setAudioProgress(pct);
        if (pct >= 100) {
          clearInterval(simTimerRef.current);
          setIsPlaying(false);
          setAudioProgress(0);
        }
      }, 100);
    }
  };

  const handleCopy = () => {
    if (message.text) {
      navigator.clipboard?.writeText(message.text);
      setCopied(true);
      onCopyText?.();
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const renderHighlightChunk = (chunk: string, keyPrefix: string) => {
    if (!highlightQuery || !highlightQuery.trim()) return chunk;
    const regex = new RegExp(`(${highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = chunk.split(regex);
    return parts.map((part, idx) =>
      regex.test(part) ? (
        <mark key={`${keyPrefix}-${idx}`} className="bg-amber-300 dark:bg-amber-500/60 text-slate-900 dark:text-white rounded px-0.5">
          {part}
        </mark>
      ) : (
        <React.Fragment key={`${keyPrefix}-${idx}`}>{part}</React.Fragment>
      )
    );
  };

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    const segments = splitTextWithUrls(text);
    return segments.map((seg, idx) => {
      if (seg.type === 'url' && seg.href) {
        return (
          <a
            key={`seg-${idx}`}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="inline-block underline decoration-1 underline-offset-2 text-sky-700 dark:text-sky-300 hover:text-sky-800 dark:hover:text-sky-200 break-all font-medium"
          >
            {renderHighlightChunk(seg.value, `url-${idx}`)}
          </a>
        );
      }
      return <React.Fragment key={`seg-${idx}`}>{renderHighlightChunk(seg.value, `txt-${idx}`)}</React.Fragment>;
    });
  };

  // Total votes for poll
  const totalPollVotes = message.pollData
    ? message.pollData.options.reduce((sum, o) => sum + o.votes, 0)
    : 0;

  if (message.isDeleted) {
    return (
      <div className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
        <div className="px-3.5 py-2 rounded-xl text-xs italic text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-[#202c33]/70 flex items-center gap-2 shadow-sm">
          <Ban className="w-3.5 h-3.5" />
          <span>{isMe ? 'لقد حذفت هذه الرسالة' : 'تم حذف هذه الرسالة'}</span>
          <span className="text-[10px] opacity-70">{message.timestamp}</span>
        </div>
      </div>
    );
  }

  return (
    <div id={`msg-bubble-${message.id}`} className={`flex ${isMe ? 'justify-start' : 'justify-end'} group relative mb-1`}>
      <div
        className={`relative max-w-[82%] sm:max-w-[70%] lg:max-w-[56%] px-3.5 py-2 rounded-2xl text-[13px] shadow-sm transition-colors ${
          isMe
            ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 rounded-tr-sm'
            : 'bg-white dark:bg-[#202c33] text-slate-900 dark:text-slate-100 rounded-tl-sm'
        } ${isScheduled ? 'border border-dashed border-[#00a884]/70 opacity-95' : ''} ${
          isActiveSearchMatch ? 'ring-2 ring-amber-400' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => setShowActions(prev => !prev)}
          className={`absolute top-1.5 left-1.5 p-1 rounded-full transition-opacity ${
            showActions
              ? 'opacity-100 bg-black/10 dark:bg-white/10'
              : 'opacity-60 md:opacity-0 md:group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10'
          } text-slate-500 dark:text-slate-300`}
          title="خيارات الرسالة"
          aria-label="خيارات الرسالة"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {/* Scheduled indicator banner */}
        {isScheduled && message.scheduledAt && (
          <div className="flex items-center justify-between gap-2 mb-1.5 px-2 py-1 rounded-lg bg-black/5 dark:bg-black/25 text-[10px] font-bold text-[#008f72] dark:text-emerald-300">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              مجدولة: {new Date(message.scheduledAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          </div>
        )}
        {/* Group sender name */}
        {isGroup && !isMe && message.senderName && (
          <div className="text-[11px] font-bold text-[#00a884] mb-0.5">{message.senderName}</div>
        )}

        {/* Forwarded indicator */}
        {message.isForwarded && (
          <div className="flex items-center gap-1 text-[11px] italic text-slate-500 dark:text-slate-400 mb-1">
            <CornerUpRight className="w-3 h-3" />
            <span>تمت إعادة التوجيه</span>
          </div>
        )}

        {/* Reply quote */}
        {message.replyTo && (
          <div className="mb-1.5 p-2 bg-black/5 dark:bg-black/20 rounded-lg border-r-4 border-[#00a884] text-xs">
            <span className="block font-bold text-[11px] text-[#00a884] mb-0.5">{message.replyTo.senderName}</span>
            <span className="text-slate-600 dark:text-slate-300 line-clamp-2">{message.replyTo.text}</span>
          </div>
        )}

        {/* Message body by type */}
        {message.type === 'audio' ? (
          <div className="flex items-center gap-3 py-1 min-w-[215px]">
            <button
              onClick={togglePlayAudio}
              className="w-9 h-9 bg-[#00a884] hover:bg-[#008f72] text-white rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95"
              aria-label={isPlaying ? 'إيقاف' : 'تشغيل'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white mr-0.5" />}
            </button>
            <div className="flex-1 space-y-1">
              {/* Waveform bars */}
              <div className="flex items-center gap-0.5 h-5">
                {[35, 65, 90, 45, 80, 100, 55, 70, 40, 85, 60, 95, 50, 75, 45, 65, 80, 40].map((h, idx, arr) => {
                  const active = (idx / arr.length) * 100 <= audioProgress;
                  return (
                    <div
                      key={idx}
                      style={{ height: `${h}%` }}
                      className={`flex-1 rounded-full transition-colors ${
                        active ? 'bg-[#00a884]' : 'bg-slate-400/40 dark:bg-slate-500/50'
                      }`}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-300/80 tabular-nums">
                <span>0:{String(message.audioDuration || 4).padStart(2, '0')}</span>
                <span>رسالة صوتية</span>
              </div>
            </div>
          </div>
        ) : message.isViewOnce ? (
          <button
            onClick={() => !message.isViewedOnce && onOpenViewOnce(message)}
            disabled={message.isViewedOnce}
            className={`flex items-center gap-2.5 py-1.5 px-2 rounded-xl border ${
              message.isViewedOnce
                ? 'border-slate-300/50 dark:border-slate-700/60 text-slate-400 cursor-default'
                : 'border-[#00a884]/40 bg-[#00a884]/10 text-[#00a884] hover:bg-[#00a884]/15 cursor-pointer'
            }`}
          >
            <span className="w-6 h-6 rounded-full border-2 border-dashed border-current flex items-center justify-center text-[11px] font-bold">
              1
            </span>
            <span className="font-semibold text-xs">
              {message.isViewedOnce ? 'تم فتح الصورة' : 'صورة للعرض مرة واحدة'}
            </span>
            {!message.isViewedOnce && <Eye className="w-4 h-4" />}
          </button>
        ) : message.type === 'image' && (groupedImages?.length || message.mediaUrls?.length || message.mediaUrl) ? (() => {
          const album: string[] =
            groupedImages && groupedImages.length > 0
              ? groupedImages
              : message.mediaUrls && message.mediaUrls.length > 0
              ? message.mediaUrls
              : message.mediaUrl
              ? [message.mediaUrl]
              : [];

          if (album.length <= 1) {
            const singleUrl = album[0];
            return (
              <div className="space-y-1.5">
                <img
                  src={singleUrl}
                  alt="صورة مرفقة"
                  referrerPolicy="no-referrer"
                  onClick={() => onOpenImage(singleUrl, [singleUrl], 0)}
                  className="rounded-xl max-h-64 w-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                />
                {message.text && <p className="leading-relaxed whitespace-pre-wrap">{renderHighlightedText(message.text)}</p>}
              </div>
            );
          }

          const visibleThumbs = album.slice(0, 4);
          const extraCount = album.length - 4;

          return (
            <div className="space-y-1.5 min-w-[220px] sm:min-w-[260px]">
              <div className="relative grid grid-cols-2 gap-1 rounded-xl overflow-hidden bg-black/10 dark:bg-black/25 p-0.5">
                {visibleThumbs.map((imgUrl, idx) => {
                  const isThreeFirst = album.length === 3 && idx === 0;
                  const showOverflow = idx === 3 && extraCount > 0;
                  return (
                    <button
                      key={`${imgUrl.slice(0, 24)}-${idx}`}
                      type="button"
                      onClick={() => onOpenImage(imgUrl, album, idx)}
                      className={`relative overflow-hidden rounded-lg group/thumb focus:outline-none ${
                        isThreeFirst
                          ? 'col-span-2 h-36 sm:h-40'
                          : album.length === 2
                          ? 'h-36 sm:h-40'
                          : 'h-28 sm:h-32'
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={`صورة ${idx + 1} من ${album.length}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                      />
                      {showOverflow && (
                        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[1px] flex flex-col items-center justify-center text-white">
                          <span className="text-lg font-extrabold tabular-nums">+{extraCount}</span>
                          <span className="text-[10px] font-semibold">عرض الكل</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-300/80 px-0.5">
                <span className="font-semibold">ألبوم صور مجمّع ({album.length})</span>
                <span>انقر للمعاينة والتنقل</span>
              </div>
              {message.text && <p className="leading-relaxed whitespace-pre-wrap">{renderHighlightedText(message.text)}</p>}
            </div>
          );
        })() : message.type === 'document' ? (
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/5 dark:bg-black/20 min-w-[220px]">
            <div className="p-2.5 rounded-lg bg-blue-500/15 text-blue-500 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs truncate">{message.fileName || message.text}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{message.fileSize || 'PDF · 1.2 MB'}</p>
            </div>
            <button
              onClick={() => {
                if (message.mediaUrl) {
                  const a = document.createElement('a');
                  a.href = message.mediaUrl;
                  a.download = message.fileName || 'document';
                  a.click();
                  return;
                }
                const blob = new Blob([`ملف مرفق: ${message.fileName || message.text}`], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = message.fileName || 'document.txt';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
              title="تنزيل المستند"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        ) : message.type === 'location' && message.locationData ? (
          <div className="space-y-2 min-w-[220px]">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                message.locationData.coords.replace(/[^\d.,-]/g, '').replace(/,+/g, ',') || message.locationData.title
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-28 rounded-xl bg-gradient-to-br from-emerald-600/20 via-teal-500/15 to-sky-500/20 border border-emerald-500/30 flex flex-col items-center justify-center relative overflow-hidden hover:opacity-90 transition-opacity"
            >
              <div className="p-2.5 bg-rose-500 text-white rounded-full shadow-lg">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-slate-700 dark:text-slate-200 mt-1.5 font-mono flex items-center gap-1">
                {message.locationData.coords} <ExternalLink className="w-3 h-3" />
              </span>
            </a>
            <div>
              <p className="font-bold text-xs">{message.locationData.title}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{message.locationData.subtitle}</p>
            </div>
          </div>
        ) : message.type === 'contact' && message.contactCard ? (
          <div className="min-w-[220px] space-y-2">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-black/5 dark:bg-black/20">
              <Avatar src={message.contactCard.avatar} name={message.contactCard.name} size="sm" />
              <div className="min-w-0">
                <p className="font-bold text-xs truncate">{message.contactCard.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 dir-ltr">{message.contactCard.phone}</p>
              </div>
            </div>
            <button
              onClick={() => onStartChatWithCard(message.contactCard!)}
              className="w-full py-1.5 text-center text-xs font-bold text-[#00a884] bg-[#00a884]/10 hover:bg-[#00a884]/20 rounded-lg transition-colors"
            >
              مراسلة
            </button>
          </div>
        ) : message.type === 'poll' && message.pollData ? (
          <div className="space-y-2.5 min-w-[240px]">
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">{message.pollData.question}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-300/80 mt-0.5">
                {message.pollData.allowMultiple ? 'يمكن اختيار أكثر من إجابة' : 'اختر إجابة واحدة'} · {totalPollVotes} صوت
              </p>
            </div>
            <div className="space-y-1.5">
              {message.pollData.options.map((opt, i) => {
                const pct = totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
                return (
                  <button
                    key={i}
                    onClick={() => onVotePoll(message.id, i)}
                    className={`w-full text-right p-2 rounded-xl relative overflow-hidden border transition-all ${
                      opt.votedByMe
                        ? 'border-[#00a884] bg-[#00a884]/10'
                        : 'border-slate-300/50 dark:border-slate-600/50 bg-black/5 dark:bg-black/15 hover:bg-black/10'
                    }`}
                  >
                    <div
                      className="absolute inset-y-0 right-0 bg-[#00a884]/20 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 font-medium">
                        {opt.votedByMe && <CheckCircle2 className="w-3.5 h-3.5 text-[#00a884]" />}
                        {opt.text}
                      </span>
                      <span className="font-bold text-[11px] tabular-nums">{opt.votes}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {message.linkPreview && (
              <a
                href={message.linkPreview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl overflow-hidden bg-black/5 dark:bg-black/25 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-black/35 transition-colors min-w-[230px]"
              >
                {message.linkPreview.image && !previewImgError && (
                  <div className="w-full h-36 sm:h-40 bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <img
                      src={message.linkPreview.image}
                      alt={message.linkPreview.title || 'معاينة الرابط'}
                      referrerPolicy="no-referrer"
                      onError={() => setPreviewImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-300/80">
                    <span className="flex items-center gap-1.5 min-w-0 font-semibold">
                      {message.linkPreview.favicon && !previewFaviconError ? (
                        <img
                          src={message.linkPreview.favicon}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={() => setPreviewFaviconError(true)}
                          className="w-3.5 h-3.5 rounded-sm shrink-0 object-contain"
                        />
                      ) : (
                        <Globe className="w-3.5 h-3.5 text-[#00a884] shrink-0" />
                      )}
                      <span className="truncate">{message.linkPreview.siteName || message.linkPreview.domain}</span>
                    </span>
                    <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                  </div>
                  <p className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                    {message.linkPreview.title}
                  </p>
                  {message.linkPreview.description && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300/85 line-clamp-2 leading-relaxed">
                      {message.linkPreview.description}
                    </p>
                  )}
                </div>
              </a>
            )}
            <p className="leading-relaxed whitespace-pre-wrap break-words">{renderHighlightedText(message.text)}</p>
          </div>
        )}

        {/* Scheduled quick actions */}
        {isScheduled && (
          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-black/10 dark:border-white/10 text-[10px] font-bold">
            {onSendNow && (
              <button
                onClick={() => onSendNow(message.id)}
                className="px-2 py-1 rounded-lg bg-[#00a884] text-white hover:bg-[#008f72] transition-colors"
              >
                إرسال الآن
              </button>
            )}
            {onCancelSchedule && (
              <button
                onClick={() => onCancelSchedule(message.id)}
                className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-300 hover:bg-rose-500/25 transition-colors"
              >
                إلغاء الجدولة
              </button>
            )}
          </div>
        )}

        {/* Footer: Detailed visual status indicator showing sent (1 check), delivered (2 checks), and read (2 blue checks + تمت المشاهدة) */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-black/5 dark:border-white/5 text-[10px]">
          <div className="flex items-center gap-1">
            {isScheduled ? (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                مجدولة: {message.scheduledAt ? new Date(message.scheduledAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : message.timestamp}
              </span>
            ) : !isMe ? (
              <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                تم الاستلام
              </span>
            ) : message.status === 'read' && readReceipts ? (
              <span
                className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/35 font-bold flex items-center gap-1"
                title="استلم الطرف الآخر الرسالة وشاهدها"
              >
                <CheckCheck className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
                تمت المشاهدة
              </span>
            ) : message.status === 'delivered' || message.status === 'read' ? (
              <span
                className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1"
                title="تم تسليم الرسالة إلى جهاز الطرف الآخر"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                تم الاستلام
              </span>
            ) : (
              <span
                className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-400/30 font-semibold flex items-center gap-1"
                title="تم الإرسال ولم تُستلم من الطرف الآخر بعد"
              >
                <Check className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                تم الإرسال
              </span>
            )}
          </div>
          <div className={`flex items-center gap-1.5 ${isMe ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
            {message.isEdited && <span className="italic">تم التعديل</span>}
            {message.isStarred && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
            <span className="tabular-nums font-semibold">{message.timestamp}</span>
            {isMe && (
              <span
                className="inline-flex items-center"
                aria-label={
                  isScheduled
                    ? 'رسالة مجدولة'
                    : message.status === 'read' && readReceipts
                    ? 'تمت المشاهدة'
                    : message.status === 'delivered' || message.status === 'read'
                    ? 'تم الاستلام'
                    : 'تم الإرسال'
                }
              >
                {isScheduled ? (
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                ) : message.status === 'read' && readReceipts ? (
                  <CheckCheck className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8] stroke-[2.4]" />
                ) : message.status === 'delivered' || message.status === 'read' ? (
                  <CheckCheck className="w-4 h-4 text-slate-500 dark:text-slate-300 stroke-[2.2]" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 stroke-[2.2]" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Reactions bar if any */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 -mb-3 ${isMe ? 'justify-start' : 'justify-end'}`}>
            {message.reactions.map((r, idx) => (
              <button
                key={idx}
                onClick={() => onReact(message.id, r.emoji)}
                className={`px-1.5 py-0.5 rounded-full text-[11px] shadow-sm border flex items-center gap-1 transition-transform hover:scale-110 ${
                  r.byMe
                    ? 'bg-emerald-50 dark:bg-emerald-950 border-[#00a884] text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-[#2a3942] border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="text-[10px] tabular-nums">{r.count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Quick Toolbar (Hover on desktop OR click chevron on mobile/desktop) */}
        <div
          className={`${
            showActions ? 'flex opacity-100' : 'hidden md:flex opacity-0 group-hover:opacity-100'
          } items-center gap-0.5 absolute -top-9 ${
            isMe ? 'right-0' : 'left-0'
          } bg-white dark:bg-[#233138] border border-slate-200 dark:border-slate-700 rounded-full px-2 py-1 shadow-lg transition-opacity z-20 max-w-[90vw] overflow-x-auto no-scrollbar`}
        >
          {QUICK_REACTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                onReact(message.id, emoji);
                setShowActions(false);
              }}
              className="hover:scale-125 transition-transform px-1 text-sm"
              title={`تفاعل ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
          <button
            onClick={() => {
              onReply(message);
              setShowActions(false);
            }}
            className="p-1 text-slate-500 hover:text-[#00a884]"
            title="رد"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              onForward(message);
              setShowActions(false);
            }}
            className="p-1 text-slate-500 hover:text-[#00a884]"
            title="إعادة توجيه"
          >
            <Forward className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              onToggleStar(message.id);
              setShowActions(false);
            }}
            className="p-1 text-slate-500 hover:text-amber-500"
            title="تمييز بنجمة"
          >
            <Star className={`w-3.5 h-3.5 ${message.isStarred ? 'text-amber-500 fill-amber-500' : ''}`} />
          </button>
          {message.text && (
            <button
              onClick={() => {
                handleCopy();
                setShowActions(false);
              }}
              className="p-1 text-slate-500 hover:text-sky-500"
              title={copied ? 'تم النسخ' : 'نسخ'}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          {isMe && (!message.type || message.type === 'text') && (
            <button
              onClick={() => {
                onEdit(message);
                setShowActions(false);
              }}
              className="p-1 text-slate-500 hover:text-emerald-500"
              title="تعديل"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => {
              onDeleteRequest(message);
              setShowActions(false);
            }}
            className="p-1 text-slate-500 hover:text-rose-500"
            title="حذف"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
