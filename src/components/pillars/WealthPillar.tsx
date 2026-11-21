import React, { useMemo, useState } from 'react';
import {
  Camera,
  Edit3,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { AssetClass, InvestmentHolding } from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import {
  formatCurrency,
  formatDateShort,
  formatPercent,
  getTodayISO,
} from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ModalSheet } from '../ui/ModalSheet';
import {
  AllocationDonutChart,
  ELEVATE_CHART_PALETTE,
} from '../charts/AllocationDonutChart';
import { NetWorthTimelineChart } from '../charts/NetWorthTimelineChart';

const ASSET_CLASSES: AssetClass[] = [
  'Equities & Index Funds',
  'Fixed Income & Bonds',
  'Cash & Treasury',
  'Real Estate',
  'Alternative / Other',
];

export function WealthPillar() {
  const {
    workspace,
    totalPortfolioValue,
    totalPortfolioCost,
    portfolioUnrealizedGain,
    portfolioReturnPct,
    totalTrackedNetWorth,
    addHolding,
    updateHolding,
    deleteHolding,
    recordSnapshot,
    deleteSnapshot,
  } = useElevate();

  const currency = workspace.currency;

  const [holdingModalOpen, setHoldingModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<InvestmentHolding | null>(
    null
  );
  const [snapshotNote, setSnapshotNote] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>(
    'Equities & Index Funds'
  );
  const [accountLabel, setAccountLabel] = useState('');
  const [units, setUnits] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [valuedAt, setValuedAt] = useState(getTodayISO());

  const openNewHolding = () => {
    setEditingHolding(null);
    setName('');
    setSymbol('');
    setAssetClass('Equities & Index Funds');
    setAccountLabel('');
    setUnits('');
    setCostBasis('');
    setCurrentValue('');
    setValuedAt(getTodayISO());
    setHoldingModalOpen(true);
  };

  const openEditHolding = (h: InvestmentHolding) => {
    setEditingHolding(h);
    setName(h.name);
    setSymbol(h.symbol ?? '');
    setAssetClass(h.assetClass);
    setAccountLabel(h.accountLabel);
    setUnits(String(h.units));
    setCostBasis(String(h.costBasis));
    setCurrentValue(String(h.currentValue));
    setValuedAt(h.valuedAt || getTodayISO());
    setHoldingModalOpen(true);
  };

  const handleSaveHolding = (e: React.FormEvent) => {
    e.preventDefault();
    const numCost = parseFloat(costBasis) || 0;
    const numVal = parseFloat(currentValue);
    const numUnits = parseFloat(units) || 0;
    if (!name.trim() || !Number.isFinite(numVal) || numVal < 0) return;

    const payload = {
      name: name.trim(),
      symbol: symbol.trim().toUpperCase() || undefined,
      assetClass,
      accountLabel: accountLabel.trim() || 'Investment Account',
      units: Math.max(0, numUnits),
      costBasis: Math.max(0, numCost),
      currentValue: Math.max(0, numVal),
      valuedAt: valuedAt || getTodayISO(),
    };

    if (editingHolding) {
      updateHolding(editingHolding.id, payload);
    } else {
      addHolding(payload);
    }
    setHoldingModalOpen(false);
  };

  const allocationSlices = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const h of workspace.holdings) {
      grouped.set(h.assetClass, (grouped.get(h.assetClass) ?? 0) + h.currentValue);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({
        label,
        value,
        color: ELEVATE_CHART_PALETTE[i % ELEVATE_CHART_PALETTE.length],
      }));
  }, [workspace.holdings]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#1E8A78]">
            Elevate Wealth · Investment Tracker
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            Portfolio holdings & valuation log
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            All holdings use your own confirmed statement valuations and cost basis — zero simulated or fabricated market prices.
          </p>
        </div>

        <Button variant="secondary" onClick={openNewHolding}>
          <Plus className="w-4 h-4" />
          <span>Add Holding</span>
        </Button>
      </div>

      {/* KPI Strip */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#142A3B]/10">
          <div className="sm:pr-4">
            <StatMetric
              label="Confirmed Portfolio Value"
              value={formatCurrency(totalPortfolioValue, currency)}
              detail={`${workspace.holdings.length} tracked position${workspace.holdings.length === 1 ? '' : 's'}`}
            />
          </div>
          <div className="pt-5 sm:pt-0 sm:px-4">
            <StatMetric
              label="Total Cost Basis"
              value={formatCurrency(totalPortfolioCost, currency)}
              detail="Entered principal invested"
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:px-4">
            <StatMetric
              label="Unrealized Gain / Loss"
              value={formatCurrency(portfolioUnrealizedGain, currency)}
              tone={
                portfolioUnrealizedGain > 0
                  ? 'teal'
                  : portfolioUnrealizedGain < 0
                    ? 'negative'
                    : 'default'
              }
              detail={`${formatPercent(portfolioReturnPct, true)} vs. entered cost basis`}
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:pl-4">
            <StatMetric
              label="Combined Net Worth"
              value={formatCurrency(totalTrackedNetWorth, currency)}
              detail="Flow net cash + Wealth holdings"
            />
          </div>
        </div>
      </Card>

      {/* Allocation & Net Worth Snapshots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Asset Class Allocation"
            subtitle="Based on your most recently confirmed valuations"
          />
          {allocationSlices.length > 0 ? (
            <AllocationDonutChart
              slices={allocationSlices}
              currency={currency}
              centerLabel="Portfolio"
            />
          ) : (
            <EmptyState
              icon={<TrendingUp className="w-5 h-5" />}
              title="No holdings logged yet"
              description="Record an equity fund, bond holding, treasury bill, or property stake to view your allocation."
              actionLabel="Add First Holding"
              onAction={openNewHolding}
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Net Worth Snapshots"
            subtitle="Record point-in-time checkpoints of your cash + invested position"
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              recordSnapshot(snapshotNote);
              setSnapshotNote('');
            }}
            className="flex flex-col sm:flex-row gap-2.5 mb-5"
          >
            <input
              type="text"
              value={snapshotNote}
              onChange={(e) => setSnapshotNote(e.target.value)}
              placeholder="Snapshot note (e.g., Q4 statement review)"
              className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            />
            <Button type="submit" variant="primary" size="md">
              <Camera className="w-4 h-4" />
              <span>Record Snapshot</span>
            </Button>
          </form>

          {workspace.snapshots.length > 0 ? (
            <div className="space-y-4">
              <NetWorthTimelineChart
                snapshots={workspace.snapshots}
                currency={currency}
              />
              <ul className="divide-y divide-[#142A3B]/8 text-xs">
                {[...workspace.snapshots]
                  .reverse()
                  .slice(0, 4)
                  .map((s) => (
                    <li
                      key={s.id}
                      className="py-2 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-[#142A3B]">
                          {formatDateShort(s.date)}
                        </span>
                        <span className="text-[#627384] ml-2">{s.note}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                          {formatCurrency(
                            s.totalCashValue + s.totalInvestedValue,
                            currency
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteSnapshot(s.id)}
                          aria-label={`Delete snapshot from ${s.date}`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#627384] hover:text-[#B42318] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              icon={<Camera className="w-5 h-5" />}
              title="No snapshots recorded"
              description="Click Record Snapshot above whenever you reconcile statements to build an accurate net worth history."
            />
          )}
        </Card>
      </div>

      {/* Holdings Register */}
      <Card>
        <CardHeader
          title="Holdings Register"
          subtitle="Click edit on any holding to update its confirmed valuation date and amount"
        />

        {workspace.holdings.length > 0 ? (
          <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-[#142A3B]/10 text-xs font-medium text-[#627384]">
                  <th className="py-2.5 pr-4">Holding</th>
                  <th className="py-2.5 pr-4">Asset Class</th>
                  <th className="py-2.5 pr-4 text-right">Units</th>
                  <th className="py-2.5 pr-4 text-right">Cost Basis</th>
                  <th className="py-2.5 pr-4 text-right">Confirmed Value</th>
                  <th className="py-2.5 pr-4 text-right">Gain / Loss</th>
                  <th className="py-2.5 pr-4">Valued Date</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#142A3B]/8 text-sm">
                {workspace.holdings.map((h) => {
                  const diff = h.currentValue - h.costBasis;
                  const pct = h.costBasis > 0 ? (diff / h.costBasis) * 100 : 0;
                  return (
                    <tr key={h.id} className="hover:bg-[#F7F9FA]/70 transition-colors">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-[#142A3B]">
                          {h.name}
                          {h.symbol ? ` (${h.symbol})` : ''}
                        </p>
                        <p className="text-xs text-[#627384]">{h.accountLabel}</p>
                      </td>
                      <td className="py-3 pr-4 text-xs text-[#425466]">
                        {h.assetClass}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums text-[#425466]">
                        {h.units > 0 ? h.units.toLocaleString('en-US') : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums text-[#425466]">
                        {formatCurrency(h.costBasis, currency)}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-[#142A3B]">
                        {formatCurrency(h.currentValue, currency)}
                      </td>
                      <td
                        className={`py-3 pr-4 text-right font-mono tabular-nums text-xs font-semibold ${
                          diff > 0
                            ? 'text-[#1E8A78]'
                            : diff < 0
                              ? 'text-[#B42318]'
                              : 'text-[#425466]'
                        }`}
                      >
                        {formatCurrency(diff, currency)} ({formatPercent(pct, true)})
                      </td>
                      <td className="py-3 pr-4 text-xs font-mono tabular-nums text-[#627384] whitespace-nowrap">
                        {formatDateShort(h.valuedAt)}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditHolding(h)}
                          aria-label={`Edit ${h.name}`}
                          className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-[#425466] hover:text-[#142A3B] hover:bg-[#142A3B]/5 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteHolding(h.id)}
                          aria-label={`Delete ${h.name}`}
                          className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-[#627384] hover:text-[#B42318] hover:bg-[#B42318]/8 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<TrendingUp className="w-5 h-5" />}
            title="Your holdings register is empty"
            description="Add your investment positions using figures from your brokerage or retirement statements."
            actionLabel="Add Holding"
            onAction={openNewHolding}
          />
        )}
      </Card>

      {/* Holding Modal */}
      <ModalSheet
        open={holdingModalOpen}
        onClose={() => setHoldingModalOpen(false)}
        title={editingHolding ? 'Update Holding Valuation' : 'Add Investment Holding'}
        subtitle="Enter statement-confirmed cost basis and current value."
      >
        <form onSubmit={handleSaveHolding} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Holding Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Total Market Index Fund"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Ticker / Ref
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="Optional"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Asset Class
              </label>
              <select
                value={assetClass}
                onChange={(e) => setAssetClass(e.target.value as AssetClass)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                {ASSET_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Account / Custodian Label
              </label>
              <input
                type="text"
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
                placeholder="e.g., Retirement Account"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Units / Shares
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="0"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Cost Basis ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={costBasis}
                onChange={(e) => setCostBasis(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Confirmed Value ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
              Valuation Confirmation Date
            </label>
            <input
              type="date"
              required
              value={valuedAt}
              onChange={(e) => setValuedAt(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setHoldingModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary">
              {editingHolding ? 'Save Valuation' : 'Add Holding'}
            </Button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
}
