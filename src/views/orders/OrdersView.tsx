import { useMemo, useState } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, Ban, ChevronDown, ChevronUp,
  CreditCard, HandCoins, Loader2, PackageCheck, Plus, Truck,
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
  awaiting_payment: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pending Payment',
  paid: 'Paid',
  processing: 'Processing',
  approved: 'In Transit',
  awaiting_payment: 'Payment Due',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

// For a credit order, the created state means "awaiting seller's decision
// to ship on credit", not "awaiting payment" — label it honestly
const statusLabel = (order: OrderRow): string =>
  order.payment_terms === 'on_delivery' && order.status === 'pending_payment'
    ? 'Awaiting Fulfillment'
    : STATUS_LABELS[order.status];

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
  const [confirmCreditShip, setConfirmCreditShip] = useState<OrderRow | null>(null);

  const anyActionPending =
    payOrder.isPending || fulfillOrder.isPending ||
    receiveOrder.isPending || cancelOrder.isPending;

  const visibleOrders = useMemo(() => {
    const rows = orders.data ?? [];
    return tab === 'outgoing'
      ? rows.filter((o) => o.buyer_branch_id === user?.branch_id)
      : rows.filter((o) => o.seller_branch_id === user?.branch_id);
  }, [orders.data, tab, user?.branch_id]);

  // Trade-credit visibility: what we owe, and what is owed to us
  const { payables, receivables } = useMemo(() => {
    const rows = (orders.data ?? []).filter((o) => o.status === 'awaiting_payment');
    return {
      payables: rows
        .filter((o) => o.buyer_branch_id === user?.branch_id)
        .reduce((sum, o) => sum + o.total_amount, 0),
      receivables: rows
        .filter((o) => o.seller_branch_id === user?.branch_id)
        .reduce((sum, o) => sum + o.total_amount, 0),
    };
  }, [orders.data, user?.branch_id]);

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
      {/* Tabs + create button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {(['outgoing', 'incoming'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {t === 'outgoing' ? <ArrowUpFromLine size={15} /> : <ArrowDownToLine size={15} />}
              {t === 'outgoing' ? 'Outgoing Orders' : 'Incoming Orders'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-lg shadow-red-600/20 transition-all active:scale-[0.98]"
        >
          <Plus size={18} /> New Order
        </button>
      </div>

      {/* Outstanding credit summary — visible until debts are settled */}
      {(payables > 0 || receivables > 0) && (
        <div className="flex flex-wrap gap-3">
          {payables > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-900/15 border border-rose-200 dark:border-rose-900/40 rounded-xl text-sm">
              <HandCoins size={16} className="text-rose-600" />
              <span className="text-rose-700 dark:text-rose-400">
                You owe <b>{formatNaira(payables)}</b> on delivered credit orders
              </span>
            </div>
          )}
          {receivables > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-sm">
              <HandCoins size={16} className="text-emerald-600" />
              <span className="text-emerald-700 dark:text-emerald-400">
                Other branches owe you <b>{formatNaira(receivables)}</b>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Orders list */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {orders.isLoading && (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {orders.isError && (
          <div className="p-12 text-center text-slate-500">
            <p className="font-medium text-red-600 dark:text-red-400 mb-1">Failed to load orders</p>
            <p className="text-sm">{orders.error?.message}</p>
          </div>
        )}

        {!orders.isLoading && !orders.isError && visibleOrders.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <Truck className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p>
              {tab === 'outgoing'
                ? 'No outgoing orders yet. Click "New Order" to order from another branch.'
                : 'No incoming orders from other branches yet.'}
            </p>
          </div>
        )}

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {visibleOrders.map((order) => {
            const isBuyer = order.buyer_branch_id === user?.branch_id;
            const expanded = expandedId === order.id;
            const isCredit = order.payment_terms === 'on_delivery';
            return (
              <div key={order.id}>
                <div className="p-5 flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {order.order_number}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[order.status]}`}>
                        {statusLabel(order)}
                      </span>
                      {isCredit && (
                        <span
                          title="Pay on delivery — seller ships first, buyer pays after receiving"
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        >
                          <HandCoins size={11} /> CREDIT
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {isBuyer
                        ? `From ${order.seller_branch?.name ?? '?'} branch`
                        : `To ${order.buyer_branch?.name ?? '?'} branch`}
                      {' · '}{formatDate(order.created_at)}
                      {' · '}{order.order_items.length} product(s)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <span className="font-bold text-slate-900 dark:text-white mr-2">
                      {formatNaira(order.total_amount)}
                    </span>

                    {/* Buyer actions */}
                    {isBuyer && !isCredit && order.status === 'pending_payment' &&
                      actionButton('Pay', CreditCard, () => setConfirmPay(order))}
                    {isBuyer && isCredit && order.status === 'awaiting_payment' &&
                      actionButton('Pay Now', CreditCard, () => setConfirmPay(order))}
                    {isBuyer && order.status === 'approved' &&
                      actionButton('Receive Stock', PackageCheck, () =>
                        runAction(receiveOrder, order.id,
                          isCredit
                            ? `${order.order_number} received — stock added. Payment of ${formatNaira(order.total_amount)} is now due.`
                            : `${order.order_number} received — stock added to your branch.`))}

                    {/* Seller actions */}
                    {!isBuyer && !isCredit && order.status === 'paid' &&
                      actionButton('Fulfill & Ship', Truck, () =>
                        runAction(fulfillOrder, order.id,
                          `${order.order_number} fulfilled — stock deducted and marked in transit.`))}
                    {!isBuyer && isCredit && order.status === 'pending_payment' &&
                      actionButton('Ship on Credit', Truck, () => setConfirmCreditShip(order))}

                    {/* Either side: cancel before fulfillment/payment */}
                    {order.status === 'pending_payment' &&
                      actionButton('Cancel', Ban, () =>
                        runAction(cancelOrder, order.id, `${order.order_number} cancelled.`),
                        'danger')}

                    <button
                      onClick={() => setExpandedId(expanded ? null : order.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="px-5 pb-5">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl divide-y divide-slate-200 dark:divide-slate-700/50">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="p-3 flex justify-between text-sm">
                          <span className="text-slate-700 dark:text-slate-300">
                            {item.product?.name ?? 'Unknown product'}{' '}
                            <span className="text-slate-400">× {item.quantity}</span>
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white">
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

      {/* Payment confirmation — wording adapts to prepaid vs settling a debt */}
      <Modal
        isOpen={confirmPay !== null}
        onClose={() => setConfirmPay(null)}
        title={`Pay ${confirmPay?.order_number ?? ''}?`}
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
                  const isCreditSettle = confirmPay.payment_terms === 'on_delivery';
                  runAction(payOrder, confirmPay.id,
                    isCreditSettle
                      ? `${confirmPay.order_number} settled — ${formatNaira(confirmPay.total_amount)} paid to ${confirmPay.seller_branch?.name}. Order completed.`
                      : `${confirmPay.order_number} paid — ${formatNaira(confirmPay.total_amount)} transferred to ${confirmPay.seller_branch?.name}.`);
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
          <strong>{formatNaira(confirmPay?.total_amount ?? 0)}</strong> will be transferred
          from your branch wallet to <strong>{confirmPay?.seller_branch?.name}</strong> branch.
          {confirmPay?.payment_terms === 'on_delivery' && (
            <> This settles the outstanding debt for goods you have already received, and
            completes the order.</>
          )}{' '}
          Both wallets' ledgers will record this transaction permanently.
        </p>
      </Modal>

      {/* Credit-shipping confirmation — the seller consciously extends credit */}
      <Modal
        isOpen={confirmCreditShip !== null}
        onClose={() => setConfirmCreditShip(null)}
        title={`Ship ${confirmCreditShip?.order_number ?? ''} on credit?`}
        actions={
          <>
            <button
              onClick={() => setConfirmCreditShip(null)}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (confirmCreditShip) {
                  runAction(fulfillOrder, confirmCreditShip.id,
                    `${confirmCreditShip.order_number} shipped on credit — ${confirmCreditShip.buyer_branch?.name} owes ${formatNaira(confirmCreditShip.total_amount)} on receipt.`);
                }
                setConfirmCreditShip(null);
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Ship Without Payment
            </button>
          </>
        }
      >
        <p>
          This order is on <strong>pay-on-delivery</strong> terms: your stock leaves now,{' '}
          <strong>before any payment</strong>. Once{' '}
          <strong>{confirmCreditShip?.buyer_branch?.name}</strong> receives the goods, they will
          owe your branch <strong>{formatNaira(confirmCreditShip?.total_amount ?? 0)}</strong>{' '}
          until they pay. If you are not willing to extend this credit, cancel here and ask them
          to reorder on Pay Now terms.
        </p>
      </Modal>
    </div>
  );
};