/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatContact, Message, StatusStory, CallRecord, UserAccount, SyncedContact, Channel, Community, NotificationToneId } from '../types';

export function mapServerMessage(m: any, currentUserId: string): Message {
  const isMe = m.senderId === currentUserId;
  const isDeleted = !!(m.isDeletedForAll || (Array.isArray(m.deletedFor) && m.deletedFor.includes(currentUserId)));

  return {
    id: m.id,
    sender: isMe ? 'me' : 'them',
    senderId: m.senderId,
    senderName: m.senderName,
    text: isDeleted ? '' : m.text || '',
    timestamp: m.timestamp,
    createdAt: m.createdAt,
    scheduledAt: m.scheduledAt,
    status: m.status || 'sent',
    type: m.type || 'text',
    mediaUrl: isDeleted ? undefined : m.mediaUrl,
    mediaUrls: isDeleted ? undefined : Array.isArray(m.mediaUrls) ? m.mediaUrls : undefined,
    audioUrl: isDeleted ? undefined : m.audioUrl,
    audioDuration: m.audioDuration,
    fileName: m.fileName,
    fileSize: m.fileSize,
    contactCard: m.contactCard,
    locationData: m.locationData,
    linkPreview: isDeleted ? undefined : m.linkPreview,
    isViewOnce: m.isViewOnce,
    isViewedOnce: m.isViewedOnce,
    reactions: (m.reactions || []).map((r: any) => ({
      emoji: r.emoji,
      count: r.userIds?.length || 1,
      byMe: Array.isArray(r.userIds) ? r.userIds.includes(currentUserId) : false,
    })),
    replyTo: m.replyTo,
    isStarred: Array.isArray(m.starredBy) ? m.starredBy.includes(currentUserId) : false,
    isEdited: m.isEdited,
    isForwarded: m.isForwarded,
    isDeleted,
    pollData: m.pollData
      ? {
          question: m.pollData.question,
          allowMultiple: m.pollData.allowMultiple,
          options: (m.pollData.options || []).map((opt: any) => ({
            text: opt.text,
            votes: opt.voterIds?.length || 0,
            votedByMe: Array.isArray(opt.voterIds) ? opt.voterIds.includes(currentUserId) : false,
          })),
        }
      : undefined,
  };
}

