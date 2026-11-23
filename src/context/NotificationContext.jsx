import { useCallback, useEffect, useState } from 'react';
import NotificationContext from './notificationContextInstance';
import { socket } from '../lib/socket';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/notificationApi';

const PAGE_SIZE = 20;

async function fetchNotificationSnapshot() {
  const [list, count] = await Promise.all([
    fetchNotifications(PAGE_SIZE, 0),
    fetchUnreadCount(),
  ]);
  return {
    list,
    count,
    hasMore: list.length === PAGE_SIZE,
  };
}

export function NotificationProvider({ token, children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Load from REST (used on reconnect and error rollback)
  const loadInitial = useCallback(async () => {
    try {
      const snapshot = await fetchNotificationSnapshot();
      setNotifications(snapshot.list);
      setUnreadCount(snapshot.count);
      setHasMore(snapshot.hasMore);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  }, []);

  useEffect(() => {
    // Logged out: disconnect socket (state is derived as empty when !token)
    if (!token) {
      socket.disconnect();
      return;
    }

    let isMounted = true;

    fetchNotificationSnapshot()
      .then((snapshot) => {
        if (!isMounted) return;
        setNotifications(snapshot.list);
        setUnreadCount(snapshot.count);
        setHasMore(snapshot.hasMore);
      })
      .catch((err) => {
        console.error('Failed to load notifications', err);
      });

    socket.auth = (cb) => {
      cb({ token: sessionStorage.getItem('token') });
    };
    socket.connect();

    const onNew = (n) => {
  if (!isMounted) return;

  setNotifications((prev) => {
    if (prev.some((x) => x.id === n.id)) return prev;
    return [n, ...prev];
  });

  setUnreadCount((c) => c + 1);
};

    // After a reconnect, refetch anything missed while offline
    const onConnect = () => {
      if (isMounted) loadInitial();
    };

    const onConnectError = async (err) => {
      console.error('Socket error:', err.message);
      if (err.message === 'TOKEN_EXPIRED') {
        try {
          const { authApi } = await import('../api/authApi');
          const res = await authApi.refresh();
          if (res?.accessToken) {
            socket.auth = { token: res.accessToken };
            socket.connect();
          }
        } catch {
          // If refresh fails, user will be logged out by axios interceptor
        }
      }
    };

    socket.on('notification:new', onNew);
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);

    return () => {
      isMounted = false;
      socket.off('notification:new', onNew);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.disconnect();
    };
  }, [token, loadInitial]);

  const markAsRead = useCallback(async (id) => {
    const wasUnread = notifications.some((n) => n.id === id && !n.is_read);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.is_read ? { ...n, is_read: true } : n))
    );
    if (wasUnread) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    try {
      await markNotificationRead(id);
    } catch (err) {
      console.error('Failed to mark as read', err);
      loadInitial(); // roll back to server state
    }
  }, [notifications, loadInitial]);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch (err) {
      console.error('Failed to mark all as read', err);
      loadInitial();
    }
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    try {
      const more = await fetchNotifications(PAGE_SIZE, notifications.length);
      setNotifications((prev) => [...prev, ...more.filter((m) => !prev.some((p) => p.id === m.id))]);
      setHasMore(more.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load more', err);
    }
  }, [notifications.length]);

  const visibleNotifications = token ? notifications : [];
  const visibleUnreadCount = token ? unreadCount : 0;
  const visibleHasMore = token ? hasMore : false;

  return (
    <NotificationContext.Provider
      value={{
        notifications: visibleNotifications,
        unreadCount: visibleUnreadCount,
        hasMore: visibleHasMore,
        markAsRead,
        markAllAsRead,
        loadMore,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export default NotificationProvider;