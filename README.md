# WanderChain v6.1 — hardened
**What’s fixed from v6**
- Valid JSON in all `package.json` (no unescaped quotes).
- Added missing `@fastify/cookie` dep; API registers it.
- Switched dev runners to **`tsx`** for clean ESM DX; `ts-node` removed from dev scripts.
- Corrected shared import to **`@pkg/shared`** (compiled dist) everywhere.
- Setup uses **`prisma db push`** (non-interactive) by default to avoid hangs.
- Added **Jest smoke test**, ESLint config, and **CI** workflow.
- Kept all v6 features: **Amadeus Flights + Hotels**, **Redis token cache**, **opossum** circuit breaker + **p-retry**, **BullMQ priority queues**, **React Query** UI, **Prometheus metrics**.

## Quickstart (Windows/macOS/Linux)
```bash
pnpm i
cp .env.example .env
pnpm setup          # docker up db/redis, prisma generate + db push + seed, enable PostGIS + geom index
pnpm dev            # api:4000, web:3000, worker metrics:4001
```

## Dev login & GraphQL
```bash
# login
curl -s -X POST http://localhost:4000/auth/dev-login -H "content-type: application/json" -d '{"username":"dev","password":"dev"}'

# auth radius search (replace TOKEN)
TOKEN="..."
curl -s -X POST http://localhost:4000/graphql -H "content-type: application/json" -H "authorization: Bearer $TOKEN"   -d '{"query":"query($i:SearchInput!){search(input:$i){place{name countryCode} offers{provider priceMinor currency}}}","variables":{"i":{"query":"","lat":66.5039,"lng":25.7294,"radiusKm":50}}}'
```

## Live Amadeus (optional)
Set in `.env`: `ENABLE_AMADEUS=true` and provide `AMADEUS_CLIENT_ID/SECRET` (Self‑Service test env).

## Scripts
- `pnpm setup` — infra up, schema push, seed, PostGIS, geom index
- `pnpm dev` — runs API/Worker/Web via `tsx`
- `pnpm tsc:check` / `pnpm build` — typecheck and build
- `pnpm -r test` — runs Jest smoke in API
- `k6 run infra/k6/scale.js` — 1k VU load
- `pnpm tsx infra/queues/flood.ts` — enqueue 10k provider jobs
- `docker compose -f infra/zap/docker-compose.zap.yml up --exit-code-from zap` — ZAP baseline scan
