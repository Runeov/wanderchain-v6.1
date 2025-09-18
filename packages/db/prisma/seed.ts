import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const places: [string,string,number,number][] = [
  ['Rovaniemi','FI',66.5039,25.7294],
  ['Helsinki','FI',60.1699,24.9384],
  ['Tromsø','NO',69.6492,18.9553],
  ['Oslo','NO',59.9139,10.7522],
  ['Stockholm','SE',59.3293,18.0686],
  ['Reykjavik','IS',64.1466,-21.9426],
  ['Paris','FR',48.8566,2.3522],
  ['Berlin','DE',52.5200,13.4050],
  ['Rome','IT',41.9028,12.4964],
  ['Barcelona','ES',41.3851,2.1734],
  ['London','GB',51.5074,-0.1278],
  ['New York','US',40.7128,-74.0060]
];

async function main() {
  for (const [name, cc, lat, lng] of places) {
    const place = await prisma.place.upsert({
      where: { id: `${name}-${cc}` },
      update: {},
      create: { id: `${name}-${cc}`, name, countryCode: cc, lat, lng }
    });
    await prisma.offer.createMany({
      data: [
        { provider: 'booking', placeId: place.id, priceMinor: 12000, currency: 'EUR', availableFrom: new Date('2025-10-01') },
        { provider: 'amadeus', placeId: place.id, priceMinor: 11500, currency: 'EUR', availableFrom: new Date('2025-10-01') },
        { provider: 'expedia', placeId: place.id, priceMinor: 12500, currency: 'EUR', availableFrom: new Date('2025-10-01') }
      ],
      skipDuplicates: true
    });
  }
  console.log('Seeded', places.length, 'places.');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
