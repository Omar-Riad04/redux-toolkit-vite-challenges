# Challenge 08 — Multi-Step Checkout Wizard

**Difficulty:** Medium–Hard  
**Core topics:** Draft persistence, validation, cross-step state  
**Constraint:** 100% local data. No backend, REST API, GraphQL, or network requests.

## Task instructions

Build a local multi-step checkout flow; NO payment processing or API.
1. Make four steps: Contact, Shipping, Preferences, Review.
2. Keep the draft, current step, visited state, and errors in Redux.
3. Validate each step before advancing, including cross-step rules.
4. Allow backward navigation without losing valid draft values.
5. Save non-sensitive fields to localStorage and restore on reload.
6. Implement reset and a mock "Place order" reducer saving local order history.
7. Block duplicate submissions and display an editable confirmation.
8. Add tests for navigation, validation, and restoration.
Bonus: conditionally display a pickup-location step for pickup orders.
Do not collect payment credentials.

## Getting started

```bash
npm install
npm run dev
```

Run `npm run build` to check types and production compilation. Run `npm test` after adding tests.

## Starter files

- `src/app/store.ts` — configured Redux store and typed hooks.
- `src/features/checkoutSlice.ts` — minimal slice and seed data; extend this.
- `src/App.tsx` — minimal UI demonstrating dispatch and selection.

## Definition of done

- All numbered requirements are implemented without any API call.
- UI demonstrates the behaviors, including invalid states and edge cases.
- At least five meaningful automated tests cover reducers/selectors and key edge cases.
- `npm run build` and `npm test` pass.

> This is a scaffold and assignment, not a solved project.
