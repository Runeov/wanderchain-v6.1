import { z } from 'zod';

export const SearchInput = z.object({
  query: z.string().default(''),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().positive().max(20000).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  guests: z.number().int().min(1).default(1),
  budgetMinor: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).default('USD'),
  origin: z.string().length(3).optional(),
  destination: z.string().length(3).optional(),
  adults: z.number().int().min(1).max(9).optional(),
  hotelCityCode: z.string().length(3).optional(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});
export type SearchInput = z.infer<typeof SearchInput>;
