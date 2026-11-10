import {
  createSlice,
  createEntityAdapter,
  createSelector,
  nanoid,
  PayloadAction,
} from '@reduxjs/toolkit';

// ---------- Types ----------
export type StockEventType = 'in' | 'out' | 'reversal';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  openingStock: number;
  threshold: number;
  unitCost: number; // used by the valuation report (bonus)
  archived: boolean;
}

export interface LedgerEvent {
  id: string;
  productId: string;
  type: StockEventType;
  delta: number; // signed: + for in, - for out
  reason: string;
  timestamp: number;
  reversesId?: string; // set only on compensating events
}

export type SortKey = 'name' | 'sku' | 'category' | 'stock';

export interface Filters {
  category: string; // 'all' or a category name
  search: string;
  sortBy: SortKey;
  sortDir: 'asc' | 'desc';
  showArchived: boolean;
}

export interface Feedback {
  kind: 'error' | 'success';
  text: string;
}

export const STORAGE_KEY = 'inventory_state';
export const SCHEMA_VERSION = 1;

// ---------- Adapters ----------
const productsAdapter = createEntityAdapter<Product>();
// No sortComparer on the ledger: ids keep insertion order, which is the audit order.
const ledgerAdapter = createEntityAdapter<LedgerEvent>();

type ProductsState = ReturnType<typeof productsAdapter.getInitialState>;
type LedgerState = ReturnType<typeof ledgerAdapter.getInitialState>;

export interface InventoryState {
  products: ProductsState;
  ledger: LedgerState;
  filters: Filters;
  feedback: Feedback | null;
}

export interface Snapshot {
  version: number;
  products: Product[];
  ledger: LedgerEvent[];
}

const productSel = productsAdapter.getSelectors();
const ledgerSel = ledgerAdapter.getSelectors();

// ---------- Helpers ----------
const round2 = (n: number) => Math.round(n * 100) / 100;
const normSku = (s: string) => s.trim().toUpperCase();
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const isMoney = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

const defaultFilters: Filters = {
  category: 'all',
  search: '',
  sortBy: 'name',
  sortDir: 'asc',
  showArchived: false,
};

const stockFor = (p: Product, events: LedgerEvent[]) =>
  events.reduce((n, e) => (e.productId === p.id ? n + e.delta : n), p.openingStock);

/** Latest event that is neither a reversal nor already reversed. */
const findUndoable = (events: LedgerEvent[]): LedgerEvent | undefined => {
  const reversed = new Set<string>();
  for (const e of events) if (e.reversesId) reversed.add(e.reversesId);
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type !== 'reversal' && !reversed.has(e.id)) return e;
  }
  return undefined;
};

// ---------- Schema validation (used for localStorage AND import) ----------
export type ParseResult = { ok: true; data: Snapshot } | { ok: false; error: string };
const bad = (error: string): ParseResult => ({ ok: false, error });

