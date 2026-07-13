import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { Modal } from '../../components/ui/Modal';
import { Loader2, CheckCircle2, Check, X, ShieldAlert } from 'lucide-react';

// Typed instead of any[] — catches column typos at compile time
interface PendingUser {
  id: string;
  full_name: string | null;
  role: 'manager' | 'salesperson';
  status: 'pending' | 'active' | 'suspended';
  branch_id: string | null;
  created_at: string;
}

export const TeamApprovalsView = () => {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  // Tracks which user row has an action in flight — blocks double-clicks
  const [processingId, setProcessingId] = useState<string | null>(null);
  // Holds a user awaiting manager-role confirmation
  const [confirmManager, setConfirmManager] = useState<PendingUser | null>(null);
  const { addToast } = useToast();

  const fetchPendingUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, status, branch_id, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      addToast(`Failed to load pending users: ${error.message}`, 'error');
    } else {
      setPendingUsers(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  // Core status updater used by both approve and reject.
  // .eq('status', 'pending') guards against acting on a row that changed
  // under us, and .select() verifies a row was ACTUALLY updated —
  // Supabase returns no error on 0-row updates (e.g. filtered by RLS).
  const updateUserStatus = async (
    userId: string,
    newStatus: 'active' | 'suspended',
    successMessage: string
  ) => {
    setProcessingId(userId);
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', userId)
        .eq('status', 'pending')
        .select('id');

      if (error) {
        addToast(error.message, 'error');
      } else if (!data || data.length === 0) {
        // Nothing was updated: row no longer pending, or RLS blocked it
        addToast(
          'No change was made. The request may have already been handled or is outside your branch.',
          'error'
        );
        fetchPendingUsers();
      } else {
        addToast(successMessage, 'success');
        fetchPendingUsers();
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveClick = (user: PendingUser) => {
    // Manager approvals grant wallet + inventory + approval powers.
    // Force an explicit confirmation instead of one-click approval.
    if (user.role === 'manager') {
      setConfirmManager(user);
    } else {
      updateUserStatus(user.id, 'active', 'User approved successfully.');
    }
  };

  const handleReject = (user: PendingUser) => {
    updateUserStatus(user.id, 'suspended', 'Registration rejected.');
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pending Team Approvals</h2>
          <span className="px-3 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-sm font-semibold">
            {pendingUsers.length} Pending
          </span>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p>No pending approvals at this time.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {pendingUsers.map((user) => {
              const isProcessing = processingId === user.id;
              return (
                <div
                  key={user.id}
                  className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 font-bold uppercase">
                      {(user.full_name || '?').charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {user.full_name || 'Unnamed User'}
                      </h3>
                      <p className="text-sm text-slate-500 capitalize flex items-center gap-1.5">
                        Requested role: {user.role}
                        {user.role === 'manager' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs font-semibold">
                            <ShieldAlert size={12} /> Elevated access
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReject(user)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      <X size={16} /> Reject
                    </button>
                    <button
                      onClick={() => handleApproveClick(user)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                      {isProcessing ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                      Approve Access
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation gate for manager-role approvals */}
      <Modal
        isOpen={confirmManager !== null}
        onClose={() => setConfirmManager(null)}
        title="Approve Branch Manager?"
        actions={
          <>
            <button
              onClick={() => setConfirmManager(null)}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (confirmManager) {
                  updateUserStatus(
                    confirmManager.id,
                    'active',
                    'Manager approved successfully.'
                  );
                }
                setConfirmManager(null);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Yes, Approve Manager
            </button>
          </>
        }
      >
        <p>
          <strong>{confirmManager?.full_name || 'This user'}</strong> requested the{' '}
          <strong>Branch Manager</strong> role. Approving grants them access to the branch
          wallet, full inventory control, and the ability to approve or suspend other staff.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Only approve if you can verify who this person is.
        </p>
      </Modal>
    </div>
  );
};