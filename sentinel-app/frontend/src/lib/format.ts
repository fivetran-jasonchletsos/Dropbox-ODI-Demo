export function fmtB(n: number, digits = 1): string {
  if (n >= 1000) return (n / 1000).toFixed(digits) + 'T';
  return n.toFixed(digits) + 'B';
}

export function fmtCount(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

export function fmtBytes(b: number): string {
  if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b >= 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

export function fmtPct(n: number, digits = 2): string {
  return n.toFixed(digits) + '%';
}

export function fmtDate(s: string): string {
  try {
    const d = new Date(s);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

export function fmtDateTime(s: string): string {
  try {
    const d = new Date(s);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return s;
  }
}

export function tierClass(tier: string): string {
  switch (tier) {
    case 'low': return 'risk-chip risk-low';
    case 'watch': return 'risk-chip risk-watch';
    case 'elevated': return 'risk-chip risk-elevated';
    case 'high': return 'risk-chip risk-high';
    default: return 'risk-chip risk-low';
  }
}

export function tierColor(tier: string): string {
  switch (tier) {
    case 'low': return '#34d399';
    case 'watch': return '#fbbf24';
    case 'elevated': return '#fb923c';
    case 'high': return '#fb7185';
    default: return '#94a3b8';
  }
}

export function riskIndexColor(index: number): string {
  if (index < 25) return '#34d399';
  if (index < 50) return '#fbbf24';
  if (index < 75) return '#fb923c';
  return '#fb7185';
}
