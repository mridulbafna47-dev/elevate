import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 border border-dashed border-[#142A3B]/15 rounded-xl bg-[#F7F9FA]/60">
      <div className="w-11 h-11 rounded-xl bg-white border border-[#142A3B]/10 flex items-center justify-center text-[#1E8A78] mb-3.5">
        {icon}
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-[#142A3B]">{title}</h3>
      <p className="text-xs sm:text-sm text-[#425466] max-w-md mt-1 leading-relaxed">
        {description}
      </p>
      {(actionLabel || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <Button variant="secondary" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
