import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-[#142A3B] text-white hover:bg-[#1D3B53] active:bg-[#0F202D]',
    secondary: 'bg-[#1E8A78] text-white hover:bg-[#177061] active:bg-[#135C50]',
    outline:
      'bg-white text-[#142A3B] border border-[#142A3B]/15 hover:bg-[#F7F9FA] active:bg-[#EEF2F5]',
    ghost: 'bg-transparent text-[#425466] hover:text-[#142A3B] hover:bg-[#142A3B]/5',
    danger: 'bg-[#B42318]/10 text-[#B42318] hover:bg-[#B42318]/15',
  };

  const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'min-h-[40px] sm:min-h-[36px] px-3.5 py-1.5 text-xs',
    md: 'min-h-[44px] sm:min-h-[40px] px-4 py-2 text-sm',
    lg: 'min-h-[48px] px-5 py-2.5 text-sm',
  };

  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
