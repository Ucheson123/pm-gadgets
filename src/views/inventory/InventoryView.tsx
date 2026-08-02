import { useMemo, useState } from 'react';
import { Loader2, Package, PackagePlus, Pencil, ScanBarcode, Search, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  useBranchStock, formatNaira, variantLabel, LOW_STOCK_THRESHOLD,
} from '../../hooks/useInventory';
import type { StockRow } from '../../hooks/useInventory';
import { AddProductModal } from './AddProductModal';
import { AdjustStockModal } from './AdjustStockModal';
import { EditProductModal } from './EditProductModal';

const StockBadge = ({ quantity }: { quantity: number }) => {
  if (quantity === 0) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Out of Stock</span>;
  }
  if (quantity < LOW_STOCK_THRESHOLD) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Low Stock</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">In Stock</span>;
};

interface Grouped {
  standalone: StockRow[];
  groups: { parent: StockRow; children: StockRow[] }[];
}

export const InventoryView = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const stock = useBranchStock();

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const [editing, setEditing] = useState<StockRow | null>(null);

  const grouped: Grouped = useMemo(() => {
    const rows = stock.data ?? [];
    const term = search.trim().toLowerCase();
    const matches = (r: StockRow) =>
      !term || r.name.toLowerCase().includes(term) || r.sku.toLowerCase().includes(term);

    const children = rows.filter((r) => r.parent_id);
    const childrenByParent = new Map<string, StockRow[]>();
    for (const c of children) {
      const list = childrenByParent.get(c.parent_id!) ?? [];
      list.push(c);
      childrenByParent.set(c.parent_id!, list);
    }

    const groups: Grouped['groups'] = [];
    const standalone: StockRow[] = [];

    for (const row of rows) {
      if (row.parent_id) continue; // rendered inside its group
      const kids = childrenByParent.get(row.id);
      if (kids && kids.length > 0) {
        // Parent matches → show all variants; else show only matching variants
        const visibleKids = matches(row) ? kids : kids.filter(matches);
        if (visibleKids.length > 0) groups.push({ parent: row, children: visibleKids });
      } else if (matches(row)) {
        standalone.push(row);
      }
    }
    return { standalone, groups };
  }, [stock.data, search]);

  const visibleCount =
    grouped.standalone.length +
    grouped.groups.reduce((sum, g) => sum + g.children.length, 0);

  const rowActions = (row: StockRow) =>
    isManager && (
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setEditing(row)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors"
        >
          <Pencil size={13} /> Edit
        </button>
        <button
          onClick={() => setAdjusting(row)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
        >
          <SlidersHorizontal size={13} /> Adjust
        </button>
      </div>
    );

  const productRow = (row: StockRow, indent = false) => (
    <div
      key={row.id}
      className={`p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
        indent ? 'pl-8 sm:pl-12' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-slate-900 dark:text-white truncate">{row.name}</p>
          {row.track_imei && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <ScanBarcode size={11} /> IMEI
            </span>
          )}
          <StockBadge quantity={row.quantity} />
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {row.sku}
          {row.variant_attributes && <> · {variantLabel(row.variant_attributes)}</>}
          {' · '}
          {isManager
            ? <>Cost: {formatNaira(row.cost_price)} · Sells: {formatNaira(row.price)}</>
            : <>{formatNaira(row.price)}</>}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-bold text-slate-900 dark:text-white">{row.quantity}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">units</p>
        </div>
        {rowActions(row)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm text-slate-900 dark:text-white transition-all"
            placeholder="Search by product name or SKU..."
          />
        </div>
        {isManager && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-600/20 transition-all active:scale-[0.98]"
          >
            <PackagePlus size={16} /> Add Product
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 className="font-bold text-slate-900 dark:text-white">Branch Inventory</h2>
          <span className="text-sm text-slate-500">
            {visibleCount} product(s){search ? ` matching "${search}"` : ''}
          </span>
        </div>

        {stock.isLoading && (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {stock.isError && (
          <p className="p-8 text-center text-sm text-red-600">{stock.error?.message}</p>
        )}

        {!stock.isLoading && !stock.isError && visibleCount === 0 && (
          <div className="p-12 text-center text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p>{search ? `No products match "${search}".` : 'No products in the catalog yet.'}</p>
          </div>
        )}

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {/* Variant groups: parent header + indented variants */}
          {grouped.groups.map(({ parent, children }) => {
            const totalUnits = children.reduce((sum, c) => sum + c.quantity, 0);
            return (
              <div key={parent.id}>
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{parent.name}</p>
                      {parent.track_imei && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                          <ScanBarcode size={11} /> IMEI
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {children.length} variant(s) · {totalUnits} unit(s) total
                    </p>
                  </div>
                  {isManager && (
                    <button
                      onClick={() => setEditing(parent)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors shrink-0"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {children.map((child) => productRow(child, true))}
                </div>
              </div>
            );
          })}

          {/* Standalone products */}
          {grouped.standalone.map((row) => productRow(row))}
        </div>
      </div>

      <AddProductModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
      <AdjustStockModal product={adjusting} onClose={() => setAdjusting(null)} />
      <EditProductModal product={editing} onClose={() => setEditing(null)} />
    </div>
  );
};