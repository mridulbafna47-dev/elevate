import React from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { Button } from './Button';

interface ProFeatureGateProps {
  title: string;
  description: string;
  onComparePlans: () => void;
  ctaLabel?: string;
}

export function ProFeatureGate({
  title,
  description,
  onComparePlans,
  ctaLabel = 'Compare Plans · Elevate Pro (₹199/mo)',
}: ProFeatureGateProps) {
  return (
    <div className="p-5 sm:p-6 rounded-xl border border-[#142A3B]/12 bg-[#F7F9FA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-white border border-[#142A3B]/10 flex items-center justify-center text-[#946C1B] shrink-0">
          <Lock className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#946C1B]">
            Included in Elevate Pro · ₹199/month
          </p>
          <h3 className="text-sm font-semibold text-[#142A3B] mt-0.5">
            {title}
          </h3>
          <p className="text-xs text-[#425466] mt-1 leading-relaxed max-w-2xl">
            {description}
          </p>
        </div>
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={onComparePlans}
        className="shrink-0"
      >
        <span>{ctaLabel}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
