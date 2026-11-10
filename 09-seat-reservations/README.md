# Challenge 09 — Interactive Seat Reservation Simulator

**Difficulty:** Hard  
**Core topics:** Reservation invariants, allocation rules, expirations  
**Constraint:** 100% local data. No backend, REST API, GraphQL, or network requests.

## Task instructions

Build an entirely local cinema seat-booking simulator.
1. Render a 2D seat grid with unavailable, available, held, and booked seats.
2. Allow selection of up to 6 adjacent seats per booking.
3. Disallow selecting booked/unavailable seats and enforce row boundaries.
4. Implement Redux reducers to hold, release and confirm seats locally.
5. Use a simulated clock tick to expire holds after 2 minutes.
6. Implement group pricing and a derived booking-summary selector.
7. Add undo for the last unconfirmed seat selection.
8. Persist confirmed bookings to localStorage and restore state.
Bonus: add "best available seats" algorithm with deterministic tie-breaking.

## Getting started

```bash
npm install
npm run dev
```

Run `npm run build` to check types and production compilation. Run `npm test` after adding tests.

## Starter files

- `src/app/store.ts` — configured Redux store and typed hooks.
- `src/features/seatsSlice.ts` — minimal slice and seed data; extend this.
- `src/App.tsx` — minimal UI demonstrating dispatch and selection.

## Definition of done

- All numbered requirements are implemented without any API call.
- UI demonstrates the behaviors, including invalid states and edge cases.
- At least five meaningful automated tests cover reducers/selectors and key edge cases.
- `npm run build` and `npm test` pass.

> This is a scaffold and assignment, not a solved project.
