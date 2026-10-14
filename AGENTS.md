# Sandboxx Lock

Keypad lock and web app for Sandboxx (BITS Hyderabad hardware clubs' workspace). Users request access with a reason, a club SuperUser approves, the user gets a 6-digit PIN valid for 12h, and an ESP32 lock checks the PIN against the server. Hosted by DADU.

## Stack
- TanStack Start (React 19, SPA, file routes) on Vite + Nitro, TypeScript strict
- API: Hono, mounted under `/api` (MedC lineage, bphcerp/medical-center-system)
- DB: Postgres + Drizzle (`drizzle-orm/node-postgres`), Postgres runs in docker compose
- UI: Tailwind v4 + shadcn
- Firmware: Arduino IDE 2 sketch for ESP32-S3 in `firmware/`
- Package manager: Bun only (`bun`, `bunx`). Never npm/pnpm.

## Commands
- Dev server: `bun run dev` (port 3000)
- Checks (all must pass): `bunx tsc --noEmit`, `bun run lint`, `bun run build`
- Format: `bunx biome check --write .`

## Layout
- `src/routes`: pages (TanStack file routes; `routeTree.gen.ts` is generated, never edit)
- `src/api`: one Hono router per domain file
- `src/db`: Drizzle table definitions; migrations in `drizzle/`
- `src/lib`: env, helpers
- `firmware/`: ESP32 sketch; `config.h` is gitignored, `config.example.h` is committed
- `docs/`: the project proposal PDF

## Conventions
- Biome: tabs, double quotes. Follow the MedC style: `{ success, data }` / `{ success: false, error: { message } }` envelope, inline zod validation, no try/catch in handlers.
- Tables: snake_case plural names, exported as `xxxTable`, identity integer ids, `createdAt`/`updatedAt`.
- Env is parsed with zod in `src/lib/env.ts`; code reads `env.X`, never `process.env.X`.
- Comments: almost none. Short lowercase "why" comments only. No JSDoc, no numbered step comments, no em-dashes.
- Keep functions few, small and plainly named: the owner must be able to explain every user-defined function to faculty.
- Commits: lowercase conventional, short, no body (`feat: add pin verify endpoint`).

## Never
- Commit secrets or `.env*` / `firmware/**/config.h`; read config from env vars.
- Edit applied migrations, generated files or lockfiles by hand.
- Use `any`, `@ts-ignore`, `biome-ignore` without a reason, or skip checks to make them pass.
- Add libraries, abstraction layers, tests or docs that weren't asked for.
- Push, deploy or run commands against production.
