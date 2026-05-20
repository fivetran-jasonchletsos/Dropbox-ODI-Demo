interface Props {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}

export default function Sparkline({ data, width = 220, height = 56, stroke = '#FFDA47' }: Props) {
  if (data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => [i * stepX, height - 4 - ((v - min) / range) * (height - 12)] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${d} L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${stroke}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.45" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${stroke})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={stroke} />
      <circle cx={last[0]} cy={last[1]} r="6" fill={stroke} opacity="0.25" />
    </svg>
  );
}
