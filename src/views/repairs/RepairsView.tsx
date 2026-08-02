import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, Ban, ChevronDown, ChevronUp,
  CreditCard, Loader2, PackageCheck, Plus, Truck, Wrench,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { formatNaira } from '../../hooks/useInventory';
import {
  useRepairs, useReceiveRepair, useCompleteRepair, useReturnRepair,
  useReceiveRepaired, usePayRepair, useCancelRepair,
} from '../../hooks/useRepairs';
import type { RepairRow, RepairStatus } from '../../hooks/useRepairs';
import { CreateRepairModal } from './CreateRepairModal';

const STATUS_STYLES: Record<RepairStatus, string> = {
  sent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  received: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  repaired: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  returned: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  awaiting_payment: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_LABELS: Record<RepairStatus, string> = {
  sent: 'Sent — In Transit',
  received: 'In Workshop',
  repaired: 'Repaired — Awaiting Return',
  returned: 'Returning',
  awaiting_payment: 'Payment Due',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export const RepairsView = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const repairs = useRepairs();
  const receiveRepair = useReceiveRepair();
  const completeRepair = useCompleteRepair();
  const returnRepair = useReturnRepair();
  const receiveRepaired = useReceiveRepaired();
  const payRepair = usePayRepair();
  const cancelRepair = useCancelRepair();

  const [tab, setTab] = useState<'sent' | 'workshop'>('sent');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pricing, setPricing] = useState<RepairRow | null>(null); // complete-repair modal
  const [confirmPay, setConfirmPay] = useState<RepairRow | null>(null);

  const anyPending =
    receiveRepair.isPending || completeRepair.isPending || returnRepair.isPending ||
    receiveRepaired.isPending || payRepair.isPending || cancelRepair.isPending;

  const visible = useMemo(() => {
    const rows = repairs.data ?? [];
    return tab === 'sent'
      ? rows.filter((r) => r.sender_branch_id === user?.branch_id)
      : rows.filter((r) => r.repairer_branch_id === user?.branch_id);
  }, [repairs.data, tab, user?.branch_id]);

  // Repair bills we owe / are owed
  const { repairPayables, repairReceivables } = useMemo(() => {
    const rows = (repairs.data ?? []).filter((r) => r.status === 'awaiting_payment');
    return {
      repairPayables: rows
        .filter((r) => r.sender_branch_id === user?.branch_id)
        .reduce((sum, r) => sum + (r.repair_cost ?? 0), 0),
      repairReceivables: rows
        .filter((r) => r.repairer_branch_id === user?.branch_id)
        .reduce((sum, r) => sum + (r.repair_cost ?? 0), 0),
    };
  }, [repairs.data, user?.branch_id]);

  const runAction = (
    mutation: typeof receiveRepair, repairId: string, successMessage: string
  ) =>
    mutation.mutate(repairId, {
      onSuccess: () => addToast(successMessage, 'success'),
      onError: (error) => addToast(error.message, 'error'),
    });

  const handlePriceSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pricing) return;
    const formData = new FormData(e.currentTarget);
    const cost = parseFloat((formData.get('cost') as string) || '');
    const notes = ((formData.get('notes') as string) || '').trim();
    if (isNaN(cost) || cost < 0) {
      addToast('Repair cost must be zero or more (zero = free/warranty/unrepairable).', 'error');
      return;
    }
    completeRepair.mutate(
      { repairId: pricing.id, cost, notes },
      {
        onSuccess: (r) => {
          addToast(
            cost > 0
              ? `${r.repair_number} completed — cost set at ${formatNaira(cost)}. Now send it back.`
              : `${r.repair_number} completed at no charge. Now send it back.`,
            'success'
          );
          setPricing(null);
        },
        onError: (error) => addToast(error.message, 'error'),
      }
    );
  };

  const actionButton = (
    label: string, Icon: typeof Truck, onClick: () => void,
    variant: 'primary' | 'secondary' | 'danger' = 'primary'
  ) => (
    <button
      onClick={onClick}
      disabled={anyPending}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
        variant === 'primary'
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : variant === 'danger'
            ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600'
            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
      }`}
    >
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Tabs + create */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {([
            { id: 'sent' as const, label: 'Sent for Repair', icon: ArrowUpFromLine },
            { id: 'workshop' as const, label: 'My Workshop', icon: ArrowDownToLine },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-lg shadow-red-600/20 transition-all active:scale-[0.98]"
        >
          <Plus size={18} /> Send for Repair
        </button>
      </div>

      {/* Outstanding repair bills */}
      {(repairPayables > 0 || repairReceivables > 0) && (
        <div className="flex flex-wrap gap-3">
          {repairPayables > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-900/15 border border-rose-200 dark:border-rose-900/40 rounded-xl text-sm">
              <Wrench size={16} className="text-rose-600" />
              <span className="text-rose-700 dark:text-rose-400">
                Repair bills you owe: <b>{formatNaira(repairPayables)}</b>
              </span>
            </div>
          )}
          {repairReceivables > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-sm">
              <Wrench size={16} className="text-emerald-600" />
              <span className="text-emerald-700 dark:text-emerald-400">
                Repair fees owed to you: <b>{formatNaira(repairReceivables)}</b>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Repairs list */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {repairs.isLoading && (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}
        {repairs.isError && (
          <p className="p-8 text-center text-sm text-red-600">{repairs.error?.message}</p>
        )}
        {!repairs.isLoading && !repairs.isError && visible.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <Wrench className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p>
              {tab === 'sent'
                ? 'No items sent for repair. Click "Send for Repair" when a product is faulty.'
                : 'No repair jobs from other branches in your workshop.'}
            </p>
          </div>
        )}

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {visible.map((r) => {
            const isSender = r.sender_branch_id === user?.branch_id;
            const expanded = expandedId === r.id;
            return (
              <div key={r.id}>
                <div className="p-5 flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {r.repair_number}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {r.quantity} × {r.product?.name ?? 'Product'}
                      {' · '}
                      {isSender
                        ? `Repairing at ${r.repairer_branch?.name ?? '?'}`
                        : `From ${r.sender_branch?.name ?? '?'}`}
                      {' · '}{formatDate(r.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {r.repair_cost !== null && (
                      <span className={`font-bold mr-2 ${r.repair_cost > 0 ? 'text-slate-900 dark:text-white' : 'text-emerald-600'}`}>
                        {r.repair_cost > 0 ? formatNaira(r.repair_cost) : 'No charge'}
                      </span>
                    )}

                    {/* Sender actions */}
                    {isSender && r.status === 'sent' &&
                      actionButton('Cancel & Recall', Ban, () =>
                        runAction(cancelRepair, r.id,
                          `${r.repair_number} recalled — stock restored to your branch.`),
                        'danger')}
                    {isSender && r.status === 'returned' &&
                      actionButton('Receive Back', PackageCheck, () =>
                        runAction(receiveRepaired, r.id,
                          `${r.repair_number} received — stock restored to your branch.`))}
                    {isSender && r.status === 'awaiting_payment' &&
                      actionButton(`Pay ${formatNaira(r.repair_cost ?? 0)}`, CreditCard,
                        () => setConfirmPay(r))}

                    {/* Workshop actions */}
                    {!isSender && r.status === 'sent' &&
                      actionButton('Confirm Receipt', PackageCheck, () =>
                        runAction(receiveRepair, r.id,
                          `${r.repair_number} received into your workshop.`),
                        'secondary')}
                    {!isSender && r.status === 'received' &&
                      actionButton('Complete Repair', Wrench, () => setPricing(r))}
                    {!isSender && r.status === 'repaired' &&
                      actionButton('Send Back', Truck, () =>
                        runAction(returnRepair, r.id,
                          `${r.repair_number} dispatched back to ${r.sender_branch?.name}.`))}

                    <button
                      onClick={() => setExpandedId(expanded ? null : r.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="px-5 pb-5 space-y-2">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2 text-sm">
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="text-slate-500">Fault:</span> {r.fault_description}
                      </p>
                      {r.repair_notes && (
                        <p className="text-slate-700 dark:text-slate-300">
                          <span className="text-slate-500">Workshop notes:</span> {r.repair_notes}
                        </p>
                      )}
                      {r.imeis && r.imeis.length > 0 && (
                        <p className="font-mono text-xs text-slate-500 break-all">
                          IMEI: {r.imeis.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <CreateRepairModal isOpen={showCreate} onClose={() => setShowCreate(false)} />

      {/* Workshop: price the completed job */}
      <Modal
        isOpen={pricing !== null}
        onClose={() => setPricing(null)}
        title={`Complete ${pricing?.repair_number ?? ''}`}
      >
        {pricing && (
          <form onSubmit={handlePriceSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Set the repair cost for {pricing.quantity} × {pricing.product?.name}. Enter{' '}
              <b>0</b> if the repair is free (warranty) or the item could not be repaired —
              explain in the notes either way.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Repair cost (₦)
              </label>
              <input
                type="number"
                name="cost"
                required
                min="0"
                step="0.01"
                disabled={completeRepair.isPending}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all disabled:opacity-50"
                placeholder="15000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Workshop notes <span className="text-slate-400 font-normal">(what was done)</span>
              </label>
              <textarea
                name="notes"
                rows={3}
                disabled={completeRepair.isPending}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all disabled:opacity-50"
                placeholder="Replaced screen assembly and battery; tested for 24 hours."
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setPricing(null)}
                disabled={completeRepair.isPending}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={completeRepair.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {completeRepair.isPending && <Loader2 size={16} className="animate-spin" />}
                Save & Mark Repaired
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Sender: confirm repair payment */}
      <Modal
        isOpen={confirmPay !== null}
        onClose={() => setConfirmPay(null)}
        title={`Pay for ${confirmPay?.repair_number ?? ''}?`}
        actions={
          <>
            <button
              onClick={() => setConfirmPay(null)}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (confirmPay) {
                  runAction(payRepair, confirmPay.id,
                    `${confirmPay.repair_number} paid — ${formatNaira(confirmPay.repair_cost ?? 0)} transferred to ${confirmPay.repairer_branch?.name}.`);
                }
                setConfirmPay(null);
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Confirm Payment
            </button>
          </>
        }
      >
        <p>
          <strong>{formatNaira(confirmPay?.repair_cost ?? 0)}</strong> will be transferred from
          your branch wallet to <strong>{confirmPay?.repairer_branch?.name}</strong> branch for
          the repair of {confirmPay?.quantity} × {confirmPay?.product?.name}. Both wallets'
          ledgers will record this transaction permanently.
        </p>
      </Modal>
    </div>
  );
};