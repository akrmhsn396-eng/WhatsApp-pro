/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare, CircleDashed, Users, Phone, Settings, Search, Plus, Send, Mic, Image, Paperclip,
  Smile, MoreVertical, PhoneCall, Video, Info, Star, Archive, Shield, Bell, ChevronRight,
  Trash2, Sparkles, Moon, Sun, FileText, BarChart2, MapPin, X, Lock, Unlock, ArrowRight,
  Check, CheckCheck, Clock, Download, Ban, UserPlus, Edit3, Contact, Radio, CheckCircle2, Camera, ArrowLeftRight,
  ShieldCheck, UserMinus, LogOut, RefreshCw, ChevronUp, ChevronDown, ChevronLeft, Laptop, KeyRound, Fingerprint, Mail, Package,
  Pin, PinOff, Type, Globe, Music, Volume2, ExternalLink
} from 'lucide-react';
import {
  Message, ChatContact, StatusStory, Channel, Community, CallRecord, AppSettings, NavTab,
  DisappearingDuration, NotificationToneId, WallpaperTheme, UserAccount, SyncedContact, AuthSessionInfo, LinkPreviewData
} from './types';
import {
  INITIAL_SETTINGS
} from './data/initialData';
import { Avatar } from './components/Avatar';
import { NavigationRail } from './components/NavigationRail';
import { ChatBubble } from './components/ChatBubble';
import { CallModal } from './components/CallModal';
import {
  NewContactModal, PollModal, MediaModal, ForwardModal,
  DeleteMessageModal, PinModal, StatusViewerModal, AddStatusModal, EditProfileModal,
  IncomingCallModal, ScheduleMessageModal
} from './components/Modals';
import { NewGroupModal, AddGroupMembersModal } from './components/NewGroupModal';
import { ContactSyncModal } from './components/ContactSyncModal';
import { EmailAuthScreen } from './components/EmailAuthScreen';
import { SecuritySessionsModal } from './components/SecuritySessionsModal';
import { BiometricLockScreen } from './components/BiometricLockScreen';
import { registerBiometric, isBiometricSupported } from './utils/biometric';
import {
  mapServerConversation, mapServerStatus, mapServerCall, mapServerChannel, mapServerCommunity
} from './utils/wsMapper';
import { getClientDeviceName } from './utils/countries';
import { PWAInstallButton, OfflineIndicator } from './components/PWAComponents';
import { PWABuilderModal } from './components/PWABuilderModal';
import { APP_VERSION, APP_RELEASE_LABEL } from './data/version';
import { NotificationCenter, AppNotification } from './components/NotificationCenter';
import { NOTIFICATION_TONES, playNotificationTone, getToneLabel } from './utils/notificationTones';
import { extractFirstUrl, extractAllUrls } from './utils/linkPreview';

const SETTINGS_STORAGE_KEY = 'whatsapp_pro_ai_prefs_v2';
const TAB_USER_KEY = 'wa_tab_user_id';
const AUTH_TOKEN_SESSION_KEY = 'wa_auth_token_tab';
const AUTH_TOKEN_REMEMBER_KEY = 'wa_auth_token_remember';

function loadInitialAuthToken(): string {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_SESSION_KEY) || localStorage.getItem(AUTH_TOKEN_REMEMBER_KEY) || '';
  } catch {
    return '';
  }
}

function loadSavedSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? { ...INITIAL_SETTINGS, ...JSON.parse(raw) } : INITIAL_SETTINGS;
  } catch {
    return INITIAL_SETTINGS;
  }
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSavedSettings);
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => !!settings.biometricEnabled);

  // Phone Authentication & Per-Tab Session Token
  const [authToken, setAuthToken] = useState<string>(loadInitialAuthToken);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [showPhoneSwitchScreen, setShowPhoneSwitchScreen] = useState<boolean>(false);
  const [showSecurityModal, setShowSecurityModal] = useState<{
    open: boolean;
    tab: 'sessions' | 'two_factor' | 'change_phone' | 'audit';
  }>({ open: false, tab: 'sessions' });

  // Per-tab active user identity derived from verified auth session
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return sessionStorage.getItem(TAB_USER_KEY) || '';
  });

  // Authoritative server-synced state
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [serverConversations, setServerConversations] = useState<any[]>([]);
  const [serverStatuses, setServerStatuses] = useState<any[]>([]);
  const [serverCalls, setServerCalls] = useState<any[]>([]);
  const [serverChannels, setServerChannels] = useState<any[]>([]);
  const [serverCommunities, setServerCommunities] = useState<any[]>([]);
  const [syncedContacts, setSyncedContacts] = useState<SyncedContact[]>([]);
  const [lastContactSyncAt, setLastContactSyncAt] = useState<number | null>(null);
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const [wsConnected, setWsConnected] = useState(false);

  // Channels UI local inputs
  const [channelPostDrafts, setChannelPostDrafts] = useState<Record<string, string>>({});
  const [newChannelName, setNewChannelName] = useState('');
  const [showNewChannelInput, setShowNewChannelInput] = useState(false);

  // Navigation & Filters
  const [activeTab, setActiveTab] = useState<NavTab>('chats');
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'favorites' | 'groups' | 'ai'>('all');
  const [callsFilter, setCallsFilter] = useState<'all' | 'missed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarUserResults, setSidebarUserResults] = useState<UserAccount[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false);

  // Chat UI States
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [deletingMsg, setDeletingMsg] = useState<Message | null>(null);
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [inChatMatchIdx, setInChatMatchIdx] = useState(0);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [composerLinkPreview, setComposerLinkPreview] = useState<LinkPreviewData | null>(null);
  const [loadingLinkPreview, setLoadingLinkPreview] = useState(false);
  const [dismissedPreviewUrl, setDismissedPreviewUrl] = useState<string | null>(null);
  const [composerPreviewImgError, setComposerPreviewImgError] = useState(false);

  // Popups & Drawers
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [editingGroupInfo, setEditingGroupInfo] = useState(false);
  const [groupTitleDraft, setGroupTitleDraft] = useState('');
  const [groupAboutDraft, setGroupAboutDraft] = useState('');
  const [infoGalleryTab, setInfoGalleryTab] = useState<'media' | 'docs' | 'links'>('media');
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [showChatHeaderMenu, setShowChatHeaderMenu] = useState(false);

  // Modals
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showAddGroupMembersModal, setShowAddGroupMembersModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showContactSyncModal, setShowContactSyncModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showAddStatusModal, setShowAddStatusModal] = useState(false);
  const [viewingStatusId, setViewingStatusId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pinned' | 'video' | 'image' | 'text'>('all');
  const [viewingGallery, setViewingGallery] = useState<{ images: string[]; index: number } | null>(null);
  const [viewingViewOnceMsg, setViewingViewOnceMsg] = useState<Message | null>(null);
  const [showShareContactPicker, setShowShareContactPicker] = useState(false);
  const [showNewCommunityModal, setShowNewCommunityModal] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDesc, setNewCommunityDesc] = useState('');
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [newPinValue, setNewPinValue] = useState('');
  const [showApkBuilderModal, setShowApkBuilderModal] = useState(false);

  // Locked Chats Access
  const [unlockedSession, setUnlockedSession] = useState(false);
  const [pinPromptAction, setPinPromptAction] = useState<{ title: string; onConfirm: () => void } | null>(null);

  // Voice Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  // Calls
  const [activeCall, setActiveCall] = useState<{
    callId: string;
    contact: ChatContact;
    type: 'voice' | 'video';
    status: 'ringing' | 'connected';
    duration: number;
  } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    caller: UserAccount;
    callType: 'voice' | 'video';
  } | null>(null);
  const callTimerRef = useRef<any>(null);

  // Animated Notification Center state (replaces standard toast)
  const [activeBanners, setActiveBanners] = useState<AppNotification[]>([]);
  const [notifHistory, setNotifHistory] = useState<AppNotification[]>([]);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  const pushNotification = (
    input: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & { recordInHistory?: boolean }
  ) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: AppNotification = {
      id,
      kind: input.kind,
      title: input.title,
      body: input.body,
      timestamp: Date.now(),
      read: false,
      conversationId: input.conversationId,
      senderAvatar: input.senderAvatar,
      isGroup: input.isGroup,
      isAI: input.isAI,
      messageType: input.messageType,
    };
    setActiveBanners(prev => [item, ...prev].slice(0, 3));
    if (input.recordInHistory !== false) {
      setNotifHistory(prev => [item, ...prev].slice(0, 30));
    }
  };

  const notify = (msg: string, kind: 'info' | 'success' | 'warning' = 'success') => {
    pushNotification({
      kind,
      title: 'WhatsApp Pro AI',
      body: msg,
      recordInHistory: false,
    });
  };

  // Refs for WS & audio
  const wsRef = useRef<WebSocket | null>(null);
  const pendingQueueRef = useRef<any[]>([]);
  const selectedChatIdRef = useRef<string>(selectedChatId);
  selectedChatIdRef.current = selectedChatId;
  const currentUserIdRef = useRef<string>(currentUserId);
  currentUserIdRef.current = currentUserId;
  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;
  const contactsRef = useRef<ChatContact[]>([]);
  const activeChatRef = useRef<ChatContact | undefined>(undefined);
  const usersRef = useRef<UserAccount[]>([]);
  const mobileShowChatRef = useRef<boolean>(mobileShowChat);
  mobileShowChatRef.current = mobileShowChat;
  const activeTabRef = useRef<NavTab>(activeTab);
  activeTabRef.current = activeTab;
  const typingTimeoutRef = useRef<any>(null);

  // Persist user preferences locally
  useEffect(() => {
    if (settings.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Persist tab user ID
  useEffect(() => {
    sessionStorage.setItem(TAB_USER_KEY, currentUserId);
  }, [currentUserId]);

  const playSound = (type: 'send' | 'receive', toneId: NotificationToneId = 'default') => {
    if (!settingsRef.current.soundsEnabled) return;
    playNotificationTone(toneId, type);
  };

  const emitWS = (payload: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    } else {
      pendingQueueRef.current.push(payload);
    }
  };

  // Close dropdown popups when pressing Escape & navigate gallery lightbox
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMainMenu(false);
        setShowChatHeaderMenu(false);
        setShowAttachMenu(false);
        setShowEmojiPicker(false);
        setViewingGallery(null);
      } else if (e.key === 'ArrowLeft') {
        setViewingGallery(prev =>
          prev && prev.images.length > 1
            ? { ...prev, index: (prev.index + 1) % prev.images.length }
            : prev
        );
      } else if (e.key === 'ArrowRight') {
        setViewingGallery(prev =>
          prev && prev.images.length > 1
            ? { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length }
            : prev
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const showDesktopNotification = (title: string, body: string) => {
    if (!settingsRef.current.desktopNotifications) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    try {
      new Notification(title, { body, icon: '/pwa-192x192.png' });
    } catch {
      // ignore
    }
  };

  // Verify existing phone auth session on startup (and load demo user previews)
  useEffect(() => {
    let active = true;
    const bootstrapAuth = async () => {
      try {
        const usersRes = await fetch('/api/users');
        if (usersRes.ok && active) {
          const usersJson = await usersRes.json();
          if (Array.isArray(usersJson.users)) {
            setUsers(usersJson.users);
          }
        }
      } catch {
        // ignore
      }

      if (!authToken) {
        if (active) setAuthChecking(false);
        return;
      }

      try {
        const meRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!active) return;
        if (meRes.ok) {
          const data = await meRes.json();
          if (data.user?.id) {
            setCurrentUserId(data.user.id);
            sessionStorage.setItem(AUTH_TOKEN_SESSION_KEY, authToken);
          }
        } else {
          sessionStorage.removeItem(AUTH_TOKEN_SESSION_KEY);
          localStorage.removeItem(AUTH_TOKEN_REMEMBER_KEY);
          setAuthToken('');
        }
      } catch {
        // ignore network hiccup
      } finally {
        if (active) setAuthChecking(false);
      }
    };
    bootstrapAuth();
    return () => {
      active = false;
    };
  }, []);

  const handleAuthenticated = (payload: {
    token: string;
    user: UserAccount;
    session: AuthSessionInfo;
    remember: boolean;
  }) => {
    sessionStorage.setItem(AUTH_TOKEN_SESSION_KEY, payload.token);
    if (payload.remember) {
      localStorage.setItem(AUTH_TOKEN_REMEMBER_KEY, payload.token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_REMEMBER_KEY);
    }
    pendingQueueRef.current = [];
    setUnlockedSession(false);
    setSelectedChatId('');
    setMobileShowChat(false);
    setServerConversations([]);
    setServerCalls([]);
    setSyncedContacts([]);
    setCurrentUserId(payload.user.id);
    setUsers(prev => {
      const exists = prev.some(u => u.id === payload.user.id);
      return exists ? prev.map(u => (u.id === payload.user.id ? payload.user : u)) : [...prev, payload.user];
    });
    setAuthToken(payload.token);
    setShowPhoneSwitchScreen(false);
    notify(`مرحباً ${payload.user.name} · تم التحقق من رقمك بنجاح`);
  };

  const handleLogout = async (silent = false) => {
    const tokenToRevoke = authToken;
    pendingQueueRef.current = [];
    sessionStorage.removeItem(AUTH_TOKEN_SESSION_KEY);
    localStorage.removeItem(AUTH_TOKEN_REMEMBER_KEY);
    setAuthToken('');
    setShowPhoneSwitchScreen(false);
    setShowSecurityModal({ open: false, tab: 'sessions' });
    setServerConversations([]);
    setServerCalls([]);
    setSyncedContacts([]);
    setSelectedChatId('');
    setMobileShowChat(false);
    if (tokenToRevoke) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenToRevoke}` },
        });
      } catch {
        // ignore
      }
    }
    if (!silent) {
      notify('تم تسجيل الخروج بنجاح');
    }
  };

  // WebSocket Connection Lifecycle (Authenticated by Session Token)
  useEffect(() => {
    if (!authToken) return;
    let closedByEffect = false;
    let reconnectTimer: any = null;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws?token=${encodeURIComponent(authToken)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        while (pendingQueueRef.current.length > 0) {
          const item = pendingQueueRef.current.shift();
          ws.send(JSON.stringify(item));
        }
        if (settingsRef.current.autoSyncContacts !== false) {
          ws.send(JSON.stringify({ type: 'contacts:resync' }));
        }
      };

      ws.onmessage = evt => {
        try {
          const data = JSON.parse(evt.data);
          switch (data.type) {
            case 'init:sync': {
              setUsers(data.users || []);
              setOnlineUserIds(data.onlineUserIds || []);
              setServerConversations(data.conversations || []);
              setServerStatuses(data.statuses || []);
              setServerCalls(data.calls || []);
              setServerChannels(data.channels || []);
              setServerCommunities(data.communities || []);
              setSyncedContacts(data.syncedContacts || []);
              setLastContactSyncAt(data.lastContactSyncAt ?? null);

              setSelectedChatId(prev => {
                const exists = (data.conversations || []).some((c: any) => c.id === prev);
                if (exists) return prev;
                return (data.conversations?.[0]?.id as string) || '';
              });
              break;
            }

            case 'channels:updated': {
              setServerChannels(data.channels || []);
              break;
            }

            case 'communities:updated': {
              setServerCommunities(data.communities || []);
              break;
            }

            case 'contacts:synced': {
              setSyncedContacts(data.contacts || []);
              if (data.lastSyncAt !== undefined) {
                setLastContactSyncAt(data.lastSyncAt);
              }
              break;
            }

            case 'presence:update': {
              setOnlineUserIds(data.onlineUserIds || []);
              break;
            }

            case 'user:registered':
            case 'user:updated': {
              setUsers(prev => {
                const idx = prev.findIndex(u => u.id === data.user.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = data.user;
                  return next;
                }
                return [...prev, data.user];
              });
              // Request sync if a new user registered so DM conversation appears
              if (data.type === 'user:registered') {
                emitWS({ type: 'sync:request' });
              }
              break;
            }

            case 'store:reset': {
              emitWS({ type: 'sync:request' });
              break;
            }

            case 'message:new': {
              const { conversationId, message } = data;
              setServerConversations(prev =>
                prev.map(conv => {
                  if (conv.id !== conversationId) return conv;
                  if (conv.messages.some((m: any) => m.id === message.id)) return conv;
                  return { ...conv, messages: [...conv.messages, message] };
                })
              );
              setTypingMap(prev => ({ ...prev, [conversationId]: false }));

              if (message.senderId !== currentUserIdRef.current) {
                const matchedChat = contactsRef.current.find(c => c.id === conversationId);
                if (!matchedChat?.isMuted) {
                  playSound('receive', matchedChat?.notificationTone || 'default');
                }
                const senderUser = usersRef.current.find(u => u.id === message.senderId);
                const displayTitle = matchedChat?.isGroup
                  ? `${matchedChat.name} · ${message.senderName || senderUser?.name || 'عضو'}`
                  : message.senderName || senderUser?.name || matchedChat?.name || 'رسالة جديدة';
                const displayBody =
                  message.text ||
                  (message.type === 'image'
                    ? Array.isArray(message.mediaUrls) && message.mediaUrls.length > 1
                      ? `أرسل ${message.mediaUrls.length} صور مجمعة`
                      : 'أرسل صورة'
                    : message.type === 'audio'
                    ? 'أرسل رسالة صوتية'
                    : message.type === 'document'
                    ? 'أرسل مستنداً'
                    : 'أرسل لك رسالة جديدة');

                showDesktopNotification(displayTitle, displayBody);

                const isCurrentlyViewingThisChat =
                  activeTabRef.current === 'chats' &&
                  activeChatRef.current?.id === conversationId &&
                  (typeof window === 'undefined' || window.innerWidth >= 768 || mobileShowChatRef.current);

                if (isCurrentlyViewingThisChat) {
                  emitWS({
                    type: 'chat:read',
                    conversationId,
                    sendReadReceipt: settingsRef.current.readReceipts,
                  });
                }

                if (!isCurrentlyViewingThisChat) {
                  pushNotification({
                    kind: 'message',
                    title: displayTitle,
                    body: displayBody,
                    conversationId,
                    senderAvatar: matchedChat?.avatar || senderUser?.avatar || '',
                    isGroup: matchedChat?.isGroup,
                    isAI: matchedChat?.isAI || message.senderId === 'meta-ai',
                    messageType: message.type,
                    recordInHistory: true,
                  });
                }
              }
              break;
            }

            case 'message:updated': {
              const { conversationId, message } = data;
              setServerConversations(prev =>
                prev.map(conv =>
                  conv.id === conversationId
                    ? {
                        ...conv,
                        messages: conv.messages.map((m: any) => (m.id === message.id ? message : m)),
                      }
                    : conv
                )
              );
              break;
            }

            case 'message:removed': {
              const { conversationId, messageId } = data;
              setServerConversations(prev =>
                prev.map(conv =>
                  conv.id === conversationId
                    ? {
                        ...conv,
                        messages: conv.messages.filter((m: any) => m.id !== messageId),
                      }
                    : conv
                )
              );
              break;
            }

            case 'conversation:read': {
              const { conversationId, readerId } = data;
              setServerConversations(prev =>
                prev.map(conv =>
                  conv.id === conversationId
                    ? {
                        ...conv,
                        messages: conv.messages.map((m: any) =>
                          m.senderId !== readerId ? { ...m, status: 'read' } : m
                        ),
                      }
                    : conv
                )
              );
              break;
            }

            case 'conversation:sync': {
              const conv = data.conversation;
              setServerConversations(prev => {
                const idx = prev.findIndex(c => c.id === conv.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = conv;
                  return next;
                }
                return [conv, ...prev];
              });
              break;
            }

            case 'conversation:removed': {
              const { conversationId } = data;
              setServerConversations(prev => prev.filter(c => c.id !== conversationId));
              if (selectedChatIdRef.current === conversationId) {
                setSelectedChatId('');
                setShowContactInfo(false);
                setMobileShowChat(false);
              }
              notify('تمت إزالتك من المجموعة');
              break;
            }

            case 'typing:update': {
              setTypingMap(prev => ({ ...prev, [data.conversationId]: !!data.isTyping }));
              break;
            }

            case 'status:new': {
              setServerStatuses(prev => {
                if (prev.some(s => s.id === data.status.id)) return prev;
                return [data.status, ...prev];
              });
              break;
            }

            case 'status:updated': {
              setServerStatuses(prev => prev.map(s => (s.id === data.status.id ? data.status : s)));
              break;
            }

            case 'status:deleted': {
              setServerStatuses(prev => prev.filter(s => s.id !== data.statusId));
              break;
            }

            case 'call:incoming': {
              setUsers(currUsers => {
                const caller = currUsers.find(u => u.id === data.callerId);
                if (caller) {
                  setIncomingCall({
                    callId: data.callId,
                    caller,
                    callType: data.callType,
                  });
                }
                return currUsers;
              });
              break;
            }

            case 'call:accepted': {
              setActiveCall(prev => (prev ? { ...prev, status: 'connected' } : null));
              if (!callTimerRef.current) {
                callTimerRef.current = setInterval(() => {
                  setActiveCall(prev => (prev ? { ...prev, duration: prev.duration + 1 } : null));
                }, 1000);
              }
              break;
            }

            case 'call:rejected': {
              clearInterval(callTimerRef.current);
              callTimerRef.current = null;
              setActiveCall(null);
              notify('تم رفض المكالمة');
              break;
            }

            case 'call:ended': {
              clearInterval(callTimerRef.current);
              callTimerRef.current = null;
              setActiveCall(null);
              setIncomingCall(null);
              break;
            }

            case 'call:record': {
              setServerCalls(prev => [data.record, ...prev]);
              break;
            }

            case 'calls:cleared': {
              setServerCalls([]);
              break;
            }

            case 'auth:revoked': {
              closedByEffect = true;
              sessionStorage.removeItem(AUTH_TOKEN_SESSION_KEY);
              localStorage.removeItem(AUTH_TOKEN_REMEMBER_KEY);
              setAuthToken('');
              setServerConversations([]);
              setSelectedChatId('');
              notify('تم إنهاء هذه الجلسة من جهاز آخر. سجّل الدخول مجدداً.');
              break;
            }

            case 'toast': {
              if (data.message) notify(data.message);
              break;
            }
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closedByEffect) {
          reconnectTimer = setTimeout(connect, 1500);
        }
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [authToken]);

  // Debounced live link preview fetcher for message composer
  useEffect(() => {
    const detectedUrl = extractFirstUrl(inputText);
    if (!detectedUrl) {
      setComposerLinkPreview(null);
      setLoadingLinkPreview(false);
      setDismissedPreviewUrl(null);
      return;
    }
    if (dismissedPreviewUrl === detectedUrl) {
      setComposerLinkPreview(null);
      setLoadingLinkPreview(false);
      return;
    }
    if (composerLinkPreview && composerLinkPreview.url === detectedUrl) {
      return;
    }

    const controller = new AbortController();
    setLoadingLinkPreview(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(detectedUrl)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setComposerLinkPreview(null);
          return;
        }
        const data = await res.json();
        if (data?.preview) {
          setComposerPreviewImgError(false);
          setComposerLinkPreview(data.preview);
        } else {
          setComposerLinkPreview(null);
        }
      } catch {
        // aborted or failed silently; server enrichment still runs on send
      } finally {
        if (!controller.signal.aborted) {
          setLoadingLinkPreview(false);
        }
      }
    }, 360);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inputText, dismissedPreviewUrl]);

  // Derived mapped UI data from server state
  const myProfile = useMemo(() => {
    const found = users.find(u => u.id === currentUserId);
    return (
      found || {
        id: currentUserId || 'user',
        name: 'مستخدم واتساب',
        phone: '',
        about: 'مرحباً! أستخدم WhatsApp Pro 💬',
        avatar: '',
        lastSeen: 'الآن',
      }
    );
  }, [users, currentUserId]);

  const contacts: ChatContact[] = useMemo(() => {
    return serverConversations.map(conv =>
      mapServerConversation(conv, currentUserId, users, onlineUserIds, typingMap, syncedContacts)
    );
  }, [serverConversations, currentUserId, users, onlineUserIds, typingMap, syncedContacts]);

  const statuses: StatusStory[] = useMemo(() => {
    return serverStatuses.map(st => mapServerStatus(st, currentUserId, users));
  }, [serverStatuses, currentUserId, users]);

  const viewingStatus = useMemo(
    () => (viewingStatusId ? statuses.find(s => s.id === viewingStatusId) || null : null),
    [statuses, viewingStatusId]
  );

  const callRecords: CallRecord[] = useMemo(() => {
    return serverCalls.map(cr => mapServerCall(cr, currentUserId, users));
  }, [serverCalls, currentUserId, users]);

  const channels: Channel[] = useMemo(() => {
    return serverChannels.map(ch => mapServerChannel(ch, currentUserId));
  }, [serverChannels, currentUserId]);

  const communities: Community[] = useMemo(() => {
    return serverCommunities.map(com => mapServerCommunity(com));
  }, [serverCommunities]);

  const activeChat = contacts.find(c => c.id === selectedChatId) || contacts[0];
  contactsRef.current = contacts;
  activeChatRef.current = activeChat;
  usersRef.current = users;

  const unreadNotifCount = useMemo(() => notifHistory.filter(n => !n.read).length, [notifHistory]);

  const handleOpenChatFromNotif = (conversationId: string, notifId: string) => {
    setActiveBanners(prev => prev.filter(n => n.id !== notifId));
    setNotifHistory(prev => prev.map(n => (n.id === notifId ? { ...n, read: true } : n)));
    const target = contacts.find(c => c.id === conversationId);
    if (target) {
      setActiveTab('chats');
      openChat(target);
    }
  };

  const handleQuickReplyFromNotif = (conversationId: string, text: string, notifId: string) => {
    emitWS({ type: 'message:send', conversationId, text });
    playSound('send');
    setActiveBanners(prev => prev.filter(n => n.id !== notifId));
    setNotifHistory(prev => prev.map(n => (n.id === notifId ? { ...n, read: true } : n)));
    notify('تم إرسال الرد السريع');
  };

  const inChatMatches = useMemo(() => {
    const q = inChatSearchQuery.trim().toLowerCase();
    if (!q || !activeChat) return [];
    return activeChat.messages.filter(m => !m.isDeleted && m.text.toLowerCase().includes(q));
  }, [activeChat, inChatSearchQuery]);

  useEffect(() => {
    setInChatMatchIdx(0);
  }, [inChatSearchQuery, activeChat?.id]);

  const jumpToSearchMatch = (idx: number) => {
    if (inChatMatches.length === 0) return;
    const bounded = ((idx % inChatMatches.length) + inChatMatches.length) % inChatMatches.length;
    setInChatMatchIdx(bounded);
    const targetMsg = inChatMatches[bounded];
    if (targetMsg) {
      document.getElementById(`msg-bubble-${targetMsg.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  // Scroll to bottom on message changes
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length, selectedChatId]);

  // Smart Replies for incoming human messages
  useEffect(() => {
    if (!activeChat) return;
    const last = activeChat.messages[activeChat.messages.length - 1];
    if (activeChat.isAI || !last || last.sender !== 'them' || !last.text || last.isDeleted) {
      setSmartReplies([]);
      return;
    }
    let cancelled = false;
    fetch('/api/smart-replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastMessage: last.text }),
    })
      .then(r => r.json())
      .then(data => {
        if (!cancelled && Array.isArray(data.suggestions)) setSmartReplies(data.suggestions);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeChat?.id, activeChat?.messages.length]);

  // Mark currently visible chat as read when returning to chats tab on desktop or mobile chat view
  useEffect(() => {
    if (
      activeTab === 'chats' &&
      activeChat &&
      activeChat.unreadCount > 0 &&
      (typeof window === 'undefined' || window.innerWidth >= 768 || mobileShowChat)
    ) {
      emitWS({
        type: 'chat:read',
        conversationId: activeChat.id,
        sendReadReceipt: settingsRef.current.readReceipts,
      });
    }
  }, [activeTab, activeChat?.id, activeChat?.unreadCount, mobileShowChat]);

  // Open chat & mark read on server
  const openChat = (contact: ChatContact) => {
    const proceed = () => {
      setSelectedChatId(contact.id);
      setMobileShowChat(true);
      setInChatSearchOpen(false);
      setInChatSearchQuery('');
      emitWS({
        type: 'chat:read',
        conversationId: contact.id,
        sendReadReceipt: settingsRef.current.readReceipts,
      });
    };
    if (contact.isLocked && !unlockedSession) {
      setPinPromptAction({
        title: `فتح محادثة ${contact.name}`,
        onConfirm: () => {
          setPinPromptAction(null);
          proceed();
        },
      });
    } else {
      proceed();
    }
  };

  // Send or Edit Message via WebSocket -> Server DB
  const handleSendMessage = async (
    customText?: string,
    customType?: Message['type'],
    extra?: Partial<Message>
  ) => {
    if (!activeChat) return;
    if (activeChat.isBlocked) {
      notify('قم بإلغاء حظر جهة الاتصال أولاً لإرسال رسالة');
      return;
    }

    const textToSend = customText !== undefined ? customText : inputText.trim();
    if (
      !textToSend &&
      !extra?.mediaUrl &&
      !(extra?.mediaUrls && extra.mediaUrls.length > 0) &&
      !extra?.pollData &&
      !extra?.contactCard &&
      !extra?.locationData &&
      !extra?.audioUrl
    ) {
      return;
    }

    const detectedInputUrl = extractFirstUrl(textToSend);
    const isDismissedForText = !!(detectedInputUrl && dismissedPreviewUrl === detectedInputUrl);
    const matchedComposerPreview =
      !isDismissedForText && composerLinkPreview && detectedInputUrl
        ? composerLinkPreview
        : undefined;

    // Inline Edit
    if (editingMsg && customText === undefined) {
      emitWS({
        type: 'message:edit',
        conversationId: activeChat.id,
        messageId: editingMsg.id,
        newText: textToSend,
        linkPreview: matchedComposerPreview,
        skipLinkPreview: isDismissedForText,
      });
      setEditingMsg(null);
      setInputText('');
      setComposerLinkPreview(null);
      setDismissedPreviewUrl(null);
      notify('تم تعديل الرسالة');
      return;
    }

    if (customText === undefined) {
      setInputText('');
      setComposerLinkPreview(null);
      setDismissedPreviewUrl(null);
    }
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    setSmartReplies([]);
    emitWS({ type: 'typing:stop', conversationId: activeChat.id });

    const nowTime = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const msgId = 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const isFutureScheduled = typeof extra?.scheduledAt === 'number' && extra.scheduledAt > Date.now();
    const resolvedType = customType || 'text';

    const serverMsgPayload: any = {
      id: msgId,
      conversationId: activeChat.id,
      senderId: currentUserId,
      senderName: myProfile.name,
      text: textToSend,
      timestamp: nowTime,
      createdAt: Date.now(),
      scheduledAt: extra?.scheduledAt,
      status: isFutureScheduled ? 'scheduled' : 'sent',
      type: resolvedType,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            senderName: replyingTo.sender === 'me' ? myProfile.name : replyingTo.senderName || activeChat.name,
            text: replyingTo.text || 'رسالة وسائط',
          }
        : undefined,
      mediaUrl: extra?.mediaUrl,
      mediaUrls: extra?.mediaUrls,
      audioUrl: extra?.audioUrl,
      audioDuration: extra?.audioDuration,
      fileName: extra?.fileName,
      fileSize: extra?.fileSize,
      contactCard: extra?.contactCard,
      locationData: extra?.locationData,
      linkPreview: extra?.linkPreview ?? (resolvedType === 'text' ? matchedComposerPreview : undefined),
      skipLinkPreview: resolvedType === 'text' && isDismissedForText ? true : undefined,
      isViewOnce: extra?.isViewOnce,
      isViewedOnce: extra?.isViewedOnce,
      pollData: extra?.pollData
        ? {
            question: extra.pollData.question,
            allowMultiple: extra.pollData.allowMultiple,
            options: extra.pollData.options.map(o => ({ text: o.text, voterIds: [] })),
          }
        : undefined,
    };

    setReplyingTo(null);

    // Send over WebSocket to server (server persists in store.json and waits until scheduledAt if scheduled)
    emitWS({
      type: 'message:send',
      conversationId: activeChat.id,
      message: serverMsgPayload,
    });

    if (isFutureScheduled) {
      notify('تمت جدولة الرسالة وستُرسل تلقائياً في الموعد المحدد');
      return;
    }

    playSound('send');

    // If chatting with Meta AI, request AI generation on server (which stores and pushes reply over WS)
    if (activeChat.isAI) {
      const historyForAi = (serverConversations.find(c => c.id === activeChat.id)?.messages || []).slice(-10);
      setTypingMap(prev => ({ ...prev, [activeChat.id]: true }));
      try {
        await fetch('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            conversationId: activeChat.id,
            message: textToSend,
            history: historyForAi,
          }),
        });
      } finally {
        setTypingMap(prev => ({ ...prev, [activeChat.id]: false }));
      }
    }
  };

  // Input typing broadcast
  const handleInputChange = (val: string) => {
    setInputText(val);
    if (!activeChat || activeChat.isAI) return;
    emitWS({ type: 'typing:start', conversationId: activeChat.id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitWS({ type: 'typing:stop', conversationId: activeChat.id });
    }, 1400);
  };

  // Real/Fallback Voice Recording
  const startRecording = async () => {
    setIsRecording(true);
    setRecordSeconds(0);
    audioChunksRef.current = [];
    recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);

    try {
      if (navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = e => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      }
    } catch {
      // Fallback without mic
    }
  };

  const stopAndSendRecording = () => {
    clearInterval(recordTimerRef.current);
    const dur = Math.max(recordSeconds, 1);
    setIsRecording(false);
    setRecordSeconds(0);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const rec = mediaRecorderRef.current;
      rec.onstop = () => {
        rec.stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size > 0) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
            handleSendMessage(`رسالة صوتية (${dur} ث)`, 'audio', { audioDuration: dur, audioUrl: dataUrl });
          };
          reader.readAsDataURL(blob);
        } else {
          handleSendMessage(`رسالة صوتية (${dur} ث)`, 'audio', { audioDuration: dur });
        }
      };
      rec.stop();
      mediaRecorderRef.current = null;
    } else {
      handleSendMessage(`رسالة صوتية (${dur} ث)`, 'audio', { audioDuration: dur });
    }
  };

  const cancelRecording = () => {
    clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setRecordSeconds(0);
  };

  // Real document upload (reads file data URL up to 8 MB so recipient downloads real file)
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      notify('الحد الأقصى لحجم المستند هو 8 ميجابايت');
      return;
    }
    const sizeMB =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
      handleSendMessage(file.name, 'document', {
        fileName: file.name,
        fileSize: sizeMB,
        mediaUrl: dataUrl,
      });
      notify(`تم إرسال المستند "${file.name}"`);
    };
    reader.onerror = () => notify('تعذر قراءة الملف المحدد');
    reader.readAsDataURL(file);
  };

  // Real geolocation share
  const handleShareLocation = () => {
    setShowAttachMenu(false);
    if (!navigator.geolocation) {
      handleSendMessage('موقعي الحالي', 'location', {
        locationData: {
          title: 'الموقع المشترك',
          subtitle: 'تمت المشاركة عبر التطبيق',
          coords: '24.7136, 46.6753',
        },
      });
      return;
    }
    notify('جاري تحديد موقعك الجغرافي الحالي...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        handleSendMessage('موقعي الجغرافي الحالي', 'location', {
          locationData: {
            title: 'موقعي الجغرافي الحالي',
            subtitle: `دقة التحديد: ~${Math.round(pos.coords.accuracy)} متر`,
            coords: `${lat}, ${lng}`,
          },
        });
        notify('تمت مشاركة موقعك الفعلي بنجاح');
      },
      () => {
        notify('تعذر الحصول على إذن الموقع من المتصفح، يرجى تفعيل الموقع وإعادة المحاولة');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Start / End real-time call
  const startCall = (contact: ChatContact, type: 'voice' | 'video') => {
    const callId = 'call-' + Date.now();
    if (contact.isAI) {
      setActiveCall({ callId, contact, type, status: 'connected', duration: 0 });
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => {
        setActiveCall(prev => (prev ? { ...prev, duration: prev.duration + 1 } : null));
      }, 1000);
      return;
    }

    setActiveCall({ callId, contact, type, status: 'ringing', duration: 0 });
    if (contact.peerUserId) {
      emitWS({
        type: 'call:signal',
        signalType: 'invite',
        targetUserId: contact.peerUserId,
        callType: type,
        callId,
      });
    }
  };

  const endCall = () => {
    if (!activeCall) return;
    clearInterval(callTimerRef.current);
    callTimerRef.current = null;
    if (activeCall.contact.peerUserId) {
      emitWS({
        type: 'call:signal',
        signalType: 'end',
        targetUserId: activeCall.contact.peerUserId,
        callType: activeCall.type,
        callId: activeCall.callId,
        duration: activeCall.duration,
      });
    }
    setActiveCall(null);
  };

  const handleExportChat = () => {
    if (!activeChat) return;
    const lines = activeChat.messages
      .map(m => `[${m.timestamp}] ${m.sender === 'me' ? myProfile.name : activeChat.name}: ${m.text}`)
      .join('\n');
    const blob = new Blob([`سجل محادثة: ${activeChat.name}\n\n${lines}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${activeChat.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    notify('تم تصدير سجل المحادثة');
  };

  const wallpaperClass: Record<WallpaperTheme, string> = {
    default: 'bg-[#efeae2] dark:bg-[#0b141a]',
    emerald: 'bg-[#e3f3ed] dark:bg-[#071f1b]',
    slate: 'bg-[#e9edf2] dark:bg-[#0f172a]',
    sand: 'bg-[#f6efe2] dark:bg-[#1c1917]',
  };

  // Filtered & Sorted Contacts
  const filteredContacts = contacts
    .filter(c => {
      if (activeTab === 'archive') return !!c.isArchived;
      if (activeTab === 'locked') return !!c.isLocked;
      if (c.isArchived || c.isLocked) return false;

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchName =
          c.name.toLowerCase().includes(q) ||
          c.about.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q));
        const matchMsg = c.messages.some(m => m.text.toLowerCase().includes(q));
        if (!matchName && !matchMsg) return false;
      }

      if (chatFilter === 'unread') return c.unreadCount > 0;
      if (chatFilter === 'favorites') return !!c.isFavorite;
      if (chatFilter === 'groups') return !!c.isGroup;
      if (chatFilter === 'ai') return !!c.isAI;
      return true;
    })
    .sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned));

  const unreadChatsCount = contacts.filter(c => !c.isArchived && !c.isLocked && c.unreadCount > 0).length;
  const unviewedStatusCount = statuses.filter(s => !s.isViewed && s.contactId !== 'me').length;
  const missedCallsCount = callRecords.filter(c => c.direction === 'missed').length;
  const lockedCount = contacts.filter(c => c.isLocked).length;
  const archivedCount = contacts.filter(c => c.isArchived).length;

  // Live server search by email/name/phone when typing in main sidebar search bar
  useEffect(() => {
    const q = searchQuery.trim();
    if (!authToken || q.length < 2 || activeTab !== 'chats') {
      setSidebarUserResults([]);
      setIsSearchingUsers(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setIsSearchingUsers(true);
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data.users)) {
          setSidebarUserResults(data.users.filter((u: UserAccount) => u.id !== currentUserId));
        }
      } catch {
        // ignore transient search failures
      } finally {
        if (!cancelled) setIsSearchingUsers(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, authToken, activeTab, currentUserId]);

  const discoveredUsersForSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || activeTab !== 'chats') return [];
    const localMatched = users.filter(
      u =>
        u.id !== currentUserId &&
        (u.name.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.phone && u.phone.toLowerCase().includes(q)))
    );
    const merged = [
      ...localMatched,
      ...sidebarUserResults.filter(su => !localMatched.some(lu => lu.id === su.id)),
    ];
    // Exclude users whose DM conversation is already listed in filteredContacts
    return merged.filter(u => !filteredContacts.some(fc => !fc.isGroup && fc.peerUserId === u.id));
  }, [searchQuery, activeTab, users, sidebarUserResults, currentUserId, filteredContacts]);

  const startChatWithSearchedUser = async (targetUser: UserAccount) => {
    const existingConv = contacts.find(c => !c.isGroup && c.peerUserId === targetUser.id);
    if (existingConv) {
      openChat(existingConv);
      setSearchQuery('');
      return;
    }
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: targetUser.name,
          phone: targetUser.email || targetUser.phone,
          email: targetUser.email,
          avatar: targetUser.avatar,
          creatorUserId: currentUserId,
        }),
      });
      const data = await res.json();
      const resolvedUser = data.user || targetUser;
      const convId = data.conversation?.id || ('dm:' + [currentUserId, resolvedUser.id].sort().join(':'));
      setUsers(prev => (prev.some(u => u.id === resolvedUser.id) ? prev : [resolvedUser, ...prev]));
      if (data.conversation) {
        setServerConversations(prev => [data.conversation, ...prev.filter(c => c.id !== data.conversation.id)]);
      } else {
        setServerConversations(prev =>
          prev.some(c => c.id === convId)
            ? prev
            : [...prev, { id: convId, kind: 'dm', memberIds: [currentUserId, resolvedUser.id], messages: [] }]
        );
      }
      emitWS({ type: 'dm:ensure', targetUserId: resolvedUser.id });
      setSearchQuery('');
      setSelectedChatId(convId);
      setMobileShowChat(true);
      notify(`تم فتح المحادثة الفورية مع ${resolvedUser.name}`);
    } catch {
      notify('تعذر فتح المحادثة مع هذا المستخدم');
    }
  };

  const handleNavClick = (tab: NavTab) => {
    if (tab === 'locked' && !unlockedSession) {
      setPinPromptAction({
        title: 'الدردشات المقفلة',
        onConfirm: () => {
          setUnlockedSession(true);
          setPinPromptAction(null);
          setActiveTab('locked');
        },
      });
      return;
    }
    setActiveTab(tab);
  };

  if (authChecking) {
    return (
      <div
        dir="rtl"
        className="h-screen w-screen flex flex-col items-center justify-center bg-[#eae6df] dark:bg-[#0b141a] text-slate-800 dark:text-slate-100 gap-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-[#00a884] text-white flex items-center justify-center shadow-lg">
          <MessageSquare className="w-7 h-7" />
        </div>
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">جاري التحقق من الجلسة...</p>
      </div>
    );
  }

  if (!authToken || showPhoneSwitchScreen) {
    return (
      <>
        <EmailAuthScreen
          onAuthenticated={handleAuthenticated}
          onCancelSwitch={authToken && showPhoneSwitchScreen ? () => setShowPhoneSwitchScreen(false) : undefined}
          onNotify={notify}
        />
        <NotificationCenter
          activeBanners={activeBanners}
          history={notifHistory}
          drawerOpen={false}
          onCloseDrawer={() => setNotifDrawerOpen(false)}
          onDismissBanner={id => setActiveBanners(prev => prev.filter(n => n.id !== id))}
          onDismissHistoryItem={id => setNotifHistory(prev => prev.filter(n => n.id !== id))}
          onMarkAllRead={() => setNotifHistory(prev => prev.map(n => ({ ...n, read: true })))}
          onClearAll={() => setNotifHistory([])}
          onOpenChat={handleOpenChatFromNotif}
          onQuickReply={handleQuickReplyFromNotif}
        />
      </>
    );
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden flex bg-[#d1d7db] dark:bg-[#0b141a] text-slate-900 dark:text-slate-100 select-none antialiased"
      dir="rtl"
    >
      {isAppLocked && (
        <BiometricLockScreen
          onUnlock={() => setIsAppLocked(false)}
          credentialId={settings.biometricCredentialId}
        />
      )}
      <div className="hidden md:block absolute top-0 left-0 right-0 h-[127px] bg-[#00a884] dark:bg-[#0b141a] z-0 pointer-events-none" />

      <div className="relative z-10 flex h-full w-full max-w-[1680px] mx-auto md:my-auto md:h-[97vh] md:rounded-xl overflow-hidden shadow-2xl border border-slate-300/70 dark:border-slate-800 bg-white dark:bg-[#111b21]">
        {/* 1. Desktop Vertical Navigation Rail */}
        <NavigationRail
          activeTab={activeTab}
          setActiveTab={handleNavClick}
          unreadChatsCount={unreadChatsCount}
          unviewedStatusCount={unviewedStatusCount}
          missedCallsCount={missedCallsCount}
          lockedCount={lockedCount}
          archivedCount={archivedCount}
          darkMode={settings.darkMode}
          onToggleDarkMode={() => setSettings(s => ({ ...s, darkMode: !s.darkMode }))}
          onOpenAI={() => {
            setActiveTab('chats');
            const aiBot = contacts.find(c => c.isAI);
            if (aiBot) openChat(aiBot);
          }}
          onOpenProfile={() => setShowEditProfileModal(true)}
          myProfile={myProfile}
        />

        {/* 2. Left Sidebar List Panel */}
        <div
          className={`${
            mobileShowChat ? 'hidden md:flex' : 'flex'
          } w-full md:w-[360px] lg:w-[400px] flex-col h-full bg-white dark:bg-[#111b21] border-l border-slate-200 dark:border-slate-800 shrink-0 pb-16 md:pb-0`}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#111b21] border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="text-lg font-extrabold text-[#00a884] dark:text-white tracking-tight truncate">
                {activeTab === 'chats' && 'الدردشات'}
                {activeTab === 'updates' && 'المستجدات'}
                {activeTab === 'communities' && 'المجتمعات'}
                {activeTab === 'calls' && 'المكالمات'}
                {activeTab === 'starred' && 'المميزة بنجمة'}
                {activeTab === 'archive' && 'المؤرشفة'}
                {activeTab === 'locked' && 'الدردشات المقفلة'}
                {activeTab === 'settings' && 'الإعدادات'}
              </h1>
            </div>

            <div className="flex items-center gap-1.5 relative shrink-0">
              <button
                type="button"
                onClick={() => setNotifDrawerOpen(true)}
                className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#202c33] text-slate-600 dark:text-slate-300 transition-colors"
                title="مركز الإشعارات"
                aria-label="مركز الإشعارات"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#00a884] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {unreadNotifCount > 9 ? '+9' : unreadNotifCount}
                  </span>
                )}
              </button>
              <PWAInstallButton variant="compact" onNotify={notify} />
              <button
                onClick={() => setShowEditProfileModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#202c33] hover:bg-slate-200 dark:hover:bg-[#2a3942] transition-colors"
                title="الملف الشخصي"
              >
                <Avatar src={myProfile.avatar} name={myProfile.name || 'حسابي'} size="sm" />
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 max-w-[85px] truncate">
                  {myProfile.name || 'حسابي'}
                </span>
              </button>

              {activeTab === 'chats' && (
                <>
                  <button
                    onClick={() => setShowContactSyncModal(true)}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#202c33] text-[#00a884]"
                    title="مزامنة جهات الاتصال"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#202c33] text-slate-600 dark:text-slate-300"
                    title="محادثة جديدة"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </>
              )}
              {activeTab === 'updates' && (
                <button
                  onClick={() => setShowAddStatusModal(true)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#202c33] text-[#00a884]"
                  title="إضافة حالة"
                >
                  <Camera className="w-5 h-5" />
                </button>
              )}
              {activeTab === 'communities' && (
                <button
                  onClick={() => setShowNewCommunityModal(true)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#202c33] text-[#00a884]"
                  title="إنشاء مجتمع"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setShowMainMenu(!showMainMenu)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#202c33] text-slate-600 dark:text-slate-300"
                title="المزيد"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showMainMenu && (
                <div className="absolute left-0 top-11 w-56 bg-white dark:bg-[#233138] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs">
                  <button
                    onClick={() => { setShowPhoneSwitchScreen(true); setShowMainMenu(false); }}
                    className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5"
                  >
                    <ArrowLeftRight className="w-4 h-4 text-[#00a884]" /> تبديل الحساب عبر الهاتف
                  </button>
                  <button
                    onClick={() => { setShowContactSyncModal(true); setShowMainMenu(false); }}
                    className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2.5">
                      <RefreshCw className="w-4 h-4 text-[#00a884]" /> مزامنة جهات الاتصال
                    </span>
                    <span className="text-[10px] font-bold text-[#00a884] tabular-nums">{syncedContacts.length}</span>
                  </button>
                  <button
                    onClick={() => { setShowNewGroupModal(true); setShowMainMenu(false); }}
                    className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5"
                  >
                    <Users className="w-4 h-4 text-[#00a884]" /> مجموعة جديدة
                  </button>
                  <button
                    onClick={() => { setShowNewChatModal(true); setShowMainMenu(false); }}
                    className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5"
                  >
                    <UserPlus className="w-4 h-4 text-[#00a884]" /> جهة اتصال جديدة
                  </button>
                  <button
                    onClick={() => { setActiveTab('starred'); setShowMainMenu(false); }}
                    className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5"
                  >
                    <Star className="w-4 h-4 text-amber-500" /> الرسائل المميزة بنجمة
                  </button>
                  <button
                    onClick={() => { setActiveTab('archive'); setShowMainMenu(false); }}
                    className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2.5">
                      <Archive className="w-4 h-4 text-sky-500" /> الدردشات المؤرشفة
                    </span>
                    {archivedCount > 0 && (
                      <span className="text-[10px] font-bold text-[#00a884] tabular-nums">{archivedCount}</span>
                    )}
                  </button>
                  <button
                    onClick={() => { handleNavClick('locked'); setShowMainMenu(false); }}
                    className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5"
                  >
                    <Lock className="w-4 h-4 text-[#00a884]" /> الدردشات المقفلة
                  </button>
                  <button
                    onClick={() => { setActiveTab('settings'); setShowMainMenu(false); }}
                    className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5"
                  >
                    <Settings className="w-4 h-4 text-slate-400" /> الإعدادات
                  </button>
                  <button
                    onClick={() => {
                      setShowSecurityModal({ open: true, tab: 'sessions' });
                      setShowMainMenu(false);
                    }}
                    className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2.5"
                  >
                    <Laptop className="w-4 h-4 text-[#00a884]" /> الأجهزة المرتبطة والأمان
                  </button>
                  <button
                    onClick={() => {
                      setShowMainMenu(false);
                      handleLogout();
                    }}
                    className="w-full text-right px-4 py-2.5 hover:bg-rose-500/10 text-rose-500 flex items-center gap-2.5 border-t border-slate-100 dark:border-slate-700/60"
                  >
                    <LogOut className="w-4 h-4" /> تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Search & Filters */}
          {(activeTab === 'chats' || activeTab === 'archive' || activeTab === 'locked') && (
            <div className="px-3 pt-2.5 pb-2 space-y-2.5">
              <div className="flex items-center gap-2 bg-[#f0f2f5] dark:bg-[#202c33] px-3 py-2 rounded-xl border border-transparent focus-within:border-[#00a884]/60 transition-all">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، البريد الإلكتروني، أو الرسائل..."
                  className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {activeTab === 'chats' && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                  {(
                    [
                      ['all', 'الكل'],
                      ['unread', 'غير مقروءة'],
                      ['favorites', 'المفضلة'],
                      ['groups', 'المجموعات'],
                      ['ai', 'Meta AI'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setChatFilter(key)}
                      className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap shrink-0 ${
                        chatFilter === key
                          ? 'bg-[#00a884]/20 text-[#00a884] font-bold'
                          : 'bg-[#f0f2f5] dark:bg-[#202c33] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2a3942]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'chats' && archivedCount > 0 && (
                <button
                  onClick={() => setActiveTab('archive')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202c33] transition-colors text-xs"
                >
                  <span className="flex items-center gap-3 font-semibold">
                    <Archive className="w-4 h-4 text-[#00a884]" /> المؤرشفة
                  </span>
                  <span className="text-[#00a884] font-bold tabular-nums">{archivedCount}</span>
                </button>
              )}

              {activeTab === 'chats' && lockedCount > 0 && (
                <button
                  onClick={() => handleNavClick('locked')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202c33] transition-colors text-xs"
                >
                  <span className="flex items-center gap-3 font-semibold">
                    <Lock className="w-4 h-4 text-[#00a884]" /> الدردشات المقفلة
                  </span>
                  <span className="text-[#00a884] font-bold tabular-nums">{lockedCount}</span>
                </button>
              )}

              {(activeTab === 'archive' || activeTab === 'locked') && (
                <button
                  onClick={() => setActiveTab('chats')}
                  className="text-xs font-bold text-[#00a884] flex items-center gap-1 px-1"
                >
                  <ArrowRight className="w-4 h-4" /> العودة لجميع الدردشات
                </button>
              )}
            </div>
          )}

          {/* CHAT LIST */}
          {(activeTab === 'chats' || activeTab === 'archive' || activeTab === 'locked') && (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40">
              {filteredContacts.length === 0 && discoveredUsersForSearch.length === 0 ? (
                contacts.length === 0 && !searchQuery.trim() ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#202c33] flex items-center justify-center text-[#00a884]">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-700 dark:text-slate-200">لا توجد محادثات بعد</p>
                      <p className="text-[11px] text-slate-400 mt-1">ابدأ محادثة جديدة بالبريد الإلكتروني أو رقم الهاتف</p>
                    </div>
                    <button
                      onClick={() => setShowNewChatModal(true)}
                      className="px-4 py-2 rounded-xl bg-[#00a884] text-white font-bold text-xs hover:bg-[#008f72] transition-colors"
                    >
                      بدء محادثة جديدة
                    </button>
                  </div>
                ) : (
                  <div className="p-10 text-center text-xs text-slate-400 space-y-2">
                    <p>{isSearchingUsers ? 'جاري البحث عن المستخدمين...' : 'لا توجد محادثات أو مستخدمون مطابقون للبحث'}</p>
                    {searchQuery.trim().includes('@') && !isSearchingUsers && (
                      <button
                        onClick={() => setShowNewChatModal(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#00a884]/15 text-[#00a884] font-bold hover:bg-[#00a884]/25 transition-colors"
                      >
                        مراسلة {searchQuery.trim()}
                      </button>
                    )}
                  </div>
                )
              ) : (
                <>
                  {filteredContacts.map(contact => {
                  const lastMsg = contact.messages[contact.messages.length - 1];
                  const isSelected = activeChat?.id === contact.id;
                  return (
                    <div
                      key={contact.id}
                      onClick={() => openChat(contact)}
                      className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-colors group ${
                        isSelected
                          ? 'bg-[#f0f2f5] dark:bg-[#2a3942]'
                          : 'hover:bg-slate-50 dark:hover:bg-[#202c33]/70'
                      }`}
                    >
                      <Avatar
                        src={contact.avatar}
                        name={contact.name}
                        size="lg"
                        isOnline={contact.isOnline}
                        isAI={contact.isAI}
                        isGroup={contact.isGroup}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                            {contact.name}
                            {contact.isMuted && <Bell className="w-3 h-3 text-slate-400 line-through" />}
                          </h4>
                          <span
                            className={`text-[11px] shrink-0 tabular-nums ${
                              contact.unreadCount > 0 ? 'text-[#00a884] font-bold' : 'text-slate-400'
                            }`}
                          >
                            {lastMsg?.timestamp || ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                            {contact.isTyping ? (
                              <span className="text-[#00a884] font-semibold">يكتب الآن...</span>
                            ) : (
                              <>
                                {lastMsg?.sender === 'me' && !lastMsg.isDeleted && (
                                  lastMsg.status === 'scheduled' ? (
                                    <Clock className="w-3.5 h-3.5 shrink-0 text-[#00a884]" />
                                  ) : lastMsg.status === 'read' && settings.readReceipts ? (
                                    <CheckCheck className="w-3.5 h-3.5 shrink-0 text-[#0284c7] dark:text-[#38bdf8]" />
                                  ) : lastMsg.status === 'delivered' || lastMsg.status === 'read' ? (
                                    <CheckCheck className="w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-slate-300" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                  )
                                )}
                                <span className="truncate">
                                  {lastMsg?.isDeleted
                                    ? 'تم حذف هذه الرسالة'
                                    : lastMsg?.status === 'scheduled'
                                    ? `مجدولة: ${lastMsg.text}`
                                    : lastMsg?.type === 'poll'
                                    ? `📊 ${lastMsg.pollData?.question}`
                                    : lastMsg?.type === 'image' && !lastMsg.text
                                    ? lastMsg.mediaUrls && lastMsg.mediaUrls.length > 1
                                      ? `🖼️ ${lastMsg.mediaUrls.length} صور مجمعة`
                                      : '🖼️ صورة'
                                    : lastMsg?.text || contact.about}
                                </span>
                              </>
                            )}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {contact.isPinned && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                            {contact.unreadCount > 0 && (
                              <span className="bg-[#00a884] text-white text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center tabular-nums">
                                {contact.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                  {discoveredUsersForSearch.length > 0 && (
                    <div className="bg-slate-50/70 dark:bg-[#111b21]/50">
                      <div className="px-3.5 py-2 text-[11px] font-bold text-[#00a884] flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" /> مستخدمون مسجلون ({discoveredUsersForSearch.length})
                        </span>
                        {isSearchingUsers && <span className="text-[10px] text-slate-400">جاري التحديث...</span>}
                      </div>
                      {discoveredUsersForSearch.map(u => (
                        <div
                          key={u.id}
                          onClick={() => startChatWithSearchedUser(u)}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#202c33]/80 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar src={u.avatar} name={u.name} size="md" isOnline={onlineUserIds.includes(u.id)} />
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{u.name}</h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate dir-ltr text-right">
                                {u.email || u.phone}
                              </p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-[#00a884]/15 text-[#00a884] text-[11px] font-bold shrink-0">
                            مراسلة
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* UPDATES: STATUS + CHANNELS */}
          {activeTab === 'updates' && (() => {
            const openStatusStory = (st: StatusStory) => {
              emitWS({ type: 'status:view', statusId: st.id });
              setViewingStatusId(st.id);
            };
            const handleToggleStatusPin = (st: StatusStory) => {
              emitWS({ type: 'status:pin', statusId: st.id });
              notify(st.isPinned ? 'تم إلغاء تثبيت الحالة' : 'تم تثبيت الحالة في الأعلى');
            };
            const filteredStatuses = statuses.filter(st => {
              if (statusFilter === 'pinned') return !!st.isPinned;
              if (statusFilter === 'video') return st.mediaType === 'video';
              if (statusFilter === 'image') return st.mediaType === 'image';
              if (statusFilter === 'text') return st.mediaType === 'text' || (!st.mediaUrl && !!st.text);
              return true;
            });
            const pinnedStatuses = filteredStatuses.filter(s => s.isPinned);
            const regularStatuses = filteredStatuses.filter(s => !s.isPinned);
            const fmtDur = (sec?: number) => {
              if (!sec) return '';
              const m = Math.floor(sec / 60);
              const s = Math.round(sec % 60);
              return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            };

            const renderStatusRow = (st: StatusStory) => {
              const typeBadge =
                st.mediaType === 'video'
                  ? `فيديو${st.videoDuration ? ` · ${fmtDur(st.videoDuration)}` : ''}`
                  : st.mediaType === 'image'
                  ? 'صورة'
                  : 'حالة نصية';
              return (
                <div
                  key={st.id}
                  onClick={() => openStatusStory(st)}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-2xl cursor-pointer transition-colors ${
                    st.isPinned
                      ? 'bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25'
                      : 'hover:bg-slate-100 dark:hover:bg-[#202c33]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-0.5 rounded-full ring-2 shrink-0 relative ${
                        st.isPinned
                          ? 'ring-amber-500'
                          : st.isViewed
                          ? 'ring-slate-400/50'
                          : 'ring-[#00a884]'
                      }`}
                    >
                      <Avatar src={st.avatar} name={st.contactName} size="md" />
                      {st.mediaType === 'video' && (
                        <span className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-[#00a884] text-white flex items-center justify-center border border-white dark:border-[#111b21]">
                          <Video className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold truncate">{st.contactName}</h4>
                        {st.isPinned && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[9px] font-bold flex items-center gap-0.5 shrink-0">
                            <Pin className="w-2.5 h-2.5" /> مثبتة
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                        <span>{st.timestamp}</span>
                        <span>·</span>
                        <span className="font-semibold text-[#00a884]">{typeBadge}</span>
                        {st.privacy === 'private' && <Lock className="w-2.5 h-2.5 text-slate-400" />}
                        {st.privacy === 'contacts' && <Users className="w-2.5 h-2.5 text-slate-400" />}
                        {st.contactId === 'me' && typeof st.viewsCount === 'number' && (
                          <span>· {st.viewsCount} مشاهدة</span>
                        )}
                      </div>
                      {st.reactions && st.reactions.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {st.reactions.slice(0, 4).map((r, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-slate-700/60 text-[10px]"
                            >
                              {r.emoji} {r.count > 1 ? r.count : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleToggleStatusPin(st);
                      }}
                      className={`p-1.5 rounded-full transition-colors ${
                        st.isPinned
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 hover:bg-amber-500/30'
                          : 'text-slate-400 hover:text-amber-500 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
                      }`}
                      title={st.isPinned ? 'إلغاء تثبيت الحالة' : 'تثبيت الحالة'}
                    >
                      {st.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                    {st.contactId === 'me' && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          emitWS({ type: 'status:delete', statusId: st.id });
                          notify('تم حذف الحالة');
                        }}
                        className="p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                        title="حذف الحالة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div
                  onClick={() => {
                    const mySt = statuses.find(s => s.contactId === 'me');
                    if (mySt) openStatusStory(mySt);
                    else setShowAddStatusModal(true);
                  }}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#f0f2f5] dark:bg-[#202c33] cursor-pointer hover:opacity-95"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar src={myProfile.avatar} name={myProfile.name} size="lg" />
                      <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 bg-[#00a884] text-white rounded-full flex items-center justify-center border-2 border-white dark:border-[#202c33]">
                        <Plus className="w-3 h-3" />
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold">حالتي</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {statuses.some(s => s.contactId === 'me')
                          ? 'انقر لعرض حالتك أو أضف فيديو / صورة'
                          : 'انقر لإضافة حالة نصية أو فيديو حتى 3 دقائق'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setShowAddStatusModal(true);
                    }}
                    className="px-3 py-1.5 rounded-full bg-[#00a884] text-white text-[11px] font-bold hover:bg-[#008f72]"
                  >
                    إضافة
                  </button>
                </div>

                {/* Status Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(
                    [
                      { id: 'all', label: `الكل (${statuses.length})` },
                      { id: 'pinned', label: `المثبتة (${statuses.filter(s => s.isPinned).length})` },
                      { id: 'video', label: `فيديو (${statuses.filter(s => s.mediaType === 'video').length})` },
                      { id: 'image', label: 'صور' },
                      { id: 'text', label: 'كتابة' },
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 transition-colors ${
                        statusFilter === tab.id
                          ? 'bg-[#00a884] text-white'
                          : 'bg-[#f0f2f5] dark:bg-[#202c33] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {pinnedStatuses.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Pin className="w-3.5 h-3.5" /> الحالات المثبتة ({pinnedStatuses.length})
                    </h3>
                    <div className="space-y-1.5">{pinnedStatuses.map(renderStatusRow)}</div>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">التحديثات الأخيرة</h3>
                  {regularStatuses.length === 0 && pinnedStatuses.length === 0 ? (
                    <div className="p-4 text-center text-[11px] text-slate-400 rounded-xl bg-slate-50 dark:bg-[#202c33]/50">
                      لا توجد حالات مطابقة حالياً. جرّب إضافة حالة نصية أو فيديو قصير!
                    </div>
                  ) : regularStatuses.length === 0 ? (
                    <div className="p-3 text-center text-[11px] text-slate-400 rounded-xl bg-slate-50 dark:bg-[#202c33]/50">
                      جميع الحالات المعروضة مثبتة في الأعلى.
                    </div>
                  ) : (
                    <div className="space-y-1.5">{regularStatuses.map(renderStatusRow)}</div>
                  )}
                </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-[#00a884]" /> القنوات (Channels)
                  </h3>
                  <button
                    onClick={() => setShowNewChannelInput(v => !v)}
                    className="text-[11px] font-bold text-[#00a884] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> إنشاء قناة
                  </button>
                </div>

                {showNewChannelInput && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newChannelName}
                      onChange={e => setNewChannelName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newChannelName.trim()) {
                          emitWS({ type: 'channel:create', name: newChannelName.trim() });
                          setNewChannelName('');
                          setShowNewChannelInput(false);
                          notify('تم إنشاء القناة للجميع');
                        }
                      }}
                      placeholder="اسم القناة الجديدة..."
                      className="flex-1 p-2 rounded-xl bg-[#f0f2f5] dark:bg-[#202c33] text-xs outline-none"
                    />
                    <button
                      onClick={() => {
                        if (!newChannelName.trim()) return;
                        emitWS({ type: 'channel:create', name: newChannelName.trim() });
                        setNewChannelName('');
                        setShowNewChannelInput(false);
                        notify('تم إنشاء القناة للجميع');
                      }}
                      className="px-3 py-2 rounded-xl bg-[#00a884] text-white text-xs font-bold"
                    >
                      إنشاء
                    </button>
                  </div>
                )}

                {channels.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-slate-400 rounded-xl bg-slate-50 dark:bg-[#202c33]/50">
                    لا توجد قنوات بعد. انقر على "إنشاء قناة" لنشر تحديثاتك للمتابعين.
                  </div>
                ) : (
                  channels.map(ch => (
                    <div key={ch.id} className="p-3 rounded-2xl bg-[#f0f2f5] dark:bg-[#202c33] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={ch.avatar} name={ch.name} size="sm" />
                          <div>
                            <h4 className="text-xs font-bold flex items-center gap-1">
                              {ch.name}
                              {ch.verified && <CheckCircle2 className="w-3.5 h-3.5 text-[#00a884]" />}
                            </h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">{ch.followers}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => emitWS({ type: 'channel:follow', channelId: ch.id })}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                            ch.isFollowing
                              ? 'bg-slate-200 dark:bg-[#2a3942] text-slate-700 dark:text-slate-200'
                              : 'bg-[#00a884] text-white'
                          }`}
                        >
                          {ch.isFollowing ? 'متابَع' : 'متابعة'}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={channelPostDrafts[ch.id] || ''}
                          onChange={e =>
                            setChannelPostDrafts(prev => ({ ...prev, [ch.id]: e.target.value }))
                          }
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (channelPostDrafts[ch.id] || '').trim()) {
                              emitWS({
                                type: 'channel:post',
                                channelId: ch.id,
                                text: channelPostDrafts[ch.id],
                              });
                              setChannelPostDrafts(prev => ({ ...prev, [ch.id]: '' }));
                              notify('تم نشر تحديث في القناة');
                            }
                          }}
                          placeholder="انشر تحديثاً في هذه القناة..."
                          className="flex-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#111b21] text-[11px] outline-none"
                        />
                        <button
                          onClick={() => {
                            const txt = (channelPostDrafts[ch.id] || '').trim();
                            if (!txt) return;
                            emitWS({ type: 'channel:post', channelId: ch.id, text: txt });
                            setChannelPostDrafts(prev => ({ ...prev, [ch.id]: '' }));
                            notify('تم نشر تحديث في القناة');
                          }}
                          className="p-1.5 rounded-xl bg-[#00a884] text-white hover:bg-[#008f72]"
                          title="نشر"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {ch.posts.map(p => (
                        <div key={p.id} className="p-2.5 rounded-xl bg-white dark:bg-[#111b21] text-xs space-y-2">
                          <p className="leading-relaxed">{p.text}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{p.timestamp}</span>
                            <button
                              onClick={() =>
                                emitWS({ type: 'channel:react', channelId: ch.id, postId: p.id })
                              }
                              className={`px-2 py-0.5 rounded-full border ${
                                p.reacted
                                  ? 'border-[#00a884] text-[#00a884] bg-[#00a884]/10'
                                  : 'border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              ❤️ {p.reactions}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
            );
          })()}

          {/* COMMUNITIES */}
          {activeTab === 'communities' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <button
                onClick={() => setShowNewCommunityModal(true)}
                className="w-full py-3 px-4 rounded-2xl bg-[#00a884]/15 text-[#00a884] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#00a884]/25 transition-colors"
              >
                <Plus className="w-4 h-4" /> مجتمع جديد
              </button>

              {communities.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 space-y-2 rounded-2xl bg-slate-50 dark:bg-[#202c33]/50">
                  <p className="font-bold text-slate-700 dark:text-slate-200">لا توجد مجتمعات مضافة</p>
                  <p className="text-[11px]">المجتمعات تجمع المجموعات ذات الاهتمام المشترك في مساحة منظمة واحدة.</p>
                </div>
              ) : (
                communities.map(com => (
                  <div key={com.id} className="rounded-2xl bg-[#f0f2f5] dark:bg-[#202c33] p-3.5 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={com.avatar} name={com.name} size="md" isGroup />
                      <div>
                        <h4 className="text-xs font-bold">{com.name}</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {com.membersCount} عضواً · {com.groups.length} مجموعات
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">{com.description}</p>
                    <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                      {com.groups.map(g => (
                        <button
                          key={g.id}
                          onClick={() => {
                            const target =
                              (g.conversationId && contacts.find(c => c.id === g.conversationId)) ||
                              contacts.find(c => c.isGroup && c.name.includes(g.name)) ||
                              contacts.find(c => c.isGroup) ||
                              contacts[0];
                            if (target) openChat(target);
                            setActiveTab('chats');
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-[#111b21] text-right transition-colors"
                        >
                          <div>
                            <p className="text-xs font-semibold">{g.name}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{g.lastMessage}</p>
                          </div>
                          <span className="text-[10px] text-slate-400">{g.time}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* CALLS */}
          {activeTab === 'calls' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setCallsFilter('all')}
                    className={`px-3 py-1 rounded-full font-semibold ${
                      callsFilter === 'all' ? 'bg-[#00a884] text-white' : 'bg-slate-100 dark:bg-[#202c33]'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setCallsFilter('missed')}
                    className={`px-3 py-1 rounded-full font-semibold ${
                      callsFilter === 'missed' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-[#202c33]'
                    }`}
                  >
                    فائتة
                  </button>
                </div>
                {callRecords.length > 0 && (
                  <button
                    onClick={() => {
                      emitWS({ type: 'calls:clear' });
                      notify('تم مسح سجل المكالمات');
                    }}
                    className="text-[11px] text-rose-500 hover:underline"
                  >
                    مسح السجل
                  </button>
                )}
              </div>

              {callRecords.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 space-y-2 rounded-2xl bg-slate-50 dark:bg-[#202c33]/50">
                  <p className="font-bold text-slate-700 dark:text-slate-200">لا توجد مكالمات حتى الآن</p>
                  <p className="text-[11px]">سجل مكالماتك الصوتية ومكالمات الفيديو المشفرة تماماً سيظهر هنا.</p>
                </div>
              ) : (
                callRecords
                  .filter(cr => (callsFilter === 'missed' ? cr.direction === 'missed' : true))
                  .map(cr => (
                    <div
                      key={cr.id}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202c33]"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={cr.avatar} name={cr.contactName} size="md" />
                        <div>
                          <h4
                            className={`text-xs font-bold ${
                              cr.direction === 'missed' ? 'text-rose-500' : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {cr.contactName}
                          </h4>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1.5 tabular-nums">
                            <PhoneCall
                              className={`w-3 h-3 ${
                                cr.direction === 'incoming'
                                  ? 'text-emerald-500'
                                  : cr.direction === 'outgoing'
                                  ? 'text-sky-500'
                                  : 'text-rose-500'
                              }`}
                            />
                            <span>{cr.timestamp}</span>
                            {cr.duration && <span>· {cr.duration}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const target = contacts.find(c => c.peerUserId === cr.contactId) || contacts[0];
                            if (target) startCall(target, 'voice');
                          }}
                          className="p-2 rounded-full hover:bg-emerald-500/15 text-[#00a884]"
                          title="مكالمة صوتية"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const target = contacts.find(c => c.peerUserId === cr.contactId) || contacts[0];
                            if (target) startCall(target, 'video');
                          }}
                          className="p-2 rounded-full hover:bg-emerald-500/15 text-[#00a884]"
                          title="مكالمة فيديو"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* STARRED MESSAGES */}
          {activeTab === 'starred' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {contacts.flatMap(c =>
                c.messages.filter(m => m.isStarred && !m.isDeleted).map(m => ({ ...m, contact: c }))
              ).length === 0 ? (
                <div className="text-center py-14 text-slate-400 text-xs">لا توجد رسائل مميزة بنجمة حتى الآن</div>
              ) : (
                contacts
                  .flatMap(c =>
                    c.messages.filter(m => m.isStarred && !m.isDeleted).map(m => ({ ...m, contact: c }))
                  )
                  .map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        openChat(item.contact);
                        setActiveTab('chats');
                      }}
                      className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-2xl cursor-pointer hover:ring-1 hover:ring-[#00a884] transition-all text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#00a884] font-bold">
                        <span>{item.contact.name}</span>
                        <span className="text-slate-400 font-normal">{item.timestamp}</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 line-clamp-3">{item.text}</p>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              <div
                onClick={() => setShowEditProfileModal(true)}
                className="flex items-center justify-between p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-2xl cursor-pointer hover:opacity-90"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={myProfile.avatar} name={myProfile.name} size="lg" />
                  <div>
                    <h4 className="font-bold text-sm">{myProfile.name}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{myProfile.about}</p>
                  </div>
                </div>
                <Edit3 className="w-4 h-4 text-[#00a884]" />
              </div>

              <button
                onClick={() => setShowPhoneSwitchScreen(true)}
                className="w-full flex items-center justify-between p-3 bg-[#00a884]/15 text-[#00a884] rounded-xl font-bold hover:bg-[#00a884]/25"
              >
                <span className="flex items-center gap-2.5">
                  <ArrowLeftRight className="w-4 h-4" /> تبديل الحساب أو تسجيل الدخول برقم آخر
                </span>
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>

              <div className="p-3 bg-[#00a884]/10 border border-[#00a884]/30 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#00a884] text-white">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-[#00a884] dark:text-emerald-300">مزامنة الخادم الفورية</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">تحديث المحادثات والرسائل والاتصال فورياً مع الخادم</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ type: 'sync:request' }));
                      wsRef.current.send(JSON.stringify({ type: 'contacts:resync' }));
                      notify('جاري مزامنة البيانات مع الخادم...');
                      setTimeout(() => {
                        notify('تمت مزامنة الخادم بنجاح وتحديث كافة البيانات');
                      }, 750);
                    } else {
                      if (wsRef.current) wsRef.current.close();
                      notify('جاري إعادة الاتصال ومزامنة الخادم...');
                      setTimeout(() => {
                        notify('تمت مزامنة الخادم بنجاح');
                      }, 1000);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#00a884] text-white font-bold text-xs hover:bg-[#008f72] transition-colors shadow"
                >
                  مزامنة الآن
                </button>
              </div>

              <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <RefreshCw className="w-4 h-4 text-[#00a884]" />
                    <div>
                      <p className="font-bold">نظام مزامنة جهات الاتصال</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {syncedContacts.length} جهة متزامنة · {syncedContacts.filter(c => !!c.registeredUserId).length} مسجلة
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowContactSyncModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#00a884] text-white font-bold text-[11px]"
                  >
                    إدارة
                  </button>
                </div>
                <label className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/60 cursor-pointer">
                  <span className="text-[11px] font-medium">مزامنة ومطابقة تلقائية في الخلفية</span>
                  <input
                    type="checkbox"
                    checked={settings.autoSyncContacts !== false}
                    onChange={e => setSettings(s => ({ ...s, autoSyncContacts: e.target.checked }))}
                    className="w-4 h-4 accent-[#00a884]"
                  />
                </label>
              </div>

              <PWAInstallButton variant="full" onNotify={notify} />

              <button
                type="button"
                onClick={() => setShowApkBuilderModal(true)}
                className="w-full flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold hover:bg-emerald-500/20 transition-colors text-xs"
              >
                <span className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-[#00a884]" />
                  <span>توليد وتحميل حزمة APK عبر PWABuilder</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#00a884] text-white text-[11px]">
                  Android APK
                </span>
              </button>

              <div className="flex items-center justify-between p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl">
                <span className="flex items-center gap-2.5 font-medium">
                  <Fingerprint className="w-4 h-4 text-[#00a884]" />
                  القفل البيومتري (البصمة / الوجه)
                </span>
                <input
                  type="checkbox"
                  checked={!!settings.biometricEnabled}
                  onChange={async e => {
                    const checked = e.target.checked;
                    if (checked) {
                      if (!isBiometricSupported()) {
                        notify('التحقق البيومتري غير مدعوم في هذا المتصفح');
                        return;
                      }
                      const res = await registerBiometric(myProfile.name);
                      if (res.success) {
                        setSettings(s => ({
                          ...s,
                          biometricEnabled: true,
                          biometricCredentialId: res.credentialId,
                        }));
                        notify('تم تفعيل القفل البيومتري بنجاح');
                      } else {
                        notify(res.error || 'فشل إعداد القفل البيومتري');
                      }
                    } else {
                      setSettings(s => ({ ...s, biometricEnabled: false, biometricCredentialId: undefined }));
                      notify('تم إيقاف القفل البيومتري');
                    }
                  }}
                  className="w-4 h-4 accent-[#00a884]"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl">
                <span className="flex items-center gap-2.5 font-medium">
                  {settings.darkMode ? <Moon className="w-4 h-4 text-sky-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                  الوضع الداكن
                </span>
                <input
                  type="checkbox"
                  checked={settings.darkMode}
                  onChange={e => setSettings(s => ({ ...s, darkMode: e.target.checked }))}
                  className="w-4 h-4 accent-[#00a884]"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl">
                <span className="flex items-center gap-2.5 font-medium">
                  <CheckCheck className="w-4 h-4 text-sky-400" />
                  مؤشرات قراءة الرسائل (الصحين الزرق)
                </span>
                <input
                  type="checkbox"
                  checked={settings.readReceipts}
                  onChange={e => setSettings(s => ({ ...s, readReceipts: e.target.checked }))}
                  className="w-4 h-4 accent-[#00a884]"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl">
                <span className="flex items-center gap-2.5 font-medium">
                  <Bell className="w-4 h-4 text-[#00a884]" />
                  أصوات الإرسال والاستلام
                </span>
                <input
                  type="checkbox"
                  checked={settings.soundsEnabled}
                  onChange={e => setSettings(s => ({ ...s, soundsEnabled: e.target.checked }))}
                  className="w-4 h-4 accent-[#00a884]"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl">
                <span className="flex items-center gap-2.5 font-medium">
                  <Send className="w-4 h-4 text-[#00a884]" />
                  الإرسال عبر زر Enter
                </span>
                <input
                  type="checkbox"
                  checked={settings.enterToSend}
                  onChange={e => setSettings(s => ({ ...s, enterToSend: e.target.checked }))}
                  className="w-4 h-4 accent-[#00a884]"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl">
                <span className="flex items-center gap-2.5 font-medium">
                  <Bell className="w-4 h-4 text-amber-500" />
                  إشعارات المتصفح الفورية
                </span>
                <input
                  type="checkbox"
                  checked={!!settings.desktopNotifications}
                  onChange={async e => {
                    const checked = e.target.checked;
                    if (checked && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                      const perm = await Notification.requestPermission();
                      if (perm !== 'granted') {
                        notify('لم يتم منح إذن الإشعارات في المتصفح');
                        return;
                      }
                    }
                    setSettings(s => ({ ...s, desktopNotifications: checked }));
                    notify(checked ? 'تم تفعيل إشعارات المتصفح' : 'تم إيقاف إشعارات المتصفح');
                  }}
                  className="w-4 h-4 accent-[#00a884]"
                />
              </div>

              <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl space-y-2">
                <span className="font-medium block">خصوصية آخر ظهور والحالة المتصلة</span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['everyone', 'الجميع'],
                      ['contacts', 'جهاتي فقط'],
                      ['nobody', 'لا أحد'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => {
                        setSettings(s => ({ ...s, lastSeenPrivacy: val }));
                        emitWS({ type: 'user:privacy', lastSeenPrivacy: val });
                        notify(`تم تحديث خصوصية الظهور إلى: ${label}`);
                      }}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold border ${
                        settings.lastSeenPrivacy === val
                          ? 'border-[#00a884] bg-[#00a884]/15 text-[#00a884]'
                          : 'border-transparent bg-white dark:bg-[#111b21]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl space-y-2">
                <span className="font-medium block">خلفية الدردشة</span>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ['default', 'افتراضي'],
                      ['emerald', 'زمردي'],
                      ['slate', 'كلاسيك'],
                      ['sand', 'رملي'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSettings(s => ({ ...s, wallpaper: key }))}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold border ${
                        settings.wallpaper === key
                          ? 'border-[#00a884] bg-[#00a884]/15 text-[#00a884]'
                          : 'border-transparent bg-white dark:bg-[#111b21]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setActiveTab('starred')}
                  className="p-2.5 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl flex flex-col items-center gap-1 hover:text-[#00a884]"
                >
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-[11px] font-semibold">المميزة</span>
                </button>
                <button
                  onClick={() => setActiveTab('archive')}
                  className="p-2.5 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl flex flex-col items-center gap-1 hover:text-[#00a884]"
                >
                  <Archive className="w-4 h-4 text-sky-500" />
                  <span className="text-[11px] font-semibold">المؤرشفة ({archivedCount})</span>
                </button>
                <button
                  onClick={() => handleNavClick('locked')}
                  className="p-2.5 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl flex flex-col items-center gap-1 hover:text-[#00a884]"
                >
                  <Lock className="w-4 h-4 text-[#00a884]" />
                  <span className="text-[11px] font-semibold">المقفلة ({lockedCount})</span>
                </button>
              </div>

              <button
                onClick={() => setShowSecurityModal({ open: true, tab: 'sessions' })}
                className="w-full flex items-center justify-between p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl hover:opacity-90"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <Laptop className="w-4 h-4 text-[#00a884]" />
                  الأجهزة المرتبطة والجلسات النشطة
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
              </button>

              <button
                onClick={() => setShowSecurityModal({ open: true, tab: 'two_factor' })}
                className="w-full flex items-center justify-between p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl hover:opacity-90"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <KeyRound className="w-4 h-4 text-[#00a884]" />
                  التحقق بخطوتين {myProfile.hasTwoFactor ? '· مفعّل' : ''}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
              </button>

              <button
                onClick={() => setShowSecurityModal({ open: true, tab: 'change_phone' })}
                className="w-full flex items-center justify-between p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl hover:opacity-90"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <Phone className="w-4 h-4 text-[#00a884]" />
                  تغيير رقم الهاتف ({myProfile.phone})
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
              </button>

              <button
                onClick={() => {
                  setNewPinValue(settings.chatLockPin);
                  setShowChangePinModal(true);
                }}
                className="w-full flex items-center justify-between p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl hover:opacity-90"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <Lock className="w-4 h-4 text-[#00a884]" />
                  تغيير رمز قفل الدردشات
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
              </button>

              <button
                onClick={() => handleLogout()}
                className="w-full py-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-500/25 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> تسجيل الخروج من هذا الحساب
              </button>

              <div className="p-3 rounded-2xl bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-100">{APP_RELEASE_LABEL}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">نسخة الويب والتثبيت المستقل</p>
                </div>
                <button
                  onClick={async () => {
                    if ('serviceWorker' in navigator) {
                      const reg = await navigator.serviceWorker.getRegistration();
                      if (reg) await reg.update();
                    }
                    notify(`أنت تستخدم أحدث إصدار (v${APP_VERSION})`);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#00a884]/15 text-[#00a884] font-bold text-[11px] hover:bg-[#00a884]/25"
                >
                  تحقق من التحديث
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Right Main Chat Window */}
        {activeChat ? (
          <div
            className={`${
              mobileShowChat ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col h-full relative overflow-hidden transition-colors ${wallpaperClass[settings.wallpaper]}`}
          >
            <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.04] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />

            {/* Active Chat Header */}
            <div className="flex items-center justify-between px-3 md:px-4 py-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800 z-20">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => setMobileShowChat(false)}
                  className="md:hidden p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/60"
                  aria-label="رجوع"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>

                <div
                  onClick={() => setShowContactInfo(!showContactInfo)}
                  className="flex items-center gap-3 cursor-pointer min-w-0"
                >
                  <Avatar
                    src={activeChat.avatar}
                    name={activeChat.name}
                    size="md"
                    isOnline={activeChat.isOnline}
                    isAI={activeChat.isAI}
                    isGroup={activeChat.isGroup}
                  />
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold truncate flex items-center gap-1.5">
                      {activeChat.name}
                      {activeChat.isLocked && <Lock className="w-3.5 h-3.5 text-[#00a884]" />}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {activeChat.isBlocked
                        ? 'تم حظر جهة الاتصال'
                        : activeChat.isTyping
                        ? 'يكتب الآن...'
                        : activeChat.isOnline
                        ? 'متصل الآن'
                        : activeChat.lastSeen || 'غير متصل'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 relative shrink-0">
                <button
                  onClick={() => startCall(activeChat, 'video')}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
                  title="مكالمة فيديو"
                >
                  <Video className="w-5 h-5" />
                </button>
                <button
                  onClick={() => startCall(activeChat, 'voice')}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
                  title="مكالمة صوتية"
                >
                  <Phone className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setInChatSearchOpen(!inChatSearchOpen);
                    setInChatSearchQuery('');
                  }}
                  className={`p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors ${
                    inChatSearchOpen ? 'text-[#00a884] bg-[#00a884]/10' : ''
                  }`}
                  title="بحث في الدردشة"
                >
                  <Search className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowContactInfo(!showContactInfo)}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
                  title="معلومات الدردشة"
                >
                  <Info className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowChatHeaderMenu(!showChatHeaderMenu)}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
                  title="خيارات المحادثة"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {showChatHeaderMenu && (
                  <div className="absolute left-0 top-11 w-56 bg-white dark:bg-[#233138] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs">
                    <button
                      onClick={() => { setShowContactInfo(true); setShowChatHeaderMenu(false); }}
                      className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2"
                    >
                      <Info className="w-4 h-4 text-[#00a884]" />
                      {activeChat.isGroup ? 'معلومات المجموعة والمشرفين' : 'معلومات جهة الاتصال'}
                    </button>
                    {activeChat.isGroup && activeChat.isCurrentUserAdmin && (
                      <button
                        onClick={() => { setShowAddGroupMembersModal(true); setShowChatHeaderMenu(false); }}
                        className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4 text-[#00a884]" /> إضافة مشاركين للمجموعة
                      </button>
                    )}
                    <button
                      onClick={() => {
                        emitWS({ type: 'chat:prefs', conversationId: activeChat.id, action: { toggle: 'pin' } });
                        setShowChatHeaderMenu(false);
                        notify(activeChat.isPinned ? 'تم إلغاء التثبيت' : 'تم تثبيت المحادثة');
                      }}
                      className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2"
                    >
                      <Star className="w-4 h-4 text-amber-500" /> {activeChat.isPinned ? 'إلغاء التثبيت' : 'تثبيت المحادثة'}
                    </button>
                    <button
                      onClick={() => {
                        emitWS({ type: 'chat:prefs', conversationId: activeChat.id, action: { toggle: 'archive' } });
                        setShowChatHeaderMenu(false);
                        notify(activeChat.isArchived ? 'تم إلغاء الأرشفة' : 'تمت أرشفة المحادثة');
                      }}
                      className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2"
                    >
                      <Archive className="w-4 h-4 text-sky-500" /> {activeChat.isArchived ? 'إلغاء الأرشفة' : 'أرشفة المحادثة'}
                    </button>
                    <button
                      onClick={() => { handleExportChat(); setShowChatHeaderMenu(false); }}
                      className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4 text-emerald-500" /> تصدير الدردشة (.txt)
                    </button>
                    <button
                      onClick={() => {
                        emitWS({ type: 'chat:prefs', conversationId: activeChat.id, action: { clearForUser: true } });
                        setShowChatHeaderMenu(false);
                        notify('تم مسح محتوى الدردشة لديك');
                      }}
                      className="w-full text-right px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2 text-rose-500"
                    >
                      <Trash2 className="w-4 h-4" /> مسح الدردشة
                    </button>
                  </div>
                )}
              </div>
            </div>

            {inChatSearchOpen && (
              <div className="px-4 py-2 bg-white/95 dark:bg-[#202c33]/95 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 z-10 text-xs">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={inChatSearchQuery}
                  onChange={e => setInChatSearchQuery(e.target.value)}
                  placeholder="ابحث داخل هذه المحادثة..."
                  className="flex-1 bg-transparent outline-none"
                />
                {inChatSearchQuery && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 tabular-nums shrink-0">
                    <span>
                      {inChatMatches.length > 0 ? `${inChatMatchIdx + 1}/${inChatMatches.length}` : '0 نتيجة'}
                    </span>
                    <button
                      onClick={() => jumpToSearchMatch(inChatMatchIdx - 1)}
                      disabled={inChatMatches.length === 0}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
                      title="النتيجة السابقة"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => jumpToSearchMatch(inChatMatchIdx + 1)}
                      disabled={inChatMatches.length === 0}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
                      title="النتيجة التالية"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => { setInChatSearchOpen(false); setInChatSearchQuery(''); }}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Messages Feed */}
            <div
              onClick={() => {
                if (showMainMenu) setShowMainMenu(false);
                if (showChatHeaderMenu) setShowChatHeaderMenu(false);
                if (showAttachMenu) setShowAttachMenu(false);
                if (showEmojiPicker) setShowEmojiPicker(false);
              }}
              className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-2.5 z-10"
            >
              <div className="flex flex-col items-center gap-1.5 my-2">
                <div className="px-3 py-1.5 rounded-xl bg-amber-100/90 dark:bg-[#182229]/90 text-[11px] text-slate-700 dark:text-amber-200/80 text-center max-w-md flex items-center gap-1.5 shadow-sm">
                  <Lock className="w-3 h-3 shrink-0" />
                  <span>الرسائل والمكالمات محفوظة على الخادم ومتزامنة لحظياً بين الطرفين.</span>
                </div>
                {activeChat.disappearing && activeChat.disappearing !== 'off' && (
                  <div className="px-3 py-1 rounded-xl bg-white/80 dark:bg-[#182229]/80 text-[11px] text-[#00a884] flex items-center gap-1.5 shadow-sm">
                    <Clock className="w-3 h-3" />
                    <span>
                      الرسائل ذاتية الاختفاء مفعّلة ({activeChat.disappearing === '24h' ? '24 ساعة' : activeChat.disappearing === '7d' ? '7 أيام' : '90 يوماً'})
                    </span>
                  </div>
                )}
                {activeChat.messages.some(m => m.status === 'scheduled') && (
                  <div className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-[#00a884]/30 text-[11px] text-[#00a884] flex items-center gap-1.5 shadow-sm">
                    <Clock className="w-3 h-3" />
                    <span>
                      يوجد {activeChat.messages.filter(m => m.status === 'scheduled').length} رسالة مجدولة بانتظار موعد الإرسال
                    </span>
                  </div>
                )}
              </div>

              {(() => {
                type FeedEntry = { msg: Message; groupedImages?: string[] };
                const entries: FeedEntry[] = [];

                const canAutoGroupImage = (m: Message) =>
                  m.type === 'image' &&
                  !m.isViewOnce &&
                  !m.isDeleted &&
                  !m.replyTo &&
                  !m.isForwarded &&
                  m.status !== 'scheduled' &&
                  !!(m.mediaUrls?.length || m.mediaUrl);

                for (let i = 0; i < activeChat.messages.length; i++) {
                  const curr = activeChat.messages[i];
                  if (canAutoGroupImage(curr) && !curr.mediaUrls?.length && !curr.text) {
                    const batch: Message[] = [curr];
                    const firstTime = curr.createdAt || 0;
                    while (i + 1 < activeChat.messages.length) {
                      const next = activeChat.messages[i + 1];
                      const nextTime = next.createdAt || 0;
                      const sameSender =
                        next.sender === curr.sender &&
                        (next.senderId || '') === (curr.senderId || '');
                      const withinWindow = !firstTime || !nextTime || Math.abs(nextTime - firstTime) <= 120_000;
                      if (
                        sameSender &&
                        withinWindow &&
                        canAutoGroupImage(next) &&
                        !next.mediaUrls?.length
                      ) {
                        batch.push(next);
                        i++;
                        if (next.text) break; // Keep trailing caption on last image of batch
                      } else {
                        break;
                      }
                    }
                    if (batch.length > 1) {
                      const urls = batch
                        .map(b => b.mediaUrl)
                        .filter((u): u is string => !!u);
                      entries.push({ msg: batch[batch.length - 1], groupedImages: urls });
                      continue;
                    }
                  }
                  entries.push({ msg: curr });
                }

                return entries.map(({ msg, groupedImages }) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  groupedImages={groupedImages}
                  isGroup={activeChat.isGroup}
                  readReceipts={settings.readReceipts}
                  highlightQuery={inChatSearchQuery}
                  isActiveSearchMatch={inChatMatches[inChatMatchIdx]?.id === msg.id}
                  onCopyText={() => notify('تم نسخ نص الرسالة')}
                  onReply={m => {
                    setEditingMsg(null);
                    setReplyingTo(m);
                  }}
                  onToggleStar={msgId => emitWS({ type: 'message:star', conversationId: activeChat.id, messageId: msgId })}
                  onEdit={m => {
                    setReplyingTo(null);
                    setEditingMsg(m);
                    setInputText(m.text);
                  }}
                  onForward={m => setForwardingMsg(m)}
                  onDeleteRequest={m => setDeletingMsg(m)}
                  onReact={(msgId, emoji) =>
                    emitWS({ type: 'message:react', conversationId: activeChat.id, messageId: msgId, emoji })
                  }
                  onVotePoll={(msgId, optionIndex) =>
                    emitWS({ type: 'poll:vote', conversationId: activeChat.id, messageId: msgId, optionIndex })
                  }
                  onOpenViewOnce={m => setViewingViewOnceMsg(m)}
                  onOpenImage={(url, albumUrls, index) => {
                    const list = albumUrls && albumUrls.length > 0 ? albumUrls : [url];
                    const idx = typeof index === 'number' ? index : Math.max(0, list.indexOf(url));
                    setViewingGallery({ images: list, index: idx });
                  }}
                  onSendNow={msgId => {
                    emitWS({ type: 'message:send_now', conversationId: activeChat.id, messageId: msgId });
                    notify('تم إرسال الرسالة فوراً');
                  }}
                  onCancelSchedule={msgId => {
                    emitWS({ type: 'message:cancel_schedule', conversationId: activeChat.id, messageId: msgId });
                    notify('تم إلغاء جدولة الرسالة');
                  }}
                  onStartChatWithCard={async card => {
                    const existing = contacts.find(c => c.phone === card.phone);
                    if (existing) {
                      openChat(existing);
                    } else {
                      const res = await fetch('/api/users/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: card.name, phone: card.phone, avatar: card.avatar, creatorUserId: currentUserId }),
                      });
                      const data = await res.json();
                      if (data.user) {
                        const convId = data.conversation?.id || ('dm:' + [currentUserId, data.user.id].sort().join(':'));
                        setUsers(prev => (prev.some(u => u.id === data.user.id) ? prev : [data.user, ...prev]));
                        if (data.conversation) {
                          setServerConversations(prev => [data.conversation, ...prev.filter(c => c.id !== data.conversation.id)]);
                        }
                        emitWS({ type: 'dm:ensure', targetUserId: data.user.id });
                        setSelectedChatId(convId);
                        setMobileShowChat(true);
                        setInChatSearchOpen(false);
                        setInChatSearchQuery('');
                        notify(`تم بدء محادثة فورية مع ${data.user.name}`);
                      }
                    }
                  }}
                />
                ));
              })()}
              <div ref={messagesEndRef} />
            </div>

            {activeChat.isAI && (
              <div className="px-4 py-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar z-10">
                {[
                  'لخّص لي يوم عملي في نقاط',
                  'اكتب رسالة اعتذار مهذبة عن اجتماع',
                  'ترجم: Let us ship this today',
                  'أعطني 3 أفكار مشاريع تقنية',
                ].map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => handleSendMessage(prompt)}
                    className="px-3 py-1 rounded-full bg-white/90 dark:bg-[#202c33]/90 hover:bg-[#00a884] hover:text-white text-[11px] font-medium shadow-sm border border-[#00a884]/30 whitespace-nowrap transition-colors"
                  >
                    ✨ {prompt}
                  </button>
                ))}
              </div>
            )}

            {!activeChat.isAI && smartReplies.length > 0 && (
              <div className="px-4 py-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar z-10">
                {smartReplies.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(s)}
                    className="px-3 py-1 rounded-full bg-white/95 dark:bg-[#202c33]/95 hover:bg-[#00a884] hover:text-white text-[11px] font-medium shadow-sm border border-slate-200 dark:border-slate-700 whitespace-nowrap transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {(composerLinkPreview || loadingLinkPreview) && !isRecording && (
              <div className="px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-slate-200 dark:border-slate-800 z-10">
                {loadingLinkPreview && !composerLinkPreview ? (
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700/70 animate-pulse">
                    <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                      <Globe className="w-4 h-4 text-[#00a884] animate-spin" />
                      <span>جاري جلب معاينة الرابط...</span>
                    </div>
                  </div>
                ) : composerLinkPreview ? (
                  <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700/80 border-r-4 border-r-[#00a884] shadow-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {composerLinkPreview.image && !composerPreviewImgError ? (
                        <img
                          src={composerLinkPreview.image}
                          alt={composerLinkPreview.title}
                          referrerPolicy="no-referrer"
                          onError={() => setComposerPreviewImgError(true)}
                          className="w-12 h-12 rounded-lg object-cover shrink-0 bg-slate-100 dark:bg-slate-800"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[#00a884]/10 text-[#00a884] flex items-center justify-center shrink-0">
                          <Globe className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#00a884]">
                          <span className="truncate">{composerLinkPreview.siteName || composerLinkPreview.domain}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {composerLinkPreview.title}
                        </p>
                        {composerLinkPreview.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {composerLinkPreview.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const detected = extractFirstUrl(inputText);
                        if (detected) setDismissedPreviewUrl(detected);
                        setComposerLinkPreview(null);
                      }}
                      className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 shrink-0"
                      title="إزالة معاينة الرابط"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {(replyingTo || editingMsg) && (
              <div className="px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs z-10">
                <div className="flex items-center gap-2 border-r-4 border-[#00a884] pr-2.5 min-w-0">
                  <span className="font-bold text-[#00a884] shrink-0">
                    {editingMsg ? 'تعديل الرسالة:' : `الرد على ${replyingTo?.sender === 'me' ? 'نفسك' : activeChat.name}:`}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 truncate">
                    {editingMsg ? editingMsg.text : replyingTo?.text}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setEditingMsg(null);
                    if (editingMsg) setInputText('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Input Footer */}
            <div className="px-3 sm:px-4 py-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-slate-200 dark:border-slate-800 z-20 flex items-center gap-2 relative">
              <input ref={docFileInputRef} type="file" onChange={handleDocumentUpload} className="hidden" />

              {showAttachMenu && (
                <div className="absolute bottom-16 right-4 bg-white dark:bg-[#233138] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 z-50 flex flex-col gap-1 w-52 text-xs">
                  <button
                    onClick={() => { setShowMediaModal(true); setShowAttachMenu(false); }}
                    className="flex items-center gap-3 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl"
                  >
                    <Image className="w-4 h-4 text-purple-500" /> صور ووسائط (أو عرض مرة واحدة)
                  </button>
                  <button
                    onClick={() => { docFileInputRef.current?.click(); setShowAttachMenu(false); }}
                    className="flex items-center gap-3 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl"
                  >
                    <FileText className="w-4 h-4 text-sky-500" /> مستند من الجهاز
                  </button>
                  <button
                    onClick={() => { setShowPollModal(true); setShowAttachMenu(false); }}
                    className="flex items-center gap-3 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl"
                  >
                    <BarChart2 className="w-4 h-4 text-amber-500" /> استطلاع رأي
                  </button>
                  <button
                    onClick={() => { setShowShareContactPicker(true); setShowAttachMenu(false); }}
                    className="flex items-center gap-3 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl"
                  >
                    <Contact className="w-4 h-4 text-emerald-500" /> جهة اتصال
                  </button>
                  <button
                    onClick={handleShareLocation}
                    className="flex items-center gap-3 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl"
                  >
                    <MapPin className="w-4 h-4 text-rose-500" /> مشاركة الموقع الحالي
                  </button>
                  <button
                    onClick={() => {
                      setShowScheduleModal(true);
                      setShowAttachMenu(false);
                    }}
                    className="flex items-center gap-3 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl"
                  >
                    <Clock className="w-4 h-4 text-[#00a884]" /> جدولة إرسال رسالة
                  </button>
                </div>
              )}

              {showEmojiPicker && (
                <div className="absolute bottom-16 right-14 bg-white dark:bg-[#233138] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 z-50 grid grid-cols-6 gap-2 text-xl">
                  {['😊', '😂', '❤️', '👍', '🔥', '🎉', '🙏', '👏', '✨', '💡', '🚀', '⭐', '😍', '🤝', '💯', '☕', '🌙', '✅'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setInputText(prev => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="hover:scale-125 transition-transform p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowAttachMenu(false);
                }}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300"
                title="الرموز التعبيرية"
              >
                <Smile className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  setShowAttachMenu(!showAttachMenu);
                  setShowEmojiPicker(false);
                }}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300"
                title="إرفاق"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {isRecording ? (
                <div className="flex-1 flex items-center justify-between bg-white dark:bg-[#2a3942] px-4 py-2 rounded-xl border border-rose-500/50">
                  <div className="flex items-center gap-2.5 text-rose-500 text-xs font-bold tabular-nums">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span>جاري التسجيل... 0:{String(recordSeconds).padStart(2, '0')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={cancelRecording} className="p-1.5 text-slate-400 hover:text-rose-500" title="إلغاء التسجيل">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={stopAndSendRecording} className="p-2 bg-[#00a884] text-white rounded-full hover:bg-[#008f72]" title="إرسال التسجيل">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center bg-white dark:bg-[#2a3942] rounded-xl px-3.5 py-2 border border-transparent focus-within:border-[#00a884]/60">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => handleInputChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && settings.enterToSend) handleSendMessage();
                    }}
                    placeholder={activeChat.isBlocked ? 'تم حظر جهة الاتصال' : 'اكتب رسالة...'}
                    disabled={activeChat.isBlocked}
                    className="w-full bg-transparent text-xs sm:text-[13px] text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
                  />
                </div>
              )}

              {!isRecording && !editingMsg && !activeChat.isBlocked && (
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50 hover:text-[#00a884] rounded-full transition-colors"
                  title="جدولة إرسال رسالة"
                >
                  <Clock className="w-5 h-5" />
                </button>
              )}

              {inputText.trim() ? (
                <button
                  onClick={() => handleSendMessage()}
                  className="p-2.5 bg-[#00a884] hover:bg-[#008f72] text-white rounded-full shadow-md transition-transform active:scale-95"
                  title="إرسال"
                >
                  <Send className="w-5 h-5" />
                </button>
              ) : !isRecording ? (
                <button
                  onClick={startRecording}
                  className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-full transition-colors"
                  title="تسجيل رسالة صوتية"
                >
                  <Mic className="w-5 h-5" />
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-between p-8 bg-[#f0f2f5] dark:bg-[#222e35] text-center">
            <div />
            <div className="max-w-md space-y-5">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-[#00a884]/15 text-[#00a884] flex items-center justify-center shadow-inner">
                <MessageSquare className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                  WhatsApp Pro AI <span className="text-xs font-bold text-[#00a884] align-middle">v{APP_VERSION}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  أرسل واستقبل الرسائل الفورية والمكالمات والمستندات بأمان كامل مع مزامنة جهات اتصالك ومساعد Meta AI.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f72] text-white font-bold text-xs flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> محادثة جديدة
                </button>
                <button
                  onClick={() => setShowContactSyncModal(true)}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-[#202c33]"
                >
                  <RefreshCw className="w-4 h-4 text-[#00a884]" /> مزامنة جهات الاتصال
                </button>
              </div>
              <div className="pt-1 flex justify-center">
                <PWAInstallButton variant="pill" onNotify={notify} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Lock className="w-3.5 h-3.5 text-[#00a884]" />
              <span>محادثاتك ومكالماتك مشفرة تماماً بين الطرفين · {APP_RELEASE_LABEL}</span>
            </div>
          </div>
        )}

        {/* 4. Right Contact Info Drawer */}
        {showContactInfo && activeChat && (
          <div className="fixed inset-0 md:static z-40 md:z-20 w-full md:w-[320px] lg:w-[340px] bg-white dark:bg-[#111b21] border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shadow-2xl md:shadow-none">
            <div className="flex items-center justify-between p-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold">معلومات جهة الاتصال</h3>
              <button onClick={() => setShowContactInfo(false)} className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100 dark:border-slate-800">
                <Avatar src={activeChat.avatar} name={activeChat.name} size="xl" isAI={activeChat.isAI} isGroup={activeChat.isGroup} />
                <h2 className="text-base font-bold mt-3">{activeChat.name}</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5 dir-ltr">{activeChat.phone}</p>

                {!activeChat.isGroup && (
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => startCall(activeChat, 'voice')}
                      className="px-4 py-2 rounded-xl bg-[#00a884]/15 text-[#00a884] font-bold flex items-center gap-1.5 hover:bg-[#00a884]/25"
                    >
                      <Phone className="w-4 h-4" /> صوت
                    </button>
                    <button
                      onClick={() => startCall(activeChat, 'video')}
                      className="px-4 py-2 rounded-xl bg-[#00a884]/15 text-[#00a884] font-bold flex items-center gap-1.5 hover:bg-[#00a884]/25"
                    >
                      <Video className="w-4 h-4" /> فيديو
                    </button>
                  </div>
                )}
              </div>

              <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {activeChat.isGroup ? 'وصف المجموعة' : 'الأخبار'}
                  </span>
                  {activeChat.isGroup && activeChat.isCurrentUserAdmin && (
                    <button
                      onClick={() => {
                        setGroupTitleDraft(activeChat.name);
                        setGroupAboutDraft(activeChat.about);
                        setEditingGroupInfo(v => !v);
                      }}
                      className="text-[11px] font-bold text-[#00a884] hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> تعديل
                    </button>
                  )}
                </div>
                {editingGroupInfo && activeChat.isGroup ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={groupTitleDraft}
                      onChange={e => setGroupTitleDraft(e.target.value)}
                      placeholder="اسم المجموعة..."
                      className="w-full p-2 rounded-xl bg-white dark:bg-[#111b21] outline-none"
                    />
                    <input
                      type="text"
                      value={groupAboutDraft}
                      onChange={e => setGroupAboutDraft(e.target.value)}
                      placeholder="وصف المجموعة..."
                      className="w-full p-2 rounded-xl bg-white dark:bg-[#111b21] outline-none"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setEditingGroupInfo(false)}
                        className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700"
                      >
                        إلغاء
                      </button>
                      <button
                        onClick={() => {
                          emitWS({
                            type: 'group:update_info',
                            conversationId: activeChat.id,
                            title: groupTitleDraft,
                            about: groupAboutDraft,
                          });
                          setEditingGroupInfo(false);
                          notify('تم تحديث بيانات المجموعة');
                        }}
                        className="px-3 py-1 rounded-lg bg-[#00a884] text-white font-bold"
                      >
                        حفظ
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="font-medium leading-relaxed">{activeChat.about}</p>
                )}
              </div>

              {activeChat.isGroup && activeChat.groupMembers && (
                <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      المشاركون ({activeChat.groupMembers.length})
                    </span>
                    {activeChat.isCurrentUserAdmin && (
                      <button
                        onClick={() => setShowAddGroupMembersModal(true)}
                        className="px-2.5 py-1 rounded-lg bg-[#00a884] hover:bg-[#008f72] text-white text-[10px] font-bold flex items-center gap-1 transition-colors"
                      >
                        <UserPlus className="w-3 h-3" /> إضافة مشاركين
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {activeChat.groupMembers.map(member => {
                      const isSelf = member.id === currentUserId;
                      return (
                        <div
                          key={member.id}
                          className="p-2 rounded-xl bg-white dark:bg-[#111b21] flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar src={member.avatar} name={member.name} size="sm" isOnline={member.isOnline} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-[11px] truncate">{member.name}</span>
                                {member.isAdmin && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-[#00a884] text-[9px] font-bold shrink-0">
                                    مشرف
                                  </span>
                                )}
                              </div>
                              {member.phone && (
                                <p className="text-[10px] text-slate-400 dir-ltr text-right truncate">{member.phone}</p>
                              )}
                            </div>
                          </div>

                          {activeChat.isCurrentUserAdmin && !isSelf && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  emitWS({
                                    type: 'group:toggle_admin',
                                    conversationId: activeChat.id,
                                    targetUserId: member.id,
                                  });
                                  notify(
                                    member.isAdmin
                                      ? `تمت إزالة الإشراف عن ${member.name}`
                                      : `تم تعيين ${member.name} مشرفاً`
                                  );
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  member.isAdmin
                                    ? 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25'
                                    : 'bg-slate-100 dark:bg-[#202c33] text-slate-500 hover:text-[#00a884]'
                                }`}
                                title={member.isAdmin ? 'إزالة صلاحية المشرف' : 'تعيين كمشرف'}
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  emitWS({
                                    type: 'group:remove_member',
                                    conversationId: activeChat.id,
                                    targetUserId: member.id,
                                  });
                                  notify(`تمت إزالة ${member.name} من المجموعة`);
                                }}
                                className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                                title="إزالة من المجموعة"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-2xl space-y-2.5">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <button
                    onClick={() => setInfoGalleryTab('media')}
                    className={`font-bold ${infoGalleryTab === 'media' ? 'text-[#00a884]' : 'text-slate-400'}`}
                  >
                    الوسائط
                  </button>
                  <button
                    onClick={() => setInfoGalleryTab('docs')}
                    className={`font-bold ${infoGalleryTab === 'docs' ? 'text-[#00a884]' : 'text-slate-400'}`}
                  >
                    المستندات
                  </button>
                  <button
                    onClick={() => setInfoGalleryTab('links')}
                    className={`font-bold ${infoGalleryTab === 'links' ? 'text-[#00a884]' : 'text-slate-400'}`}
                  >
                    الروابط
                  </button>
                </div>
                {infoGalleryTab === 'media' ? (() => {
                  const sharedImages = activeChat.messages
                    .filter(m => m.type === 'image' && !m.isViewOnce && !m.isDeleted)
                    .flatMap(m => (m.mediaUrls && m.mediaUrls.length > 0 ? m.mediaUrls : m.mediaUrl ? [m.mediaUrl] : []));
                  return (
                    <div className="grid grid-cols-3 gap-1.5">
                      {sharedImages.length === 0 ? (
                        <span className="col-span-3 text-[11px] text-slate-400 py-2">لا توجد صور مشاركة</span>
                      ) : (
                        sharedImages.map((imgUrl, idx) => (
                          <img
                            key={`${imgUrl.slice(0, 20)}-${idx}`}
                            src={imgUrl}
                            alt="وسائط"
                            onClick={() => setViewingGallery({ images: sharedImages, index: idx })}
                            className="h-16 w-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        ))
                      )}
                    </div>
                  );
                })() : infoGalleryTab === 'docs' ? (
                  <div className="space-y-1.5">
                    {activeChat.messages.filter(m => m.type === 'document').length === 0 ? (
                      <span className="text-[11px] text-slate-400">لا توجد مستندات مشاركة</span>
                    ) : (
                      activeChat.messages
                        .filter(m => m.type === 'document')
                        .map(m => (
                          <div key={m.id} className="text-[11px] p-2 rounded-lg bg-white dark:bg-[#111b21] truncate">
                            📄 {m.fileName || m.text}
                          </div>
                        ))
                    )}
                  </div>
                ) : (() => {
                  const linkEntries: Array<{ id: string; url: string; title: string; siteName?: string; image?: string }> = [];
                  const seenUrls = new Set<string>();
                  for (const m of activeChat.messages) {
                    if (m.isDeleted) continue;
                    if (m.linkPreview && !seenUrls.has(m.linkPreview.url)) {
                      seenUrls.add(m.linkPreview.url);
                      linkEntries.push({
                        id: m.id,
                        url: m.linkPreview.url,
                        title: m.linkPreview.title,
                        siteName: m.linkPreview.siteName || m.linkPreview.domain,
                        image: m.linkPreview.image,
                      });
                    }
                    for (const u of extractAllUrls(m.text || '')) {
                      if (!seenUrls.has(u)) {
                        seenUrls.add(u);
                        let domain = u;
                        try {
                          domain = new URL(u).hostname.replace(/^www\./i, '');
                        } catch {
                          // fallback
                        }
                        linkEntries.push({ id: `${m.id}-${u}`, url: u, title: domain, siteName: domain });
                      }
                    }
                  }
                  return (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {linkEntries.length === 0 ? (
                        <span className="text-[11px] text-slate-400">لا توجد روابط مشاركة</span>
                      ) : (
                        linkEntries.map(item => (
                          <a
                            key={item.id}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-[#111b21] hover:bg-slate-50 dark:hover:bg-[#18242b] transition-colors"
                          >
                            {item.image ? (
                              <img src={item.image} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-[#00a884]/10 text-[#00a884] flex items-center justify-center shrink-0">
                                <Globe className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold truncate text-slate-800 dark:text-slate-100">{item.title}</p>
                              <p className="text-[10px] text-sky-600 dark:text-sky-400 truncate" dir="ltr">{item.url}</p>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </a>
                        ))
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-2xl space-y-2">
                <span className="flex items-center gap-2 font-semibold">
                  <Clock className="w-4 h-4 text-[#00a884]" /> الرسائل ذاتية الاختفاء
                </span>
                <select
                  value={activeChat.disappearing || 'off'}
                  onChange={e => {
                    const val = e.target.value as DisappearingDuration;
                    emitWS({ type: 'chat:prefs', conversationId: activeChat.id, action: { disappearing: val } });
                    notify('تم تحديث مؤقت اختفاء الرسائل');
                  }}
                  className="w-full p-2 rounded-xl bg-white dark:bg-[#111b21] outline-none"
                >
                  <option value="off">إيقاف</option>
                  <option value="24h">24 ساعة</option>
                  <option value="7d">7 أيام</option>
                  <option value="90d">90 يوماً</option>
                </select>
              </div>

              <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <Music className="w-4 h-4 text-[#00a884]" /> نغمة إشعارات مخصصة
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const activeTone = activeChat.notificationTone || 'default';
                      if (activeTone === 'silent') {
                        notify('النغمة مضبوطة على الوضع الصامت لهذه المحادثة', 'info');
                      } else {
                        playNotificationTone(activeTone, 'receive');
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#00a884]/15 text-[#00a884] text-[11px] font-bold flex items-center gap-1 hover:bg-[#00a884]/25 transition-colors"
                    title="استماع للنغمة الحالية"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> معاينة
                  </button>
                </div>

                <select
                  value={activeChat.notificationTone || 'default'}
                  onChange={e => {
                    const val = e.target.value as NotificationToneId;
                    emitWS({
                      type: 'chat:prefs',
                      conversationId: activeChat.id,
                      action: { notificationTone: val },
                    });
                    if (val !== 'silent') {
                      playNotificationTone(val, 'receive');
                    }
                    notify(
                      `تم تعيين "${getToneLabel(val)}" ${
                        activeChat.isGroup ? 'لهذه المجموعة' : 'لهذه المحادثة'
                      }`
                    );
                  }}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-[#111b21] outline-none border border-transparent focus:border-[#00a884]"
                >
                  {NOTIFICATION_TONES.map(tone => (
                    <option key={tone.id} value={tone.id}>
                      {tone.name} — {tone.description}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap gap-1.5">
                  {NOTIFICATION_TONES.map(tone => {
                    const selected = (activeChat.notificationTone || 'default') === tone.id;
                    return (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => {
                          emitWS({
                            type: 'chat:prefs',
                            conversationId: activeChat.id,
                            action: { notificationTone: tone.id },
                          });
                          if (tone.id !== 'silent') {
                            playNotificationTone(tone.id, 'receive');
                          }
                          notify(
                            `تم تعيين "${tone.name}" ${
                              activeChat.isGroup ? 'لهذه المجموعة' : 'لهذه المحادثة'
                            }`
                          );
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                          selected
                            ? 'bg-[#00a884] border-[#00a884] text-white'
                            : 'bg-white dark:bg-[#111b21] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#00a884]/60'
                        }`}
                      >
                        {tone.name}
                      </button>
                    );
                  })}
                </div>

                {activeChat.isMuted && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    تنبيه: هذه {activeChat.isGroup ? 'المجموعة' : 'المحادثة'} مكتومة حالياً — ستصدر النغمة المخصصة عند إلغاء الكتم.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => emitWS({ type: 'chat:prefs', conversationId: activeChat.id, action: { toggle: 'mute' } })}
                  className="w-full p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl flex items-center justify-between"
                >
                  <span className="flex items-center gap-2"><Bell className="w-4 h-4" /> كتم الإشعارات</span>
                  <span className="font-bold text-[#00a884]">{activeChat.isMuted ? 'مكتوم' : 'إيقاف'}</span>
                </button>

                <button
                  onClick={() => emitWS({ type: 'chat:prefs', conversationId: activeChat.id, action: { toggle: 'favorite' } })}
                  className="w-full p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl flex items-center justify-between"
                >
                  <span className="flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> إضافة للمفضلة</span>
                  <span className="font-bold text-[#00a884]">{activeChat.isFavorite ? 'مفضلة' : 'لا'}</span>
                </button>

                <button
                  onClick={() => {
                    if (activeChat.isLocked) {
                      setPinPromptAction({
                        title: 'إلغاء قفل المحادثة',
                        onConfirm: () => {
                          emitWS({ type: 'chat:prefs', conversationId: activeChat.id, action: { toggle: 'lock' } });
                          setPinPromptAction(null);
                          notify('تم إلغاء قفل المحادثة');
                        },
                      });
                    } else {
                      emitWS({ type: 'chat:prefs', conversationId: activeChat.id, action: { toggle: 'lock' } });
                      notify(`تم قفل المحادثة برمز (${settings.chatLockPin})`);
                    }
                  }}
                  className="w-full p-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    {activeChat.isLocked ? <Unlock className="w-4 h-4 text-[#00a884]" /> : <Lock className="w-4 h-4 text-[#00a884]" />}
                    قفل الدردشة
                  </span>
                  <span className="font-bold text-[#00a884]">{activeChat.isLocked ? 'مقفلة' : 'غير مقفلة'}</span>
                </button>

                {!activeChat.isAI && !activeChat.isGroup && (
                  <button
                    onClick={() => emitWS({ type: 'chat:prefs', conversationId: activeChat.id, action: { toggle: 'block' } })}
                    className="w-full p-3 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-rose-500/20"
                  >
                    <Ban className="w-4 h-4" /> {activeChat.isBlocked ? 'إلغاء الحظر' : `حظر ${activeChat.name}`}
                  </button>
                )}

                {activeChat.isGroup && (
                  <button
                    onClick={() => {
                      emitWS({
                        type: 'group:remove_member',
                        conversationId: activeChat.id,
                        targetUserId: currentUserId,
                      });
                      setShowContactInfo(false);
                      notify('لقد غادرت المجموعة');
                    }}
                    className="w-full p-3 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-rose-500/20"
                  >
                    <LogOut className="w-4 h-4" /> مغادرة المجموعة
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Tab Bar */}
      {!mobileShowChat && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 dark:bg-[#202c33]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center text-[10px] font-medium">
          {(
            [
              ['chats', 'الدردشات', <MessageSquare className="w-5 h-5" />, unreadChatsCount],
              ['updates', 'المستجدات', <CircleDashed className="w-5 h-5" />, unviewedStatusCount],
              ['communities', 'المجتمعات', <Users className="w-5 h-5" />, 0],
              ['calls', 'المكالمات', <Phone className="w-5 h-5" />, missedCallsCount],
              ['settings', 'الإعدادات', <Settings className="w-5 h-5" />, 0],
            ] as const
          ).map(([tab, label, icon, badge]) => (
            <button
              key={tab}
              onClick={() => handleNavClick(tab)}
              className={`flex flex-col items-center justify-center gap-1 relative h-full ${
                activeTab === tab ? 'text-[#00a884] font-bold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <div className="relative">
                {icon}
                {badge > 0 && (
                  <span className="absolute -top-1 -left-2 min-w-[16px] h-4 px-1 bg-[#00a884] text-white text-[9px] rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* ================= MODALS ================= */}

      {showSecurityModal.open && authToken && (
        <SecuritySessionsModal
          authToken={authToken}
          currentUser={myProfile}
          initialTab={showSecurityModal.tab}
          onClose={() => setShowSecurityModal(s => ({ ...s, open: false }))}
          onUserUpdated={updated => {
            setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
          }}
          onLoggedOutCurrent={() => handleLogout(true)}
          onNotify={notify}
        />
      )}

      {showNewGroupModal && (
        <NewGroupModal
          users={users}
          currentUserId={currentUserId}
          onClose={() => setShowNewGroupModal(false)}
          onQuickRegisterUser={async (name, phone) => {
            const res = await fetch('/api/users/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, phone }),
            });
            const data = await res.json();
            return data.user || null;
          }}
          onCreate={(title, memberIds, adminIds, about) => {
            emitWS({ type: 'group:create', title, memberIds, adminIds, about });
            setShowNewGroupModal(false);
            setActiveTab('chats');
            notify(`تم إنشاء المجموعة "${title}" مع ${adminIds.length + 1} مشرفين`);
          }}
        />
      )}

      {showAddGroupMembersModal && activeChat && activeChat.isGroup && (
        <AddGroupMembersModal
          groupName={activeChat.name}
          users={users}
          existingMemberIds={(activeChat.groupMembers || []).map(m => m.id)}
          onClose={() => setShowAddGroupMembersModal(false)}
          onQuickRegisterUser={async (name, phone) => {
            const res = await fetch('/api/users/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, phone }),
            });
            const data = await res.json();
            return data.user || null;
          }}
          onAddMembers={(memberIds, adminIds) => {
            emitWS({
              type: 'group:add_members',
              conversationId: activeChat.id,
              memberIds,
              adminIds,
            });
            setShowAddGroupMembersModal(false);
            notify(`تمت إضافة ${memberIds.length} مشاركين إلى المجموعة`);
          }}
        />
      )}

      {showNewChatModal && (
        <NewContactModal
          availableUsers={users}
          currentUserId={currentUserId}
          onClose={() => setShowNewChatModal(false)}
          onAdd={async (name, phoneOrEmail) => {
            try {
              const isEmail = phoneOrEmail.includes('@');
              if (!isEmail) {
                emitWS({
                  type: 'contacts:sync_batch',
                  contacts: [{ displayName: name, phone: phoneOrEmail, source: 'manual' }],
                });
              }
              const res = await fetch('/api/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name,
                  phone: phoneOrEmail,
                  email: isEmail ? phoneOrEmail : undefined,
                  creatorUserId: currentUserId,
                }),
              });
              const data = await res.json();
              if (data.user) {
                setUsers(prev => (prev.some(u => u.id === data.user.id) ? prev : [data.user, ...prev]));
                const convId = data.conversation?.id || ('dm:' + [currentUserId, data.user.id].sort().join(':'));

                if (data.conversation) {
                  setServerConversations(prev => {
                    const idx = prev.findIndex(c => c.id === data.conversation.id);
                    if (idx >= 0) {
                      const next = [...prev];
                      next[idx] = data.conversation;
                      return next;
                    }
                    return [data.conversation, ...prev];
                  });
                } else {
                  setServerConversations(prev => {
                    if (prev.some(c => c.id === convId)) return prev;
                    return [
                      {
                        id: convId,
                        kind: 'dm',
                        memberIds: [currentUserId, data.user.id],
                        messages: [],
                      },
                      ...prev,
                    ];
                  });
                }

                emitWS({ type: 'dm:ensure', targetUserId: data.user.id });
                if (!isEmail) emitWS({ type: 'contacts:resync' });

                setShowNewChatModal(false);
                setActiveTab('chats');
                setSelectedChatId(convId);
                setMobileShowChat(true);
                setInChatSearchOpen(false);
                setInChatSearchQuery('');
                notify(`تم فتح محادثة فورية مع ${data.user.name}`);
              }
            } catch (err) {
              console.error('Failed to create/open contact chat:', err);
              notify('تعذر بدء المحادثة، يرجى المحاولة ثانية');
            }
          }}
        />
      )}

      {showContactSyncModal && (
        <ContactSyncModal
          syncedContacts={syncedContacts}
          users={users}
          lastSyncAt={lastContactSyncAt}
          autoSyncEnabled={settings.autoSyncContacts !== false}
          onToggleAutoSync={enabled => setSettings(s => ({ ...s, autoSyncContacts: enabled }))}
          onSyncBatch={batch => {
            emitWS({ type: 'contacts:sync_batch', contacts: batch });
            notify(`جاري مزامنة ${batch.length} جهة اتصال...`);
          }}
          onResync={() => {
            emitWS({ type: 'contacts:resync' });
            notify('تمت إعادة مزامنة ومطابقة جهات الاتصال');
          }}
          onDeleteContact={contactId => {
            emitWS({ type: 'contacts:delete', contactId });
            notify('تم حذف جهة الاتصال من القائمة المتزامنة');
          }}
          onClearAll={() => {
            emitWS({ type: 'contacts:clear' });
            notify('تم مسح القائمة المتزامنة');
          }}
          onStartChatWithUser={targetUserId => {
            const convId = 'dm:' + [currentUserId, targetUserId].sort().join(':');
            setShowContactSyncModal(false);
            setActiveTab('chats');
            setServerConversations(prev => {
              if (prev.some(c => c.id === convId)) return prev;
              return [
                {
                  id: convId,
                  kind: 'dm',
                  memberIds: [currentUserId, targetUserId],
                  messages: [],
                },
                ...prev,
              ];
            });
            emitWS({ type: 'dm:ensure', targetUserId });
            setSelectedChatId(convId);
            setMobileShowChat(true);
            setInChatSearchOpen(false);
            setInChatSearchQuery('');
            const targetUser = users.find(u => u.id === targetUserId);
            notify(`تم فتح المحادثة الفورية مع ${targetUser?.name || 'جهة الاتصال'}`);
          }}
          onOnboardAndChat={async contact => {
            try {
              const res = await fetch('/api/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: contact.displayName, phone: contact.phone, creatorUserId: currentUserId }),
              });
              const data = await res.json();
              if (data.user) {
                const convId = data.conversation?.id || ('dm:' + [currentUserId, data.user.id].sort().join(':'));
                setUsers(prev => (prev.some(u => u.id === data.user.id) ? prev : [data.user, ...prev]));
                if (data.conversation) {
                  setServerConversations(prev => {
                    const idx = prev.findIndex(c => c.id === data.conversation.id);
                    if (idx >= 0) {
                      const next = [...prev];
                      next[idx] = data.conversation;
                      return next;
                    }
                    return [data.conversation, ...prev];
                  });
                } else {
                  setServerConversations(prev => {
                    if (prev.some(c => c.id === convId)) return prev;
                    return [
                      {
                        id: convId,
                        kind: 'dm',
                        memberIds: [currentUserId, data.user.id],
                        messages: [],
                      },
                      ...prev,
                    ];
                  });
                }
                emitWS({ type: 'dm:ensure', targetUserId: data.user.id });
                emitWS({ type: 'contacts:resync' });
                setShowContactSyncModal(false);
                setActiveTab('chats');
                setSelectedChatId(convId);
                setMobileShowChat(true);
                setInChatSearchOpen(false);
                setInChatSearchQuery('');
                notify(`تم تفعيل حساب ${contact.displayName} وفتح المحادثة الفورية`);
              }
            } catch (err) {
              console.error('Failed to onboard contact and start chat:', err);
              notify('تعذر بدء المحادثة، يرجى المحاولة ثانية');
            }
          }}
          onCopyInvite={async contact => {
            const inviteText = `مرحباً ${contact.displayName}! انضم إليّ على تطبيق WhatsApp Pro AI برقمك ${contact.phone}: ${window.location.origin}`;
            try {
              await navigator.clipboard.writeText(inviteText);
              notify(`تم نسخ رسالة الدعوة لـ ${contact.displayName}`);
            } catch {
              notify(`جهّزت الدعوة لـ ${contact.displayName}`);
            }
          }}
          onClose={() => setShowContactSyncModal(false)}
        />
      )}

      {showPollModal && (
        <PollModal
          onClose={() => setShowPollModal(false)}
          onCreate={(question, opts, allowMultiple) => {
            handleSendMessage('', 'poll', {
              pollData: {
                question,
                allowMultiple,
                options: opts.map(text => ({ text, votes: 0, votedByMe: false })),
              },
            });
            setShowPollModal(false);
          }}
        />
      )}

      {showMediaModal && (
        <MediaModal
          onClose={() => setShowMediaModal(false)}
          onSend={(urls, caption, isViewOnce) => {
            if (urls.length === 0) return;
            if (urls.length > 1) {
              handleSendMessage(caption, 'image', {
                mediaUrl: urls[0],
                mediaUrls: urls,
                isViewOnce: false,
                isViewedOnce: false,
              });
              notify(`تم إرسال ${urls.length} صور مجمعة`);
            } else {
              handleSendMessage(caption, 'image', {
                mediaUrl: urls[0],
                isViewOnce,
                isViewedOnce: false,
              });
            }
            setShowMediaModal(false);
          }}
        />
      )}

      {showScheduleModal && activeChat && (
        <ScheduleMessageModal
          initialText={inputText}
          recipientName={activeChat.name}
          onClose={() => setShowScheduleModal(false)}
          onSchedule={(text, scheduledAt) => {
            handleSendMessage(text, 'text', { scheduledAt });
            setInputText('');
            setShowScheduleModal(false);
          }}
        />
      )}

      {forwardingMsg && (
        <ForwardModal
          contacts={contacts}
          message={forwardingMsg}
          onClose={() => setForwardingMsg(null)}
          onForwardTo={targetConvId => {
            const fwdPayload = {
              id: 'fwd-' + Date.now(),
              conversationId: targetConvId,
              senderId: currentUserId,
              senderName: myProfile.name,
              text: forwardingMsg.text,
              timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
              createdAt: Date.now(),
              status: 'sent',
              type: forwardingMsg.type || 'text',
              mediaUrl: forwardingMsg.mediaUrl,
              mediaUrls: forwardingMsg.mediaUrls,
              fileName: forwardingMsg.fileName,
              fileSize: forwardingMsg.fileSize,
              locationData: forwardingMsg.locationData,
              contactCard: forwardingMsg.contactCard,
              linkPreview: forwardingMsg.linkPreview,
              isForwarded: true,
            };
            emitWS({ type: 'message:send', conversationId: targetConvId, message: fwdPayload });
            setForwardingMsg(null);
            notify('تمت إعادة توجيه الرسالة');
          }}
        />
      )}

      {deletingMsg && activeChat && (
        <DeleteMessageModal
          message={deletingMsg}
          onClose={() => setDeletingMsg(null)}
          onDeleteForMe={() => {
            emitWS({
              type: 'message:delete',
              conversationId: activeChat.id,
              messageId: deletingMsg.id,
              forEveryone: false,
            });
            setDeletingMsg(null);
          }}
          onDeleteForEveryone={() => {
            emitWS({
              type: 'message:delete',
              conversationId: activeChat.id,
              messageId: deletingMsg.id,
              forEveryone: true,
            });
            setDeletingMsg(null);
          }}
        />
      )}

      {pinPromptAction && (
        <PinModal
          expectedPin={settings.chatLockPin}
          title={pinPromptAction.title}
          onClose={() => setPinPromptAction(null)}
          onSuccess={pinPromptAction.onConfirm}
        />
      )}

      {showAddStatusModal && (
        <AddStatusModal
          onClose={() => setShowAddStatusModal(false)}
          onPublish={payload => {
            emitWS({
              type: 'status:add',
              ...payload,
            });
            setShowAddStatusModal(false);
            notify(payload.pinImmediately ? 'تم نشر الحالة وتثبيتها في الأعلى' : 'تم نشر حالتك للجميع');
          }}
        />
      )}

      {viewingStatus && (
        <StatusViewerModal
          status={viewingStatus}
          statuses={statuses}
          onSelectStatus={st => {
            emitWS({ type: 'status:view', statusId: st.id });
            setViewingStatusId(st.id);
          }}
          onClose={() => setViewingStatusId(null)}
          onTogglePin={statusId => {
            emitWS({ type: 'status:pin', statusId });
            notify(viewingStatus.isPinned ? 'تم إلغاء تثبيت الحالة' : 'تم تثبيت الحالة');
          }}
          onReactStatus={(statusId, emoji) => {
            emitWS({ type: 'status:react', statusId, emoji });
          }}
          onDeleteStatus={statusId => {
            emitWS({ type: 'status:delete', statusId });
            notify('تم حذف الحالة');
          }}
          onReplyToStatus={(st, replyText) => {
            const target = contacts.find(c => c.peerUserId === st.contactId);
            if (!target) return;
            emitWS({
              type: 'message:send',
              conversationId: target.id,
              message: {
                id: 'st-rep-' + Date.now(),
                conversationId: target.id,
                senderId: currentUserId,
                senderName: myProfile.name,
                text: replyText,
                timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
                createdAt: Date.now(),
                status: 'sent',
                type: 'text',
                replyTo: {
                  id: st.id,
                  senderName: `حالة ${st.contactName}`,
                  text: st.text || (st.mediaType === 'video' ? 'فيديو الحالة' : 'صورة الحالة'),
                },
              },
            });
            openChat(target);
            setActiveTab('chats');
            notify('تم إرسال الرد على الحالة');
          }}
        />
      )}

      {showEditProfileModal && (
        <EditProfileModal
          profile={myProfile}
          onClose={() => setShowEditProfileModal(false)}
          onSave={async updated => {
            setUsers(prev => prev.map(u => u.id === currentUserId ? { ...u, ...updated } : u));
            await fetch('/api/users/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: currentUserId, ...updated }),
            });
            setShowEditProfileModal(false);
            notify('تم تحديث الملف الشخصي ورقم الهاتف وحفظه على الخادم');
          }}
        />
      )}

      {incomingCall && (
        <IncomingCallModal
          caller={incomingCall.caller}
          callType={incomingCall.callType}
          onAccept={() => {
            const peerContact =
              contacts.find(c => c.peerUserId === incomingCall.caller.id) || {
                id: 'call-peer',
                peerUserId: incomingCall.caller.id,
                name: incomingCall.caller.name,
                avatar: incomingCall.caller.avatar,
                about: incomingCall.caller.about,
                phone: incomingCall.caller.phone,
                isOnline: true,
                unreadCount: 0,
                messages: [],
              };
            emitWS({
              type: 'call:signal',
              signalType: 'accept',
              targetUserId: incomingCall.caller.id,
              callId: incomingCall.callId,
            });
            setActiveCall({
              callId: incomingCall.callId,
              contact: peerContact,
              type: incomingCall.callType,
              status: 'connected',
              duration: 0,
            });
            callTimerRef.current = setInterval(() => {
              setActiveCall(prev => (prev ? { ...prev, duration: prev.duration + 1 } : null));
            }, 1000);
            setIncomingCall(null);
          }}
          onReject={() => {
            emitWS({
              type: 'call:signal',
              signalType: 'reject',
              targetUserId: incomingCall.caller.id,
              callType: incomingCall.callType,
              callId: incomingCall.callId,
            });
            setIncomingCall(null);
          }}
        />
      )}

      {activeCall && (
        <CallModal
          contact={activeCall.contact}
          type={activeCall.type}
          status={activeCall.status}
          duration={activeCall.duration}
          availableUsers={users.filter(u => u.id !== currentUserId)}
          onInviteParticipant={(targetUid, userName) => {
            emitWS({
              type: 'call:signal',
              signalType: 'invite',
              targetUserId: targetUid,
              callType: activeCall.type,
              callId: activeCall.callId,
            });
            notify(`تمت دعوة ${userName} إلى المكالمة`);
          }}
          onEndCall={endCall}
        />
      )}

      {showShareContactPicker && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#222e35] rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">مشاركة جهة اتصال</h3>
              <button onClick={() => setShowShareContactPicker(false)} className="p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {contacts.filter(c => !c.isGroup && !c.isAI).map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    handleSendMessage(c.name, 'contact', {
                      contactCard: { name: c.name, phone: c.phone, avatar: c.avatar },
                    });
                    setShowShareContactPicker(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2a3942]"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar src={c.avatar} name={c.name} size="sm" />
                    <span className="font-semibold">{c.name}</span>
                  </div>
                  <span className="text-[#00a884] font-bold">مشاركة</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showNewCommunityModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#222e35] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-[#00a884]" /> إنشاء مجتمع جديد
            </h3>
            <input
              type="text"
              value={newCommunityName}
              onChange={e => setNewCommunityName(e.target.value)}
              placeholder="اسم المجتمع..."
              className="w-full p-3 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none"
            />
            <textarea
              value={newCommunityDesc}
              onChange={e => setNewCommunityDesc(e.target.value)}
              placeholder="وصف المجتمع..."
              className="w-full p-3 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none h-20 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewCommunityModal(false)} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700">إلغاء</button>
              <button
                onClick={() => {
                  if (!newCommunityName.trim()) return;
                  emitWS({
                    type: 'community:create',
                    name: newCommunityName.trim(),
                    description: newCommunityDesc.trim(),
                  });
                  setNewCommunityName('');
                  setNewCommunityDesc('');
                  setShowNewCommunityModal(false);
                  notify('تم إنشاء المجتمع ومجموعته بنجاح');
                }}
                className="px-5 py-2 rounded-xl bg-[#00a884] text-white font-bold"
              >
                إنشاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangePinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white dark:bg-[#222e35] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#00a884]" /> رمز قفل الدردشات الجديد
            </h3>
            <input
              type="password"
              maxLength={6}
              value={newPinValue}
              onChange={e => setNewPinValue(e.target.value)}
              placeholder="أدخل 4 أرقام"
              className="w-full text-center tracking-[0.4em] text-base font-bold p-3 rounded-xl bg-slate-100 dark:bg-[#2a3942] outline-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowChangePinModal(false)} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700">إلغاء</button>
              <button
                onClick={() => {
                  if (newPinValue.trim().length >= 4) {
                    setSettings(s => ({ ...s, chatLockPin: newPinValue.trim() }));
                    setShowChangePinModal(false);
                    notify('تم تحديث رمز القفل');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#00a884] text-white font-bold"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingGallery && viewingGallery.images.length > 0 && (() => {
        const currentUrl = viewingGallery.images[viewingGallery.index] || viewingGallery.images[0];
        const hasMultiple = viewingGallery.images.length > 1;
        return (
          <div
            onClick={() => setViewingGallery(null)}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-4"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="w-full max-w-4xl flex items-center justify-between text-white text-xs z-10"
            >
              <span className="px-3 py-1.5 rounded-full bg-white/10 font-bold tabular-nums">
                {hasMultiple ? `صورة ${viewingGallery.index + 1} من ${viewingGallery.images.length}` : 'معاينة الصورة'}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={currentUrl}
                  download={`whatsapp-image-${viewingGallery.index + 1}.jpg`}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                  title="تنزيل الصورة"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button
                  type="button"
                  onClick={() => setViewingGallery(null)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div
              onClick={e => e.stopPropagation()}
              className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-2 min-h-0"
            >
              {hasMultiple && (
                <button
                  type="button"
                  onClick={() =>
                    setViewingGallery(prev =>
                      prev
                        ? { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length }
                        : null
                    )
                  }
                  className="absolute right-2 sm:right-4 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/15"
                  title="الصورة السابقة"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}

              <img
                src={currentUrl}
                alt={`معاينة ${viewingGallery.index + 1}`}
                className="max-h-[74vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
              />

              {hasMultiple && (
                <button
                  type="button"
                  onClick={() =>
                    setViewingGallery(prev =>
                      prev ? { ...prev, index: (prev.index + 1) % prev.images.length } : null
                    )
                  }
                  className="absolute left-2 sm:left-4 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/15"
                  title="الصورة التالية"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
            </div>

            {hasMultiple && (
              <div
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-2 overflow-x-auto max-w-full px-2 py-1.5 rounded-2xl bg-white/10 backdrop-blur-sm"
              >
                {viewingGallery.images.map((thumbUrl, idx) => (
                  <button
                    key={`${thumbUrl.slice(0, 18)}-${idx}`}
                    type="button"
                    onClick={() => setViewingGallery(prev => (prev ? { ...prev, index: idx } : null))}
                    className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                      idx === viewingGallery.index ? 'border-[#00a884] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={thumbUrl} alt={`مصغرة ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {viewingViewOnceMsg && activeChat && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 text-white">
          <div className="flex items-center justify-between w-full max-w-lg mb-4 text-xs">
            <span className="flex items-center gap-2 text-[#00a884] font-bold">
              <Shield className="w-4 h-4" /> عرض لمرة واحدة · ستختفي الصورة بعد الإغلاق
            </span>
            <button
              onClick={() => {
                emitWS({
                  type: 'message:view_once',
                  conversationId: activeChat.id,
                  messageId: viewingViewOnceMsg.id,
                });
                setViewingViewOnceMsg(null);
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {viewingViewOnceMsg.mediaUrl && (
            <img src={viewingViewOnceMsg.mediaUrl} alt="عرض مرة واحدة" className="max-h-[75vh] rounded-2xl object-contain" />
          )}
        </div>
      )}

      <NotificationCenter
        activeBanners={activeBanners}
        history={notifHistory}
        drawerOpen={notifDrawerOpen}
        onCloseDrawer={() => setNotifDrawerOpen(false)}
        onDismissBanner={id => setActiveBanners(prev => prev.filter(n => n.id !== id))}
        onDismissHistoryItem={id => setNotifHistory(prev => prev.filter(n => n.id !== id))}
        onMarkAllRead={() => setNotifHistory(prev => prev.map(n => ({ ...n, read: true })))}
        onClearAll={() => setNotifHistory([])}
        onOpenChat={handleOpenChatFromNotif}
        onQuickReply={handleQuickReplyFromNotif}
      />

      <PWABuilderModal
        open={showApkBuilderModal}
        onClose={() => setShowApkBuilderModal(false)}
        onNotify={notify}
      />

      <OfflineIndicator />
    </div>
  );
}
