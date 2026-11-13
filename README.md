# Futbolchi Pro (MVP)

A browser football career game. You create a fictional footballer, pick one training option a week, and watch the matches play out automatically in a 2D replay. Each season ends with a summary, a story and a shareable card. You climb from an academy club up a fictional league pyramid. The UI is in Uzbek; the code is in English.

## Run

```bash
npm install
npm run dev          # starts both: API on :8787 and the game on http://localhost:5173
```

Open the game at **http://localhost:5173**. Port 8787 is the API server only; opening it in a browser redirects to the game. To run the two separately: `npm run dev:server` and `npm run dev:web`.

## New player flow

1. **Loading** — a rolling counter shows how many players have registered (`GET /api/stats`, a real count).
2. **Main menu** — the player enters a name; the price (5 000 so'm) appears next to *Davom etish*.
3. **Payment** — the player transfers to the card shown, uploads a receipt image ("chek") and waits. The page polls and continues by itself once an admin approves.
4. **Persona** — appearance (head shape, skin, hair style and colour, height, weight, strong foot) with a live pixel avatar, then position and bonus points. Appearance is cosmetic only.
5. **Game.**

## Server settings (environment variables)

| Variable | Purpose | Dev default |
|---|---|---|
| `PAYMENT_CARD_NUMBER`, `PAYMENT_CARD_HOLDER` | Card shown to players on the payment page | placeholder `0000 0000 0000 0000` |
| `PERSONA_PRICE_MINOR` | Price in tiyin | `500000` (5 000 so'm) |
| `ADMIN_TOKEN` | Admin panel token | `dev-admin-token` (admin is disabled in production if unset) |
| `PAYMENT_EVENT_SECRET` | Signs admin payment decisions | dev value (required in production) |
| `DATA_DIR` | Where `db.json` and receipt images are stored | `apps/server/data` |

```bash
npm test             # all unit tests (engine, server, replay timeline)
npm run typecheck
npx tsx packages/engine/scripts/balance-report.ts 200 6
```

## Admin panel

Open `http://localhost:5173/#/admin` and enter the admin token. It has three parts:

- **To'lovsiz kirish** — gives this browser a free persona slot, so the owner can play without paying. It is recorded as a 0 so'm receipt.
- **To'lovlar** — uploaded receipts with their images; approve or reject (a rejection reason is shown to the player).
- **Highlightlar** — mark match events as highlights.

## Layout

| Path | What |
|---|---|
| `packages/engine` | Pure, deterministic simulation (no DOM, no I/O, no `Math.random`). Persona, training, match, league, season, story. |
| `apps/web` | Vite + React SPA. Game state lives in `localStorage` as plain JSON. Includes the canvas replay and share card. |
| `apps/server` | Fastify. `PaymentProvider` interface with a manual provider (receipt upload + admin approval) and a mock (tests), idempotent payment events, receipts, save sync, admin. JSON-file store and receipt images in `apps/server/data/` (git-ignored). |
| `BALANCE.md` | Every formula and tunable number. |

## Stack rationale

- **TypeScript everywhere.** One data model is shared by the engine, the UI and the server.
- **The engine is a plain TS package.** It is testable on its own, and later the server can re-simulate a match to verify a result.
- **Vite + React.** Widely used and quick to build with. The replay is a plain `<canvas>`, so no game engine is needed.
- **Fastify + JSON store.** It gives a real webhook endpoint now. The store can be swapped for Postgres or SQLite later.

## Not in the MVP (by design)

- Automatic payment providers: see `TODO(payme)` and `TODO(click)` in `apps/server/src/payments/PaymentProvider.ts`. Payments are confirmed by hand for now.
- Deleting old receipt images: see `TODO(privacy)` in `apps/server/src/store/proofStorage.ts`.
- Accounts: the user id is an anonymous id kept in localStorage.
- Video highlights, the mobile app, and multiplayer.