export function mapServerConversation(
  conv: any,
  currentUserId: string,
  users: UserAccount[],
  onlineUserIds: string[],
  typingMap: Record<string, boolean>,
  syncedContacts: SyncedContact[] = []
): ChatContact {
  const messages: Message[] = (conv.messages || []).map((m: any) => mapServerMessage(m, currentUserId));

  const unreadCount = (conv.messages || []).filter(
    (m: any) =>
      m.senderId !== currentUserId &&
      m.status !== 'read' &&
      !(Array.isArray(m.readBy) && m.readBy.includes(currentUserId)) &&
      m.status !== 'scheduled' &&
      !m.isDeletedForAll &&
      !(Array.isArray(m.deletedFor) && m.deletedFor.includes(currentUserId))
  ).length;

  const isPinned = Array.isArray(conv.pinnedBy) && conv.pinnedBy.includes(currentUserId);
  const isArchived = Array.isArray(conv.archivedBy) && conv.archivedBy.includes(currentUserId);
  const isMuted = Array.isArray(conv.mutedBy) && conv.mutedBy.includes(currentUserId);
  const isLocked = Array.isArray(conv.lockedBy) && conv.lockedBy.includes(currentUserId);
  const isFavorite = Array.isArray(conv.favoriteBy) && conv.favoriteBy.includes(currentUserId);
  const isBlocked = Array.isArray(conv.blockedBy) && conv.blockedBy.includes(currentUserId);
  const notificationTone: NotificationToneId =
    (conv.notificationTones && conv.notificationTones[currentUserId]) || 'default';

  if (conv.kind === 'ai') {
    return {
      id: conv.id,
      name: conv.title || 'Meta AI · مساعد واتساب الذكي',
      avatar: '',
      about: 'مساعدك الشخصي المدعوم بذكاء Gemini المتقدم للرد الفوري، التلخيص، والترجمة.',
      phone: '+1 (800) 555-META-AI',
      isOnline: true,
      isTyping: !!typingMap[conv.id],
      unreadCount: 0,
      isPinned,
      isArchived,
      isMuted,
      isLocked,
      isFavorite,
      isAI: true,
      disappearing: conv.disappearing || 'off',
      notificationTone,
      messages,
    };
  }

  if (conv.kind === 'group') {
    const adminIds: string[] =
      Array.isArray(conv.adminIds) && conv.adminIds.length > 0
        ? conv.adminIds
        : (conv.memberIds || []).slice(0, 1);

    const groupMembers = (conv.memberIds || []).map((id: string) => {
      const u = users.find(x => x.id === id);
      const saved = syncedContacts.find(sc => sc.registeredUserId === id);
      const memberLabel = saved?.displayName || u?.name || id;
      return {
        id,
        name: id === currentUserId ? `${u?.name || 'أنت'} (أنت)` : memberLabel,
        avatar: u?.avatar || '',
        phone: u?.phone || '',
        isOnline: id === currentUserId || onlineUserIds.includes(id),
        isAdmin: adminIds.includes(id),
      };
    });

    groupMembers.sort((a: any, b: any) => Number(b.isAdmin) - Number(a.isAdmin));

    const memberNames = groupMembers.map((m: any) => m.name);
    const anyOnline = (conv.memberIds || []).some((id: string) => id !== currentUserId && onlineUserIds.includes(id));

    return {
      id: conv.id,
      name: conv.title || 'مجموعة',
      avatar: conv.avatar || '/src/assets/images/avatar_group_devs_1794862076550.jpg',
      about: conv.about || 'مجموعة محادثة',
      phone: `مجموعة · ${memberNames.length} أعضاء`,
      isOnline: anyOnline,
      isTyping: !!typingMap[conv.id],
      unreadCount,
      isPinned,
      isArchived,
      isMuted,
      isLocked,
      isFavorite,
      isGroup: true,
      members: memberNames,
      adminIds,
      isCurrentUserAdmin: adminIds.includes(currentUserId),
      groupMembers,
      disappearing: conv.disappearing || 'off',
      notificationTone,
      messages,
    };
  }

  // Direct Message (dm)
  const peerId = (conv.memberIds || []).find((id: string) => id !== currentUserId);
  const peer = users.find(u => u.id === peerId);
  const syncedMatch = peerId ? syncedContacts.find(sc => sc.registeredUserId === peerId) : undefined;

  const privacy = peer?.lastSeenPrivacy || 'everyone';
  const canSeePresence =
    privacy === 'everyone' || (privacy === 'contacts' && !!syncedMatch);

  return {
    id: conv.id,
    peerUserId: peerId,
    name: syncedMatch?.displayName || peer?.name || 'مستخدم',
    avatar: peer?.avatar || '',
    about: peer?.about || 'مرحباً! أستخدم WhatsApp Pro AI',
    phone: peer?.phone || '',
    email: peer?.email || (peer?.phone && peer.phone.includes('@') ? peer.phone : undefined) || syncedMatch?.email,
    isOnline: canSeePresence && peerId ? onlineUserIds.includes(peerId) : false,
    isTyping: !!typingMap[conv.id],
    lastSeen: canSeePresence && peer?.lastSeen ? `آخر ظهور ${peer.lastSeen}` : undefined,
    unreadCount,
    isPinned,
    isArchived,
    isMuted,
    isLocked,
    isFavorite,
    isBlocked,
    isSyncedContact: !!syncedMatch,
    savedContactName: syncedMatch?.displayName,
    disappearing: conv.disappearing || 'off',
    notificationTone,
    messages,
  };
}

