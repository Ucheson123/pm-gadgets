import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import {
  Wallet as WalletIcon, Plus, ArrowDownLeft, ArrowUpRight,
  ReceiptText, Printer, Download,
} from 'lucide-react';
import {
  useWallet, useWalletStatement, presetToRange,
} from '../../hooks/useWallet';
import type { RangePreset, WalletStatement, StatementTransaction } from '../../hooks/useWallet';
import { useAuth } from '../../context/AuthContext';
import { formatNaira } from '../../hooks/useInventory';
import { DepositModal } from './DepositModal';

const PRESETS: { id: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'last30', label: 'Last 30 Days' },
];

type TypeFilter = 'all' | 'credit' | 'debit';

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'Overall' },
  { id: 'credit', label: 'Credits' },
  { id: 'debit', label: 'Debits' },
];

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const formatDateOnly = (d: Date) =>
  d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });

const toDateInputValue = (d: Date) => d.toISOString().slice(0, 10);

// jsPDF's built-in fonts lack the ₦ glyph, so the PDF uses "NGN"
const pdfMoney = (v: number) =>
  v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ==========================================
// STATEMENT PDF: A4, bank-statement layout with Debit/Credit columns,
// automatic pagination, and page numbers.
// ==========================================
const buildStatementPdf = (
  stmt: WalletStatement,
  transactions: StatementTransaction[],
  branchName: string,
  range: { start: Date; end: Date },
  typeFilter: TypeFilter
) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 12;
  const W = 210;
  // Columns: Date | Description | Debit | Credit | Balance
  const COL = { date: M, desc: M + 30, debit: M + 111, credit: M + 138, balance: W - M };
  const DESC_WIDTH = 76;
  let y = 0;

  const drawTableHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('DATE', COL.date, y);
    doc.text('DESCRIPTION', COL.desc, y);
    doc.text('DEBIT (NGN)', COL.debit + 25, y, { align: 'right' });
    doc.text('CREDIT (NGN)', COL.credit + 25, y, { align: 'right' });
    doc.text('BALANCE (NGN)', COL.balance, y, { align: 'right' });
    y += 2;
    doc.setDrawColor(180);
    doc.line(M, y, W - M, y);
    y += 4;
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
  };

  const newPageIfNeeded = (rowHeight: number) => {
    if (y + rowHeight > 280) {
      doc.addPage();
      y = 15;
      drawTableHeader();
    }
  };

  // ---- Header ----
  y = 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PM GADGETS', M, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Wallet Account Statement', W - M, y, { align: 'right' });
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`${branchName} Branch`, M, y);
  doc.text(
    `Period: ${formatDateOnly(range.start)} — ${formatDateOnly(range.end)}`,
    W - M, y, { align: 'right' }
  );
  y += 5;
  doc.text(`Generated: ${formatDateTime(new Date().toISOString())}`, M, y);
  if (typeFilter !== 'all') {
    doc.setFont('helvetica', 'bold');
    doc.text(`Filter: ${typeFilter === 'credit' ? 'Credits only' : 'Debits only'}`, W - M, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
  }
  y += 4;
  doc.setDrawColor(150);
  doc.line(M, y, W - M, y);
  y += 7;

  // ---- Summary ----
  doc.setTextColor(0);
  doc.setFontSize(9);
  const summary: [string, string][] = [
    ['Opening Balance', pdfMoney(stmt.opening_balance)],
    ['Total Credits', pdfMoney(stmt.total_credits)],
    ['Total Debits', pdfMoney(stmt.total_debits)],
    ['Closing Balance', pdfMoney(stmt.closing_balance)],
  ];
  const boxW = (W - M * 2) / 4;
  summary.forEach(([label, value], i) => {
    const x = M + boxW * i;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`NGN ${value}`, x, y + 5);
    doc.setFontSize(9);
  });
  y += 13;

  // ---- Table ----
  drawTableHeader();
  doc.setFontSize(8);

  if (transactions.length === 0) {
    doc.setTextColor(120);
    doc.text('No transactions in this period.', M, y + 2);
  }

  for (const tx of transactions) {
    const descLines = doc.splitTextToSize(tx.description, DESC_WIDTH);
    const rowHeight = Math.max(descLines.length * 3.6, 5) + 2.5;
    newPageIfNeeded(rowHeight);

    doc.setTextColor(0);
    doc.text(formatDateTime(tx.created_at), COL.date, y);
    doc.text(descLines, COL.desc, y);
    if (tx.type === 'debit') {
      doc.text(pdfMoney(tx.amount), COL.debit + 25, y, { align: 'right' });
    } else {
      doc.text(pdfMoney(tx.amount), COL.credit + 25, y, { align: 'right' });
    }
    doc.text(pdfMoney(tx.balance_after), COL.balance, y, { align: 'right' });
    y += rowHeight;
    doc.setDrawColor(230);
    doc.line(M, y - 2, W - M, y - 2);
  }

  // ---- Page numbers ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount} · PM Gadgets Enterprise`, W / 2, 292, { align: 'center' });
  }

  const name = `statement-${toDateInputValue(range.start)}_to_${toDateInputValue(range.end)}.pdf`;
  doc.save(name);
};

