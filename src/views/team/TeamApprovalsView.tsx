import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, ShieldAlert, UserCheck, UserX, Users, UserMinus,
  RotateCcw, Trash2, Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';

// ==========================================
// TYPES + DATA
// ==========================================
interface StaffRow {
  id: string;
  full_name: string;
  email: string | null;
  role: 'manager' | 'salesperson';
  status: 'pending' | 'active' | 'suspended';
  created_at: string;
}

const TEAM_KEY = ['branch-team'];

// RLS scopes this to the manager's own branch
const useBranchTeam = () =>
  useQuery({
    queryKey: TEAM_KEY,
    queryFn: async (): Promise<StaffRow[]> => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, status, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StaffRow[];
    },
  });

const useSetStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      status: 'active' | 'suspended';
      fromStatus?: StaffRow['status'];
    }) => {
      let query = supabase
        .from('users')
        .update({ status: input.status })
        .eq('id', input.userId);
      if (input.fromStatus) query = query.eq('status', input.fromStatus);
      const { data, error } = await query.select('id, full_name');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('No change was made — the account may have been updated by someone else. Refresh and try again.');
      }
      return data[0];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAM_KEY }),
  });
};

const useRemoveStaff = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_staff', { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAM_KEY }),
  });
};

// ==========================================
// SHARED BITS
// ==========================================
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });

const RoleBadge = ({ role }: { role: StaffRow['role'] }) =>
  role === 'manager' ? (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      Manager
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      Salesperson
    </span>
  );

