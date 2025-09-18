import { Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import Fastify from 'fastify';
import * as Prom from 'prom-client';
import * as dotenv from 'dotenv';
dotenv.config();

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });

const app = Fastify({ logger: true });
const register = new Prom.Registry();
Prom.collectDefaultMetrics({ register });
const jobsCompleted = new Prom.Counter({ name: 'jobs_completed_total', help: 'Jobs completed', registers: [register], labelNames: ['queue'] });
const jobsFailed = new Prom.Counter({ name: 'jobs_failed_total', help: 'Jobs failed', registers: [register], labelNames: ['queue'] });

app.get('/metrics', async (req, reply) => {
  reply.header('Content-Type', register.contentType); return register.metrics();
});
app.listen({ port: 4001, host: '0.0.0.0' });

const ingestWorker = new Worker('ingest', async job => ({ ok: true, id: job.id }), { connection });
const enrichWorker = new Worker('enrich', async job => ({ ok: true, payload: job.data }), { connection });
const providersWorker = new Worker('providers', async job => ({ ok: true, type: job.name }), { connection });

for (const q of ['ingest','enrich','providers']) {
  const qe = new QueueEvents(q, { connection });
  qe.on('completed', () => jobsCompleted.inc({ queue: q }));
  qe.on('failed', () => jobsFailed.inc({ queue: q }));
}

console.log('Workers running: ingest, enrich, providers (metrics on :4001/metrics)');



