import React from 'react';
import { WeaponId } from '../game/weapons';

export const WeaponSvgIcon: React.FC<{ weaponId: WeaponId; className?: string }> = ({
  weaponId,
  className = 'w-6 h-6',
}) => {
  switch (weaponId) {
    case 'ar':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M2 12h18l2 2h-4l-1 4h-3l.5-4H9l-1.5 5H5l1-5H2v-2Z" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M6 10h8v2H6v-2Z" fill="#38bdf8" />
        </svg>
      );
    case 'sniper':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M1 13h22v1.8H11l-1.5 4.2H7l1-4.2H2L1 13Z" fill="#0f172a" stroke="#a855f7" strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="7" y="9" width="7" height="2.4" rx="1" fill="#a855f7" />
        </svg>
      );
    case 'shotgun':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M2 12h19v2.5H12v1.5H7l-2 3.5H2.5L4 14.5H2V12Z" fill="#0f172a" stroke="#f97316" strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="11" y="14.2" width="6" height="1.8" fill="#f97316" />
        </svg>
      );
    case 'burst':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M2 12.5h18l2 1.5h-5l-1 4.5h-2.5l.5-4.5H8.5L7 18.5H4.5l1-4.5H2v-1.5Z" fill="#0f172a" stroke="#2dd4bf" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 9.5h5l1 2H7l1-2Z" fill="#2dd4bf" />
        </svg>
      );
    case 'revolver':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4 11h15v3h-7l-1.5 5.5H7L8.5 14H4v-3Z" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="10.5" cy="12.5" r="1.8" fill="#fbbf24" />
        </svg>
      );
    case 'uzi':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M5 10h13v3.5h-4v6.5h-2.8v-6.5H8.5l-1 4.5H5v-8Z" fill="#0f172a" stroke="#60a5fa" strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="8" y="8" width="6" height="1.8" fill="#60a5fa" />
        </svg>
      );
    case 'flare':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M5 11h12l2-1v5l-2-1H10l-1.5 5H6l1-5H5v-3Z" fill="#0f172a" stroke="#fb7185" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="19.5" cy="12.5" r="2" fill="#fb7185" />
        </svg>
      );
    case 'katana':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4 20L8.5 15.5M7 14l2.5 2.5M8.2 15.2L19.5 3.8c.8-.8 1.5-.3 1 1L9.5 16.5" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'scythe':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M6 20L17 5c-4-1.5-8.5 0-11 4.5 3.5-1.2 6.8-1 9.5.5" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'fists':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="5" y="7" width="14" height="10" rx="3" fill="#0f172a" stroke="#facc15" strokeWidth="1.8" />
          <path d="M8 7v4m3-4v4m3-4v4m3-4v4" stroke="#facc15" strokeWidth="1.5" />
        </svg>
      );
    case 'grenade':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <ellipse cx="12" cy="14" rx="5.5" ry="6.5" fill="#0f172a" stroke="#4ade80" strokeWidth="1.8" />
          <path d="M10 7.5h4V5h3" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'medkit':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="7" width="16" height="12" rx="2.5" fill="#0f172a" stroke="#10b981" strokeWidth="1.8" />
          <path d="M12 10v6m-3-3h6" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'molotov':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M9 10l1-4h4l1 4 2 3v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-6l2-3Z" fill="#0f172a" stroke="#f97316" strokeWidth="1.8" />
          <path d="M12 2c1.5 1.5 2 3 0 4-1.5-1-1-2.5 0-4Z" fill="#f97316" />
        </svg>
      );
    case 'tripmine':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <polygon points="12,3 21,12 12,21 3,12" fill="#0f172a" stroke="#e879f9" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3" fill="#e879f9" />
        </svg>
      );
  }
};
