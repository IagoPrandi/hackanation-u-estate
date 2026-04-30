# Usufruct Protocol

Milestones `0.1` and `0.2` establish the local hybrid Web2/Web3 baseline described in `PRD.md`.

## What is included

- Next.js 16 + TypeScript + Tailwind CSS 4
- `wagmi` + `viem` wired to Sepolia
- Server-side `lowdb` persistence in `offchain-db/db.json`
- Server-side OKX fiat pricing with timeout, cache, and fallback
- Deterministic hashing via stable JSON + `keccak256`
- Dockerfile and `docker-compose.yml`
- Foundry-oriented contract directory scaffold outside the app container

## Local run

```bash
npm run dev
```

## Docker run

```bash
docker compose up --build
```

Local app runtime reads `.env.app`. Deployment secrets stay outside container app in `.env.deploy`.

## Foundry outside app container

```powershell
.\scripts\deploy-sepolia.ps1
```

The wrapper runs `forge script` in dedicated Foundry container, not inside `app`.

## Fiat pricing route

```text
GET /api/fiat-rates
```

The route fetches `ETH-USDC` and `USDC-BRL` from OKX server-side, stores the last valid snapshot in `lowdb`, and returns cached fallback rates when the provider is temporarily unavailable.
