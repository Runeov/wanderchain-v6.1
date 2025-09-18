import { gql } from 'graphql-tag';
import { SearchInput as SearchInputSchema } from '@pkg/shared';
import { prisma } from './db.js';
import { Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { amadeusFlightOffers, amadeusHotelOffers } from './providers/amadeus.js';
import { metrics } from './metrics.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const enrichQueue = new Queue('enrich', { connection });
const providersQueue = new Queue('providers', { connection });

export const typeDefs = gql`
  type Place { id: ID!, name: String!, countryCode: String!, lat: Float!, lng: Float! }
  type Offer { id: ID!, provider: String!, placeId: ID!, priceMinor: Int!, currency: String!, availableFrom: String, availableTo: String }
  type SearchResult { place: Place!, offers: [Offer!]! }
  input SearchInput {
    query: String!
    lat: Float, lng: Float, radiusKm: Float
    dateFrom: String, dateTo: String
    guests: Int = 1, budgetMinor: Int, currency: String = "USD"
    origin: String, destination: String, adults: Int
    hotelCityCode: String, checkInDate: String
  }
  type Query { search(input: SearchInput!): [SearchResult!]! }
`;

type Row = { place_id: string; place_name: string; country_code: string; lat: number; lng: number;
  offer_id: string; provider: string; price_minor: number; currency: string; available_from: string|null; available_to: string|null; };

export const resolvers = {
  Query: {
    search: {
      async resolve(_: any, { input }: any, ctx: any) {
        const t0 = Date.now();
        await (ctx.req as any).jwtVerify();
        metrics.searchRequests.inc();

        const parsed = SearchInputSchema.parse(input);

        // Optional provider jobs with priority
        if (process.env.ENABLE_AMADEUS === 'true') {
          if (parsed.origin && parsed.destination && parsed.dateFrom) {
            await providersQueue.add('amadeus-flight', { ...parsed }, { attempts: 2, priority: 1, removeOnComplete: 500, removeOnFail: 100 });
          }
          if (parsed.hotelCityCode && parsed.checkInDate) {
            await providersQueue.add('amadeus-hotel', { ...parsed }, { attempts: 2, priority: 5, removeOnComplete: 500, removeOnFail: 100 });
          }
        }

        const amadeusEnabled = process.env.ENABLE_AMADEUS === 'true'
          && process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET;

        let liveOffers: any[] = [];
        if (amadeusEnabled) {
          try {
            if (parsed.origin && parsed.destination && parsed.dateFrom) {
              liveOffers = liveOffers.concat(await amadeusFlightOffers(
                { origin: parsed.origin, destination: parsed.destination, dateFrom: parsed.dateFrom.split('T')[0], adults: parsed.adults || 1 },
                { baseUrl: process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com', clientId: process.env.AMADEUS_CLIENT_ID!, clientSecret: process.env.AMADEUS_CLIENT_SECRET! }
              ));
            }
            if (parsed.hotelCityCode && parsed.checkInDate) {
              liveOffers = liveOffers.concat(await amadeusHotelOffers(
                { cityCode: parsed.hotelCityCode, checkInDate: parsed.checkInDate, adults: parsed.adults || 1 },
                { baseUrl: process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com', clientId: process.env.AMADEUS_CLIENT_ID!, clientSecret: process.env.AMADEUS_CLIENT_SECRET! }
              ));
            }
          } catch {}
        }

        // Geo radius
        if (parsed.lat !== undefined && parsed.lng !== undefined && parsed.radiusKm !== undefined) {
          const conds: Prisma.Sql[] = [
            Prisma.sql`ST_DWithin(p.geom, ST_SetSRID(ST_MakePoint(${parsed.lng}, ${parsed.lat}), 4326)::geography, ${parsed.radiusKm * 1000})`
          ];
          if (parsed.budgetMinor != null) conds.push(Prisma.sql`o."priceMinor" <= ${parsed.budgetMinor}`);
          if (parsed.dateFrom) conds.push(Prisma.sql`(o."availableFrom" IS NULL OR o."availableFrom" <= ${new Date(parsed.dateFrom)})`);
          if (parsed.dateTo) conds.push(Prisma.sql`(o."availableTo" IS NULL OR o."availableTo" >= ${new Date(parsed.dateTo)})`);
          const where = Prisma.join(conds, ' AND ');

          const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
            SELECT p.id as place_id, p.name as place_name, p."countryCode" as country_code, p.lat, p.lng,
                   o.id as offer_id, o.provider, o."priceMinor" as price_minor, o.currency,
                   o."availableFrom" as available_from, o."availableTo" as available_to
            FROM "Place" p JOIN "Offer" o ON o."placeId" = p.id
            WHERE ${where} ORDER BY o."priceMinor" ASC LIMIT 100;
          `);

          const grouped = new Map<string, { place: any, offers: any[] }>();
          for (const r of rows) {
            if (!grouped.has(r.place_id)) grouped.set(r.place_id, {
              place: { id: r.place_id, name: r.place_name, countryCode: r.country_code, lat: r.lat, lng: r.lng }, offers: []
            });
            grouped.get(r.place_id)!.offers.push({ id: r.offer_id, provider: r.provider, placeId: r.place_id, priceMinor: r.price_minor, currency: r.currency, availableFrom: r.available_from || undefined, availableTo: r.available_to || undefined });
          }
          if (liveOffers.length) {
            const first = [...grouped.values()][0]; if (first) first.offers.unshift(...liveOffers);
          }
          metrics.searchDuration.observe(Date.now() - t0);
          return [...grouped.values()];
        }

        // Name fallback
        const place = await prisma.place.findFirst({ where: { name: { contains: parsed.query, mode: 'insensitive' } } });
        if (!place) return [];
        const offers = await prisma.offer.findMany({
          where: {
            placeId: place.id,
            ...(parsed.budgetMinor ? { priceMinor: { lte: parsed.budgetMinor } } : {}),
            ...(parsed.dateFrom || parsed.dateTo ? {
              AND: [
                parsed.dateFrom ? { OR: [{ availableFrom: null }, { availableFrom: { lte: new Date(parsed.dateFrom) } }] } : {},
                parsed.dateTo   ? { OR: [{ availableTo: null },   { availableTo:   { gte: new Date(parsed.dateTo) } }] } : {}
              ]
            } : {})
          },
          orderBy: { priceMinor: 'asc' }, take: 50
        });
        if (liveOffers.length) offers.unshift(...liveOffers.map(o => ({ ...o, placeId: place.id })));
        await enrichQueue.add('budget-check', { placeId: place.id, count: offers.length }, { attempts: 3, removeOnComplete: true, removeOnFail: 50 });
        metrics.searchDuration.observe(Date.now() - t0);
        return [{ place, offers }];
      }
    }
  }
};








