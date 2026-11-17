/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NotificationToneId } from '../types';

export interface NotificationToneOption {
  id: NotificationToneId;
  name: string;
  description: string;
}

export const NOTIFICATION_TONES: NotificationToneOption[] = [
  { id: 'default', name: 'النغمة الافتراضية', description: 'نغمة الإشعارات القياسية للتطبيق' },
  { id: 'chime', name: 'رنين مزدوج', description: 'نغمتان صافيتان متصاعدتان' },
  { id: 'crystal', name: 'بلّور (Crystal)', description: 'وتر ثلاثي لامع وهادئ' },
  { id: 'pulse', name: 'نبض ذكي', description: 'إيقاع تنبيهي حديث وسريع' },
  { id: 'marimba', name: 'ماريمبا دافئة', description: 'نغمة موسيقية ناعمة متدرجة' },
  { id: 'aurora', name: 'أورورا (Aurora)', description: 'موجة صوتية مريحة للأذن' },
  { id: 'silent', name: 'صامت (بدون صوت)', description: 'تعطيل الصوت لهذه المحادثة فقط' },
];

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function scheduleNote(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  wave: OscillatorType = 'sine',
  peakGain = 0.09
) {
  const start = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playNotificationTone(
  toneId: NotificationToneId = 'default',
  direction: 'send' | 'receive' = 'receive'
) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (direction === 'send') {
      scheduleNote(ctx, 620, 0, 0.18, 'sine', 0.07);
      return;
    }

    switch (toneId) {
      case 'silent':
        return;

      case 'chime':
        scheduleNote(ctx, 587.33, 0, 0.16, 'sine', 0.09); // D5
        scheduleNote(ctx, 880, 0.11, 0.24, 'sine', 0.1); // A5
        return;

      case 'crystal':
        scheduleNote(ctx, 659.25, 0, 0.14, 'triangle', 0.08); // E5
        scheduleNote(ctx, 830.61, 0.08, 0.15, 'triangle', 0.08); // G#5
        scheduleNote(ctx, 987.77, 0.16, 0.26, 'sine', 0.09); // B5
        return;

      case 'pulse':
        scheduleNote(ctx, 523.25, 0, 0.09, 'square', 0.035); // C5
        scheduleNote(ctx, 783.99, 0.1, 0.14, 'sine', 0.09); // G5
        return;

      case 'marimba':
        scheduleNote(ctx, 440, 0, 0.14, 'sine', 0.1); // A4
        scheduleNote(ctx, 554.37, 0.09, 0.15, 'sine', 0.1); // C#5
        scheduleNote(ctx, 659.25, 0.18, 0.22, 'sine', 0.09); // E5
        return;

      case 'aurora':
        scheduleNote(ctx, 392, 0, 0.28, 'sine', 0.07); // G4
        scheduleNote(ctx, 587.33, 0.06, 0.34, 'triangle', 0.06); // D5
        return;

      case 'default':
      default:
        scheduleNote(ctx, 480, 0, 0.22, 'triangle', 0.08);
        return;
    }
  } catch {
    // ignore audio autoplay restrictions
  }
}

export function getToneLabel(toneId?: NotificationToneId): string {
  const found = NOTIFICATION_TONES.find(t => t.id === (toneId || 'default'));
  return found ? found.name : 'النغمة الافتراضية';
}
