# Challenge 01 — Advanced Shopping Cart

**Difficulty:** Medium  
**Core topics:** Cart state, variant keys, memoized selectors, undo  
**Constraint:** 100% local data. No backend, REST API, GraphQL, or network requests.

## Task instructions

Build a shopping cart with product variants and robust local persistence.
1. Add/remove products and modify quantities using Redux reducers.
2. Use a composite key for product + size/color and merge matching items.
3. Enforce inventory limits and prevent negative quantities.
4. Implement coupon codes SAVE10 and FLAT20 with validation.
5. Derive subtotal, discounts, shipping, and total using memoized selectors.
6. Persist to localStorage with validation of restored data.
7. Implement undo for the most recent removal, expiring after the next cart edit.
8. Add at least five reducer/selector tests, including edge cases.
Bonus: support cart bulk actions and per-item gift wrap.

## Getting started

```bash
npm install
npm run dev
```

Run `npm run build` to check types and production compilation. Run `npm test` after adding tests.

## Starter files

- `src/app/store.ts` — configured Redux store and typed hooks.
- `src/features/cartSlice.ts` — minimal slice and seed data; extend this.
- `src/App.tsx` — minimal UI demonstrating dispatch and selection.

## Definition of done

- All numbered requirements are implemented without any API call.
- UI demonstrates the behaviors, including invalid states and edge cases.
- At least five meaningful automated tests cover reducers/selectors and key edge cases.
- `npm run build` and `npm test` pass.

> This is a scaffold and assignment, not a solved project.