const StatusBadge = ({ status }: { status: StaffRow['status'] }) => {
  const styles: Record<StaffRow['status'], string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    pending: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${styles[status]}`}>
      {status}
    </span>
  );
};

// ==========================================
// VIEW
// ==========================================
export const TeamApprovalsView = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const team = useBranchTeam();
  const setStatus = useSetStatus();
  const removeStaff = useRemoveStaff();

  const [tab, setTab] = useState<'pending' | 'team'>('pending');
  const [confirmManager, setConfirmManager] = useState<StaffRow | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<StaffRow | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const rows = team.data ?? [];
  const pending = rows.filter((r) => r.status === 'pending');
  const roster = useMemo(
    () =>
      rows
        .filter((r) => r.status !== 'pending')
        .sort((a, b) =>
          a.status === b.status
            ? a.role === b.role
              ? a.full_name.localeCompare(b.full_name)
              : a.role === 'manager' ? -1 : 1
            : a.status === 'active' ? -1 : 1
        ),
    [rows]
  );

  const act = (
    row: StaffRow,
    status: 'active' | 'suspended',
    fromStatus: StaffRow['status'] | undefined,
    successMessage: string
  ) => {
    setActingOn(row.id);
    setStatus.mutate(
      { userId: row.id, status, fromStatus },
      {
        onSuccess: () => addToast(successMessage, 'success'),
        onError: (error) => addToast(error.message, 'error'),
        onSettled: () => setActingOn(null),
      }
    );
  };

  const approve = (row: StaffRow) => {
    if (row.role === 'manager') {
      setConfirmManager(row);
      return;
    }
    act(row, 'active', 'pending', `${row.full_name} approved — they can enter immediately.`);
  };

  const handleRemove = (row: StaffRow) => {
    setActingOn(row.id);
    removeStaff.mutate(row.id, {
      onSuccess: () => {
        addToast(`${row.full_name}'s account was permanently removed.`, 'success');
        setConfirmRemove(null);
      },
      onError: (error) => {
        addToast(error.message, 'error');
        setConfirmRemove(null);
      },
      onSettled: () => setActingOn(null),
    });
  };

  const busy = setStatus.isPending || removeStaff.isPending;

  const actionButton =
    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50';

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-full sm:w-auto sm:inline-flex">
        {([
          { id: 'pending', label: `Pending Approvals${pending.length ? ` (${pending.length})` : ''}`, icon: Clock },
          { id: 'team', label: 'My Team', icon: Users },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {team.isLoading && (
        <div className="p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      )}
      {team.isError && (
        <p className="p-8 text-center text-sm text-red-600">{team.error?.message}</p>
      )}

      {/* ============ PENDING TAB ============ */}
      {tab === 'pending' && !team.isLoading && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white">Awaiting Your Approval</h2>
            <p className="text-sm text-slate-500">
              New registrations for {user?.branch_name} branch
            </p>
          </div>
          {pending.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <UserCheck className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
              <p>No pending registrations. New sign-ups for your branch will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {pending.map((row) => (
                <div key={row.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-900 dark:text-white">{row.full_name}</p>
                      <RoleBadge role={row.role} />
                      {row.role === 'manager' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                          <ShieldAlert size={12} /> Elevated access
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {row.email ?? '—'} · registered {formatDate(row.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => act(row, 'suspended', 'pending', `${row.full_name}'s registration was rejected.`)}
                      disabled={busy}
                      className={`${actionButton} bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20`}
                    >
                      {actingOn === row.id && setStatus.isPending
                        ? <Loader2 size={13} className="animate-spin" /> : <UserX size={13} />}
                      Reject
                    </button>
                    <button
                      onClick={() => approve(row)}
                      disabled={busy}
                      className={`${actionButton} bg-emerald-600 hover:bg-emerald-700 text-white`}
                    >
                      {actingOn === row.id && setStatus.isPending
                        ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
                      Approve Access
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ MY TEAM TAB ============ */}
      {tab === 'team' && !team.isLoading && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white">
              {user?.branch_name} Branch Team
            </h2>
            <p className="text-sm text-slate-500">
              {roster.filter((r) => r.status === 'active').length} active ·{' '}
              {roster.filter((r) => r.status === 'suspended').length} suspended
            </p>
          </div>
          {roster.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
              <p>No approved staff yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {roster.map((row) => {
                const isSelf = row.id === user?.id;
                const isSalesperson = row.role === 'salesperson';
                return (
                  <div key={row.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {row.full_name}{isSelf && <span className="text-slate-400 font-normal"> (you)</span>}
                        </p>
                        <RoleBadge role={row.role} />
                        <StatusBadge status={row.status} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {row.email ?? '—'} · joined {formatDate(row.created_at)}
                      </p>
                    </div>

                    {isSalesperson && (
                      <div className="flex items-center gap-2 shrink-0">
                        {row.status === 'active' && (
                          <button
                            onClick={() => act(row, 'suspended', 'active', `${row.full_name} was suspended — access revoked, history preserved.`)}
                            disabled={busy}
                            className={`${actionButton} bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20`}
                          >
                            {actingOn === row.id && setStatus.isPending
                              ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
                            Suspend
                          </button>
                        )}
                        {row.status === 'suspended' && (
                          <button
                            onClick={() => act(row, 'active', 'suspended', `${row.full_name} was reactivated.`)}
                            disabled={busy}
                            className={`${actionButton} bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100`}
                          >
                            {actingOn === row.id && setStatus.isPending
                              ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                            Reactivate
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmRemove(row)}
                          disabled={busy}
                          className={`${actionButton} bg-red-600 hover:bg-red-700 text-white`}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Manager-approval confirmation (unchanged behavior) */}
      <Modal
        isOpen={confirmManager !== null}
        onClose={() => setConfirmManager(null)}
        title="Approve a Branch Manager?"
      >
        {confirmManager && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <b>{confirmManager.full_name}</b> will gain full manager powers for{' '}
                {user?.branch_name} branch: <b>wallet access and transfers, complete inventory
                control, and the power to approve other staff</b>. Only approve people whose
                identity you have verified.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmManager(null)}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const row = confirmManager;
                  setConfirmManager(null);
                  act(row, 'active', 'pending', `${row.full_name} approved as manager.`);
                }}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Approve Manager
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Permanent-removal confirmation */}
      <Modal
        isOpen={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title="Permanently Remove Account?"
      >
        {confirmRemove && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <Trash2 className="text-red-600 shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-red-800 dark:text-red-300 space-y-2">
                <p>
                  This permanently deletes <b>{confirmRemove.full_name}</b>'s account and login.
                  It cannot be undone.
                </p>
                <p>
                  Removal is only possible for salespersons who <b>never recorded a sale</b>. If
                  they have sales history, the system will refuse — <b>suspend</b> them instead,
                  which revokes access while keeping the records intact.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                disabled={removeStaff.isPending}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(confirmRemove)}
                disabled={removeStaff.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {removeStaff.isPending && <Loader2 size={14} className="animate-spin" />}
                Remove Permanently
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};