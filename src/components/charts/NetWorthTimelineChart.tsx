import React from 'react';
import { ValuationSnapshot } from '../../types/finance';
import { formatCompactCurrency, formatCurrency, formatDateShort } from '../../utils/format';

interface NetWorthTimelineChartProps {
  snapshots: ValuationSnapshot[];
  currency: string;
}

export function NetWorthTimelineChart({
  snapshots,
  currency,
}: NetWorthTimelineChartProps) {
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const totals = sorted.map((s) => s.totalInvestedValue + s.totalCashValue);
  const minVal = Math.min(...totals);
  const maxVal = Math.max(...totals);
  const padRange = maxVal === minVal ? Math.max(1000, maxVal * 0.2) : (maxVal - minVal) * 0.15;
  const yMin = Math.max(0, minVal - padRange);
  const yMax = maxVal + padRange;

  const w = 540;
  const h = 180;
  const padLeft = 56;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 30;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const points = sorted.map((s, idx) => {
    const total = s.totalInvestedValue + s.totalCashValue;
    const x =
      sorted.length === 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (sorted.length - 1)) * plotW;
    const y = padTop + plotH - ((total - yMin) / Math.max(1, yMax - yMin)) * plotH;
    return { x, y, total, snap: s };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const yTicks = [0, 0.5, 1].map((r) => ({
    val: yMin + (yMax - yMin) * r,
    y: padTop + plotH * (1 - r),
  }));

  const latest = points[points.length - 1];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#142A3B]/8 text-xs">
        <span className="text-[#425466]">
          Plotted from {sorted.length} user-recorded snapshot{sorted.length === 1 ? '' : 's'}
        </span>
        <span className="font-mono tabular-nums font-medium text-[#142A3B]">
          Latest: {formatCurrency(latest.total, currency)} ({formatDateShort(latest.snap.date)})
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full min-w-[320px] h-auto"
          role="img"
          aria-label="User-recorded net worth snapshots timeline"
        >
          <defs>
            <linearGradient id="elevateAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E8A78" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#1E8A78" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={t.y}
                x2={w - padRight}
                y2={t.y}
                stroke="#142A3B"
                strokeOpacity={idx === 0 ? 0.16 : 0.07}
              />
              <text
                x={padLeft - 8}
                y={t.y + 4}
                textAnchor="end"
                className="fill-[#627384] text-[10px] font-mono"
              >
                {formatCompactCurrency(t.val, currency)}
              </text>
            </g>
          ))}

          {areaPath && <path d={areaPath} fill="url(#elevateAreaGrad)" />}
          {points.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="#1E8A78"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {points.map((p) => (
            <g key={p.snap.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#FFFFFF"
                stroke="#142A3B"
                strokeWidth="2"
              />
              <text
                x={p.x}
                y={h - 8}
                textAnchor="middle"
                className="fill-[#627384] text-[10px]"
              >
                {p.snap.date.slice(5)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
