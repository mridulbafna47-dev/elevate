import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl bg-[#B42318]/8 border border-[#B42318]/25 text-xs sm:text-sm text-[#B42318]"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <p className="leading-relaxed font-medium">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-[#B42318]/10 shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function FlowLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading financial workspace">
      <div className="bg-white border border-[#142A3B]/10 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2.5">
            <div className="h-3 w-24 rounded bg-[#E5EBF0]" />
            <div className="h-7 w-32 rounded bg-[#D7E0E7]" />
            <div className="h-3 w-40 rounded bg-[#EEF2F5]" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#142A3B]/10 rounded-2xl p-6 space-y-4">
          <div className="h-5 w-36 rounded bg-[#D7E0E7]" />
          {[0, 1, 2].map((r) => (
            <div key={r} className="h-11 w-full rounded-xl bg-[#EEF2F5]" />
          ))}
        </div>
        <div className="lg:col-span-7 bg-white border border-[#142A3B]/10 rounded-2xl p-6 space-y-4">
          <div className="h-5 w-44 rounded bg-[#D7E0E7]" />
          {[0, 1, 2].map((r) => (
            <div key={r} className="h-11 w-full rounded-xl bg-[#EEF2F5]" />
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#142A3B]/10 rounded-2xl p-6 space-y-3">
        <div className="h-5 w-40 rounded bg-[#D7E0E7]" />
        {[0, 1, 2, 3].map((r) => (
          <div key={r} className="h-10 w-full rounded-lg bg-[#EEF2F5]" />
        ))}
      </div>
    </div>
  );
}
