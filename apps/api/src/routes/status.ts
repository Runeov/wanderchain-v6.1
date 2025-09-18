import type { FastifyInstance } from 'fastify';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { createQueues } from '../queues.js';

type QueuesBundle = { ingest: Queue; enrich: Queue; providers: Queue; connection: Redis };

export async function statusRoutes(app: FastifyInstance) {
  // Get or lazily create queues
  let queues: QueuesBundle | undefined = (app as any).queues;
  if (!queues) {
    queues = createQueues() as QueuesBundle;
    (app as any).queues = queues;
    try { (app as any).decorate?.('queues', queues); } catch {}
  }

  let redisOk = false;
  try { redisOk = (await queues.connection.ping()) === 'PONG'; } catch {}

  const [ingest, enrich, providers] = await Promise.all([
    queues.ingest.getJobCounts(),
    queues.enrich.getJobCounts(),
    queues.providers.getJobCounts(),
  ]);

  return {
    ok: true,
    node: process.version,
    fastify: app.version,
    redis: redisOk,
    queues: { ingest, enrich, providers }
  };
}
