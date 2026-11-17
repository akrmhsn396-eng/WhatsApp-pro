import { CountryDialOption } from '../types';

export const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { code: 'SA', dial: '+966', name: 'المملكة العربية السعودية', flag: '🇸🇦', placeholder: '50 123 4567' },
  { code: 'EG', dial: '+20', name: 'مصر', flag: '🇪🇬', placeholder: '10 1234 5678' },
  { code: 'AE', dial: '+971', name: 'الإمارات العربية المتحدة', flag: '🇦🇪', placeholder: '50 123 4567' },
  { code: 'KW', dial: '+965', name: 'الكويت', flag: '🇰🇼', placeholder: '5001 2345' },
  { code: 'QA', dial: '+974', name: 'قطر', flag: '🇶🇦', placeholder: '3312 3456' },
  { code: 'BH', dial: '+973', name: 'البحرين', flag: '🇧🇭', placeholder: '3612 3456' },
  { code: 'OM', dial: '+968', name: 'عُمان', flag: '🇴🇲', placeholder: '9212 3456' },
  { code: 'JO', dial: '+962', name: 'الأردن', flag: '🇯🇴', placeholder: '7 9012 3456' },
  { code: 'LB', dial: '+961', name: 'لبنان', flag: '🇱🇧', placeholder: '71 123 456' },
  { code: 'PS', dial: '+970', name: 'فلسطين', flag: '🇵🇸', placeholder: '59 912 3456' },
  { code: 'IQ', dial: '+964', name: 'العراق', flag: '🇮🇶', placeholder: '770 123 4567' },
  { code: 'SY', dial: '+963', name: 'سوريا', flag: '🇸🇾', placeholder: '944 123 456' },
  { code: 'YE', dial: '+967', name: 'اليمن', flag: '🇾🇪', placeholder: '770 123 456' },
  { code: 'MA', dial: '+212', name: 'المغرب', flag: '🇲🇦', placeholder: '612 345 678' },
  { code: 'DZ', dial: '+213', name: 'الجزائر', flag: '🇩🇿', placeholder: '551 234 567' },
  { code: 'TN', dial: '+216', name: 'تونس', flag: '🇹🇳', placeholder: '20 123 456' },
  { code: 'LY', dial: '+218', name: 'ليبيا', flag: '🇱🇾', placeholder: '91 234 5678' },
  { code: 'SD', dial: '+249', name: 'السودان', flag: '🇸🇩', placeholder: '91 123 4567' },
  { code: 'TR', dial: '+90', name: 'تركيا', flag: '🇹🇷', placeholder: '501 234 5678' },
  { code: 'GB', dial: '+44', name: 'المملكة المتحدة', flag: '🇬🇧', placeholder: '7400 123456' },
  { code: 'US', dial: '+1', name: 'الولايات المتحدة', flag: '🇺🇸', placeholder: '415 555 0199' },
  { code: 'DE', dial: '+49', name: 'ألمانيا', flag: '🇩🇪', placeholder: '1512 3456789' },
  { code: 'FR', dial: '+33', name: 'فرنسا', flag: '🇫🇷', placeholder: '6 12 34 56 78' },
];

export function splitPhoneCountryAndLocal(fullPhone: string): { country: CountryDialOption; local: string } {
  const digitsOnly = (fullPhone || '').replace(/[^\d+]/g, '');
  const sorted = [...COUNTRY_DIAL_OPTIONS].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digitsOnly.startsWith(c.dial)) {
      return {
        country: c,
        local: digitsOnly.slice(c.dial.length),
      };
    }
  }
  return {
    country: COUNTRY_DIAL_OPTIONS[0],
    local: digitsOnly.replace(/^\+/, ''),
  };
}

export function getClientDeviceName(): string {
  if (typeof navigator === 'undefined') return 'متصفح الويب';
  const ua = navigator.userAgent.toLowerCase();
  let browser = 'متصفح الويب';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/') || ua.includes('crios/')) browser = 'Chrome';
  else if (ua.includes('firefox/') || ua.includes('fxios/')) browser = 'Firefox';
  else if (ua.includes('safari/')) browser = 'Safari';

  let os = 'Desktop';
  if (ua.includes('iphone')) os = 'iPhone';
  else if (ua.includes('ipad')) os = 'iPad';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macintosh')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';

  return `${browser} · ${os}`;
}
