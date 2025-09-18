import { Queue } from 'bullmq';
import IORedis from 'ioredis';
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const providers = new Queue('providers', { connection });
async function main() {
  const adds = [];
  for (let i=0;i<10000;i++) {
    const p = (i%2===0)?1:5;
    adds.push(providers.add(i%2?'amadeus-hotel':'amadeus-flight', { i }, { priority: p, removeOnComplete: true, removeOnFail: 100 }));
  }
  await Promise.all(adds);
  console.log('enqueued 10k provider jobs');
  process.exit(0);
}
main();