export function mapServerStatus(st: any, currentUserId: string, users: UserAccount[] = []): StatusStory {
  const viewerIds: string[] = Array.isArray(st.viewedBy) ? st.viewedBy : [];
  const viewedByNames = viewerIds
    .filter(id => id !== st.userId)
    .map(id => users.find(u => u.id === id)?.name || id);
  const pinnedBy: string[] = Array.isArray(st.pinnedBy) ? st.pinnedBy : [];
  const isPinned = pinnedBy.includes(currentUserId);
  const inferredMediaType: 'text' | 'image' | 'video' =
    st.mediaType === 'video' || st.mediaType === 'image' || st.mediaType === 'text'
      ? st.mediaType
      : st.mediaUrl
      ? /\.(mp4|webm|mov|ogv|3gp)(\?|$)/i.test(st.mediaUrl) || String(st.mediaUrl).startsWith('data:video/')
        ? 'video'
        : 'image'
      : 'text';

  return {
    id: st.id,
    contactId: st.userId === currentUserId ? 'me' : st.userId,
    contactName: st.userId === currentUserId ? 'أنت' : st.userName,
    avatar: st.avatar || '',
    text: st.text,
    mediaUrl: st.mediaUrl,
    mediaType: inferredMediaType,
    videoDuration: typeof st.videoDuration === 'number' ? st.videoDuration : undefined,
    bgGradient: st.bgGradient,
    fontStyle: st.fontStyle || 'classic',
    privacy: st.privacy || 'everyone',
    isPinned,
    pinnedAt: isPinned ? st.pinnedTimestamps?.[currentUserId] || st.createdAt : undefined,
    reactions: Array.isArray(st.reactions)
      ? st.reactions.map((r: any) => ({
          emoji: r.emoji,
          count: Array.isArray(r.userIds) ? r.userIds.length : r.count || 1,
          byMe: Array.isArray(r.userIds) ? r.userIds.includes(currentUserId) : false,
        }))
      : [],
    timestamp: st.timestamp,
    createdAt: st.createdAt,
    expiresAt: st.expiresAt,
    isViewed: viewerIds.includes(currentUserId),
    viewsCount: viewerIds.length,
    viewedByNames,
  };
}

export function mapServerCall(cr: any, currentUserId: string, users: UserAccount[]): CallRecord {
  const isOutgoing = cr.callerId === currentUserId;
  const peerId = isOutgoing ? cr.calleeId : cr.callerId;
  const peer = users.find(u => u.id === peerId);

  return {
    id: cr.id,
    contactId: peerId,
    contactName: peer?.name || 'مستخدم',
    avatar: peer?.avatar || '',
    type: cr.type || 'voice',
    direction: cr.status === 'missed' || cr.status === 'rejected' ? 'missed' : isOutgoing ? 'outgoing' : 'incoming',
    timestamp: cr.timestamp,
    duration: cr.duration,
  };
}

function formatFollowersCount(total: number): string {
  if (total >= 1000000) return `${(total / 1000000).toFixed(1)} مليون متابع`;
  if (total >= 1000) return `${Math.round(total / 1000)} ألف متابع`;
  return `${total} متابع`;
}

export function mapServerChannel(ch: any, currentUserId: string): Channel {
  const followerIds: string[] = Array.isArray(ch.followerIds) ? ch.followerIds : [];
  const totalFollowers = (ch.baseFollowers || 0) + followerIds.length;
  return {
    id: ch.id,
    name: ch.name,
    avatar: ch.avatar || '',
    followers: formatFollowersCount(totalFollowers),
    verified: !!ch.verified,
    isFollowing: followerIds.includes(currentUserId),
    ownerId: ch.ownerId,
    posts: (ch.posts || []).map((p: any) => {
      const reactedBy: string[] = Array.isArray(p.reactedBy) ? p.reactedBy : [];
      return {
        id: p.id,
        text: p.text,
        timestamp: p.timestamp,
        reactions: (p.baseReactions || 0) + reactedBy.length,
        reacted: reactedBy.includes(currentUserId),
      };
    }),
  };
}

export function mapServerCommunity(com: any): Community {
  return {
    id: com.id,
    name: com.name,
    description: com.description,
    avatar: com.avatar || '',
    membersCount: Array.isArray(com.memberIds) ? com.memberIds.length : 1,
    groups: (com.groups || []).map((g: any) => ({
      id: g.id,
      conversationId: g.conversationId,
      name: g.name,
      lastMessage: g.lastMessage,
      time: g.time,
    })),
  };
}
