import Fastify from 'fastify';
import mercurius from 'mercurius';
import { typeDefs, resolvers } from './schema.js';
import { buildASTSchema } from 'graphql';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import * as dotenv from 'dotenv';
import { createQueues } from './queues.js';
import { authRoutes } from './routes/auth.js';
import { statusRoutes } from './routes/status.js';
import { register } from './metrics.js';
dotenv.config();

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: (origin, cb) => {
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'), false);
  },
  credentials: true
});
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
await app.register(cookie);
await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev' });
await app.register(websocket);

await app.register(mercurius, {
  schema: buildASTSchema(typeDefs as any), resolvers, graphiql: true,
  context: async (req, reply) => {
    try { await (req as any).jwtVerify(); } catch {}
    return { req, reply };
  }
});

await app.register(authRoutes);

// Inline /status/providers route (no module import needed)
app.get('/status/providers', async () => {
  let q: any = (app as any).queues;
  if (!q) { q = createQueues(); (app as any).queues = q; }
  let redisOk = false;
  try { redisOk = (await q.connection.ping()) === 'PONG'; } catch {}
  const [ingest, enrich, providers] = await Promise.all([
    q.ingest.getJobCounts(),
    q.enrich.getJobCounts(),
    q.providers.getJobCounts(),
  ]);
  return {
    ok: true,
    node: process.version,
    fastify: app.version,
    redis: redisOk,
    queues: { ingest, enrich, providers }
  };
});
await app.register(statusRoutes);
createQueues();

app.get('/healthz', async () => ({ ok: true }));
app.get('/metrics', async (req, reply) => {
  reply.header('Content-Type', register.contentType);
  return register.metrics();
});

const port = Number(process.env.PORT || 4000);
app.listen({ port, host: '0.0.0.0' }).catch((e) => { app.log.error(e); process.exit(1); });









import { searchStub } from './graphql/resolvers/search.stub';

// --- DEV: Attach searchStub resolvers after mercurius registration
try {
  // Fastify instance: app
  // Mercurius exposes app.graphql.defineResolvers in runtime
  // Guard to avoid throwing if not available
  // @ts-ignore
  if ((app as any)?.graphql?.defineResolvers) {
    // @ts-ignore
    (app as any).graphql.defineResolvers(searchStub);
    app.log?.info("searchStub resolvers attached");
  } else {
    app.log?.warn("graphql.defineResolvers not available; ensure mercurius is registered before this block");
  }
} catch (err) {
  // Keep server booting even if this stub fails
  // @ts-ignore
  app?.log?.error({ err }, "failed to attach searchStub resolvers");
}
