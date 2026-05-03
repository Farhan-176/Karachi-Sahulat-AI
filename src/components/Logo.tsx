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
      
      {/* Mazar-e-Quaid Silhouette */}
      <g transform="translate(0, 4)">
        {/* Base Steps */}
        <rect x="16" y="44" width="32" height="2" fill="white" />
        <rect x="14" y="46" width="36" height="2" fill="white" />
        
        {/* Main Building (Sloped walls) */}
        <path d="M22 28 L42 28 L46 44 L18 44 Z" fill="white" />
        
        {/* Archway inside building */}
        <path d="M28 44 L28 36 C28 34 36 34 36 36 L36 44 Z" fill="#047857" />
        
        {/* Dome */}
        <path d="M22 28 C22 20 42 20 42 28 Z" fill="white" />
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
