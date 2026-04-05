import type { OrderStatus } from '../types';

interface Props { status: OrderStatus }

const styles: Record<OrderStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  dispatched: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const labels: Record<OrderStatus, string> = {
  pending: 'Pending',
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function StatusBadge({ status }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
