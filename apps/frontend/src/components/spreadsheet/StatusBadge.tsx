const variants = {
  success: 'border-green-200 bg-green-50 text-green-800',
  danger: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
} as const;

interface StatusBadgeProps {
  label: string;
  variant?: keyof typeof variants;
}

export function StatusBadge({ label, variant = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${variants[variant]}`}>
      {label}
    </span>
  );
}
