import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUsers,
  deactivateUser,
  adminFetchResources,
  adminCreateResource,
  adminDeleteResource,
  adminFetchPoints,
  adminDeletePoint,
  adminGetDemandSettings,
  adminSetDemand,
} from '../api/admin';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useToast } from '../context/ToastContext';
import type { DemandLevel } from '../types';

type Tab = 'users' | 'resources' | 'points' | 'demand';

const DEMAND_LEVELS: DemandLevel[] = ['low', 'normal', 'high', 'surge'];

const demandBadgeClass: Record<DemandLevel, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  surge: 'bg-red-100 text-red-700',
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [showAddResource, setShowAddResource] = useState(false);
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceUnit, setNewResourceUnit] = useState('');
  const [newResourceDesc, setNewResourceDesc] = useState('');
  const [demandPointId, setDemandPointId] = useState<number | ''>('');
  const [demandResourceId, setDemandResourceId] = useState<number | ''>('');
  const [demandLevel, setDemandLevel] = useState<DemandLevel>('normal');
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data: users, isLoading: loadingUsers } = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers });
  const { data: resources, isLoading: loadingResources } = useQuery({ queryKey: ['admin-resources'], queryFn: adminFetchResources });
  const { data: points, isLoading: loadingPoints } = useQuery({ queryKey: ['admin-points'], queryFn: adminFetchPoints });
  const { data: demandSettings, isLoading: loadingDemand } = useQuery({ queryKey: ['admin-demand'], queryFn: adminGetDemandSettings });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); addToast('User deactivated', 'success'); },
    onError: () => addToast('Failed to deactivate user', 'error'),
  });

  const createResourceMutation = useMutation({
    mutationFn: adminCreateResource,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-resources'] });
      qc.invalidateQueries({ queryKey: ['resources'] });
      addToast('Resource created', 'success');
      setShowAddResource(false);
      setNewResourceName('');
      setNewResourceUnit('');
      setNewResourceDesc('');
    },
    onError: () => addToast('Failed to create resource', 'error'),
  });

  const deleteResourceMutation = useMutation({
    mutationFn: adminDeleteResource,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-resources'] }); addToast('Resource deleted', 'success'); },
    onError: () => addToast('Failed to delete resource', 'error'),
  });

  const deletePointMutation = useMutation({
    mutationFn: adminDeletePoint,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-points'] }); addToast('Point deleted', 'success'); },
    onError: () => addToast('Failed to delete point', 'error'),
  });

  const setDemandMutation = useMutation({
    mutationFn: ({ pointId, resourceId, level }: { pointId: number; resourceId: number; level: DemandLevel }) =>
      adminSetDemand(pointId, resourceId, level),
    onSuccess: ({ reassignedCount }) => {
      qc.invalidateQueries({ queryKey: ['admin-demand'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboardStats'] });
      const msg = reassignedCount > 0
        ? `Demand updated — ${reassignedCount} pending order${reassignedCount !== 1 ? 's' : ''} automatically reassigned`
        : 'Demand updated (no pending orders to reassign)';
      addToast(msg, 'success');
      setDemandPointId('');
      setDemandResourceId('');
      setDemandLevel('normal');
    },
    onError: () => addToast('Failed to update demand', 'error'),
  });

  const handleAddResource = () => {
    if (!newResourceName.trim() || !newResourceUnit.trim()) return;
    createResourceMutation.mutate({ name: newResourceName.trim(), unit: newResourceUnit.trim(), description: newResourceDesc.trim() || undefined });
  };

  const handleSetDemand = () => {
    if (!demandPointId || !demandResourceId) return;
    setDemandMutation.mutate({ pointId: Number(demandPointId), resourceId: Number(demandResourceId), level: demandLevel });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
      <div className="flex gap-1 border-b overflow-x-auto -mb-px">
        {(['users', 'resources', 'points', 'demand'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t === 'demand' ? '📊 Demand' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loadingUsers ? <div className="p-6"><LoadingSkeleton lines={4} /></div> : (
            <>
              {/* Mobile card view */}
              <div className="sm:hidden divide-y">
                {users?.length === 0 && <div className="p-8 text-center text-gray-500">No users</div>}
                {users?.map((u) => (
                  <div key={u.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{u.full_name}</p>
                        <p className="text-sm text-gray-500">{u.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{u.role}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    {u.is_active && (
                      <button
                        onClick={() => deactivateMutation.mutate(u.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium mt-1"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users?.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-500">No users</td></tr>}
                    {users?.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3 font-medium">{u.full_name}</td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>
                        <td className="px-4 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{u.role}</span></td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.is_active && (
                            <button
                              onClick={() => deactivateMutation.mutate(u.id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'resources' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddResource((v) => !v)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {showAddResource ? '✕ Cancel' : '+ Add Resource'}
            </button>
          </div>

          {showAddResource && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h3 className="text-base font-semibold text-gray-900">New Resource</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newResourceName}
                    onChange={(e) => setNewResourceName(e.target.value)}
                    placeholder="e.g. Sand Bags"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newResourceUnit}
                    onChange={(e) => setNewResourceUnit(e.target.value)}
                    placeholder="e.g. bags"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={newResourceDesc}
                    onChange={(e) => setNewResourceDesc(e.target.value)}
                    placeholder="Optional"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddResource}
                  disabled={!newResourceName.trim() || !newResourceUnit.trim() || createResourceMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2 rounded-lg text-sm font-medium"
                >
                  {createResourceMutation.isPending ? 'Saving…' : 'Save Resource'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {loadingResources ? <div className="p-6"><LoadingSkeleton lines={4} /></div> : (
              <>
                {/* Mobile card view */}
                <div className="sm:hidden divide-y">
                  {resources?.length === 0 && <div className="p-8 text-center text-gray-500">No resources</div>}
                  {resources?.map((r) => (
                    <div key={r.id} className="p-4 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{r.name}</p>
                        <p className="text-sm text-gray-600">Unit: {r.unit}</p>
                        {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                      </div>
                      <button
                        onClick={() => deleteResourceMutation.mutate(r.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium shrink-0"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-left">Unit</th>
                        <th className="px-4 py-3 text-left">Description</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {resources?.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-500">No resources</td></tr>}
                      {resources?.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-3 font-medium">{r.name}</td>
                          <td className="px-4 py-3 text-gray-600">{r.unit}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{r.description ?? '—'}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => deleteResourceMutation.mutate(r.id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'points' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loadingPoints ? <div className="p-6"><LoadingSkeleton lines={4} /></div> : (
            <>
              {/* Mobile card view */}
              <div className="sm:hidden divide-y">
                {points?.length === 0 && <div className="p-8 text-center text-gray-500">No delivery points</div>}
                {points?.map((p) => (
                  <div key={p.id} className="p-4 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-sm text-gray-600">{p.address}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{p.latitude}, {p.longitude}</p>
                    </div>
                    <button
                      onClick={() => deletePointMutation.mutate(p.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Address</th>
                      <th className="px-4 py-3 text-left">Coordinates</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {points?.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-500">No delivery points</td></tr>}
                    {points?.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-gray-600">{p.address}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{p.latitude}, {p.longitude}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deletePointMutation.mutate(p.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'demand' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Set Demand Level</h3>
              <p className="text-xs text-gray-500 mt-1">
                Changing demand automatically reassigns all pending orders based on updated urgency weights.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Point</label>
                <select
                  value={demandPointId}
                  onChange={(e) => setDemandPointId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select point…</option>
                  {points?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Resource</label>
                <select
                  value={demandResourceId}
                  onChange={(e) => setDemandResourceId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select resource…</option>
                  {resources?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Demand Level</label>
                <select
                  value={demandLevel}
                  onChange={(e) => setDemandLevel(e.target.value as DemandLevel)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DEMAND_LEVELS.map((l) => (
                    <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  onClick={handleSetDemand}
                  disabled={!demandPointId || !demandResourceId || setDemandMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {setDemandMutation.isPending ? 'Applying…' : 'Apply & Reassign'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Current Demand Settings</h3>
            </div>
            {loadingDemand ? <div className="p-6"><LoadingSkeleton lines={3} /></div> : (
              demandSettings?.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No demand overrides set — all resources use default (Normal) demand.
                </div>
              ) : (
                <>
                  {/* Mobile card view */}
                  <div className="sm:hidden divide-y">
                    {demandSettings?.map((d) => {
                      const point = points?.find((p) => p.id === d.point_id);
                      const resource = resources?.find((r) => r.id === d.resource_id);
                      return (
                        <div key={d.id} className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-medium text-gray-900">{point?.name ?? `Point #${d.point_id}`}</p>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${demandBadgeClass[d.level]}`}>
                              {d.level}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{resource?.name ?? `Resource #${d.resource_id}`}</p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(d.updated_at).toLocaleString()}</p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">Delivery Point</th>
                          <th className="px-4 py-3 text-left">Resource</th>
                          <th className="px-4 py-3 text-left">Demand Level</th>
                          <th className="px-4 py-3 text-left">Last Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {demandSettings?.map((d) => {
                          const point = points?.find((p) => p.id === d.point_id);
                          const resource = resources?.find((r) => r.id === d.resource_id);
                          return (
                            <tr key={d.id}>
                              <td className="px-4 py-3 font-medium">{point?.name ?? `Point #${d.point_id}`}</td>
                              <td className="px-4 py-3 text-gray-600">{resource?.name ?? `Resource #${d.resource_id}`}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${demandBadgeClass[d.level]}`}>
                                  {d.level}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-400 text-xs">
                                {new Date(d.updated_at).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
