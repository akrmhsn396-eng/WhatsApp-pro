/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, Users } from 'lucide-react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  isAI?: boolean;
  isGroup?: boolean;
  ringColor?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  isOnline,
  isAI,
  isGroup,
  ringColor,
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-24 h-24 text-2xl',
  }[size];

  const dotSize = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
    xl: 'w-5 h-5',
  }[size];

  if (isAI) {
    return (
      <div className={`relative shrink-0 ${ringColor || ''}`}>
        <div
          className={`${sizeClasses} rounded-full bg-gradient-to-tr from-[#00a884] via-teal-500 to-sky-500 flex items-center justify-center text-white shadow-sm`}
        >
          <Sparkles className={size === 'xl' ? 'w-10 h-10' : 'w-5 h-5'} />
        </div>
        {isOnline && (
          <span className={`absolute bottom-0 left-0 ${dotSize} bg-emerald-500 border-2 border-white dark:border-[#111b21] rounded-full`} />
        )}
      </div>
    );
  }

  return (
    <div className={`relative shrink-0 ${ringColor || ''}`}>
      {src && !imgError ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`${sizeClasses} rounded-full object-cover bg-slate-200 dark:bg-slate-700`}
        />
      ) : (
        <div
          className={`${sizeClasses} rounded-full bg-emerald-600/20 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center`}
        >
          {isGroup ? <Users className="w-5 h-5" /> : name.trim().charAt(0)}
        </div>
      )}
      {isOnline && (
        <span className={`absolute bottom-0 left-0 ${dotSize} bg-emerald-500 border-2 border-white dark:border-[#111b21] rounded-full`} />
      )}
    </div>
  );
};