export function parseInventorySnapshot(raw: string | null): ParseResult {
  if (!raw) return bad('Empty input');
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return bad('Not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') return bad('Root must be an object');
  if (parsed.version !== SCHEMA_VERSION) return bad(`Unsupported version (expected ${SCHEMA_VERSION})`);
  if (!Array.isArray(parsed.products) || !Array.isArray(parsed.ledger)) {
    return bad('"products" and "ledger" must be arrays');
  }

  const products: Product[] = [];
  const productIds = new Set<string>();
  const skus = new Set<string>();

  for (let i = 0; i < parsed.products.length; i++) {
    const p = parsed.products[i];
    const at = `products[${i}]`;
    if (!p || typeof p !== 'object') return bad(`${at} must be an object`);
    if (typeof p.id !== 'string' || !p.id) return bad(`${at}.id must be a non-empty string`);
    if (productIds.has(p.id)) return bad(`${at}: duplicate id "${p.id}"`);
    if (typeof p.sku !== 'string' || !p.sku.trim()) return bad(`${at}.sku must be a non-empty string`);
    if (skus.has(normSku(p.sku))) return bad(`${at}: duplicate SKU "${p.sku}"`);
    if (typeof p.name !== 'string' || !p.name.trim()) return bad(`${at}.name must be a non-empty string`);
    if (typeof p.category !== 'string' || !p.category.trim()) return bad(`${at}.category must be a non-empty string`);
    if (!isInt(p.openingStock) || p.openingStock < 0) return bad(`${at}.openingStock must be an integer >= 0`);
    if (!isInt(p.threshold) || p.threshold < 0) return bad(`${at}.threshold must be an integer >= 0`);
    if (!isMoney(p.unitCost)) return bad(`${at}.unitCost must be a number >= 0`);
    if (typeof p.archived !== 'boolean') return bad(`${at}.archived must be a boolean`);
    productIds.add(p.id);
    skus.add(normSku(p.sku));
    products.push({
      id: p.id,
      sku: p.sku.trim(),
      name: p.name.trim(),
      category: p.category.trim(),
      openingStock: p.openingStock,
      threshold: p.threshold,
      unitCost: p.unitCost,
      archived: p.archived,
    });
  }

  const ledger: LedgerEvent[] = [];
  const eventsById = new Map<string, LedgerEvent>();
  const reversedIds = new Set<string>();
  const running = new Map<string, number>(products.map(p => [p.id, p.openingStock]));

  for (let i = 0; i < parsed.ledger.length; i++) {
    const e = parsed.ledger[i];
    const at = `ledger[${i}]`;
    if (!e || typeof e !== 'object') return bad(`${at} must be an object`);
    if (typeof e.id !== 'string' || !e.id) return bad(`${at}.id must be a non-empty string`);
    if (eventsById.has(e.id)) return bad(`${at}: duplicate id "${e.id}"`);
    if (typeof e.productId !== 'string' || !productIds.has(e.productId)) return bad(`${at}.productId does not match a product`);
    if (e.type !== 'in' && e.type !== 'out' && e.type !== 'reversal') return bad(`${at}.type must be in, out or reversal`);
    if (!isInt(e.delta) || e.delta === 0) return bad(`${at}.delta must be a non-zero integer`);
    if (e.type === 'in' && e.delta < 0) return bad(`${at}: "in" events need a positive delta`);
    if (e.type === 'out' && e.delta > 0) return bad(`${at}: "out" events need a negative delta`);
    if (typeof e.reason !== 'string') return bad(`${at}.reason must be a string`);
    if (typeof e.timestamp !== 'number' || !Number.isFinite(e.timestamp)) return bad(`${at}.timestamp must be a number`);

    if (e.type === 'reversal') {
      const target = typeof e.reversesId === 'string' ? eventsById.get(e.reversesId) : undefined;
      if (!target) return bad(`${at}.reversesId must reference an earlier event`);
      if (target.type === 'reversal') return bad(`${at}: cannot reverse a reversal`);
      if (target.productId !== e.productId || target.delta !== -e.delta) {
        return bad(`${at}: does not exactly compensate event "${target.id}"`);
      }
      if (reversedIds.has(target.id)) return bad(`${at}: event "${target.id}" is already reversed`);
      reversedIds.add(target.id);
    } else if (e.reversesId !== undefined) {
      return bad(`${at}: only reversal events may set reversesId`);
    }

    const next = (running.get(e.productId) ?? 0) + e.delta;
    if (next < 0) return bad(`${at}: stock for "${e.productId}" would go negative`);
    running.set(e.productId, next);

    const event: LedgerEvent = {
      id: e.id,
      productId: e.productId,
      type: e.type,
      delta: e.delta,
      reason: e.reason,
      timestamp: e.timestamp,
      ...(e.type === 'reversal' ? { reversesId: e.reversesId } : {}),
    };
    eventsById.set(event.id, event);
    ledger.push(event);
  }

  return { ok: true, data: { version: SCHEMA_VERSION, products, ledger } };
}

