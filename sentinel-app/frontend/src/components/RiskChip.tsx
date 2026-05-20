import { tierClass } from '../lib/format';

export default function RiskChip({ tier }: { tier: string }) {
  return <span className={tierClass(tier)}>{tier}</span>;
}
