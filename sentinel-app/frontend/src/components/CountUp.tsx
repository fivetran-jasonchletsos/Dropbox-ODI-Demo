import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
}

export default function CountUp({ value, duration = 1400, decimals = 0, prefix = '', suffix = '', format }: Props) {
  const [n, setN] = useState(0);
  const startedRef = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (startedRef.current) return;
    const target = value;
    const start = performance.now();
    let raf: number;
    function step(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else { setN(target); startedRef.current = true; }
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const display = format
    ? format(n)
    : n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return <span ref={ref} className="tabular">{prefix}{display}{suffix}</span>;
}
