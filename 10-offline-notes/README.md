# Challenge 10 — Offline Notes & Version History

**Difficulty:** Hard+  
**Core topics:** Local change queue, version control, IndexedDB extension  
**Constraint:** 100% local data. No backend, REST API, GraphQL, or network requests.

## Task instructions

Build a local-first notes app without requests to a server.
1. Normalize notes with createEntityAdapter.
2. Create/edit/delete/pin/archive/tag notes.
3. Add per-note revision history (last 10 revisions) and restore a revision.
4. Track unsaved and saved states in Redux with a local save queue.
5. Implement a fake sync engine: manual "Sync to local archive" button.
6. Simulate conflicts by editing a separate archived copy of a note.
7. Resolve conflicts with keep local / keep archive / merge text options.
8. Persist all content in IndexedDB (localStorage acceptable as initial step).
9. Provide export/import JSON with validation.
10. Test revision restoration and conflict resolution.
Bonus: build a local full-text search index.

## Getting started

```bash
npm install
npm run dev
```

Run `npm run build` to check types and production compilation. Run `npm test` after adding tests.

## Starter files

- `src/app/store.ts` — configured Redux store and typed hooks.
- `src/features/notesSlice.ts` — minimal slice and seed data; extend this.
- `src/App.tsx` — minimal UI demonstrating dispatch and selection.

## Definition of done

- All numbered requirements are implemented without any API call.
- UI demonstrates the behaviors, including invalid states and edge cases.
- At least five meaningful automated tests cover reducers/selectors and key edge cases.
- `npm run build` and `npm test` pass.

> This is a scaffold and assignment, not a solved project.
