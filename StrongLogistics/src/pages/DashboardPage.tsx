import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats } from '../api/dashboard';
import { autoAssignOrders } from '../api/orders';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import RoleGuard from '../components/RoleGuard';
import CreateOrderModal from '../features/CreateOrderModal';
import AutoAssignModal from '../features/AutoAssignModal';
import { format } from 'date-fns';
import { useToast } from '../context/ToastContext';

export default function DashboardPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showAutoAssign, setShowAutoAssign] = useState(false);
  const { addToast } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000,
  });

  const handleAutoAssign = async () => {
    try {
      await autoAssignOrders();
      setShowAutoAssign(true);
    } catch {
      addToast('Failed to start auto-assign', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
              <LoadingSkeleton lines={2} />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <LoadingSkeleton lines={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Failed to load dashboard data</p>
        <button onClick={() => refetch()} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Retry</button>
      </div>
    );
  }

  const stats = [
    { label: 'Total Active Orders', value: data?.total_active_orders ?? 0, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Critical Priority', value: data?.critical_priority ?? 0, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Pending Dispatch', value: data?.pending_dispatch ?? 0, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Available Drivers', value: data?.available_drivers ?? 0, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <RoleGuard allowedRoles={['admin', 'dispatcher']}>
            <button
              onClick={handleAutoAssign}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              🤖 Auto-assign Orders
            </button>
          </RoleGuard>
          <RoleGuard allowedRoles={['admin', 'dispatcher']}>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              + Create Order
            </button>
          </RoleGuard>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`bg-white rounded-xl p-6 shadow-sm border-l-4 ${s.bg}`}>
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Recent Orders</h2>
        </div>
        {!data?.recent_orders?.length ? (
          <div className="p-8 text-center text-gray-500">No recent orders</div>
        ) : (
          <div className="divide-y">
            {data.recent_orders.slice(0, 5).map((order) => (
              <div key={order.id} className="px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">#{order.order_id}</p>
                  <p className="text-xs text-gray-500">{order.delivery_point?.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={order.priority} />
                  <StatusBadge status={order.status} />
                  <span className="text-xs text-gray-400">
                    {format(new Date(order.created_at), 'MMM d, HH:mm')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateOrderModal isOpen={showCreate} onClose={() => setShowCreate(false)} />}
      {showAutoAssign && <AutoAssignModal isOpen={showAutoAssign} onClose={() => setShowAutoAssign(false)} />}
    </div>
  );
}
