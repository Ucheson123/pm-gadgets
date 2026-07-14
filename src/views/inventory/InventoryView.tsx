import { useState, useMemo } from 'react';
import { Search, Plus, PackagePlus, PackageX, SlidersHorizontal, Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBranchStock, formatNaira, LOW_STOCK_THRESHOLD } from '../../hooks/useInventory';
import type { StockRow } from '../../hooks/useInventory';
import { AddProductModal } from './AddProductModal';
import { AdjustStockModal } from './AdjustStockModal';
import { EditProductModal } from './EditProductModal';

const StockBadge = ({ quantity }: { quantity: number }) => {
  if (quantity === 0) {
    return (
      <span className="px-2.5 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-semibold transition-colors">
        Out of Stock
      </span>
    );
  }
  if (quantity < LOW_STOCK_THRESHOLD) {
    return (
      <span className="px-2.5 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-xs font-semibold transition-colors">
        Low Stock
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full text-xs font-semibold transition-colors">
      In Stock
    </span>
  );
};

const TableSkeleton = () => (
  <div className="divide-y divide-slate-200 dark:divide-slate-800 transition-colors duration-200">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="p-5 flex items-center justify-between animate-pulse">
        <div className="space-y-2">
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
        </div>
        <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
      </div>
    ))}
  </div>
);

export const InventoryView = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const { data: stock, isLoading, isError, error } = useBranchStock();

  const [search, setSearch] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<StockRow | null>(null);
  const [editingProduct, setEditingProduct] = useState<StockRow | null>(null);

  const filteredStock = useMemo(() => {
    if (!stock) return [];
    const term = search.trim().toLowerCase();
    if (!term) return stock;
    return stock.filter(
      (row) =>
        row.name.toLowerCase().includes(term) || row.sku.toLowerCase().includes(term)
    );
  }, [stock, search]);

  return (
    <div className="space-y-6">
      {/* Toolbar: search + manager actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-400 dark:text-slate-500 transition-colors" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 hover:border-red-100 dark:hover:border-red-500/30"
            placeholder="Search by product name or SKU..."
          />
        </div>
        {isManager && (
          <button
            onClick={() => setShowAddProduct(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-lg shadow-red-600/20 transition-all duration-200 active:scale-[0.98]"
          >
            <Plus size={18} /> Add Product
          </button>
        )}
      </div>

      {/* Stock table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors duration-200">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors duration-200">
          <h2 className="font-bold text-slate-900 dark:text-white transition-colors">Branch Stock</h2>
          {stock && (
            <span className="text-sm text-slate-500 dark:text-slate-400 transition-colors">
              {filteredStock.length} of {stock.length} product(s)
            </span>
          )}
        </div>

        {isLoading && <TableSkeleton />}

        {isError && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 transition-colors">
            <PackageX className="w-12 h-12 mx-auto mb-3 text-red-300 dark:text-red-900" />
            <p className="font-medium text-red-600 dark:text-red-400 mb-1">
              Failed to load inventory
            </p>
            <p className="text-sm">{error?.message}</p>
          </div>
        )}

        {!isLoading && !isError && filteredStock.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 transition-colors">
            <PackagePlus className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            {stock && stock.length > 0 ? (
              <p>No products match "{search}".</p>
            ) : (
              <>
                <p className="mb-1 font-medium">No products in the catalog yet.</p>
                {isManager ? (
                  <p className="text-sm">Click "Add Product" to create the first one.</p>
                ) : (
                  <p className="text-sm">Your branch manager hasn't added products yet.</p>
                )}
              </>
            )}
          </div>
        )}

        {!isLoading && !isError && filteredStock.length > 0 && (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 transition-colors duration-200">
            {filteredStock.map((row) => (
              <div
                key={row.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between hover:bg-red-50/50 dark:hover:bg-red-500/5 transition-colors duration-200"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate transition-colors">
                    {row.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors">
                    {isManager ? (
                      <>
                        SKU: {row.sku} · Cost: {formatNaira(row.cost_price)} · Sells:{' '}
                        {formatNaira(row.price)}
                      </>
                    ) : (
                      <>
                        SKU: {row.sku} · {formatNaira(row.price)}
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-slate-900 dark:text-white transition-colors">
                      {row.quantity}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 transition-colors">in stock</p>
                  </div>
                  <StockBadge quantity={row.quantity} />
                  {isManager && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingProduct(row)}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors duration-200"
                      >
                        <Pencil size={15} /> Edit
                      </button>
                      <button
                        onClick={() => setAdjustingProduct(row)}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors duration-200"
                      >
                        <SlidersHorizontal size={15} /> Adjust
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manager-only modals */}
      {isManager && (
        <>
          <AddProductModal
            isOpen={showAddProduct}
            onClose={() => setShowAddProduct(false)}
          />
          <AdjustStockModal
            product={adjustingProduct}
            onClose={() => setAdjustingProduct(null)}
          />
          <EditProductModal
            product={editingProduct}
            onClose={() => setEditingProduct(null)}
          />
        </>
      )}
    </div>
  );
};