// ---------- Initial state ----------
const seedProducts: Product[] = [
  { id: 'p1', sku: 'SKU-001', name: 'Keyboard', category: 'Accessories', openingStock: 8, threshold: 3, unitCost: 45, archived: false },
  { id: 'p2', sku: 'SKU-002', name: 'Mouse', category: 'Accessories', openingStock: 12, threshold: 5, unitCost: 20, archived: false },
  { id: 'p3', sku: 'SKU-003', name: 'Monitor', category: 'Displays', openingStock: 4, threshold: 2, unitCost: 180, archived: false },
];

const fromSnapshot = (d: Snapshot): InventoryState => ({
  products: productsAdapter.setAll(productsAdapter.getInitialState(), d.products),
  ledger: ledgerAdapter.setAll(ledgerAdapter.getInitialState(), d.ledger),
  filters: { ...defaultFilters },
  feedback: null,
});

/** Pure and exported so tests don't depend on localStorage. */
export const seedState = (): InventoryState =>
  fromSnapshot({ version: SCHEMA_VERSION, products: seedProducts, ledger: [] });

const loadInitialState = (): InventoryState => {
  try {
    const result = parseInventorySnapshot(localStorage.getItem(STORAGE_KEY));
    if (result.ok) return fromSnapshot(result.data);
  } catch {
    /* localStorage unavailable */
  }
  return seedState();
};

// ---------- Slice ----------
const setError = (s: InventoryState, text: string) => {
  s.feedback = { kind: 'error', text };
};
const setSuccess = (s: InventoryState, text: string) => {
  s.feedback = { kind: 'success', text };
};

interface NewProductInput {
  sku: string;
  name: string;
  category: string;
  openingStock: number;
  threshold: number;
  unitCost: number;
}

interface StockEventInput {
  productId: string;
  type: 'in' | 'out';
  quantity: number;
  reason?: string;
}

