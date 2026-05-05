import React from 'react';

/** 
 * Custom SVG icon: Hammer and Hand-Saw 
 * Representing the Formwork trade
 */
export function HammerSawIcon({ className = "w-6 h-6", color = "currentColor" }: { className?: string, color?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      {/* Hand Saw */}
      <path d="M14 4l8 8-3 3-8-8z" />
      <path d="M12 6l-9 9 1 1.5 2-1 1 1.5 2-1 1 1.5 2-1 1 1.5" />
      <path d="M22 12l-1 1" />
      <path d="M14 4h-2a2 2 0 0 0-2 2v2" />
      {/* Hammer Header (integrated) - Lucide Hammer base */}
      <path d="M18.42 13.59l2.32-2.32a2.14 2.14 0 0 0 0-3l-2.1-2.1a2.14 2.14 0 0 0-3 0l-2.32 2.32" />
      <path d="M14.67 11.04l-3.9 3.9" />
      <path d="M10.5 11.5l1 1" />
      <path d="M13.5 8.5l1 1" />
      <path d="M9 19c-1.5 0-2.5-1.5-2.5-1.5s1.5-1 1.5-2.5" />
    </svg>
  );
}

/**
 * Custom SVG icon: Steel Fixing Nips (End-Cutting Pliers)
 * Representing the Reinforcement trade
 */
export function SteelNipsIcon({ className = "w-6 h-6", color = "currentColor" }: { className?: string, color?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      {/* Handle 1 */}
      <path d="M19 21c-2-2-3-5-3-9" />
      {/* Handle 2 */}
      <path d="M5 21c2-2 3-5 3-9" />
      {/* Head - Pliers jaw */}
      <path d="M8 12c.5-3 1-5 4-5s3.5 2 4 5" />
      <path d="M8 8s1-1 4-1 4 1 4 1" />
      {/* The cutting edge pivot */}
      <circle cx="12" cy="11" r="1.5" fill={color} />
      {/* Jaw detail */}
      <path d="M9 7l6 0" />
      <path d="M12 7l0-2" />
    </svg>
  );
}
