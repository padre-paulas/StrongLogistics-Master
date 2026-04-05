import { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { format } from 'date-fns';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAllRead } = useNotifications();

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((v) => !v); if (!open) markAllRead(); }}
        className="relative p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto sm:right-0 mt-2 sm:w-80 bg-white rounded-xl shadow-xl border z-50">
          <div className="p-3 border-b font-semibold text-sm text-gray-700">Notifications</div>
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No notifications</div>
          ) : (
            <ul className="max-h-64 overflow-y-auto divide-y">
              {notifications.slice(0, 10).map((n) => (
                <li key={n.id} className={`p-3 text-sm ${n.read ? 'bg-white' : 'bg-blue-50'}`}>
                  <p className="text-gray-800">{n.message}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {format(new Date(n.timestamp), 'MMM d, HH:mm')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
