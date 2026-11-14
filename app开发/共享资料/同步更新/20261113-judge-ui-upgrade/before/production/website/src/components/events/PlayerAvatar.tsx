'use client';

import { useState } from 'react';

export default function PlayerAvatar({ name, src, size = 'small' }: { name: string; src: string; size?: 'small' | 'medium' | 'large' }) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().slice(0, 1) || '选';

  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-crimson/15 to-gold/30 font-bold text-crimson ring-1 ring-sand/60 ${size === 'large' ? 'h-28 w-28 text-4xl md:h-32 md:w-32' : size === 'medium' ? 'h-16 w-16 text-xl' : 'h-10 w-10 text-sm'}`}>
      {initial}
      {src && !failed ? (
        <img
          src={src}
          alt={`${name}头像`}
          className="absolute inset-0 h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}
