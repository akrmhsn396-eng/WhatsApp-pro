/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatContact, StatusStory, CallRecord, Channel, Community, AppSettings } from '../types';

export const ASSET_IMAGES = {
  profile: '/src/assets/images/avatar_profile_1794862075961.jpg',
  ahmad: '/src/assets/images/avatar_ahmad_1794862077027.jpg',
  fatima: '/src/assets/images/avatar_fatima_1794862076851.jpg',
  omar: '/src/assets/images/avatar_omar_1794862076939.jpg',
  devsGroup: '/src/assets/images/avatar_group_devs_1794862076550.jpg',
  sunset: '/src/assets/images/status_sunset_1794862078473.jpg',
};

export const INITIAL_PROFILE = {
  name: '',
  about: 'مرحباً! أستخدم WhatsApp Pro',
  phone: '',
  avatar: '',
};

export const INITIAL_SETTINGS: AppSettings = {
  darkMode: true,
  readReceipts: true,
  soundsEnabled: true,
  enterToSend: true,
  lastSeenPrivacy: 'everyone',
  wallpaper: 'default',
  chatLockPin: '0000',
  autoSyncContacts: true,
};

export const INITIAL_CONTACTS: ChatContact[] = [];

export const INITIAL_STATUSES: StatusStory[] = [];

export const INITIAL_CHANNELS: Channel[] = [];

export const INITIAL_COMMUNITIES: Community[] = [];

export const INITIAL_CALLS: CallRecord[] = [];

