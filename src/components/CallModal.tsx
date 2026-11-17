/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Video, VideoOff, PhoneOff, UserPlus, ShieldCheck, X, Minimize2, Maximize2, Camera } from 'lucide-react';
import { ChatContact, UserAccount } from '../types';
import { Avatar } from './Avatar';

interface CallModalProps {
  contact: ChatContact;
  type: 'voice' | 'video';
  status: 'ringing' | 'connected';
  duration: number;
  availableUsers?: UserAccount[];
  onInviteParticipant?: (userId: string, userName: string) => void;
  onEndCall: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  contact,
  type,
  status: initialStatus,
  duration,
  availableUsers = [],
  onInviteParticipant,
  onEndCall,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(type === 'video');
  const [isMinimized, setIsMinimized] = useState(false);
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected'>(initialStatus);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [invitedNames, setInvitedNames] = useState<string[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Auto-connect simulation for ringing state after 2.5s if AI or demo peer
  useEffect(() => {
    if (callStatus === 'ringing') {
      const timer = setTimeout(() => {
        setCallStatus('connected');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [callStatus]);

  // Capture mic audio and sync mute state
  useEffect(() => {
    let mounted = true;
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: false })
        .then(stream => {
          if (!mounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          audioStreamRef.current = stream;
          stream.getAudioTracks().forEach(t => {
            t.enabled = !isMuted;
          });
        })
        .catch(() => {
          // Audio mic permission denied or unavailable
        });
    }
    return () => {
      mounted = false;
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Capture video when enabled
  useEffect(() => {
    let mounted = true;
    if (isVideoOn && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode }, audio: false })
        .then(stream => {
          if (!mounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          videoStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          // Camera permission unavailable
        });
    } else {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(t => t.stop());
        videoStreamRef.current = null;
      }
    }

    return () => {
      mounted = false;
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(t => t.stop());
        videoStreamRef.current = null;
      }
    };
  }, [isVideoOn, facingMode]);

  const toggleCameraFacing = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const formattedTime = `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`;
  const invitableUsers = availableUsers.filter(u => u.id !== contact.peerUserId);

  if (isMinimized) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#111b21] border border-slate-700 text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 animate-slide-down">
        <div className="relative">
          <Avatar src={contact.avatar} name={contact.name} size="sm" isAI={contact.isAI} />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#111b21] animate-pulse" />
        </div>
        <div className="flex flex-col text-xs">
          <span className="font-bold">{contact.name}</span>
          <span className="text-[10px] text-emerald-400 tabular-nums">
            {callStatus === 'ringing' ? 'جاري الاتصال...' : formattedTime}
          </span>
        </div>
        <div className="flex items-center gap-1.5 ms-3">
          <button
            onClick={() => setIsMinimized(false)}
            title="تكبير"
            className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onEndCall}
            title="إنهاء المكالمة"
            className="p-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111b21] rounded-3xl p-8 shadow-2xl flex flex-col items-center text-white border border-slate-800 relative overflow-hidden">
        
        {/* Top bar controls: Minimize & Encryption */}
        <div className="w-full flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
            <span>مشفرة تماماً بين الطرفين</span>
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            title="تصغير المكالمة"
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Video / Avatar Area */}
        {isVideoOn ? (
          <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-slate-900 mb-5 border border-slate-700 flex items-center justify-center">
            {/* Remote simulated video or Avatar background */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900/80 to-slate-950">
              <Avatar src={contact.avatar} name={contact.name} size="xl" isAI={contact.isAI} />
              <span className="text-xs text-slate-400 mt-2 font-medium">{contact.name} (الفيديو البعيد)</span>
            </div>

            {/* Local Camera feed picture-in-picture */}
            <div className="absolute bottom-3 left-3 w-24 h-32 rounded-xl overflow-hidden border-2 border-[#00a884] bg-slate-800 shadow-lg">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover mirror"
              />
              <button
                onClick={toggleCameraFacing}
                title="تبديل الكاميرا"
                className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black/80"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>

            {isMuted && (
              <span className="absolute top-3 right-3 bg-rose-600/90 text-white text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                <MicOff className="w-3 h-3" /> الميكروفون مكتوم
              </span>
            )}
          </div>
        ) : (
          <div className="relative mb-6 py-4">
            <div className="ring-4 ring-[#00a884] rounded-full p-1 bg-slate-900 shadow-xl">
              <Avatar src={contact.avatar} name={contact.name} size="xl" isAI={contact.isAI} />
            </div>
            {callStatus === 'ringing' && (
              <span className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping pointer-events-none" />
            )}
            {/* Audio wave animation when connected */}
            {callStatus === 'connected' && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#00a884]/20 border border-[#00a884]/40 px-3 py-0.5 rounded-full">
                <span className="w-1 h-3 bg-[#00a884] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-5 bg-[#00a884] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-2 bg-[#00a884] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="w-1 h-4 bg-[#00a884] rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
              </div>
            )}
          </div>
        )}

        <h2 className="text-xl font-bold mb-1">{contact.name}</h2>
        <p className="text-xs text-slate-400 mb-4 tabular-nums">
          {callStatus === 'ringing' ? 'جاري الاتصال...' : `متصل • ${formattedTime}`}
          {!isSpeaker && ' · سماعة الأذن'}
        </p>

        {invitedNames.length > 0 && (
          <p className="text-[11px] text-[#00a884] mb-3 text-center bg-emerald-950/40 border border-emerald-800/50 px-3 py-1 rounded-xl">
            تمت دعوة: {invitedNames.join('، ')}
          </p>
        )}

        {showInvitePicker && (
          <div className="w-full mb-4 p-3 rounded-2xl bg-slate-900 border border-slate-700 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">دعوة مشارك للمكالمة</span>
              <button onClick={() => setShowInvitePicker(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            {invitableUsers.length === 0 ? (
              <p className="text-[11px] text-slate-400">لا يوجد مستخدمون آخرون متاحون للدعوة حالياً</p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {invitableUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      onInviteParticipant?.(u.id, u.name);
                      setInvitedNames(prev => (prev.includes(u.name) ? prev : [...prev, u.name]));
                      setShowInvitePicker(false);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800 text-right transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar src={u.avatar} name={u.name} size="sm" />
                      <span className="font-semibold">{u.name}</span>
                    </div>
                    <span className="text-[#00a884] font-bold">دعوة</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Controls Bar */}
        <div className="flex items-center justify-center gap-3.5 mt-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
            className={`p-3.5 rounded-full transition-colors ${
              isMuted ? 'bg-white text-slate-900' : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            title={isVideoOn ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}
            className={`p-3.5 rounded-full transition-colors ${
              isVideoOn ? 'bg-[#00a884] text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setIsSpeaker(!isSpeaker)}
            title={isSpeaker ? 'إيقاف مكبر الصوت' : 'تشغيل مكبر الصوت'}
            className={`p-3.5 rounded-full transition-colors ${
              isSpeaker ? 'bg-slate-700 text-[#00a884]' : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setShowInvitePicker(!showInvitePicker)}
            title="إضافة مشارك"
            className={`p-3.5 rounded-full transition-colors ${
              showInvitePicker ? 'bg-[#00a884] text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            <UserPlus className="w-5 h-5" />
          </button>

          <button
            onClick={onEndCall}
            title="إنهاء المكالمة"
            className="p-4 bg-rose-600 hover:bg-rose-700 rounded-full transition-transform hover:scale-105 shadow-lg text-white"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
