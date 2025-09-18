import { Redis } from 'ioredis';
import CircuitBreaker from 'opossum';
import pRetry from 'p-retry';
import { setTimeout as sleep } from 'timers/promises';

type TokenResponse = { access_token: string, token_type: string, expires_in: number };

const windowMs = 1000, maxPerWindow = 10;
let calls: number[] = [];
function canCallNow() { const now = Date.now(); calls = calls.filter(t => now - t < windowMs); return calls.length < maxPerWindow; }
async function rateSlot() { while (!canCallNow()) await sleep(50); calls.push(Date.now()); }

export type NormalizedOffer = {
  id: string; provider: string; placeId: string; priceMinor: number; currency: string; availableFrom?: string; availableTo?: string;
};

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
async function getToken(baseUrl: string, clientId: string, clientSecret: string) {
  const key = `amadeus:token:${clientId}`;
  const cached = await redis.get(key);
  if (cached) return cached;
  const resp = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret } as any).toString()
  });
  if (!resp.ok) throw new Error(`token ${resp.status}`);
  const data = await resp.json() as TokenResponse;
  const ttl = Math.max(60, data.expires_in - 30);
  await redis.setex(key, ttl, data.access_token);
  return data.access_token;
}

const breaker = new CircuitBreaker(async (req: RequestInfo, init?: RequestInit) => {
  const r = await fetch(req, init);
  if (!r.ok) { const t = await r.text(); throw new Error(`fetch ${r.status} ${t}`); }
  return r.json();
}, { timeout: 8000, errorThresholdPercentage: 50, volumeThreshold: 5, resetTimeout: 30000 });

export async function amadeusFlightOffers(input: { origin: string, destination: string, dateFrom: string, adults: number },
  conf: { baseUrl: string, clientId: string, clientSecret: string }): Promise<NormalizedOffer[]> {
  await rateSlot();
  const token = await getToken(conf.baseUrl, conf.clientId, conf.clientSecret);
  const url = new URL(`${conf.baseUrl}/v2/shopping/flight-offers`);
  url.searchParams.set('originLocationCode', input.origin);
  url.searchParams.set('destinationLocationCode', input.destination);
  url.searchParams.set('departureDate', input.dateFrom);
  url.searchParams.set('adults', String(input.adults));
  url.searchParams.set('currencyCode', 'EUR');
  url.searchParams.set('max', '5');

  const data = await pRetry(() => breaker.fire(url.toString(), { headers: { Authorization: `Bearer ${token}` } }), { retries: 2, onFailedAttempt: () => sleep(200) });
  const out: NormalizedOffer[] = (data.data || []).map((d: any, idx: number) => ({
    id: d.id || `amadeus-${idx}`, provider: 'amadeus', placeId: input.destination,
    priceMinor: d.price?.total ? Math.round(parseFloat(d.price.total) * 100) : 0, currency: d.price?.currency || 'EUR', availableFrom: input.dateFrom
  }));
  return out;
}

export async function amadeusHotelOffers(input: { cityCode: string, checkInDate: string, adults: number },
  conf: { baseUrl: string, clientId: string, clientSecret: string }): Promise<NormalizedOffer[]> {
  await rateSlot();
  const token = await getToken(conf.baseUrl, conf.clientId, conf.clientSecret);
  const url = new URL(`${conf.baseUrl}/v3/shopping/hotel-offers`);
  url.searchParams.set('cityCode', input.cityCode);
  url.searchParams.set('checkInDate', input.checkInDate);
  url.searchParams.set('adults', String(input.adults));
  url.searchParams.set('currency', 'EUR');
  url.searchParams.set('page[limit]', '5');

  const data = await pRetry(() => breaker.fire(url.toString(), { headers: { Authorization: `Bearer ${token}` } }), { retries: 2, onFailedAttempt: () => sleep(200) });
  const out: NormalizedOffer[] = (data.data || []).flatMap((h: any, idx: number) => {
    const offers = h.offers || [];
    return offers.slice(0,1).map((o: any, j: number) => ({
      id: o.id || `amadeus-hotel-${idx}-${j}`, provider: 'amadeus-hotel',
      placeId: input.cityCode, priceMinor: o.price?.total ? Math.round(parseFloat(o.price.total) * 100) : 0,
      currency: o.price?.currency || 'EUR', availableFrom: input.checkInDate
    }));
  });
  return out;
}


