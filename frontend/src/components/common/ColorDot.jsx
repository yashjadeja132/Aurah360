import { cn } from '@/utils/cn';

/**
 * Deterministic color coding (simplified flow): every clinic and every doctor gets a
 * stable color derived from their id, so anything related to them is recognizable at a
 * glance — no configuration needed, and the same id is always the same color.
 */
const PALETTE = [
  '#2563eb', // blue
  '#d97706', // amber
  '#059669', // emerald
  '#dc2626', // red
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
  '#ea580c', // orange
  '#4f46e5', // indigo
];

export function colorFor(id) {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function ColorDot({ id, className, title }) {
  if (!id) return null;
  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full align-middle', className)}
      style={{ backgroundColor: colorFor(id) }}
      title={title}
    />
  );
}
