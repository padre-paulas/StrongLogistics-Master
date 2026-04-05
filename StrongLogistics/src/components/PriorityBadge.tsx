import type { Priority } from '../types';

interface Props { priority: Priority }

const styles: Record<Priority, string> = {
  normal: 'bg-green-100 text-green-700',
  elevated: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700 animate-pulse',
};

export default function PriorityBadge({ priority }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[priority]}`}>
      {priority}
    </span>
  );
}
