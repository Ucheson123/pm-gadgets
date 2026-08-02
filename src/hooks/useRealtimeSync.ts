import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ==========================================
// GLOBAL REALTIME SYNC
// Mounted once (in DashboardShell) so EVERY page stays live.
//
// When a row changes anywhere the user is allowed to see (RLS still
// applies to realtime), we invalidate the matching TanStack Query keys
// and the affected screens refetch themselves — no manual refresh.
//
// It also survives network drops: the channel is rebuilt with backoff,
// and every successful (re)connection triggers a full catch-up refetch,
// because changes that happened while offline were never delivered.
// ==========================================

const TABLE_QUERY_KEYS: Record<string, string[]> = {
  wallets: ['wallet', 'dashboard-stats', 'company-stats'],
  transactions: ['wallet', 'wallet-statement', 'dashboard-stats', 'company-stats', 'audit-logs'],
  deposits: ['wallet', 'wallet-statement', 'audit-logs'],
  orders: ['orders', 'dashboard-stats', 'company-stats', 'audit-logs'],
  order_items: ['orders', 'dashboard-stats'],
  inventory: ['branch-stock', 'remote-branch-stock', 'dashboard-stats', 'company-stats', 'audit-logs'],
  products: ['branch-stock', 'remote-branch-stock', 'audit-logs'],
  product_units: ['units-in-stock', 'branch-stock', 'audit-logs'],
  sales: ['sales', 'dashboard-stats', 'company-stats', 'audit-logs'],
  sale_items: ['sales', 'dashboard-stats', 'company-stats'],
  customers: ['customers', 'audit-logs'],
  repair_orders: ['repairs', 'branch-stock', 'units-in-stock', 'audit-logs'],
  users: ['branch-team', 'audit-logs'],
};

const MAX_BACKOFF_MS = 30_000;

export const useRealtimeSync = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Batch invalidations: one sale writes to several tables at once,
  // so we collect keys briefly and refetch each query only once.
  const pendingKeys = useRef<Set<string>>(new Set());
  const flushTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let disposed = false;
    let channel: RealtimeChannel | null = null;
    let retryTimer: number | null = null;
    let attempts = 0;

    const flush = () => {
      flushTimer.current = null;
      const keys = [...pendingKeys.current];
      pendingKeys.current.clear();
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    };

    const queue = (table: string) => {
      const keys = TABLE_QUERY_KEYS[table];
      if (!keys) return;
      keys.forEach((k) => pendingKeys.current.add(k));
      if (flushTimer.current === null) {
        flushTimer.current = window.setTimeout(flush, 200);
      }
    };

    // After any gap in the connection we cannot know what we missed,
    // so refetch everything that is currently mounted.
    const catchUp = () => queryClient.invalidateQueries();

    const teardownChannel = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const scheduleReconnect = () => {
      if (disposed || retryTimer !== null) return;
      const delay = Math.min(1000 * 2 ** attempts, MAX_BACKOFF_MS);
      attempts += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        teardownChannel();
        connect();
      }, delay);
    };

    const connect = () => {
      if (disposed) return;
      // Unique name per attempt so a stale channel can never shadow the new one
      channel = supabase.channel(`pm-gadgets-live-${Date.now()}`);

      for (const table of Object.keys(TABLE_QUERY_KEYS)) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          () => queue(table)
        );
      }

      channel.subscribe((status) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          attempts = 0;
          catchUp();
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          scheduleReconnect();
        }
      });
    };

    // Network returned: reconnect immediately rather than waiting on backoff
    const handleOnline = () => {
      if (disposed) return;
      attempts = 0;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      teardownChannel();
      connect();
    };

    // Tab/app brought back to the foreground: make sure the socket is
    // still alive (phones aggressively suspend background sockets)
    const handleVisibility = () => {
      if (disposed || document.visibilityState !== 'visible') return;
      if (!channel || channel.state !== 'joined') {
        handleOnline();
      } else {
        catchUp();
      }
    };

    connect();
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (flushTimer.current !== null) {
        window.clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      pendingKeys.current.clear();
      teardownChannel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
};