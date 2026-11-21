import React, { useState } from 'react';
import { formatCompactCurrency, formatCurrency, formatMonthLabel } from '../../utils/format';

export interface MonthlyFlowDatum {
  monthKey: string;
  income: number;
  expenses: number;
}

interface CashFlowBarChartProps {
  data: MonthlyFlowDatum[];
  currency: string;
}

export function CashFlowBarChart({ data, currency }: CashFlowBarChartProps) {
  const [activeMonth, setActiveMonth] = useState<string | null>(
    data.length > 0 ? data[data.length - 1].monthKey : null
  );

  if (data.length === 0) return null;

  const maxVal = Math.max(
    100,
    ...data.flatMap((d) => [d.income, d.expenses])
  );
  const niceMax = Math.ceil(maxVal / 500) * 500;

  const selected =
    data.find((d) => d.monthKey === activeMonth) ?? data[data.length - 1];

  const chartHeight = 190;
  const chartWidth = 540;
  const padLeft = 56;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 32;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;
  const groupW = plotW / data.length;
  const barW = Math.min(24, Math.max(10, groupW * 0.28));

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    val: niceMax * ratio,
    y: padTop + plotH * (1 - ratio),
  }));

  return (
    <div>
      {/* Selected month summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-[#142A3B]/8">
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-[#142A3B] font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#1E8A78]" aria-hidden="true" />
            Income
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#142A3B] font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#142A3B]" aria-hidden="true" />
            Expenses
          </span>
        </div>

        {selected && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#425466]">
            <span className="font-medium text-[#142A3B]">
              {formatMonthLabel(selected.monthKey)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-[#1E8A78]">
              In {formatCurrency(selected.income, currency)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-[#142A3B]">
              Out {formatCurrency(selected.expenses, currency)}
            </span>
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full min-w-[320px] h-auto"
          role="img"
          aria-label="Monthly income versus expenses bar chart"
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={t.y}
                x2={chartWidth - padRight}
                y2={t.y}
                stroke="#142A3B"
                strokeOpacity={i === 0 ? 0.18 : 0.07}
                strokeWidth="1"
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

          {data.map((d, idx) => {
            const centerX = padLeft + groupW * idx + groupW / 2;
            const incH = (d.income / niceMax) * plotH;
            const expH = (d.expenses / niceMax) * plotH;
            const isSelected = selected?.monthKey === d.monthKey;

            return (
              <g
                key={d.monthKey}
                onMouseEnter={() => setActiveMonth(d.monthKey)}
                onClick={() => setActiveMonth(d.monthKey)}
                className="cursor-pointer"
              >
                {/* Invisible wider hit zone for touch */}
                <rect
                  x={padLeft + groupW * idx}
                  y={padTop}
                  width={groupW}
                  height={plotH + padBottom}
                  fill={isSelected ? '#142A3B' : 'transparent'}
                  fillOpacity={isSelected ? 0.03 : 0}
                  rx="6"
                />
                {/* Income bar */}
                <rect
                  x={centerX - barW - 2}
                  y={padTop + plotH - incH}
                  width={barW}
                  height={Math.max(2, incH)}
                  rx="3"
                  fill="#1E8A78"
                  fillOpacity={isSelected ? 1 : 0.85}
                />
                {/* Expense bar */}
                <rect
                  x={centerX + 2}
                  y={padTop + plotH - expH}
                  width={barW}
                  height={Math.max(2, expH)}
                  rx="3"
                  fill="#142A3B"
                  fillOpacity={isSelected ? 1 : 0.82}
                />
                <text
                  x={centerX}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className={`text-[11px] ${
                    isSelected ? 'fill-[#142A3B] font-semibold' : 'fill-[#627384]'
                  }`}
                >
                  {formatMonthLabel(d.monthKey)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
