import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import './NotificationBell.css';

// CHANGE: use your real route paths
function getLink(n, role) {
  const taskId = n.data?.taskId;
  if (!taskId) return null;
  return role === 'mentee' ? `/mentee/tasks/${taskId}` : `/mentor/tasks/${taskId}`;
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationBell({ role, onOpenTask }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, hasMore, markAsRead, markAllAsRead, loadMore } =
    useNotifications();

  // Close when clicking outside
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleClick = (n) => {
     if (!n.is_read) {
    markAsRead(n.id);
  }

  setOpen(false);

   // Handle group notifications
  if (n.type === 'GROUP_CREATED' || n.type === 'ADDED_TO_GROUP') {
    const groupId = n.data?.groupId;

    if (!groupId) {
      console.error('Group ID missing from notification');
      return;
    }

    navigate(`/chat?groupId=${groupId}`);
    return;
  }

  // Handle new message notification
  if (n.type === 'NEW_MESSAGE') {
    const groupId = n.data?.groupId;

    if (!groupId) {
      console.error('Group ID missing from notification');
      return;
    }

    navigate(`/chat?groupId=${groupId}`);
    return;
  }

  // Handle existing task notifications
  if (onOpenTask) {
    onOpenTask(n.data?.taskId || n);
    return;
  }

  const link = getLink(n, role);

  if (link) {
    navigate(link);
  }
};

  return (
    <div className="notif" ref={ref}>
      <button className="notif__btn" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif__panel">
          <div className="notif__header">
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button className="notif__link" onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div className="notif__list">
            {notifications.length === 0 && <p className="notif__empty">No notifications yet</p>}

            {notifications.map((n) => (
              <div
                key={n.id}
                className={`notif__item ${n.is_read ? '' : 'notif__item--unread'}`}
                onClick={() => handleClick(n)}
              >
                <div className="notif__title">{n.title}</div>
                <div className="notif__msg">{n.message}</div>
                <div className="notif__time">{timeAgo(n.created_at)}</div>
              </div>
            ))}

            {hasMore && (
              <button className="notif__more" onClick={loadMore}>
                Load more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}