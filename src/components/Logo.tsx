import React from 'react';

export function Logo({ className = '', size = 32 }: { className?: string, size?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 64 64" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="64" height="64" rx="16" fill="url(#emerald-gradient)" />
      
      {/* Mazar-e-Quaid Illustration */}
      <g transform="translate(0, 5)">
        {/* Sky Elements: Crescent and Star */}
        <path d="M42 16 C40 18 36 18 34 16 C34 20 38 24 42 22 C44 21 44 17 42 16 Z" fill="#D1FAE5" />
        <polygon points="46,14 47,16 49,16 47.5,17.5 48,19.5 46.5,18.5 45,19.5 45.5,17.5 44,16 46,16" fill="#D1FAE5" />
        
        {/* Base Steps */}
        <path d="M12 46 L52 46 L52 48 L12 48 Z" fill="white" />
        <path d="M16 44 L48 44 L48 46 L16 46 Z" fill="#F3F4F6" />
        
        {/* Main Building (Sloped walls) */}
        <path d="M22 28 L42 28 L46 44 L18 44 Z" fill="white" />
        
        {/* Golden Arch / Doorway */}
        <path d="M28 44 L28 36 C28 32 36 32 36 36 L36 44 Z" fill="#047857" />
        <path d="M30 44 L30 36.5 C30 34 34 34 34 36.5 L34 44 Z" fill="#10B981" />
        
        {/* Dome (Semicircle / pointed) */}
        <path d="M22 28 C22 14 42 14 42 28 Z" fill="white" />
      </g>

      <defs>
        <linearGradient id="emerald-gradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
    </svg>
  );
}
