import React from 'react';
import { formatHijriDate } from '../utils/formatters';

export const RubElHizbMark: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
        <rect x="6.5" y="6.5" width="19" height="19" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect
            x="6.5"
            y="6.5"
            width="19"
            height="19"
            rx="1.5"
            transform="rotate(45 16 16)"
            stroke="currentColor"
            strokeWidth="1.5"
        />
        <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
);

export const HijriDateLine: React.FC<{ className?: string }> = ({ className = '' }) => {
    const hijri = formatHijriDate();
    const miladi = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date());

    return (
        <span className={`tabular ${className}`}>
            {hijri ? `${hijri} · ${miladi}` : miladi}
        </span>
    );
};