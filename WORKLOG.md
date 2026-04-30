# Work Log

## Document Check

- [x] Opened `PRD.md` before starting implementation on 2026-04-29.
- [x] Opened `AGENTS.md` before starting implementation on 2026-04-29.
- [x] Opened the local skills folder and reviewed `skills/best-practices/SKILL.md`.
- [x] Reviewed `skills/best-practices/references/agent-principles.md`.
- [x] Reviewed `skills/best-practices/references/architecture.md`.
- [x] Reviewed `skills/best-practices/references/web3-contracts.md`.
- [x] Re-opened `PRD.md` before milestone `0.2` implementation on 2026-04-29.
- [x] Re-opened `AGENTS.md` before milestone `0.2` implementation on 2026-04-29.
- [x] Reviewed `skills/best-practices/references/web2-backend.md`.
- [x] Reviewed `skills/best-practices/references/testing.md`.
- [x] Re-opened `PRD.md` and `AGENTS.md` before milestone `0.2` verification on 2026-04-29.
- [x] Reviewed `skills/best-practices/references/agent-principles.md` before milestone `0.2` verification.
- [x] Re-opened `PRD.md` before milestone `0.3` implementation on 2026-04-30.
- [x] Re-opened `AGENTS.md` before milestone `0.3` implementation on 2026-04-30.
- [x] Re-opened the local skills folder and reviewed `skills/best-practices/SKILL.md` before milestone `0.3`.
- [x] Reviewed `skills/best-practices/references/agent-principles.md` before milestone `0.3`.
- [x] Reviewed `skills/best-practices/references/web2-backend.md` before milestone `0.3`.
- [x] Reviewed `skills/best-practices/references/testing.md` before milestone `0.3`.
- [x] Re-opened `PRD.md` and `AGENTS.md` before milestone `0.3` verification on 2026-04-30.
- [x] Re-opened the local skills folder and reviewed `skills/best-practices/SKILL.md` before milestone `0.3` verification.
- [x] Reviewed `skills/best-practices/references/agent-principles.md` before milestone `0.3` verification.
- [x] Re-opened `PRD.md` before milestone `0.4` implementation on 2026-04-30.
- [x] Re-opened `AGENTS.md` before milestone `0.4` implementation on 2026-04-30.
- [x] Re-opened the local skills folder and reviewed `skills/best-practices/SKILL.md` before milestone `0.4`.
- [x] Reviewed `skills/best-practices/references/agent-principles.md` before milestone `0.4`.
- [x] Reviewed `skills/best-practices/references/web3-contracts.md` before milestone `0.4`.

## Progress Tracker

| Milestone | Status | Notes | Updated At |
|---|---|---|---|
| 0.1 | Completed | Verified root app scaffolding, Docker runtime, lowdb persistence, deterministic hashing helpers, safe decimal utility, wagmi/viem Sepolia wiring, contract read smoke test, local `.env.app` / `.env.deploy`, Foundry install script, local Foundry binary, deploy script outside container app, and contract scaffold. Verified `npm run lint`, `npm run typecheck`, `npm run build`, `docker compose up -d --build`, `POST /api/properties`, persistence after container restart, and `tools/foundry/forge.exe build`. Milestone checklist and acceptance criteria marked done in `PRD.md` per user request. | 2026-04-30 |
| 0.2 | Completed | Added `/api/fiat-rates` with OKX server-side fetch, timeout, lowdb cache, stale fallback, standardized error, BRL runtime validation, and safe decimal math. Wired the UI to show house value, offer price, and unit value in ETH/USD/BRL with cache warnings. Added Vitest coverage for live success, cache hit, fallback, standardized error, and BRL route failure. Verified `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and local `GET /api/fiat-rates`. Milestone checklist and acceptance criteria marked done in `PRD.md` per user request. | 2026-04-30 |
| 0.3 | Completed | Reworked the off-chain intake to accept real mock document entries, align property hash payloads with the PRD, normalize `lat` and `lng` to 6 decimals, exclude `uploadedAt` from `documentsHash`, and render deterministic preview hashes before save. Verified `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, live `POST /api/properties`, live `GET /api/properties`, and persistence in `/app/offchain-db/db.json`. Milestone checklist and acceptance criteria marked done in `PRD.md` per user request after verification. | 2026-04-30 |
| 0.4 | Completed | Implemented `PropertyRegistry` registration flow with owner-gated external contract config, `PropertyRecord` storage, `UsufructPosition` storage scaffold, `nextPropertyId`, `propertyExists`, owner indexes, participants, deterministic unit split, and `PropertyRegistered` / `ParticipantAdded` events. Added Foundry coverage for happy path and validation failures, plus frontend registration from saved lowdb drafts to Sepolia with transaction confirmation, decoded `propertyId`, and persisted dashboard linkage back into `db.json`. Verified `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `tools/foundry/forge.exe build`, and `tools/foundry/forge.exe test`. Milestone checklist and acceptance criteria marked done in `PRD.md` per user confirmation after verification. | 2026-04-30 |
