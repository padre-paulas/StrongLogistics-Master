import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Notification } from '../types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

    function connect() {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const ws = new WebSocket(`${wsUrl}/ws/notifications/?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const notification: Notification = JSON.parse(evt.data);
          setNotifications((prev) => [notification, ...prev].slice(0, 50));
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[Notifications] Failed to parse WS message:', err);
        }
      };

      ws.onclose = () => {
        reconnectTimer.current = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
