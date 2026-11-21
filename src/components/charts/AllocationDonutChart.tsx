import React from 'react';
import { formatCompactCurrency, formatCurrency, formatPercent } from '../../utils/format';

export interface AllocationSlice {
  label: string;
  value: number;
  color: string;
}

export const ELEVATE_CHART_PALETTE = [
  '#142A3B', // Navy
  '#1E8A78', // Teal
  '#D5A64A', // Gold
  '#3A6B88', // Steel Navy
  '#4CA697', // Soft Teal
  '#8C9BA5', // Slate Neutral
];

interface AllocationDonutChartProps {
  slices: AllocationSlice[];
  currency: string;
  centerLabel: string;
}

export function AllocationDonutChart({
  slices,
  currency,
  centerLabel,
}: AllocationDonutChartProps) {
  const valid = slices.filter((s) => s.value > 0);
  const total = valid.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  const size = 176;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0 w-[176px] h-[176px]">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`${centerLabel} breakdown chart`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#EEF2F5"
            strokeWidth={strokeWidth}
          />
          {valid.map((slice) => {
            const fraction = slice.value / total;
            const dashLength = fraction * circumference;
            const gapLength = circumference - dashLength;
            const strokeDashoffset = -cumulativeOffset;
            cumulativeOffset += dashLength;

            return (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${Math.max(0, dashLength - 1.5)} ${gapLength + 1.5}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <span className="text-[11px] font-medium text-[#627384]">{centerLabel}</span>
          <span className="text-base font-semibold text-[#142A3B] font-mono tabular-nums mt-0.5">
            {formatCompactCurrency(total, currency)}
          </span>
        </div>
      </div>

      <ul className="w-full flex-1 space-y-2.5 min-w-0">
        {valid.map((slice) => {
          const pct = (slice.value / total) * 100;
          return (
            <li
              key={slice.label}
              className="flex items-center justify-between gap-3 text-xs sm:text-sm py-1 border-b border-[#142A3B]/6 last:border-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden="true"
                />
                <span className="text-[#142A3B] font-medium truncate">
                  {slice.label}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                <span className="text-[#627384] text-xs">{formatPercent(pct)}</span>
                <span className="text-[#142A3B] font-medium">
                  {formatCurrency(slice.value, currency)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
