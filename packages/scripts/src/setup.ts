import 'dotenv/config';
import { Client } from 'pg';
import { execSync } from 'node:child_process';
import { Redis } from 'ioredis';

function sh(cmd: string) { console.log('> ' + cmd); execSync(cmd, { stdio: 'inherit' }); }

async function waitPostgres(url: string) {
  const client = new Client({ connectionString: url });
  for (let i = 0; i < 30; i++) {
    try { await client.connect(); await client.query('select 1'); await client.end(); return; }
    catch { await new Promise(r => setTimeout(r, 2000)); }
  }
  throw new Error('Postgres not ready');
}
async function waitRedis(url: string) {
  const r = new Redis(url);
  for (let i = 0; i < 30; i++) {
    try { await r.ping(); await r.quit(); return; }
    catch { await new Promise(r => setTimeout(r, 2000)); }
  }
  throw new Error('Redis not ready');
}
async function postgis(url: string) {
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query('CREATE EXTENSION IF NOT EXISTS postgis;');
  await c.query('ALTER TABLE "Place" ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);');
  await c.query('UPDATE "Place" SET geom = ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography WHERE geom IS NULL;');
  await c.query('CREATE INDEX IF NOT EXISTS place_geom_gix ON "Place" USING GIST (geom);');
  await c.end();
}
async function main() {
  const db = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/travel?schema=public';
  const redis = process.env.REDIS_URL || 'redis://localhost:6379';
  try { sh('docker compose up -d db redis'); } catch {}
  await waitPostgres(db); await waitRedis(redis);
  sh('pnpm -F @pkg/db prisma:generate');
  sh('pnpm -F @pkg/db db:push');
  sh('pnpm -F @pkg/db build');
  sh('pnpm -F @pkg/db seed');
  await postgis(db);
  console.log('Setup complete.');
}
main().catch(err => { console.error(err); process.exit(1); });


