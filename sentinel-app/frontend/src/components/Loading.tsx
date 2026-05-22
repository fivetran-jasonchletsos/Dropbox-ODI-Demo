export default function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-[#4d8fff] pulse-dot" />
        <span className="h-2 w-2 rounded-full bg-[#4d8fff] pulse-dot" style={{ animationDelay: '0.15s' }} />
        <span className="h-2 w-2 rounded-full bg-[#4d8fff] pulse-dot" style={{ animationDelay: '0.3s' }} />
        <span className="ml-2 font-mono uppercase tracking-[0.18em] text-[11px]">{label}</span>
      </div>
    </div>
  );
}
