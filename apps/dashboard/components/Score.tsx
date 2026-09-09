export function Score({ value, compact = false }: { value: number; compact?: boolean }) {
  const normalized = Math.max(0, Math.min(100, Math.round(value)));
  const tone = normalized >= 90 ? 'good' : normalized >= 70 ? 'warn' : 'bad';
  return (
    <div className={`score score-${tone} ${compact ? 'scoreCompact' : ''}`} aria-label={`Compatibility score ${normalized} out of 100`}>
      <strong>{normalized}</strong>
      <span>/100</span>
    </div>
  );
}
