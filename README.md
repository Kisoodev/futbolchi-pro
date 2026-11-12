# Futbolchi Pro (MVP)

A browser football career game. You create a fictional footballer, pick one training option a week, and watch the matches play out automatically in a 2D replay. Each season ends with a summary, a story and a shareable card. You climb from an academy club up a fictional league pyramid. The UI is in Uzbek; the code is in English.

## Run

```bash
npm install
npm run dev:server   # API on :8787 (mock payments, saves, admin)
npm run dev:web      # game on http://localhost:5173
```

```bash
npm test             # all unit tests (engine, server, replay timeline)
npm run typecheck
npx tsx packages/engine/scripts/balance-report.ts 200 6
```

- Admin stub: `http://localhost:5173/#/admin`. The dev token is `dev-admin-token`; set `ADMIN_TOKEN` to change it.

## Layout

| Path | What |
|---|---|
| `packages/engine` | Pure, deterministic simulation (no DOM, no I/O, no `Math.random`). Persona, training, match, league, season, story. |
| `apps/web` | Vite + React SPA. Game state lives in `localStorage` as plain JSON. Includes the canvas replay and share card. |
| `apps/server` | Fastify. `PaymentProvider` interface + mock, idempotent webhooks, receipts, save sync, admin highlights. JSON-file store in `apps/server/data/`. |
| `BALANCE.md` | Every formula and tunable number. |

## Stack rationale

- **TypeScript everywhere.** One data model is shared by the engine, the UI and the server.
- **The engine is a plain TS package.** It is testable on its own, and later the server can re-simulate a match to verify a result.
- **Vite + React.** Widely used and quick to build with. The replay is a plain `<canvas>`, so no game engine is needed.
- **Fastify + JSON store.** It gives a real webhook endpoint now. The store can be swapped for Postgres or SQLite later.

## Not in the MVP (by design)

- Real payment providers: see `TODO(payme)` and `TODO(click)` in `apps/server/src/payments/PaymentProvider.ts`.
- A real price: `PERSONA_PRICE_MINOR` defaults to 0. See `TODO(pricing)`.
- Accounts: the user id is an anonymous id kept in localStorage.
- Video highlights, the mobile app, and multiplayer.
