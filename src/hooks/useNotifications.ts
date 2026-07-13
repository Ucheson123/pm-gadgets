import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

const NOTIFICATIONS_KEY = ['notifications'];

// RLS scopes results to the user's branch (and role for manager-only ones)
export const useNotifications = () =>
  useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, read, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

export const useMarkAllRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
};

// ==========================================
// REALTIME: toast + refresh whenever a notification lands for our branch.
// Mount once (in DashboardShell / NotificationsBell).
// ==========================================
export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.branch_id) return;

    const channel = supabase
      .channel('branch-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `branch_id=eq.${user.branch_id}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow & { for_managers?: boolean };
          // Manager-only notifications shouldn't toast for salespersons
          if (row.for_managers && user.role !== 'manager') return;
          addToast(row.title, 'info');
          queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.branch_id, user?.role]);
};