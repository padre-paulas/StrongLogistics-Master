import { weightLabel } from '../utils/weightCalculation';

interface Props {
  weight: number;
}

const styles = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
} as const;

export default function WeightBadge({ weight }: Props) {
  const label = weightLabel(weight);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${styles[label]}`}
      title={`Urgency weight: ${weight}/100`}
    >
      ⚖ {weight}
    </span>
  );
}
