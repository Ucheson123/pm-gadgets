import { useMemo, useState } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, Ban, ChevronDown, ChevronUp,
  CreditCard, Loader2, PackageCheck, Plus, Truck,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { formatNaira } from '../../hooks/useInventory';
import {
  useOrders, usePayOrder, useFulfillOrder, useReceiveOrder, useCancelOrder,
} from '../../hooks/useOrders';
import type { OrderRow, OrderStatus } from '../../hooks/useOrders';
import { CreateOrderModal } from './CreateOrderModal';

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending_payment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  paid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pending Payment',
  paid: 'Paid',
  processing: 'Processing',
  approved: 'In Transit',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export const OrdersView = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const orders = useOrders();
  const payOrder = usePayOrder();
  const fulfillOrder = useFulfillOrder();
  const receiveOrder = useReceiveOrder();
  const cancelOrder = useCancelOrder();

  const [tab, setTab] = useState<'outgoing' | 'incoming'>('outgoing');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmPay, setConfirmPay] = useState<OrderRow | null>(null);

  const anyActionPending =
    payOrder.isPending || fulfillOrder.isPending ||
    receiveOrder.isPending || cancelOrder.isPending;

  const visibleOrders = useMemo(() => {
    const rows = orders.data ?? [];
    return tab === 'outgoing'
      ? rows.filter((o) => o.buyer_branch_id === user?.branch_id)
      : rows.filter((o) => o.seller_branch_id === user?.branch_id);
  }, [orders.data, tab, user?.branch_id]);

  const runAction = (
    mutation: typeof fulfillOrder,
    orderId: string,
    successMessage: string
  ) =>
    mutation.mutate(orderId, {
      onSuccess: () => addToast(successMessage, 'success'),
      onError: (error) => addToast(error.message, 'error'),
    });

  const actionButton = (
    label: string, Icon: typeof Truck, onClick: () => void,
    variant: 'primary' | 'secondary' | 'danger' = 'primary'
  ) => (
    <button
      onClick={onClick}
      disabled={anyActionPending}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
        variant === 'primary'
          ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
          : variant === 'danger'
            ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:border-red-500/20'
            : 'bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 text-slate-700 dark:text-slate-200'
      }`}
    >
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Tabs + create button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1 transition-colors duration-200">
          {(['outgoing', 'incoming'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                tab === t
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400'
              }`}
            >
              {t === 'outgoing' ? <ArrowUpFromLine size={15} /> : <ArrowDownToLine size={15} />}
              {t === 'outgoing' ? 'Outgoing Orders' : 'Incoming Orders'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-lg shadow-red-600/20 transition-all duration-200 active:scale-[0.98]"
        >
          <Plus size={18} /> New Order
        </button>
      </div>

      {/* Orders list */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors duration-200">
        {orders.isLoading && (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {orders.isError && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 transition-colors duration-200">
            <p className="font-medium text-red-600 dark:text-red-400 mb-1">Failed to load orders</p>
            <p className="text-sm">{orders.error?.message}</p>
          </div>
        )}

        {!orders.isLoading && !orders.isError && visibleOrders.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 transition-colors duration-200">
            <Truck className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700 transition-colors duration-200" />
            <p>
              {tab === 'outgoing'
                ? 'No outgoing orders yet. Click "New Order" to order from another branch.'
                : 'No incoming orders from other branches yet.'}
            </p>
          </div>
        )}

        <div className="divide-y divide-slate-200 dark:divide-slate-800 transition-colors duration-200">
          {visibleOrders.map((order) => {
            const isBuyer = order.buyer_branch_id === user?.branch_id;
            const expanded = expandedId === order.id;
            return (
              <div key={order.id} className="transition-colors duration-200 hover:bg-red-50/50 dark:hover:bg-red-500/5">
                <div className="p-5 flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white transition-colors duration-200">
                        {order.order_number}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors duration-200 ${STATUS_STYLES[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 transition-colors duration-200">
                      {isBuyer
                        ? `From ${order.seller_branch?.name ?? '?'} branch`
                        : `To ${order.buyer_branch?.name ?? '?'} branch`}
                      {' · '}{formatDate(order.created_at)}
                      {' · '}{order.order_items.length} product(s)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <span className="font-bold text-slate-900 dark:text-white mr-2 transition-colors duration-200">
                      {formatNaira(order.total_amount)}
                    </span>

                    {/* Buyer actions */}
                    {isBuyer && order.status === 'pending_payment' &&
                      actionButton('Pay', CreditCard, () => setConfirmPay(order))}
                    {isBuyer && order.status === 'approved' &&
                      actionButton('Receive Stock', PackageCheck, () =>
                        runAction(receiveOrder, order.id,
                          `${order.order_number} received — stock added to your branch.`))}

                    {/* Seller actions */}
                    {!isBuyer && order.status === 'paid' &&
                      actionButton('Fulfill & Ship', Truck, () =>
                        runAction(fulfillOrder, order.id,
                          `${order.order_number} fulfilled — stock deducted and marked in transit.`))}

                    {/* Either side: cancel while unpaid */}
                    {order.status === 'pending_payment' &&
                      actionButton('Cancel', Ban, () =>
                        runAction(cancelOrder, order.id, `${order.order_number} cancelled.`),
                        'danger')}

                    <button
                      onClick={() => setExpandedId(expanded ? null : order.id)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all duration-200"
                    >
                      {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="px-5 pb-5">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl divide-y divide-slate-200 dark:divide-slate-700/50 transition-colors duration-200">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="p-3 flex justify-between text-sm">
                          <span className="text-slate-700 dark:text-slate-300 transition-colors duration-200">
                            {item.product?.name ?? 'Unknown product'}{' '}
                            <span className="text-slate-400 dark:text-slate-500">× {item.quantity}</span>
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white transition-colors duration-200">
                            {formatNaira(item.unit_price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <CreateOrderModal isOpen={showCreate} onClose={() => setShowCreate(false)} />

      {/* Payment confirmation (PRD: confirmation dialogs; money is moving) */}
      <Modal
        isOpen={confirmPay !== null}
        onClose={() => setConfirmPay(null)}
        title={`Pay ${confirmPay?.order_number ?? ''}?`}
        actions={
          <>
            <button
              onClick={() => setConfirmPay(null)}
              className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:border-red-500/20 rounded-xl text-sm font-medium transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (confirmPay) {
                  runAction(payOrder, confirmPay.id,
                    `${confirmPay.order_number} paid — ${formatNaira(confirmPay.total_amount)} transferred to ${confirmPay.seller_branch?.name}.`);
                }
                setConfirmPay(null);
              }}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-red-600/30"
            >
              Confirm Payment
            </button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-300 transition-colors duration-200">
          <strong className="text-slate-900 dark:text-white">{formatNaira(confirmPay?.total_amount ?? 0)}</strong> will be transferred
          from your branch wallet to <strong className="text-slate-900 dark:text-white">{confirmPay?.seller_branch?.name}</strong> branch.
          Both wallets' ledgers will record this transaction permanently.
        </p>
      </Modal>
    </div>
  );
};