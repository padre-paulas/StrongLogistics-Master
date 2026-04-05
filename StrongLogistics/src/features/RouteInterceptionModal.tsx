import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { scanForInterception, confirmInterception } from '../api/orders';
import type { InterceptionCandidate, InterceptionPlan } from '../types';
import WeightBadge from '../components/WeightBadge';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';

interface Props {
  urgentOrderId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function RouteInterceptionModal({ urgentOrderId, isOpen, onClose }: Props) {
  const [plan, setPlan] = useState<InterceptionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<InterceptionCandidate | null>(null);
  const { addToast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    setPlan(null);
    setSelected(null);
    scanForInterception(urgentOrderId)
      .then((p) => {
        setPlan(p);
        if (p.candidates.length > 0) setSelected(p.candidates[0]);
      })
      .catch(() => setError('Failed to scan for interception candidates'))
      .finally(() => setLoading(false));
  }, [isOpen, urgentOrderId]);

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmInterception(plan!.plan_id, plan!.urgent_order.id, selected!.transit_order.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboardStats'] });
      addToast('Route interception confirmed — vehicle redirected', 'success');
      onClose();
    },
    onError: () => addToast('Failed to confirm interception', 'error'),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl sm:mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              🔄 Route Interception Plan
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Algorithm: <span className="font-medium text-blue-600">{plan?.algorithm ?? 'ALNS'}</span>
              {' '}— Adaptive Large Neighbourhood Search (Google OR-Tools hybrid)
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="text-center py-12">
              <div className="text-3xl mb-3 animate-spin">⚙️</div>
              <p className="text-gray-500">Scanning in-transit vehicles for interception…</p>
              <p className="text-xs text-gray-400 mt-1">Running ALNS adaptive routing scan</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {plan && (
            <>
              {/* Urgent order summary */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-red-600 uppercase mb-2">⚡ Urgent Order</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xs text-blue-600">#{plan.urgent_order.order_id}</span>
                  <span className="font-medium text-gray-800">{plan.urgent_order.delivery_point?.name}</span>
                  <PriorityBadge priority={plan.urgent_order.priority} />
                  {plan.urgent_order.weight !== undefined && (
                    <WeightBadge weight={plan.urgent_order.weight} />
                  )}
                  <span className="text-sm text-gray-600">
                    {plan.urgent_order.quantity} {plan.urgent_order.resource?.unit} of {plan.urgent_order.resource?.name}
                  </span>
                </div>
              </div>

              {/* Candidates */}
              {plan.candidates.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <p className="text-2xl mb-2">🔍</p>
                  <p className="text-gray-600 font-medium">No interception candidates found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    No in-transit vehicles are currently heading to lower-priority destinations.
                    Consider dispatching from the nearest depot.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700">
                    Select a vehicle to intercept and redirect ({plan.candidates.length} candidate{plan.candidates.length !== 1 ? 's' : ''} found):
                  </p>
                  <div className="space-y-3">
                    {plan.candidates.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setSelected(c)}
                        className={`w-full text-left border rounded-xl p-4 transition-colors ${
                          selected === c
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🚛</span>
                            <span className="font-medium">{c.transit_order.driver?.full_name ?? 'Unknown Driver'}</span>
                            <span className="text-xs text-gray-500">{c.transit_order.driver?.vehicle_plate}</span>
                          </div>
                          {selected === c && (
                            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Selected</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="font-mono text-xs text-blue-600">#{c.transit_order.order_id}</span>
                          <span className="text-sm text-gray-600">→ {c.transit_order.delivery_point?.name}</span>
                          <PriorityBadge priority={c.transit_order.priority} />
                          <StatusBadge status={c.transit_order.status} />
                          {c.transit_order.weight !== undefined && (
                            <WeightBadge weight={c.transit_order.weight} />
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 bg-white rounded-lg p-2 border">
                          <div>
                            <p className="text-gray-400">Redirect qty</p>
                            <p className="font-semibold">{c.redirected_quantity} {c.transit_order.resource?.unit}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Distance to critical</p>
                            <p className="font-semibold">{c.distance_to_critical_km} km</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Route saving</p>
                            <p className="font-semibold text-green-600">−{c.distance_saved_km} km</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            onClick={() => confirmMutation.mutate()}
            disabled={!plan || !selected || confirmMutation.isPending || loading}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white py-2 rounded-lg text-sm font-medium"
          >
            {confirmMutation.isPending ? 'Redirecting…' : '🔄 Confirm Interception'}
          </button>
        </div>
      </div>
    </div>
  );
}
