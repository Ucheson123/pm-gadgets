import { useMemo, useState } from 'react';
import { BadgePercent, Loader2, Minus, Plus, ScanBarcode, Search, ShoppingCart, Trash2, UserRound } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import {
  useBranchStock, useUnitsInStock, formatNaira, parseImeiText, variantLabel,
} from '../../hooks/useInventory';
import { useCreateSale, useCustomers } from '../../hooks/useSales';
import { ReceiptModal } from './ReceiptModal';

interface CartLine {
  product_id: string;
  name: string;
  price: number;
  maxQty: number;
  quantity: number;
  trackImei: boolean;
  imeiText: string;        // untracked products: optional free entry
  selectedImeis: string[]; // tracked products: picked from real stock
}

// Picker of real in-stock IMEIs for a tracked cart line
const ImeiPicker = ({
  productId, quantity, selected, onToggle, disabled,
}: {
  productId: string;
  quantity: number;
  selected: string[];
  onToggle: (imei: string) => void;
  disabled: boolean;
}) => {
  const units = useUnitsInStock(productId);
  const full = selected.length >= quantity;

  return (
    <div>
      <p className={`text-xs mb-1 flex items-center gap-1.5 ${
        selected.length === quantity ? 'text-emerald-600' : 'text-slate-500'
      }`}>
        <ScanBarcode size={13} />
        Select the exact unit(s) being sold — {selected.length} / {quantity}
      </p>
      {units.isLoading && (
        <div className="p-2 flex justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      )}
      {!units.isLoading && (
        <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
          {(units.data ?? []).map((u) => {
            const isSelected = selected.includes(u.imei);
            return (
              <label
                key={u.id}
                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  !isSelected && full ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(u.imei)}
                  disabled={disabled || (!isSelected && full)}
                  className="rounded accent-red-600"
                />
                <span className="text-slate-700 dark:text-slate-300">{u.imei}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const POSView = () => {
  const { addToast } = useToast();
  const stock = useBranchStock();
  const customers = useCustomers();
  const createSale = useCreateSale();

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState({ full_name: '', phone: '', email: '' });
  const [applyVat, setApplyVat] = useState(false);
  const [discountText, setDiscountText] = useState('');
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);

  // Parents never carry stock, so quantity > 0 naturally hides them here
  const sellable = useMemo(() => {
    const rows = (stock.data ?? []).filter((r) => r.quantity > 0);
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(term) || r.sku.toLowerCase().includes(term)
    );
  }, [stock.data, search]);

  const addToCart = (productId: string) => {
    const row = (stock.data ?? []).find((r) => r.id === productId);
    if (!row) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === productId);
      if (existing) {
        return prev.map((l) =>
          l.product_id === productId
            ? { ...l, quantity: Math.min(l.quantity + 1, l.maxQty) }
            : l
        );
      }
      return [
        ...prev,
        {
          product_id: row.id, name: row.name, price: row.price,
          maxQty: row.quantity, quantity: 1,
          trackImei: row.track_imei, imeiText: '', selectedImeis: [],
        },
      ];
    });
  };

  const updateLine = (productId: string, patch: Partial<CartLine>) =>
    setCart((prev) =>
      prev.map((l) => (l.product_id === productId ? { ...l, ...patch } : l))
    );

  const setLineQty = (line: CartLine, qty: number) => {
    // Reducing quantity may orphan surplus IMEI selections — trim them
    updateLine(line.product_id, {
      quantity: qty,
      selectedImeis: line.selectedImeis.slice(0, qty),
    });
  };

  const toggleLineImei = (line: CartLine, imei: string) => {
    const selected = line.selectedImeis.includes(imei)
      ? line.selectedImeis.filter((x) => x !== imei)
      : [...line.selectedImeis, imei];
    updateLine(line.product_id, { selectedImeis: selected });
  };

  const removeLine = (productId: string) =>
    setCart((prev) => prev.filter((l) => l.product_id !== productId));

  const subtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const parsedDiscount = parseFloat(discountText);
  const discount = isNaN(parsedDiscount) ? 0 : Math.max(0, parsedDiscount);
  const discountTooLarge = discount > subtotal;
  const vat = applyVat ? Math.round((subtotal - Math.min(discount, subtotal)) * 7.5) / 100 : 0;
  const total = Math.max(0, subtotal - discount) + vat;

  const validate = (): string | null => {
    if (cart.length === 0) return 'Add at least one product to the sale.';
    if (discountTooLarge) {
      return `Discount (${formatNaira(discount)}) cannot exceed the subtotal (${formatNaira(subtotal)}).`;
    }
    for (const line of cart) {
      if (line.trackImei) {
        if (line.selectedImeis.length !== line.quantity) {
          return `"${line.name}": select exactly ${line.quantity} IMEI(s) from stock (${line.selectedImeis.length} selected).`;
        }
      } else {
        const imeis = parseImeiText(line.imeiText);
        if (imeis.length > 0 && imeis.length !== line.quantity) {
          return `"${line.name}": ${imeis.length} IMEI(s) entered but quantity is ${line.quantity}.`;
        }
      }
    }
    if (!customerId && !newCustomer.full_name.trim()) {
      return 'Enter the customer name (or pick an existing customer).';
    }
    return null;
  };

  const handleCheckout = () => {
    const problem = validate();
    if (problem) {
      addToast(problem, 'error');
      return;
    }

    createSale.mutate(
      {
        customer: customerId
          ? { id: customerId }
          : {
              full_name: newCustomer.full_name.trim(),
              phone: newCustomer.phone.trim(),
              email: newCustomer.email.trim(),
            },
        items: cart.map((l) => {
          const imeis = l.trackImei ? l.selectedImeis : parseImeiText(l.imeiText);
          return {
            product_id: l.product_id,
            quantity: l.quantity,
            ...(imeis.length > 0 ? { imeis } : {}),
          };
        }),
        applyVat,
        discount,
      },
      {
        onSuccess: (result) => {
          addToast(`Sale ${result.receipt_number} recorded — ${formatNaira(result.total_amount)}.`, 'success');
          setCart([]);
          setCustomerId('');
          setNewCustomer({ full_name: '', phone: '', email: '' });
          setApplyVat(false);
          setDiscountText('');
          setReceiptSaleId(result.sale_id);
        },
        onError: (error) => addToast(error.message, 'error'),
      }
    );
  };

  const inputClass =
    'w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm text-slate-900 dark:text-white transition-all disabled:opacity-50';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* LEFT: product picker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9`}
              placeholder="Search products in stock..."
            />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
          {stock.isLoading && (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}
          {!stock.isLoading && sellable.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500">
              No in-stock products{search ? ` matching "${search}"` : ''}.
            </p>
          )}
          {sellable.map((row) => (
            <button
              key={row.id}
              onClick={() => addToCart(row.id)}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-white truncate">
                  {row.name}
                  {row.track_imei && (
                    <ScanBarcode size={13} className="inline ml-1.5 text-red-500 align-[-2px]" />
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {row.sku} · {row.quantity} in stock
                  {row.variant_attributes && ` · ${variantLabel(row.variant_attributes)}`}
                </p>
              </div>
              <span className="font-semibold text-slate-900 dark:text-white shrink-0">
                {formatNaira(row.price)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT: cart + customer + checkout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-5">
        <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <ShoppingCart size={18} /> Current Sale
        </h2>

        {cart.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Tap a product on the left to add it to the sale.
          </p>
        ) : (
          <div className="space-y-4">
            {cart.map((line) => (
              <div key={line.product_id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                    {line.name}
                  </p>
                  <button
                    onClick={() => removeLine(line.product_id)}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => line.quantity > 1
                        ? setLineQty(line, line.quantity - 1)
                        : removeLine(line.product_id)}
                      className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-slate-900 dark:text-white">
                      {line.quantity}
                    </span>
                    <button
                      onClick={() => setLineQty(line, Math.min(line.quantity + 1, line.maxQty))}
                      disabled={line.quantity >= line.maxQty}
                      className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="text-xs text-slate-400">max {line.maxQty}</span>
                  </div>
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">
                    {formatNaira(line.price * line.quantity)}
                  </span>
                </div>

                {line.trackImei ? (
                  <ImeiPicker
                    productId={line.product_id}
                    quantity={line.quantity}
                    selected={line.selectedImeis}
                    onToggle={(imei) => toggleLineImei(line, imei)}
                    disabled={createSale.isPending}
                  />
                ) : (
                  <textarea
                    value={line.imeiText}
                    onChange={(e) => updateLine(line.product_id, { imeiText: e.target.value })}
                    rows={1}
                    className={inputClass}
                    placeholder={`IMEI/serial (optional) — one per line (${line.quantity} needed if used)`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Customer */}
        <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <UserRound size={15} /> Customer
          </h3>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={createSale.isPending}
            className={inputClass}
          >
            <option value="">+ New customer</option>
            {(customers.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}{c.phone ? ` — ${c.phone}` : ''}
              </option>
            ))}
          </select>
          {!customerId && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={newCustomer.full_name}
                onChange={(e) => setNewCustomer((c) => ({ ...c, full_name: e.target.value }))}
                disabled={createSale.isPending}
                className={inputClass}
                placeholder="Full name *"
              />
              <input
                type="tel"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
                disabled={createSale.isPending}
                className={inputClass}
                placeholder="Phone"
              />
              <input
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
                disabled={createSale.isPending}
                className={inputClass}
                placeholder="Email"
              />
            </div>
          )}
        </div>

        {/* Discount + VAT + totals */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <BadgePercent size={15} /> Discount (₦) — optional
            </label>
            <input
              type="number"
              value={discountText}
              onChange={(e) => setDiscountText(e.target.value)}
              min="0"
              step="0.01"
              disabled={createSale.isPending}
              className={`${inputClass} ${discountTooLarge ? 'border-red-500 focus:ring-red-500' : ''}`}
              placeholder="0.00"
            />
            {discountTooLarge && (
              <p className="text-xs text-red-600 mt-1">
                Discount cannot exceed the subtotal ({formatNaira(subtotal)}).
              </p>
            )}
            {discount > 0 && !discountTooLarge && (
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                Discounts are printed on the receipt and recorded in the audit trail.
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={applyVat}
              onChange={(e) => setApplyVat(e.target.checked)}
              disabled={createSale.isPending}
              className="rounded accent-red-600"
            />
            Apply VAT (7.5% of amount after discount)
          </label>

          <div className="space-y-1">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Subtotal</span><span>{formatNaira(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-amber-600 dark:text-amber-500">
                <span>Discount</span><span>−{formatNaira(Math.min(discount, subtotal))}</span>
              </div>
            )}
            {applyVat && (
              <div className="flex justify-between text-sm text-slate-500">
                <span>VAT (7.5%)</span><span>{formatNaira(vat)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg text-slate-900 dark:text-white">
              <span>Total</span><span>{formatNaira(total)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={createSale.isPending || cart.length === 0 || discountTooLarge}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-lg shadow-red-600/20 transition-all active:scale-[0.98]"
          >
            {createSale.isPending && <Loader2 size={18} className="animate-spin" />}
            {createSale.isPending ? 'Recording sale...' : 'Complete Sale & Generate Receipt'}
          </button>
        </div>
      </div>

      <ReceiptModal saleId={receiptSaleId} onClose={() => setReceiptSaleId(null)} />
    </div>
  );
};