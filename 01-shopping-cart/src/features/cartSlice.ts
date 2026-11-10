import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';

export type CouponCode = 'SAVE10' | 'FLAT20';
export type ShippingMethod = 'standard' | 'express';

export const GIFT_WRAP_FEE = 3;

export interface CartItem {
  key: string; // composite: productId|size|color
  productId: string;
  name: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  stock: number;
  giftWrap: boolean;
}

export type NewCartItem = Omit<CartItem, 'key' | 'quantity' | 'giftWrap'> & {
  quantity?: number;
  giftWrap?: boolean;
};

export interface CartState {
  items: CartItem[];
  coupon: CouponCode | null;
  couponInput: string;
  couponError: string | null;
  shippingMethod: ShippingMethod;
  lastRemovedItem: CartItem | null;
  selected: string[]; // keys selected for bulk actions (not persisted)
}

export const makeItemKey = (productId: string, size: string, color: string) =>
  [productId, size, color].map(s => s.trim().toLowerCase()).join('|');

const isCoupon = (v: unknown): v is CouponCode => v === 'SAVE10' || v === 'FLAT20';
const round2 = (n: number) => Math.round(n * 100) / 100;
const toQty = (n: unknown) => (Number.isFinite(n) ? Math.floor(n as number) : NaN);

const isValidItem = (i: any): boolean =>
  !!i &&
  typeof i.key === 'string' && i.key.length > 0 &&
  typeof i.productId === 'string' &&
  typeof i.name === 'string' &&
  typeof i.size === 'string' &&
  typeof i.color === 'string' &&
  Number.isFinite(i.unitPrice) && i.unitPrice >= 0 &&
  Number.isInteger(i.stock) && i.stock > 0 &&
  Number.isInteger(i.quantity) && i.quantity > 0;

const emptyState = (): CartState => ({
  items: [],
  coupon: null,
  couponInput: '',
  couponError: null,
  shippingMethod: 'standard',
  lastRemovedItem: null,
  selected: [],
});

/** Pure + exported so it can be unit-tested. Never trusts stored data. */
export function parseCartState(raw: string | null): CartState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return null;

    const seen = new Set<string>();
    const items: CartItem[] = [];
    for (const i of parsed.items) {
      if (!isValidItem(i) || seen.has(i.key)) continue;
      seen.add(i.key);
      items.push({
        key: i.key,
        productId: i.productId,
        name: i.name,
        size: i.size,
        color: i.color,
        unitPrice: i.unitPrice,
        stock: i.stock,
        quantity: Math.min(i.quantity, i.stock),
        giftWrap: i.giftWrap === true,
      });
    }

    return {
      ...emptyState(),
      items,
      coupon: isCoupon(parsed.coupon) ? parsed.coupon : null,
      shippingMethod: parsed.shippingMethod === 'express' ? 'express' : 'standard',
    };
  } catch {
    return null;
  }
}

