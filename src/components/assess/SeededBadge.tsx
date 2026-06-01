export function SeededBadge({ seeded, touched }: { seeded: boolean; touched: boolean }) {
  if (!seeded || touched) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-chalk bg-mist/60 text-slate px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider">
      Seeded
    </span>
  );
}
