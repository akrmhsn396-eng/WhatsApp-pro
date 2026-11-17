/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import firebaseAppletConfig from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  projectId: firebaseAppletConfig.projectId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  appId: firebaseAppletConfig.appId,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
auth.languageCode = 'ar';
export const googleProvider = new GoogleAuthProvider();

function mapFirebaseAuthError(err: any, fallback: string): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صالحة.';
    case 'auth/missing-email':
      return 'يرجى إدخال البريد الإلكتروني أولاً.';
    case 'auth/user-not-found':
      return 'لا يوجد حساب Firebase مسجل بهذا البريد الإلكتروني.';
    case 'auth/too-many-requests':
      return 'تم إرسال عدة طلبات متكررة. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بخدمة المصادقة. تحقق من اتصال الإنترنت.';
    case 'auth/operation-not-allowed':
      return 'مزود البريد الإلكتروني/كلمة المرور غير مفعّل حالياً في Firebase Console لهذا المشروع.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    default:
      return err?.message || fallback;
  }
}

export async function signInWithGooglePopup() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'مستخدم جوجل',
        photoURL: user.photoURL || '',
      },
    };
  } catch (err: any) {
    console.error('Google sign-in error:', err);
    return {
      success: false,
      error: mapFirebaseAuthError(err, 'فشل تسجيل الدخول عبر حساب جوجل'),
    };
  }
}

export async function sendPasswordReset(email: string): Promise<{
  success: boolean;
  error?: string;
  code?: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return {
      success: false,
      code: 'auth/invalid-email',
      error: 'يرجى إدخال عنوان بريد إلكتروني صحيح.',
    };
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return { success: true };
  } catch (err: any) {
    console.error('Firebase sendPasswordResetEmail error:', err);
    return {
      success: false,
      code: err?.code,
      error: mapFirebaseAuthError(err, 'تعذر إرسال رابط إعادة تعيين كلمة المرور.'),
    };
  }
}

export async function signInWithFirebaseEmail(
  email: string,
  password: string
): Promise<{
  success: boolean;
  idToken?: string;
  user?: { uid: string; email: string; displayName: string; photoURL: string };
  error?: string;
}> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const idToken = await cred.user.getIdToken();
    return {
      success: true,
      idToken,
      user: {
        uid: cred.user.uid,
        email: cred.user.email || email.trim().toLowerCase(),
        displayName: cred.user.displayName || '',
        photoURL: cred.user.photoURL || '',
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapFirebaseAuthError(err, 'فشل التحقق عبر Firebase Auth'),
    };
  }
}

export async function registerWithFirebaseEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    if (displayName && displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() }).catch(() => {});
    }
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.code || err?.message,
    };
  }
}
