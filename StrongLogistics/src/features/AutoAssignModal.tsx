import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { autoAssignOrders, confirmAutoAssign } from '../api/orders';
import type { AutoAssignPlan } from '../types';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AutoAssignModal({ isOpen, onClose }: Props) {
  const [plan, setPlan] = useState<AutoAssignPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { addToast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    setPlan(null);
    autoAssignOrders()
      .then((p) => setPlan(p))
      .catch(() => setError('Failed to generate auto-assign plan'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const confirmMutation = useMutation({
    mutationFn: () => confirmAutoAssign(plan!.plan_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboardStats'] });
      addToast('Auto-assignment confirmed', 'success');
      onClose();
    },
    onError: () => addToast('Failed to confirm auto-assign', 'error'),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl sm:mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">🤖 Auto-assign Orders</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="text-2xl mb-2">⏳</div>
              <p className="text-gray-500">Generating optimal assignment plan...</p>
            </div>
          )}
          {error && (
            <div className="text-center py-12">
              <p className="text-red-500">{error}</p>
            </div>
          )}
          {plan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4">
                <div>
                  <p className="text-xs text-gray-500">Total Distance</p>
                  <p className="text-xl font-bold text-gray-800">{plan.total_distance_km?.toFixed(1)} km</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Estimated Time</p>
                  <p className="text-xl font-bold text-gray-800">{plan.estimated_time_minutes} min</p>
                </div>
              </div>
              {plan.assignments?.map((assignment, i) => (
                <div key={i} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium">🚗 {assignment.driver.full_name}</p>
                    <span className="text-xs text-gray-500">{assignment.total_distance_km?.toFixed(1)} km · {assignment.estimated_time_minutes} min</span>
                  </div>
                  <div className="space-y-2">
                    {assignment.orders.map((order) => (
                      <div key={order.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2 text-sm">
                        <span className="font-mono text-xs text-blue-600">#{order.order_id}</span>
                        <span className="text-gray-700">{order.delivery_point?.name}</span>
                        <PriorityBadge priority={order.priority} />
                        <StatusBadge status={order.status} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-6 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            Reject
          </button>
          <button
            onClick={() => confirmMutation.mutate()}
            disabled={!plan || confirmMutation.isPending || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-medium"
          >
            {confirmMutation.isPending ? 'Confirming...' : 'Confirm Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
