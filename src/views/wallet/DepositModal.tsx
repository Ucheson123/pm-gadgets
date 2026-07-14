import { useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useDeposit } from '../../hooks/useWallet';
import { formatNaira } from '../../hooks/useInventory';
import { PaymentWindowClosedError } from '../../lib/paystack';

interface DepositModalProps {
  isOpen: boolean;
  walletId: string;
  onClose: () => void;
}

const QUICK_AMOUNTS = [5000, 20000, 50000, 100000];
const MIN_DEPOSIT = 100; // Paystack minimum charge is around NGN 100

export const DepositModal = ({ isOpen, walletId, onClose }: DepositModalProps) => {
  const { addToast } = useToast();
  const deposit = useDeposit();
  const [amount, setAmount] = useState('');

  const parsedAmount = parseFloat(amount);
  const amountIsValid = !isNaN(parsedAmount) && parsedAmount >= MIN_DEPOSIT;

  const resetAndClose = () => {
    setAmount('');
    onClose();
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!amountIsValid) {
      addToast(`Minimum deposit is ${formatNaira(MIN_DEPOSIT)}.`, 'error');
      return;
    }

    deposit.mutate(
      { walletId, amountNaira: parsedAmount },
      {
        onSuccess: (result) => {
          if (result.status === 'completed' || result.status === 'already_completed') {
            addToast(
              `Wallet credited${result.new_balance != null ? ` — new balance ${formatNaira(result.new_balance)}` : ''}.`,
              'success'
            );
            resetAndClose();
          } else {
            addToast(
              `Payment not confirmed (gateway status: ${result.gateway_status}). Your wallet was not charged.`,
              'error'
            );
          }
        },
        onError: (error) => {
          if (error instanceof PaymentWindowClosedError) {
            addToast('Payment cancelled. No money was moved.', 'info');
          } else {
            addToast(error.message, 'error');
          }
        },
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Deposit to Branch Wallet">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            Amount (₦)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={MIN_DEPOSIT}
            step="0.01"
            required
            disabled={deposit.isPending}
            className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white text-lg font-semibold transition-all duration-200 disabled:opacity-50 hover:border-red-100 dark:hover:border-red-500/30"
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => setAmount(String(quick))}
              disabled={deposit.isPending}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:text-red-400 disabled:opacity-50"
            >
              {formatNaira(quick)}
            </button>
          ))}
        </div>

        <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm text-slate-500 dark:text-slate-400 transition-colors duration-200">
          <ShieldCheck size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-500" />
          <span>
            Payment opens in Paystack's secure window (card, bank, transfer, or USSD).
            Your wallet is credited only after the payment is verified with Paystack's
            servers.
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={resetAndClose}
            disabled={deposit.isPending}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:border-red-500/20 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={deposit.isPending || !amountIsValid}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-red-600/30"
          >
            {deposit.isPending && <Loader2 size={16} className="animate-spin" />}
            {deposit.isPending ? 'Processing...' : 'Proceed to Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};