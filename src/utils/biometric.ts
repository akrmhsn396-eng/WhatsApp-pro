export interface BiometricSetupResult {
  success: boolean;
  credentialId?: string;
  error?: string;
}

export function isBiometricSupported(): boolean {
  return typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function';
}

export async function registerBiometric(username = 'WhatsApp Pro User'): Promise<BiometricSetupResult> {
  if (!isBiometricSupported()) {
    return { success: false, error: 'التحقق البيومتري (WebAuthn) غير مدعوم في هذا المتصفح' };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'WhatsApp Pro AI',
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      timeout: 60000,
      attestation: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        requireResidentKey: false,
      },
    };

    const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
    if (!credential) {
      return { success: false, error: 'فشل إنشاء بيانات الاعتماد البيومترية' };
    }

    const rawId = Array.from(new Uint8Array(credential.rawId))
      .map(b => String.fromCharCode(b))
      .join('');
    const credentialIdB64 = btoa(rawId);

    return { success: true, credentialId: credentialIdB64 };
  } catch (err: any) {
    console.error('Biometric registration error:', err);
    return { success: false, error: err?.message || 'تم إلغاء عملية التسجيل البيومتري أو فشلت' };
  }
}

export async function authenticateBiometric(credentialIdB64?: string): Promise<{ success: boolean; error?: string }> {
  if (!isBiometricSupported()) {
    return { success: false, error: 'التحقق البيومتري غير مدعوم في هذا المتصفح' };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    let allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (credentialIdB64) {
      try {
        const binStr = atob(credentialIdB64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        allowCredentials = [{
          id: bytes.buffer,
          type: 'public-key',
          transports: ['internal'],
        }];
      } catch {
        // ignore malformed b64
      }
    }

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      rpId: window.location.hostname,
    };

    const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
    if (!assertion) {
      return { success: false, error: 'فشل التحقق البيومتري' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Biometric authentication error:', err);
    return { success: false, error: err?.message || 'تم إلغاء المصادقة البيومترية أو لم تتطابق البصمة/الوجه' };
  }
}
