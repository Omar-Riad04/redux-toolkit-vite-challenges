# Challenge 06 — Advanced Product Filtering Lab

**Difficulty:** Medium–Hard  
**Core topics:** Memoized selectors, composed filters, URL state  
**Constraint:** 100% local data. No backend, REST API, GraphQL, or network requests.

## Task instructions

Build an offline product catalog for practicing selector architecture.
1. Render products from the supplied local mock data.
2. Implement multi-select categories, brands, price range and availability.
3. Add minimum rating, keyword search, sort, and pagination.
4. Use createSelector for derived results; never store filtered items.
5. Reset the page when any filter changes.
6. Sync filter settings to URL query parameters using browser history.
7. Restore filters from the URL on refresh and back/forward navigation.
8. Add tests for interactions between multiple filters.
Bonus: show facet counts that reflect all other active filters.

## Getting started

```bash
npm install
npm run dev
```

Run `npm run build` to check types and production compilation. Run `npm test` after adding tests.

## Starter files

- `src/app/store.ts` — configured Redux store and typed hooks.
- `src/features/catalogSlice.ts` — minimal slice and seed data; extend this.
- `src/App.tsx` — minimal UI demonstrating dispatch and selection.

## Definition of done

- All numbered requirements are implemented without any API call.
- UI demonstrates the behaviors, including invalid states and edge cases.
- At least five meaningful automated tests cover reducers/selectors and key edge cases.
- `npm run build` and `npm test` pass.

> This is a scaffold and assignment, not a solved project.