export const inventorySlice = createSlice({
  name: 'inventory',
  initialState: loadInitialState(),
  reducers: {
    addProduct: {
      reducer(state, action: PayloadAction<NewProductInput & { id: string }>) {
        const p = action.payload;
        const sku = String(p.sku ?? '').trim();
        const name = String(p.name ?? '').trim();
        const category = String(p.category ?? '').trim() || 'Uncategorized';

        if (!sku) return setError(state, 'SKU is required.');
        if (!name) return setError(state, 'Name is required.');
        if (!isInt(p.openingStock) || p.openingStock < 0) return setError(state, 'Opening stock must be a whole number >= 0.');
        if (!isInt(p.threshold) || p.threshold < 0) return setError(state, 'Low-stock threshold must be a whole number >= 0.');
        if (!isMoney(p.unitCost)) return setError(state, 'Unit cost must be a number >= 0.');
        if (productSel.selectAll(state.products).some(x => normSku(x.sku) === normSku(sku))) {
          return setError(state, `Duplicate SKU: "${sku}" already exists.`);
        }

        productsAdapter.addOne(state.products, {
          id: p.id,
          sku,
          name,
          category,
          openingStock: p.openingStock,
          threshold: p.threshold,
          unitCost: p.unitCost,
          archived: false,
        });
        setSuccess(state, `Added ${name} (${sku}).`);
      },
      prepare: (input: NewProductInput) => ({ payload: { ...input, id: nanoid() } }),
    },

    renameProduct: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const name = action.payload.name.trim();
      if (!productSel.selectById(state.products, action.payload.id)) return setError(state, 'Product not found.');
      if (!name) return setError(state, 'Name cannot be empty.');
      productsAdapter.updateOne(state.products, { id: action.payload.id, changes: { name } });
      state.feedback = null;
    },

    archiveProduct: (state, action: PayloadAction<string>) => {
      if (!productSel.selectById(state.products, action.payload)) return setError(state, 'Product not found.');
      productsAdapter.updateOne(state.products, { id: action.payload, changes: { archived: true } });
      state.feedback = null;
    },

    unarchiveProduct: (state, action: PayloadAction<string>) => {
      if (!productSel.selectById(state.products, action.payload)) return setError(state, 'Product not found.');
      productsAdapter.updateOne(state.products, { id: action.payload, changes: { archived: false } });
      state.feedback = null;
    },

    recordStock: {
      reducer(state, action: PayloadAction<StockEventInput & { id: string; timestamp: number }>) {
        const { id, productId, type, quantity, timestamp } = action.payload;
        const product = productSel.selectById(state.products, productId);
        if (!product) return setError(state, 'Product not found.');
        if (product.archived) return setError(state, `${product.name} is archived. Unarchive it first.`);
        if (!isInt(quantity) || quantity <= 0) return setError(state, 'Quantity must be a whole number greater than 0.');

        const available = stockFor(product, ledgerSel.selectAll(state.ledger));
        if (type === 'out' && quantity > available) {
          return setError(state, `Cannot remove ${quantity}: only ${available} of ${product.name} available.`);
        }

        ledgerAdapter.addOne(state.ledger, {
          id,
          productId,
          type,
          delta: type === 'in' ? quantity : -quantity,
          reason: action.payload.reason?.trim() || (type === 'in' ? 'Stock in' : 'Stock out'),
          timestamp,
        });
        state.feedback = null;
      },
      prepare: (input: StockEventInput) => ({
        payload: { ...input, id: nanoid(), timestamp: Date.now() },
      }),
    },

    /** Appends a compensating event; the original entry is never modified or deleted. */
    undoLastEvent: {
      reducer(state, action: PayloadAction<{ id: string; timestamp: number }>) {
        const events = ledgerSel.selectAll(state.ledger);
        const target = findUndoable(events);
        if (!target) return setError(state, 'Nothing to undo.');

        const product = productSel.selectById(state.products, target.productId);
        if (!product) return setError(state, 'Product not found.');
        if (product.archived) return setError(state, `${product.name} is archived. Unarchive it to undo.`);
        if (stockFor(product, events) - target.delta < 0) {
          return setError(state, 'Undo would make stock negative.');
        }

        ledgerAdapter.addOne(state.ledger, {
          id: action.payload.id,
          productId: target.productId,
          type: 'reversal',
          delta: -target.delta,
          reason: `Undo: ${target.reason}`,
          timestamp: action.payload.timestamp,
          reversesId: target.id,
        });
        state.feedback = null;
      },
      prepare: () => ({ payload: { id: nanoid(), timestamp: Date.now() } }),
    },

    importSnapshot: (state, action: PayloadAction<string>) => {
      const result = parseInventorySnapshot(action.payload);
      if (!result.ok) return setError(state, `Import rejected: ${result.error}`);
      productsAdapter.setAll(state.products, result.data.products);
      ledgerAdapter.setAll(state.ledger, result.data.ledger);
      state.filters.category = 'all';
      setSuccess(
        state,
        `Imported ${result.data.products.length} products and ${result.data.ledger.length} ledger events.`
      );
    },

    // ---- Filters ----
    setCategoryFilter: (state, action: PayloadAction<string>) => {
      state.filters.category = action.payload;
    },
    setSearch: (state, action: PayloadAction<string>) => {
      state.filters.search = action.payload;
    },
    setSort: (state, action: PayloadAction<SortKey>) => {
      if (state.filters.sortBy === action.payload) {
        state.filters.sortDir = state.filters.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.filters.sortBy = action.payload;
        state.filters.sortDir = 'asc';
      }
    },
    setShowArchived: (state, action: PayloadAction<boolean>) => {
      state.filters.showArchived = action.payload;
    },
    dismissFeedback: state => {
      state.feedback = null;
    },
  },
});