const loadInitialState = (): CartState => {
  try {
    const restored = parseCartState(localStorage.getItem('cart_state'));
    if (restored) return restored;
  } catch {
    /* localStorage unavailable */
  }
  return {
    ...emptyState(),
    items: [
      {
        key: makeItemKey('shirt', 'M', 'blue'),
        productId: 'shirt',
        name: 'Shirt',
        size: 'M',
        color: 'Blue',
        unitPrice: 25,
        quantity: 1,
        stock: 8,
        giftWrap: false,
      },
    ],
  };
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState: loadInitialState(),
  reducers: {
    addItem: (state, action: PayloadAction<NewCartItem>) => {
      const p = action.payload;
      if (!(p.stock > 0) || !(p.unitPrice >= 0)) return;
      const qty = Math.max(1, toQty(p.quantity ?? 1) || 1);
      const key = makeItemKey(p.productId, p.size, p.color);

      state.lastRemovedItem = null; // any edit expires undo

      const existing = state.items.find(i => i.key === key);
      if (existing) {
        existing.quantity = Math.min(existing.stock, existing.quantity + qty);
      } else {
        state.items.push({
          ...p,
          key,
          quantity: Math.min(p.stock, qty),
          giftWrap: p.giftWrap ?? false,
        });
      }
    },

    removeItem: (state, action: PayloadAction<string>) => {
      const index = state.items.findIndex(i => i.key === action.payload);
      if (index < 0) return;
      state.lastRemovedItem = state.items[index];
      state.items.splice(index, 1);
      state.selected = state.selected.filter(k => k !== action.payload);
    },

    updateQuantity: (state, action: PayloadAction<{ key: string; quantity: number }>) => {
      const item = state.items.find(i => i.key === action.payload.key);
      const qty = toQty(action.payload.quantity);
      if (!item || Number.isNaN(qty)) return;

      state.lastRemovedItem = null; // clear FIRST, so a removal below can set it
      if (qty <= 0) {
        state.lastRemovedItem = item;
        state.items = state.items.filter(i => i.key !== item.key);
        state.selected = state.selected.filter(k => k !== item.key);
      } else {
        item.quantity = Math.min(item.stock, qty);
      }
    },

    undoRemoval: state => {
      const removed = state.lastRemovedItem;
      if (!removed) return;
      const existing = state.items.find(i => i.key === removed.key);
      if (existing) {
        existing.quantity = Math.min(existing.stock, existing.quantity + removed.quantity);
      } else {
        state.items.push(removed);
      }
      state.lastRemovedItem = null;
    },

    /** Pass a code to validate + apply, or null to remove the coupon. */
    applyCoupon: (state, action: PayloadAction<string | null>) => {
      if (action.payload === null) {
        state.coupon = null;
        state.couponError = null;
        state.lastRemovedItem = null;
        return;
      }
      const code = action.payload.trim().toUpperCase();
      if (isCoupon(code)) {
        state.coupon = code;
        state.couponInput = '';
        state.couponError = null;
        state.lastRemovedItem = null;
      } else {
        state.couponError = 'Invalid coupon. Use SAVE10 or FLAT20.';
      }
    },

    setCouponInput: (state, action: PayloadAction<string>) => {
      state.couponInput = action.payload;
      state.couponError = null;
    },

    setShippingMethod: (state, action: PayloadAction<ShippingMethod>) => {
      state.shippingMethod = action.payload;
      state.lastRemovedItem = null;
    },

    clearCart: state => {
      Object.assign(state, emptyState(), { shippingMethod: state.shippingMethod });
    },

    // ---- Bonus: gift wrap + bulk actions ----
    toggleGiftWrap: (state, action: PayloadAction<string>) => {
      const item = state.items.find(i => i.key === action.payload);
      if (!item) return;
      state.lastRemovedItem = null;
      item.giftWrap = !item.giftWrap;
    },

    toggleSelected: (state, action: PayloadAction<string>) => {
      state.selected = state.selected.includes(action.payload)
        ? state.selected.filter(k => k !== action.payload)
        : [...state.selected, action.payload];
    },

    toggleSelectAll: state => {
      const allKeys = state.items.map(i => i.key);
      const allSelected = allKeys.length > 0 && allKeys.every(k => state.selected.includes(k));
      state.selected = allSelected ? [] : allKeys;
    },

    setGiftWrapForSelected: (state, action: PayloadAction<boolean>) => {
      state.lastRemovedItem = null;
      for (const item of state.items) {
        if (state.selected.includes(item.key)) item.giftWrap = action.payload;
      }
    },
  },
});

export const {
  addItem, removeItem, updateQuantity, undoRemoval,
  applyCoupon, setCouponInput, setShippingMethod, clearCart,
  toggleGiftWrap, toggleSelected, toggleSelectAll, setGiftWrapForSelected,
} = cartSlice.actions;

// ---- Memoized selectors (narrow inputs so typing in the coupon box doesn't recompute) ----
type Root = { cart: CartState };
const selectItems = (s: Root) => s.cart.items;
const selectCoupon = (s: Root) => s.cart.coupon;
const selectShippingMethod = (s: Root) => s.cart.shippingMethod;

export const selectItemCount = createSelector([selectItems], items =>
  items.reduce((n, i) => n + i.quantity, 0)
);

export const selectSubtotal = createSelector([selectItems], items =>
  round2(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0))
);

export const selectDiscount = createSelector([selectSubtotal, selectCoupon], (subtotal, coupon) => {
  if (coupon === 'SAVE10') return round2(subtotal * 0.1);
  if (coupon === 'FLAT20') return Math.min(subtotal, 20);
  return 0;
});

export const selectShippingCost = createSelector(
  [selectItemCount, selectShippingMethod],
  (count, method) => (count === 0 ? 0 : method === 'express' ? 15 : 5)
);

export const selectGiftWrapTotal = createSelector([selectItems], items =>
  items.filter(i => i.giftWrap).length * GIFT_WRAP_FEE
);

export const selectTotal = createSelector(
  [selectSubtotal, selectDiscount, selectShippingCost, selectGiftWrapTotal],
  (subtotal, discount, shipping, wrap) => Math.max(0, round2(subtotal - discount + shipping + wrap))
);

export default cartSlice.reducer;