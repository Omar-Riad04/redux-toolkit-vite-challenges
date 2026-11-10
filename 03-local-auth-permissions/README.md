# Challenge 03 — Local Roles & Permissions Simulator

**Difficulty:** Hard  
**Core topics:** State machines, role selectors, listener middleware, session expiry simulation  
**Constraint:** 100% local data. No backend, REST API, GraphQL, or network requests.

## Task instructions

Build a LOCAL authentication and authorization simulator; this is NOT real security.
1. Provide three demo accounts: admin, editor, viewer. No passwords or API.
2. Build login/logout reducers and a session finite-state model.
3. Create can(permission) selectors for CRUD actions by role.
4. Guard routes/pages and hide or disable unauthorized controls.
5. Add a simulated session countdown using a component timer dispatching tick.
6. On logout clear all account-specific workspaces and private UI state.
7. Handle switching between demo users without leaking the previous user's data.
8. Add tests for permission transitions and session expiry.
Bonus: implement a local activity log for permission denials.
NOTE: Client-side role logic is for learning UX, not production authentication.

## Getting started

```bash
npm install
npm run dev
```

Run `npm run build` to check types and production compilation. Run `npm test` after adding tests.

## Starter files

- `src/app/store.ts` — configured Redux store and typed hooks.
- `src/features/sessionSlice.ts` — minimal slice and seed data; extend this.
- `src/App.tsx` — minimal UI demonstrating dispatch and selection.

## Definition of done

- All numbered requirements are implemented without any API call.
- UI demonstrates the behaviors, including invalid states and edge cases.
- At least five meaningful automated tests cover reducers/selectors and key edge cases.
- `npm run build` and `npm test` pass.

> This is a scaffold and assignment, not a solved project.
