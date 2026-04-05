import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createOrder } from '../api/orders';
import { fetchPoints } from '../api/points';
import { fetchResources } from '../api/resources';
import { getBlockedRoutes } from '../api/routing';
import type { DeliveryPoint, Priority, RouteInfo } from '../types';
import { useToast } from '../context/ToastContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialPointId?: number;
  /** Called with the new order's id after a critical order is created. */
  onCriticalOrderCreated?: (orderId: number) => void;
}

interface FormData {
  delivery_point: number;
  resource: number;
  quantity: number;
  priority: Priority;
  notes?: string;
}

/** Haversine distance in km between two lat/lng pairs. */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Depot coordinates (Lisbon area)
const DEPOT_LAT = 38.7169;
const DEPOT_LNG = -9.1399;

function estimateRouteInfo(point: DeliveryPoint): RouteInfo {
  const distance_km = Math.round(haversine(DEPOT_LAT, DEPOT_LNG, point.latitude, point.longitude) * 10) / 10;
  return { distance_km, estimated_time_minutes: Math.round((distance_km / 60) * 60) };
}

export default function CreateOrderModal({ isOpen, onClose, initialPointId, onCriticalOrderCreated }: Props) {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const { addToast } = useToast();
  const qc = useQueryClient();

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { priority: 'normal', delivery_point: initialPointId },
  });

  const { data: points = [] } = useQuery({ queryKey: ['points'], queryFn: fetchPoints });
  const { data: resources = [] } = useQuery({ queryKey: ['resources'], queryFn: fetchResources });
  const { data: blockedRoutes = [] } = useQuery({ queryKey: ['blockedRoutes'], queryFn: getBlockedRoutes });

  const selectedPointId = watch('delivery_point');
  const selectedResourceId = watch('resource');
  const selectedPriority = watch('priority');

  const selectedPoint = points.find((p) => p.id === Number(selectedPointId));
  const currentStock = selectedPoint?.stock?.find((s) => s.resource_id === Number(selectedResourceId));
  const pointBlocked = blockedRoutes.some((b) => b.point_id === Number(selectedPointId));

  useEffect(() => {
    if (selectedPoint) {
      setRouteInfo(estimateRouteInfo(selectedPoint));
    } else {
      setRouteInfo(null);
    }
  }, [selectedPoint]);

  const mutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (newOrder) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboardStats'] });
      addToast('Order created successfully', 'success');
      reset();
      onClose();
      if (newOrder.priority === 'critical' && onCriticalOrderCreated) {
        onCriticalOrderCreated(newOrder.id);
      }
    },
    onError: () => addToast('Failed to create order', 'error'),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg mx-0 sm:mx-4 overflow-hidden fixed bottom-0 sm:static max-h-[95vh] flex flex-col">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Point</label>
            <select
              {...register('delivery_point', { required: 'Required', valueAsNumber: true })}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                pointBlocked ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            >
              <option value="">Select point...</option>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {blockedRoutes.some((b) => b.point_id === p.id) ? '🚫 ' : ''}{p.name}
                </option>
              ))}
            </select>
            {errors.delivery_point && <p className="text-red-500 text-xs mt-1">{errors.delivery_point.message}</p>}
            {pointBlocked && (
              <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                🚫 Route to this point is currently blocked. Delivery may not be possible.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resource</label>
            <select
              {...register('resource', { required: 'Required', valueAsNumber: true })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select resource...</option>
              {resources.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>)}
            </select>
            {errors.resource && <p className="text-red-500 text-xs mt-1">{errors.resource.message}</p>}
          </div>

          {currentStock && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
              Current stock at {selectedPoint?.name}: <strong>{currentStock.quantity}</strong> {currentStock.resource_name}
            </div>
          )}

          {routeInfo && !pointBlocked && (
            <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700">
              📍 Distance: <strong>{routeInfo.distance_km?.toFixed(1)} km</strong> · ⏱ ETA: <strong>{routeInfo.estimated_time_minutes} min</strong>
            </div>
          )}

          {selectedPriority === 'critical' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
              ⚡ <strong>Critical priority</strong> — after creation the system will automatically scan
              for in-transit vehicles that can be intercepted and redirected.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              {...register('quantity', { required: 'Required', min: { value: 1, message: 'Must be at least 1' }, valueAsNumber: true })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              {...register('priority')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="normal">Normal</option>
              <option value="elevated">Elevated</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-medium"
            >
              {mutation.isPending ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