export const {
  addProduct, renameProduct, archiveProduct, unarchiveProduct,
  recordStock, undoLastEvent, importSnapshot,
  setCategoryFilter, setSearch, setSort, setShowArchived, dismissFeedback,
} = inventorySlice.actions;

// ---------- Selectors ----------
type Root = { inventory: InventoryState };

const productSelectors = productsAdapter.getSelectors((s: Root) => s.inventory.products);
const ledgerSelectors = ledgerAdapter.getSelectors((s: Root) => s.inventory.ledger);
const selectFilters = (s: Root) => s.inventory.filters;

export const selectAllProducts = productSelectors.selectAll;
export const selectAllLedger = ledgerSelectors.selectAll;

/** Available stock per product = opening quantity + sum of ledger deltas. */
export const selectStockById = createSelector(
  [selectAllProducts, selectAllLedger],
  (products, events) => {
    const stock: Record<string, number> = {};
    for (const p of products) stock[p.id] = p.openingStock;
    for (const e of events) if (e.productId in stock) stock[e.productId] += e.delta;
    return stock;
  }
);

export interface InventoryRow {
  product: Product;
  stock: number;
  isLow: boolean;
}

export const selectRows = createSelector([selectAllProducts, selectStockById], (products, stock) =>
  products.map<InventoryRow>(p => ({
    product: p,
    stock: stock[p.id],
    isLow: stock[p.id] <= p.threshold,
  }))
);

export const selectCategories = createSelector([selectAllProducts], products =>
  Array.from(new Set(products.map(p => p.category))).sort((a, b) => a.localeCompare(b))
);

export const selectVisibleRows = createSelector([selectRows, selectFilters], (rows, f) => {
  const q = f.search.trim().toLowerCase();
  const dir = f.sortDir === 'asc' ? 1 : -1;
  return rows
    .filter(r => f.showArchived || !r.product.archived)
    .filter(r => f.category === 'all' || r.product.category === f.category)
    .filter(
      r => !q || r.product.name.toLowerCase().includes(q) || r.product.sku.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      let cmp: number;
      if (f.sortBy === 'stock') cmp = a.stock - b.stock;
      else cmp = a.product[f.sortBy].localeCompare(b.product[f.sortBy]);
      return cmp !== 0 ? cmp * dir : a.product.sku.localeCompare(b.product.sku);
    });
});

/** Active products at or below their threshold, lowest stock first. */
export const selectLowStockRows = createSelector([selectRows], rows =>
  rows.filter(r => !r.product.archived && r.isLow).sort((a, b) => a.stock - b.stock)
);

export const selectUndoableEvent = createSelector([selectAllLedger], findUndoable);

export interface CategoryValuation {
  category: string;
  products: number;
  units: number;
  value: number;
}

/** Bonus: per-category inventory valuation (active products only). */
export const selectValuationByCategory = createSelector([selectRows], rows => {
  const map = new Map<string, CategoryValuation>();
  for (const r of rows) {
    if (r.product.archived) continue;
    const entry = map.get(r.product.category) ?? {
      category: r.product.category,
      products: 0,
      units: 0,
      value: 0,
    };
    entry.products += 1;
    entry.units += r.stock;
    entry.value += r.stock * r.product.unitCost;
    map.set(r.product.category, entry);
  }
  return Array.from(map.values())
    .map(v => ({ ...v, value: round2(v.value) }))
    .sort((a, b) => a.category.localeCompare(b.category));
});

export const selectTotalValuation = createSelector([selectValuationByCategory], rows =>
  round2(rows.reduce((sum, r) => sum + r.value, 0))
);

export const selectSnapshot = createSelector(
  [selectAllProducts, selectAllLedger],
  (products, ledger): Snapshot => ({ version: SCHEMA_VERSION, products, ledger })
);

export default inventorySlice.reducer;