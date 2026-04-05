import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPointOrders, fetchNearbyPoints } from '../api/points';
import type { DeliveryPoint, Resource } from '../types';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useAuth } from '../context/AuthContext';

interface Props {
  point: DeliveryPoint;
  resources: Resource[];
  onClose: () => void;
  onCreateOrder: (pointId: number) => void;
}

export default function MapSidebar({ point, resources, onClose, onCreateOrder }: Props) {
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);
  const [showNearby, setShowNearby] = useState(false);
  const { role } = useAuth();
  const canCreateOrder = role === 'admin' || role === 'dispatcher';

  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ['pointOrders', point.id],
    queryFn: () => fetchPointOrders(point.id),
  });

  const { data: nearbyPoints, isLoading: loadingNearby } = useQuery({
    queryKey: ['nearbyPoints', point.id, selectedResourceId],
    queryFn: () => fetchNearbyPoints(point.id, selectedResourceId!),
    enabled: showNearby && selectedResourceId !== null,
  });

  return (
    <div className="fixed inset-x-0 bottom-0 sm:static sm:inset-auto w-full sm:w-80 bg-white rounded-t-xl sm:rounded-xl shadow-lg flex flex-col overflow-hidden sm:shrink-0 max-h-[70vh] sm:max-h-none z-[1001] sm:z-auto">
      <div className="p-4 border-b flex items-center justify-between bg-gray-50">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{point.name}</h3>
          <p className="text-xs text-gray-500 truncate">{point.address}</p>
          <p className="text-xs text-gray-400 font-mono">{point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 ml-2" aria-label="Close panel">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stock Levels */}
        {point.stock?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Stock Levels</p>
            <div className="space-y-1">
              {point.stock.map((item) => (
                <div key={item.resource_id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.resource_name}</span>
                  <span className="font-medium">{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Orders */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Active Orders</p>
          {loadingOrders ? <LoadingSkeleton lines={3} /> : (
            <>
              {!orders?.length ? (
                <p className="text-sm text-gray-500">No active orders</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-2 text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="font-mono text-blue-600">#{order.order_id}</span>
                        <PriorityBadge priority={order.priority} />
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Nearby Stock */}
        {showNearby && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Nearby Stock</p>
            <div className="mb-2">
              <select
                value={selectedResourceId ?? ''}
                onChange={(e) => setSelectedResourceId(Number(e.target.value) || null)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs"
              >
                <option value="">Select resource...</option>
                {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {loadingNearby ? <LoadingSkeleton lines={3} /> : (
              <>
                {!nearbyPoints?.length ? (
                  <p className="text-sm text-gray-500">No nearby stock found</p>
                ) : (
                  <div className="space-y-2">
                    {nearbyPoints.map((np, i) => (
                      <div key={i} className="border rounded-lg p-2 text-xs">
                        <p className="font-medium">{np.point.name}</p>
                        <p className="text-gray-500">{np.distance_km != null ? `${np.distance_km.toFixed(1)} km away` : 'Distance unavailable'}</p>
                        <p className="text-green-600">Available: {np.available_quantity}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t space-y-2">
        {canCreateOrder && (
          <button
            onClick={() => onCreateOrder(point.id)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium"
          >
            + Create Order
          </button>
        )}
        <button
          onClick={() => setShowNearby((v) => !v)}
          className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
        >
          {showNearby ? 'Hide' : '🔍'} Nearby Stock
        </button>
      </div>
    </div>
  );
}
