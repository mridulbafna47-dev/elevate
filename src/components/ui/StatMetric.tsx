import React from 'react';

interface StatMetricProps {
  label: string;
  value: string;
  detail?: string;
  tone?: 'default' | 'teal' | 'gold' | 'negative';
  className?: string;
}

export function StatMetric({
  label,
  value,
  detail,
  tone = 'default',
  className = '',
}: StatMetricProps) {
  const valueTone = {
    default: 'text-[#142A3B]',
    teal: 'text-[#1E8A78]',
    gold: 'text-[#946C1B]',
    negative: 'text-[#B42318]',
  }[tone];

  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-xs font-medium text-[#425466] truncate">{label}</p>
      <p
        className={`mt-1.5 text-2xl sm:text-[28px] font-semibold tracking-tight font-mono tabular-nums truncate ${valueTone}`}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-1 text-xs text-[#627384] leading-snug">{detail}</p>
      )}
    </div>
  );
}
