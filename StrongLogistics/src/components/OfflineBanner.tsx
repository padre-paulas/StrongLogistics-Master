import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div className="bg-yellow-400 text-yellow-900 text-sm text-center py-2 px-4 font-medium">
      ⚠️ You are offline — data may be outdated
    </div>
  );
}
