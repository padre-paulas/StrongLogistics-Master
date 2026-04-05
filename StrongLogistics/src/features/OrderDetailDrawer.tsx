import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Order, OrderStatus } from '../types';
import { updateOrderStatus } from '../api/orders';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import WeightBadge from '../components/WeightBadge';
import RoleGuard from '../components/RoleGuard';
import { format } from 'date-fns';
import { useToast } from '../context/ToastContext';

interface Props {
  order: Order;
  onClose: () => void;
}

const statuses: OrderStatus[] = ['pending', 'dispatched', 'in_transit', 'delivered', 'cancelled'];

export default function OrderDetailDrawer({ order, onClose }: Props) {
  const [newStatus, setNewStatus] = useState<OrderStatus>(order.status);
  const qc = useQueryClient();
  const { addToast } = useToast();

  const mutation = useMutation({
    mutationFn: (status: OrderStatus) => updateOrderStatus(order.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      addToast('Order status updated', 'success');
      onClose();
    },
    onError: () => addToast('Failed to update order status', 'error'),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white shadow-xl flex flex-col h-full overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Order #{order.order_id}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-6 space-y-6 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Priority</p>
              <PriorityBadge priority={order.priority} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Status</p>
              <StatusBadge status={order.status} />
            </div>
          </div>

          {order.weight !== undefined && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Urgency Weight</p>
              <div className="flex items-center gap-2">
                <WeightBadge weight={order.weight} />
                <span className="text-xs text-gray-500">score out of 100 (priority × stock urgency)</span>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Delivery Point</p>
            <p className="font-medium">{order.delivery_point?.name}</p>
            <p className="text-sm text-gray-500">{order.delivery_point?.address}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Resource</p>
              <p className="font-medium">{order.resource?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Quantity</p>
              <p className="font-medium">{order.quantity} {order.resource?.unit}</p>
            </div>
          </div>

          {order.driver && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Driver</p>
              <p className="font-medium">{order.driver.full_name}</p>
              <p className="text-sm text-gray-500">{order.driver.email}</p>
              {order.driver.vehicle_plate && <p className="text-sm text-gray-500">🚗 {order.driver.vehicle_plate}</p>}
            </div>
          )}

          {order.notes && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
              <p className="text-sm text-gray-700">{order.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Created</p>
            <p className="text-sm">{format(new Date(order.created_at), 'MMM d, yyyy HH:mm')}</p>
          </div>

          {order.status_history?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-2">Status History</p>
              <div className="space-y-2">
                {order.status_history.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <StatusBadge status={entry.status} />
                    <div>
                      <p className="text-gray-600">{entry.changed_by}</p>
                      <p className="text-gray-400 text-xs">{format(new Date(entry.timestamp), 'MMM d, HH:mm')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <RoleGuard allowedRoles={['admin', 'dispatcher']}>
            <div className="border-t pt-4">
              <p className="text-xs text-gray-500 uppercase mb-2">Update Status</p>
              <div className="flex gap-2">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
                <button
                  onClick={() => mutation.mutate(newStatus)}
                  disabled={mutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm"
                >
                  {mutation.isPending ? '...' : 'Update'}
                </button>
              </div>
            </div>
          </RoleGuard>
        </div>
      </div>
    </div>
  );
}
