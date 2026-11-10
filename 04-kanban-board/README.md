# Challenge 04 — Kanban Board & Time Travel

**Difficulty:** Hard  
**Core topics:** createEntityAdapter, task ordering, undo/redo  
**Constraint:** 100% local data. No backend, REST API, GraphQL, or network requests.

## Task instructions

Build a Trello-like local board without a backend.
1. Store tasks as normalized entities using createEntityAdapter.
2. Model Todo, In Progress, Review, Done as ordered arrays of task IDs.
3. Create/edit/delete/assign tasks with due dates and priorities.
4. Move tasks across columns and reorder tasks within a column.
5. Preserve exact ordering when moving tasks between columns.
6. Implement undo/redo for board edits (max 20 states).
7. Add filters by assignee, priority, label and overdue state.
8. Persist and restore the board locally; validate orphan IDs.
Bonus: add drag-and-drop with dnd-kit and keyboard controls.

## Getting started

```bash
npm install
npm run dev
```

Run `npm run build` to check types and production compilation. Run `npm test` after adding tests.

## Starter files

- `src/app/store.ts` — configured Redux store and typed hooks.
- `src/features/boardSlice.ts` — minimal slice and seed data; extend this.
- `src/App.tsx` — minimal UI demonstrating dispatch and selection.

## Definition of done

- All numbered requirements are implemented without any API call.
- UI demonstrates the behaviors, including invalid states and edge cases.
- At least five meaningful automated tests cover reducers/selectors and key edge cases.
- `npm run build` and `npm test` pass.

> This is a scaffold and assignment, not a solved project.
