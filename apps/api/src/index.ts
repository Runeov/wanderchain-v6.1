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
createQueues();

app.get('/healthz', async () => ({ ok: true }));
app.get('/metrics', async (req, reply) => {
  reply.header('Content-Type', register.contentType);
  return register.metrics();
});

const port = Number(process.env.PORT || 4000);
app.listen({ port, host: '0.0.0.0' }).catch((e) => { app.log.error(e); process.exit(1); });



