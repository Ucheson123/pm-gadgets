import { useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import {
  useNotifications, useMarkAllRead, useRealtimeNotifications,
} from '../../hooks/useNotifications';

const timeAgo = (iso: string) => {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });
};

export const NotificationsBell = () => {
  const [open, setOpen] = useState(false);
  const notifications = useNotifications();
  const markAllRead = useMarkAllRead();
  useRealtimeNotifications(); // live toasts + cache refresh

  const rows = notifications.data ?? [];
  const unread = rows.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 flex items-center justify-center bg-red-600 text-white text-[10px] font-bold rounded-full">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                Notifications
              </span>
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>

            {notifications.isLoading && (
              <div className="p-6 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}

            {!notifications.isLoading && rows.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-500">
                Nothing yet — order, wallet, and stock alerts will appear here.
              </p>
            )}

            {rows.map((n) => (
              <div
                key={n.id}
                className={`p-3 border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                  n.read ? '' : 'bg-red-50/50 dark:bg-red-900/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${n.read ? 'text-slate-600 dark:text-slate-400' : 'font-semibold text-slate-900 dark:text-white'}`}>
                    {n.title}
                  </p>
                  <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                    {timeAgo(n.created_at)}
                  </span>
                </div>
                {n.body && (
                  <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};