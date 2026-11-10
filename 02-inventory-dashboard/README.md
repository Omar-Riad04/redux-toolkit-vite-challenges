# Challenge 02 — Inventory & Stock Ledger

**Difficulty:** Medium–Hard  
**Core topics:** Entity adapter, stock ledger, validation, grouped selectors  
**Constraint:** 100% local data. No backend, REST API, GraphQL, or network requests.

## Task instructions

Build a local inventory control dashboard. No network requests.
1. Use createEntityAdapter for products and normalized storage.
2. Add, rename, archive, and unarchive products.
3. Record stock-in and stock-out events in an immutable audit ledger.
4. Compute available stock from opening quantity plus ledger events.
5. Reject negative stock and duplicate SKU entries.
6. Add category filtering, search, sorting, and low-stock alert selectors.
7. Support undo of the latest stock event using a compensating event.
8. Persist state to localStorage and import/export JSON with schema checks.
Bonus: add a per-category inventory valuation report.

## Getting started

```bash
npm install
npm run dev
```

Run `npm run build` to check types and production compilation. Run `npm test` after adding tests.

## Starter files

- `src/app/store.ts` — configured Redux store and typed hooks.
- `src/features/inventorySlice.ts` — minimal slice and seed data; extend this.
- `src/App.tsx` — minimal UI demonstrating dispatch and selection.

## Definition of done

- All numbered requirements are implemented without any API call.
- UI demonstrates the behaviors, including invalid states and edge cases.
- At least five meaningful automated tests cover reducers/selectors and key edge cases.
- `npm run build` and `npm test` pass.

> This is a scaffold and assignment, not a solved project.