// ==========================================
// Print-friendly statement (rendered in a body portal; the
// .print-receipt-root CSS makes it the only visible thing when printing)
// ==========================================
const StatementPrintContent = ({
  stmt, transactions, branchName, range, typeFilter,
}: {
  stmt: WalletStatement;
  transactions: StatementTransaction[];
  branchName: string;
  range: { start: Date; end: Date };
  typeFilter: TypeFilter;
}) => (
  <div className="bg-white text-slate-900 p-6 text-sm">
    <div className="flex justify-between items-start border-b border-slate-300 pb-3 mb-4">
      <div>
        <p className="font-black text-xl tracking-tight">
          <span className="text-red-600">P</span>M{' '}
          <span className="tracking-widest text-xs font-bold">GADGETS</span>
        </p>
        <p className="text-xs text-slate-500">{branchName} Branch</p>
      </div>
      <div className="text-right text-xs text-slate-500">
        <p className="font-bold text-slate-900 text-sm">Wallet Account Statement</p>
        <p>Period: {formatDateOnly(range.start)} — {formatDateOnly(range.end)}</p>
        {typeFilter !== 'all' && (
          <p className="font-semibold">
            Filter: {typeFilter === 'credit' ? 'Credits only' : 'Debits only'}
          </p>
        )}
      </div>
    </div>

    <div className="grid grid-cols-4 gap-3 mb-4 text-xs">
      <div><p className="text-slate-500">Opening Balance</p><p className="font-bold">{formatNaira(stmt.opening_balance)}</p></div>
      <div><p className="text-slate-500">Total Credits</p><p className="font-bold text-emerald-700">{formatNaira(stmt.total_credits)}</p></div>
      <div><p className="text-slate-500">Total Debits</p><p className="font-bold text-red-700">{formatNaira(stmt.total_debits)}</p></div>
      <div><p className="text-slate-500">Closing Balance</p><p className="font-bold">{formatNaira(stmt.closing_balance)}</p></div>
    </div>

    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-slate-300 text-left text-slate-500">
          <th className="py-1.5 pr-2 font-semibold">Date</th>
          <th className="py-1.5 pr-2 font-semibold">Description</th>
          <th className="py-1.5 pr-2 font-semibold text-right">Debit</th>
          <th className="py-1.5 pr-2 font-semibold text-right">Credit</th>
          <th className="py-1.5 font-semibold text-right">Balance</th>
        </tr>
      </thead>
      <tbody>
        {transactions.length === 0 && (
          <tr><td colSpan={5} className="py-4 text-center text-slate-400">No transactions in this period.</td></tr>
        )}
        {transactions.map((tx) => (
          <tr key={tx.id} className="border-b border-slate-200 align-top">
            <td className="py-1.5 pr-2 whitespace-nowrap">{formatDateTime(tx.created_at)}</td>
            <td className="py-1.5 pr-2">{tx.description}</td>
            <td className="py-1.5 pr-2 text-right">{tx.type === 'debit' ? formatNaira(tx.amount) : ''}</td>
            <td className="py-1.5 pr-2 text-right">{tx.type === 'credit' ? formatNaira(tx.amount) : ''}</td>
            <td className="py-1.5 text-right font-medium">{formatNaira(tx.balance_after)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const WalletView = () => {
  const { user } = useAuth();
  const wallet = useWallet();
  const [preset, setPreset] = useState<RangePreset>('last7');
  const [customStart, setCustomStart] = useState(toDateInputValue(new Date()));
  const [customEnd, setCustomEnd] = useState(toDateInputValue(new Date()));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showDeposit, setShowDeposit] = useState(false);

  const range = useMemo(() => {
    if (preset === 'custom') {
      const start = new Date(customStart + 'T00:00:00');
      const end = new Date(customEnd + 'T23:59:59.999');
      return { start, end };
    }
    return presetToRange(preset);
  }, [preset, customStart, customEnd]);

  const statement = useWalletStatement(range.start, range.end);
  const stmt = statement.data;

  // (1) Overall / Credits / Debits filter, applied client-side
  const filteredTransactions = useMemo(() => {
    if (!stmt) return [];
    if (typeFilter === 'all') return stmt.transactions;
    return stmt.transactions.filter((tx) => tx.type === typeFilter);
  }, [stmt, typeFilter]);

  const branchName = user?.branch_name ?? '';

  const filterChip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-red-600 text-white shadow-sm'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400'
    }`;

  return (
    <div className="space-y-6">
      {/* Balance + period summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden min-w-0 shadow-sm transition-all duration-200 hover:border-red-100 dark:hover:border-red-500/30 hover:shadow-md">
          <div className="absolute top-0 right-0 w-40 h-40 bg-red-600/5 dark:bg-red-600/20 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-2 transition-colors">
              <WalletIcon size={16} /> Branch Wallet Balance
            </div>
            <p className="text-slate-900 dark:text-white text-2xl sm:text-3xl font-black tracking-tight whitespace-nowrap transition-colors" title={formatNaira(wallet.data?.balance ?? 0)}>
              {wallet.isLoading ? '···' : formatNaira(wallet.data?.balance ?? 0)}
            </p>
            <button
              onClick={() => setShowDeposit(true)}
              disabled={!wallet.data}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] shadow-md shadow-red-600/10"
            >
              <Plus size={16} /> Deposit Funds
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 min-w-0 shadow-sm transition-all duration-200 hover:border-red-100 dark:hover:border-red-500/30 hover:shadow-md">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-2 transition-colors">
            <ArrowDownLeft size={16} className="text-emerald-600 dark:text-emerald-500" /> Credits (period)
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-500 whitespace-nowrap transition-colors">
            {stmt ? formatNaira(stmt.total_credits) : '···'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 min-w-0 shadow-sm transition-all duration-200 hover:border-red-100 dark:hover:border-red-500/30 hover:shadow-md">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-2 transition-colors">
            <ArrowUpRight size={16} className="text-red-600 dark:text-red-500" /> Debits (period)
          </div>
          <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-500 whitespace-nowrap transition-colors">
            {stmt ? formatNaira(stmt.total_debits) : '···'}
          </p>
        </div>
      </div>

      {/* Statement */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors duration-200">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4 transition-colors duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900 dark:text-white transition-colors">Account Statement</h2>
            <div className="flex items-center gap-2">
              {/* (2) Print / Download for the selected date range */}
              <button
                onClick={() => window.print()}
                disabled={!stmt}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
              >
                <Printer size={15} /> Print
              </button>
              <button
                onClick={() => stmt && buildStatementPdf(stmt, filteredTransactions, branchName, range, typeFilter)}
                disabled={!stmt}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50 shadow-sm"
              >
                <Download size={15} /> Download PDF
              </button>
            </div>
          </div>

          {stmt && (
            <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors">
              Opening:{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300 transition-colors">
                {formatNaira(stmt.opening_balance)}
              </span>{' '}
              · Closing:{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300 transition-colors">
                {formatNaira(stmt.closing_balance)}
              </span>
            </p>
          )}

          {/* Range filters (PRD §11) */}
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => setPreset(p.id)} className={filterChip(preset === p.id)}>
                {p.label}
              </button>
            ))}
            <button onClick={() => setPreset('custom')} className={filterChip(preset === 'custom')}>
              Custom
            </button>
            {preset === 'custom' && (
              <div className="flex items-center gap-2 animated fadeIn duration-200">
                <input
                  type="date"
                  value={customStart}
                  max={customEnd}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500 hover:border-red-100 dark:hover:border-red-500/30 transition-colors duration-200"
                />
                <span className="text-slate-400 dark:text-slate-500 text-sm select-none">to</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500 hover:border-red-100 dark:hover:border-red-500/30 transition-colors duration-200"
                />
              </div>
            )}
          </div>

          {/* (1) Overall / Credits / Debits */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-3 transition-colors duration-200">
            <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1 select-none">Show:</span>
            {TYPE_FILTERS.map((f) => (
              <button key={f.id} onClick={() => setTypeFilter(f.id)} className={filterChip(typeFilter === f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions list */}
        {statement.isLoading && (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 transition-colors duration-200">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-5 animate-pulse flex justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-56 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        )}

        {statement.isError && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 transition-colors duration-200">
            <p className="font-medium text-red-600 dark:text-red-400 mb-1">
              Failed to load statement
            </p>
            <p className="text-sm">{statement.error?.message}</p>
          </div>
        )}

        {stmt && filteredTransactions.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 transition-colors duration-200">
            <ReceiptText className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700 transition-colors" />
            <p>
              {stmt.transactions.length > 0
                ? `No ${typeFilter === 'credit' ? 'credits' : 'debits'} in this period.`
                : 'No transactions in this period.'}
            </p>
          </div>
        )}

        {filteredTransactions.length > 0 && (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 transition-colors duration-200">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-5 flex items-center justify-between gap-4 hover:bg-red-50/50 dark:hover:bg-red-500/5 transition-colors duration-200 group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      tx.type === 'credit'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {tx.type === 'credit' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate transition-colors duration-200">
                      {tx.description}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate transition-colors duration-200">
                      {formatDateTime(tx.created_at)} · Balance after:{' '}
                      <span className="font-mono">{formatNaira(tx.balance_after)}</span>
                    </p>
                  </div>
                </div>
                <p
                  className={`font-bold shrink-0 whitespace-nowrap transition-colors duration-200 ${
                    tx.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {tx.type === 'credit' ? '+' : '−'}
                  {formatNaira(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {wallet.data && (
        <DepositModal
          isOpen={showDeposit}
          walletId={wallet.data.id}
          onClose={() => setShowDeposit(false)}
        />
      )}

      {/* Body-level print copy of the statement (same CSS hook as receipts) */}
      {stmt &&
        createPortal(
          <div className="print-receipt-root">
            <StatementPrintContent
              stmt={stmt}
              transactions={filteredTransactions}
              branchName={branchName}
              range={range}
              typeFilter={typeFilter}
            />
          </div>,
          document.body
        )}
    </div>
  );
};