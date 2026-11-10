# Challenge 07 — Simulated Notification Center

**Difficulty:** Hard  
**Core topics:** Listener middleware, notification lifecycle, scheduling simulation  
**Constraint:** 100% local data. No backend, REST API, GraphQL, or network requests.

## Task instructions

Build a notification center with locally generated events ONLY.
1. Provide a "Generate notification" button instead of WebSocket/API.
2. Simulate a timed notification stream with setInterval in React effects.
3. Normalize notifications and prevent duplicate IDs.
4. Track read/unread, mark all read, archive, restore, and delete.
5. Add filters by priority/category and group notifications by day.
6. Use listener middleware to enforce a maximum of 100 entries.
7. Implement a snooze feature using a checked timestamp and tick action.
8. Ensure timers are cleaned up and state survives refresh.
Bonus: add in-app toast queue with dismissal and pause functionality.

## Getting started

```bash
npm install
npm run dev
```

Run `npm run build` to check types and production compilation. Run `npm test` after adding tests.

## Starter files

- `src/app/store.ts` — configured Redux store and typed hooks.
- `src/features/notificationsSlice.ts` — minimal slice and seed data; extend this.
- `src/App.tsx` — minimal UI demonstrating dispatch and selection.

## Definition of done

- All numbered requirements are implemented without any API call.
- UI demonstrates the behaviors, including invalid states and edge cases.
- At least five meaningful automated tests cover reducers/selectors and key edge cases.
- `npm run build` and `npm test` pass.

> This is a scaffold and assignment, not a solved project.
