/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserAccount {
  id: string;
  name: string;
  phone: string;
  email?: string;
  about: string;
  avatar: string;
  lastSeen: string;
  lastSeenPrivacy?: 'everyone' | 'contacts' | 'nobody';
  phoneVerified?: boolean;
  hasTwoFactor?: boolean;
  registeredAt?: number;
}

export interface AuthSessionInfo {
  id: string;
  userId: string;
  phone: string;
  deviceName: string;
  ipAddress?: string;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
  isCurrent: boolean;
}

export interface AuthAuditLogItem {
  id: string;
  phone: string;
  eventType: string;
  status: 'success' | 'failure' | 'blocked';
  ipAddress?: string;
  deviceName?: string;
  details?: string;
  createdAt: number;
}

export interface AuthDbStats {
  engine: string;
  dbPath: string;
  accountsCount: number;
  activeSessionsCount: number;
  pendingChallengesCount: number;
  auditLogsCount: number;
}

export interface CountryDialOption {
  code: string;
  dial: string;
  name: string;
  flag: string;
  placeholder: string;
}

export interface SyncedContact {
  id: string;
  ownerUserId: string;
  displayName: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  source: 'device' | 'vcf' | 'csv' | 'manual' | 'sync';
  registeredUserId?: string;
  syncedAt: number;
}

export interface PollOption {
  text: string;
  votes: number;
  votedByMe?: boolean;
}

export interface LinkPreviewData {
  url: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  domain?: string;
}

export interface Message {
  id: string;
  sender: 'me' | 'them';
  senderId?: string;
  senderName?: string;
  text: string;
  timestamp: string;
  createdAt?: number;
  scheduledAt?: number;
  status: 'scheduled' | 'sent' | 'delivered' | 'read';
  type?: 'text' | 'image' | 'audio' | 'document' | 'poll' | 'contact' | 'location';
  mediaUrl?: string;
  mediaUrls?: string[];
  audioUrl?: string;
  audioDuration?: number;
  fileName?: string;
  fileSize?: string;
  contactCard?: { name: string; phone: string; avatar: string };
  locationData?: { title: string; subtitle: string; coords: string };
  linkPreview?: LinkPreviewData;
  isViewOnce?: boolean;
  isViewedOnce?: boolean;
  reactions?: { emoji: string; byMe: boolean; count: number }[];
  replyTo?: { id: string; senderName: string; text: string };
  isStarred?: boolean;
  isEdited?: boolean;
  isForwarded?: boolean;
  isDeleted?: boolean;
  pollData?: {
    question: string;
    allowMultiple?: boolean;
    options: PollOption[];
  };
}

export type DisappearingDuration = 'off' | '24h' | '7d' | '90d';

export type NotificationToneId = 'default' | 'chime' | 'crystal' | 'pulse' | 'marimba' | 'aurora' | 'silent';

export interface GroupMemberInfo {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  isOnline: boolean;
  isAdmin: boolean;
}

export interface ChatContact {
  id: string; // conversationId
  peerUserId?: string;
  name: string;
  avatar: string;
  about: string;
  phone: string;
  email?: string;
  isOnline: boolean;
  isTyping?: boolean;
  lastSeen?: string;
  unreadCount: number;
  isPinned?: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
  isLocked?: boolean;
  isBlocked?: boolean;
  isGroup?: boolean;
  isFavorite?: boolean;
  isAI?: boolean;
  isSyncedContact?: boolean;
  savedContactName?: string;
  members?: string[];
  adminIds?: string[];
  isCurrentUserAdmin?: boolean;
  groupMembers?: GroupMemberInfo[];
  disappearing?: DisappearingDuration;
  notificationTone?: NotificationToneId;
  messages: Message[];
}

export interface StatusReaction {
  emoji: string;
  count: number;
  byMe: boolean;
}

export interface StatusStory {
  id: string;
  contactId: string;
  contactName: string;
  avatar: string;
  mediaUrl?: string;
  mediaType?: 'text' | 'image' | 'video';
  videoDuration?: number;
  text?: string;
  bgGradient?: string;
  fontStyle?: 'classic' | 'bold' | 'typewriter' | 'serif';
  privacy?: 'everyone' | 'contacts' | 'private';
  isPinned?: boolean;
  pinnedAt?: number;
  reactions?: StatusReaction[];
  timestamp: string;
  createdAt?: number;
  expiresAt?: number;
  isViewed: boolean;
  viewsCount?: number;
  viewedByNames?: string[];
}

export interface Channel {
  id: string;
  name: string;
  avatar: string;
  followers: string;
  verified?: boolean;
  isFollowing: boolean;
  ownerId?: string;
  posts: {
    id: string;
    text: string;
    timestamp: string;
    reactions: number;
    reacted?: boolean;
  }[];
}

export interface Community {
  id: string;
  name: string;
  description: string;
  avatar: string;
  membersCount: number;
  groups: { id: string; conversationId?: string; name: string; lastMessage: string; time: string }[];
}

export interface CallRecord {
  id: string;
  contactId: string;
  contactName: string;
  avatar: string;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  timestamp: string;
  duration?: string;
}

export type WallpaperTheme = 'default' | 'emerald' | 'slate' | 'sand';

export interface AppSettings {
  darkMode: boolean;
  readReceipts: boolean;
  soundsEnabled: boolean;
  enterToSend: boolean;
  lastSeenPrivacy: 'everyone' | 'contacts' | 'nobody';
  wallpaper: WallpaperTheme;
  chatLockPin: string;
  autoSyncContacts?: boolean;
  desktopNotifications?: boolean;
  biometricEnabled?: boolean;
  biometricCredentialId?: string;
}

export type NavTab = 'chats' | 'updates' | 'communities' | 'calls' | 'starred' | 'archive' | 'locked' | 'settings';
