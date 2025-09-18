import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
export function createQueues() {
  const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
  const ingest = new Queue('ingest', { connection });
  const enrich = new Queue('enrich', { connection });
  const providers = new Queue('providers', { connection });
  return { ingest, enrich, providers, connection };
}



