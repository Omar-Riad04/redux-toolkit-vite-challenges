import React, { useState } from 'react';
import { store, useAppDispatch, useAppSelector } from './app/store';
import {
  addProduct, renameProduct, archiveProduct, unarchiveProduct,
  recordStock, undoLastEvent, importSnapshot,
  setCategoryFilter, setSearch, setSort, setShowArchived, dismissFeedback,
  selectAllProducts, selectAllLedger, selectVisibleRows, selectCategories,
  selectLowStockRows, selectUndoableEvent, selectValuationByCategory,
  selectTotalValuation, selectSnapshot,
  InventoryRow, SortKey,
} from './features/inventorySlice';
import './style.css';

const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #344056' };
const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #344056', whiteSpace: 'nowrap' };
const input: React.CSSProperties = {
  padding: 8, background: '#2d3950', border: '1px solid #344056', color: '#e9eefa', borderRadius: 6,
};
const row: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 };
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', fontSize: 12, gap: 2 };
// Overrides the global button padding (12px 18px) for buttons inside tables
const small: React.CSSProperties = { padding: '5px 10px', fontSize: 13, borderRadius: 8 };

function ProductRow({ r }: { r: InventoryRow }) {
  const dispatch = useAppDispatch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(r.product.name);
  const { product } = r;

  const save = () => {
    dispatch(renameProduct({ id: product.id, name: draft }));
    setEditing(false);
  };

  return (
    <tr style={{ opacity: product.archived ? 0.55 : 1 }}>
      <td style={td}>{product.sku}</td>
      <td style={td}>
        {editing ? (
          <>
            <input
              style={input}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              aria-label={`New name for ${product.name}`}
            />
            <button style={{ ...small, marginLeft: 6 }} onClick={save}>Save</button>
            <button
              style={{ ...small, marginLeft: 4 }}
              onClick={() => { setEditing(false); setDraft(product.name); }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {product.name} {product.archived && <em>(archived)</em>}
          </>
        )}
      </td>
      <td style={td}>{product.category}</td>
      <td style={{ ...td, color: r.isLow && !product.archived ? '#ff6b6b' : undefined, fontWeight: r.isLow ? 'bold' : undefined }}>
        {r.stock}{r.isLow && !product.archived ? ' ⚠ low' : ''}
      </td>
      <td style={td}>{product.threshold}</td>
      <td style={td}>${product.unitCost.toFixed(2)}</td>
      <td style={td}>
        <div style={{ display: 'flex', gap: 6 }}>
          {!editing && (
            <button style={small} onClick={() => { setDraft(product.name); setEditing(true); }}>Rename</button>
          )}
          {product.archived ? (
            <button style={small} onClick={() => dispatch(unarchiveProduct(product.id))}>Unarchive</button>
          ) : (
            <button style={small} onClick={() => dispatch(archiveProduct(product.id))}>Archive</button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function App() {
  const dispatch = useAppDispatch();
  const feedback = useAppSelector(s => s.inventory.feedback);
  const filters = useAppSelector(s => s.inventory.filters);
  const products = useAppSelector(selectAllProducts);
  const ledger = useAppSelector(selectAllLedger);
  const rows = useAppSelector(selectVisibleRows);
  const categories = useAppSelector(selectCategories);
  const lowStock = useAppSelector(selectLowStockRows);
  const undoable = useAppSelector(selectUndoableEvent);
  const valuation = useAppSelector(selectValuationByCategory);
  const totalValue = useAppSelector(selectTotalValuation);
  const snapshot = useAppSelector(selectSnapshot);

  // Add-product form
  const emptyForm = { sku: '', name: '', category: '', openingStock: '0', threshold: '0', unitCost: '0' };
  const [form, setForm] = useState(emptyForm);
  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const before = store.getState().inventory.products.ids.length;
    dispatch(addProduct({
      sku: form.sku,
      name: form.name,
      category: form.category,
      openingStock: Number(form.openingStock),
      threshold: Number(form.threshold),
      unitCost: Number(form.unitCost),
    }));
    // Only clear the form if the product was actually added
    if (store.getState().inventory.products.ids.length > before) {
      setForm(emptyForm);
    }
  };

  // Stock-event form
  const activeProducts = products.filter(p => !p.archived);
  const [stock, setStock] = useState({ productId: '', type: 'in' as 'in' | 'out', quantity: '1', reason: '' });
  const selectedProductId = stock.productId || activeProducts[0]?.id || '';

  const handleStock = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(recordStock({
      productId: selectedProductId,
      type: stock.type,
      quantity: Number(stock.quantity),
      reason: stock.reason,
    }));
  };

  // Import / export
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    if (!file) return;
    dispatch(importSnapshot(await file.text()));
  };

  const productName = (id: string) => products.find(p => p.id === id)?.name ?? id;
  const reversedIds = new Set(ledger.filter(e => e.reversesId).map(e => e.reversesId));
  const arrow = (k: SortKey) => (filters.sortBy === k ? (filters.sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <main className="container">
      <p className="eyebrow">Redux Toolkit · Challenge 02 · Medium–Hard</p>
      <h1>Inventory & Stock Ledger</h1>
      <p className="subtitle">Entity adapter, stock ledger, validation, grouped selectors</p>

      {feedback && (
        <div
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          style={{
            background: feedback.kind === 'error' ? '#4a1d1d' : '#1d4a2b',
            color: '#fff', padding: '10px 15px', borderRadius: 6, marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>{feedback.text}</span>
          <button style={small} onClick={() => dispatch(dismissFeedback())}>Dismiss</button>
        </div>
      )}

      {lowStock.length > 0 && (
        <section className="panel" style={{ borderColor: '#ff6b6b' }}>
          <h2>⚠ Low-stock alerts ({lowStock.length})</h2>
          <ul>
            {lowStock.map(r => (
              <li key={r.product.id}>
                <strong>{r.product.name}</strong> ({r.product.sku}): {r.stock} left, threshold {r.product.threshold}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>Products</h2>
        <div style={row}>
          <input
            style={input}
            placeholder="Search name or SKU"
            value={filters.search}
            onChange={e => dispatch(setSearch(e.target.value))}
            aria-label="Search products"
          />
          <select style={input} value={filters.category} onChange={e => dispatch(setCategoryFilter(e.target.value))} aria-label="Filter by category">
            <option value="all">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label>
            <input type="checkbox" checked={filters.showArchived} onChange={e => dispatch(setShowArchived(e.target.checked))} /> Show archived
          </label>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}><button style={small} onClick={() => dispatch(setSort('sku'))}>SKU{arrow('sku')}</button></th>
                <th style={th}><button style={small} onClick={() => dispatch(setSort('name'))}>Name{arrow('name')}</button></th>
                <th style={th}><button style={small} onClick={() => dispatch(setSort('category'))}>Category{arrow('category')}</button></th>
                <th style={th}><button style={small} onClick={() => dispatch(setSort('stock'))}>Stock{arrow('stock')}</button></th>
                <th style={th}>Threshold</th>
                <th style={th}>Unit cost</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td style={td} colSpan={7}>No products match your filters.</td></tr>
              ) : (
                rows.map(r => <ProductRow key={r.product.id} r={r} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Add product</h2>
        <form onSubmit={handleAdd} style={{ ...row, alignItems: 'flex-end' }}>
          <input style={input} placeholder="SKU" value={form.sku} onChange={setField('sku')} aria-label="SKU" />
          <input style={input} placeholder="Name" value={form.name} onChange={setField('name')} aria-label="Name" />
          <input style={input} placeholder="Category" value={form.category} onChange={setField('category')} aria-label="Category" />
          <label style={field}>
            Opening stock
            <input style={{ ...input, width: 100 }} type="number" min={0} step={1} value={form.openingStock} onChange={setField('openingStock')} />
          </label>
          <label style={field}>
            Low-stock threshold
            <input style={{ ...input, width: 100 }} type="number" min={0} step={1} value={form.threshold} onChange={setField('threshold')} />
          </label>
          <label style={field}>
            Unit cost ($)
            <input style={{ ...input, width: 100 }} type="number" min={0} step="0.01" value={form.unitCost} onChange={setField('unitCost')} />
          </label>
          <button type="submit">Add product</button>
        </form>
        <p style={{ fontSize: 13, opacity: 0.8 }}>Try a duplicate SKU (e.g. "sku-001") to see validation.</p>
      </section>

      <section className="panel">
        <h2>Record stock event</h2>
        <form onSubmit={handleStock} style={{ ...row, alignItems: 'flex-end' }}>
          <select style={input} value={selectedProductId} onChange={e => setStock(s => ({ ...s, productId: e.target.value }))} aria-label="Product">
            {activeProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
          </select>
          <select style={input} value={stock.type} onChange={e => setStock(s => ({ ...s, type: e.target.value as 'in' | 'out' }))} aria-label="Event type">
            <option value="in">Stock in</option>
            <option value="out">Stock out</option>
          </select>
          <label style={field}>
            Quantity
            <input style={{ ...input, width: 90 }} type="number" min={1} step={1} value={stock.quantity} onChange={e => setStock(s => ({ ...s, quantity: e.target.value }))} />
          </label>
          <input style={input} placeholder="Reason (optional)" value={stock.reason} onChange={e => setStock(s => ({ ...s, reason: e.target.value }))} aria-label="Reason" />
          <button type="submit" disabled={activeProducts.length === 0}>Record</button>
        </form>
        <p style={{ fontSize: 13, opacity: 0.8 }}>Try removing more than is available to see negative stock rejected.</p>
      </section>

      <section className="panel">
        <h2>Audit ledger ({ledger.length})</h2>
        <div style={row}>
          <button onClick={() => dispatch(undoLastEvent())} disabled={!undoable}>
            Undo latest event
          </button>
          {undoable && (
            <span style={{ fontSize: 13 }}>
              Next undo: {productName(undoable.productId)} {undoable.delta > 0 ? '+' : ''}{undoable.delta}
            </span>
          )}
        </div>
        {ledger.length === 0 ? (
          <p>No stock events yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Time</th><th style={th}>Product</th><th style={th}>Type</th>
                  <th style={th}>Δ</th><th style={th}>Reason</th><th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...ledger].reverse().map(e => (
                  <tr key={e.id}>
                    <td style={td}>{new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td style={td}>{productName(e.productId)}</td>
                    <td style={td}>{e.type}</td>
                    <td style={{ ...td, color: e.delta > 0 ? '#6bdc8f' : '#ff6b6b' }}>{e.delta > 0 ? `+${e.delta}` : e.delta}</td>
                    <td style={td}>{e.reason}</td>
                    <td style={td}>{reversedIds.has(e.id) ? 'reversed' : e.type === 'reversal' ? 'compensating' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Valuation by category</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={th}>Category</th><th style={th}>Products</th><th style={th}>Units</th><th style={th}>Value</th></tr>
          </thead>
          <tbody>
            {valuation.map(v => (
              <tr key={v.category}>
                <td style={td}>{v.category}</td><td style={td}>{v.products}</td>
                <td style={td}>{v.units}</td><td style={td}>${v.value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td style={td} colSpan={3}><strong>Total (active products)</strong></td><td style={td}><strong>${totalValue.toFixed(2)}</strong></td></tr>
          </tfoot>
        </table>
      </section>

      <section className="panel">
        <h2>Import / export</h2>
        <div style={row}>
          <button onClick={handleExport}>Export JSON</button>
          <label>
            Import JSON: <input type="file" accept="application/json,.json" onChange={handleImport} />
          </label>
        </div>
        <p style={{ fontSize: 13, opacity: 0.8 }}>
          Imports are schema-checked (types, unique IDs and SKUs, ledger consistency, no negative stock) and rejected as a whole if anything is wrong.
        </p>
      </section>
    </main>
  );
}