# Challenge 05 — Social Feed & Undoable Interactions

**Difficulty:** Hard  
**Core topics:** Entity normalization, reaction rules, local operation journal  
**Constraint:** 100% local data. No backend, REST API, GraphQL, or network requests.

## Task instructions

Build a completely local social feed with complex interaction state.
1. Normalize posts and comments using createEntityAdapter.
2. Support likes/unlikes, bookmarks, and comments.
3. Toggle like repeatedly without corrupting reaction counts.
4. Create, edit and delete comments with correct author ownership rules.
5. Add an operation journal that enables undo/redo of the last 20 edits.
6. Allow one reaction per user per post; derive counts using selectors.
7. Filter feed by saved, liked, author, and keyword.
8. Persist state locally with starter seed data.
Bonus: support nested replies and per-post comment sorting.

## Getting started

```bash
npm install
npm run dev
```

Run `npm run build` to check types and production compilation. Run `npm test` after adding tests.

## Starter files

- `src/app/store.ts` — configured Redux store and typed hooks.
- `src/features/feedSlice.ts` — minimal slice and seed data; extend this.
- `src/App.tsx` — minimal UI demonstrating dispatch and selection.

## Definition of done

- All numbered requirements are implemented without any API call.
- UI demonstrates the behaviors, including invalid states and edge cases.
- At least five meaningful automated tests cover reducers/selectors and key edge cases.
- `npm run build` and `npm test` pass.

> This is a scaffold and assignment, not a solved project.
