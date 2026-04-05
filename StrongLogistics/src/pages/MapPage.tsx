import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
// @ts-ignore
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPoints } from '../api/points';
import { fetchResources } from '../api/resources';
import { getBlockedRoutes, blockRoute, unblockRoute } from '../api/routing';
import type { DeliveryPoint, Priority, RouteBlockage } from '../types';
import { getPriorityColor } from '../utils/priorityColors';
import MapSidebar from '../features/MapSidebar';
import CreateOrderModal from '../features/CreateOrderModal';
import RouteInterceptionModal from '../features/RouteInterceptionModal';
import { useToast } from '../context/ToastContext';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/** Creates a coloured pin icon; adds a 🚫 overlay when the point is blocked. */
function createColoredIcon(color: string, blocked = false) {
  return L.divIcon({
    className: '',
    html: blocked
      ? `<div style="position:relative;width:24px;height:24px">
           <div style="width:24px;height:24px;border-radius:50% 50% 50% 0;background:#9ca3af;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>
           <span style="position:absolute;top:-4px;left:4px;font-size:14px;line-height:1">🚫</span>
         </div>`
      : `<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;background:${color};border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
}

/** Returns the highest active order priority for a delivery point. Stub — will query active orders when integrated. */
function getDefaultPointPriority(_point: DeliveryPoint): Priority {
  return 'normal';
}

const legendItems: { priority: Priority; label: string }[] = [
  { priority: 'normal', label: 'Normal' },
  { priority: 'elevated', label: 'Elevated' },
  { priority: 'critical', label: 'Critical' },
];

export default function MapPage() {
  const [selectedPoint, setSelectedPoint] = useState<DeliveryPoint | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createPointId, setCreatePointId] = useState<number | undefined>();
  const [interceptionOrderId, setInterceptionOrderId] = useState<number | null>(null);
  const [showBlockPanel, setShowBlockPanel] = useState(false);
  const [blockPointId, setBlockPointId] = useState<number | ''>('');
  const [blockReason, setBlockReason] = useState('');
  const { addToast } = useToast();
  const qc = useQueryClient();

  const { data: points = [], isLoading, error, refetch } = useQuery({
    queryKey: ['points'],
    queryFn: fetchPoints,
    refetchInterval: 60000,
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['resources'],
    queryFn: fetchResources,
  });

  const { data: blockedRoutes = [], refetch: refetchBlocked } = useQuery<RouteBlockage[]>({
    queryKey: ['blockedRoutes'],
    queryFn: getBlockedRoutes,
  });

  const blockMutation = useMutation({
    mutationFn: () => blockRoute(Number(blockPointId), blockReason || 'Road inaccessible'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blockedRoutes'] });
      setBlockPointId('');
      setBlockReason('');
      addToast('Route marked as blocked', 'success');
      void refetchBlocked();
    },
    onError: () => addToast('Failed to block route', 'error'),
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => unblockRoute(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blockedRoutes'] });
      addToast('Route unblocked', 'success');
      void refetchBlocked();
    },
    onError: () => addToast('Failed to unblock route', 'error'),
  });

  const blockedPointIds = new Set(blockedRoutes.map((b) => b.point_id));

  const handleCreateOrder = (pointId?: number) => {
    setCreatePointId(pointId);
    setShowCreate(true);
    setSelectedPoint(null);
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Failed to load map data</p>
        <button onClick={() => refetch()} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row h-full gap-3 sm:gap-4" style={{ minHeight: 'calc(100vh - 10rem)' }}>
      <div className="flex-1 relative rounded-xl overflow-hidden shadow-sm isolate" style={{ minHeight: '300px' }}>
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 z-[1000] flex items-center justify-center">
            <div className="text-gray-500">Loading map...</div>
          </div>
        )}
        <MapContainer
          center={[51.505, -0.09]}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MarkerClusterGroup>
            {points.map((point) => {
              const blocked = blockedPointIds.has(point.id);
              return (
                <Marker
                  key={point.id}
                  position={[point.latitude, point.longitude]}
                  icon={createColoredIcon(
                    blocked ? '#9ca3af' : getPriorityColor(getDefaultPointPriority(point)),
                    blocked,
                  )}
                  eventHandlers={{ click: () => setSelectedPoint(point) }}
                >
                  <Popup>
                    <strong>{point.name}</strong>
                    {blocked && <span className="ml-1 text-red-600">🚫 Blocked</span>}
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow p-3 z-[1000]">
          <p className="text-xs font-semibold text-gray-700 mb-2">Priority</p>
          {legendItems.map((item) => (
            <div key={item.priority} className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <span className="w-3 h-3 rounded-full" style={{ background: getPriorityColor(item.priority) }} />
              {item.label}
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs text-gray-600 mt-1 pt-1 border-t">
            <span className="w-3 h-3 rounded-full bg-gray-400" />
            Blocked
          </div>
        </div>
        {/* Route blockage toggle button */}
        <div className="absolute top-4 right-4 z-[1000]">
          <button
            onClick={() => setShowBlockPanel((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium shadow ${
              blockedRoutes.length > 0
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            🚫 Routes {blockedRoutes.length > 0 ? `(${blockedRoutes.length} blocked)` : 'Blockages'}
          </button>
        </div>
      </div>

      {/* Route blockage management panel */}
      {showBlockPanel && (
        <div className="fixed inset-x-0 bottom-0 sm:static sm:inset-auto w-full sm:w-72 bg-white rounded-t-xl sm:rounded-xl shadow-lg flex flex-col overflow-hidden sm:shrink-0 max-h-[70vh] sm:max-h-none z-[1001] sm:z-auto">
          <div className="p-4 border-b flex items-center justify-between bg-gray-50">
            <h3 className="font-semibold text-gray-900">🚫 Route Blockages</h3>
            <button onClick={() => setShowBlockPanel(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <p className="text-xs text-gray-500">
              Mark delivery points as unreachable. The system will warn dispatchers and prioritise
              alternative routes using ALNS / ACO adaptive algorithms.
            </p>

            {/* Add blockage */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase">Block a point</p>
              <select
                value={blockPointId}
                onChange={(e) => setBlockPointId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">Select point…</option>
                {points
                  .filter((p) => !blockedPointIds.has(p.id))
                  .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input
                type="text"
                placeholder="Reason (optional)"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
              <button
                onClick={() => blockMutation.mutate()}
                disabled={!blockPointId || blockMutation.isPending}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white py-1.5 rounded-lg text-sm font-medium"
              >
                {blockMutation.isPending ? 'Blocking…' : '🚫 Block Route'}
              </button>
            </div>

            {/* Current blockages */}
            {blockedRoutes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase">Active blockages</p>
                {blockedRoutes.map((b) => {
                  const point = points.find((p) => p.id === b.point_id);
                  return (
                    <div key={b.id} className="border border-red-200 bg-red-50 rounded-lg p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-red-800">{point?.name ?? `Point #${b.point_id}`}</span>
                        <button
                          onClick={() => unblockMutation.mutate(b.id)}
                          disabled={unblockMutation.isPending}
                          className="text-blue-600 hover:underline text-xs disabled:opacity-50"
                        >
                          Unblock
                        </button>
                      </div>
                      <p className="text-gray-600 mt-0.5">{b.reason}</p>
                    </div>
                  );
                })}
              </div>
            )}
            {blockedRoutes.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No blocked routes</p>
            )}
          </div>
        </div>
      )}

      {/* Mobile backdrop for sidepanels */}
      {(selectedPoint || showBlockPanel) && (
        <div
          className="fixed inset-0 bg-black/30 z-[1000] sm:hidden"
          onClick={() => { setSelectedPoint(null); setShowBlockPanel(false); }}
          aria-hidden="true"
        />
      )}

      {selectedPoint && (
        <MapSidebar
          point={selectedPoint}
          resources={resources}
          onClose={() => setSelectedPoint(null)}
          onCreateOrder={handleCreateOrder}
        />
      )}

      {showCreate && (
        <CreateOrderModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          initialPointId={createPointId}
          onCriticalOrderCreated={(orderId) => setInterceptionOrderId(orderId)}
        />
      )}
      {interceptionOrderId !== null && (
        <RouteInterceptionModal
          urgentOrderId={interceptionOrderId}
          isOpen={true}
          onClose={() => setInterceptionOrderId(null)}
        />
      )}
    </div>
  );
}
