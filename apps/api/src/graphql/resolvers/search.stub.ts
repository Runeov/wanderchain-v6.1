/**
 * Stub resolver for Query.search that returns a LIST (array) of results.
 * Replace with your real provider integration later.
 */
export const searchStub = {
  Query: {
    async search(_parent: unknown, { input }: any, ctx: any) {
      ctx?.log?.info({ input }, "search resolver hit");
      // IMPORTANT: return an ARRAY (schema expects Iterable)
      return [
        {
          place: { name: input?.query ?? "Unknown", countryCode: "FI" },
          offers: [
            { provider: "amadeus",    priceMinor: 18900, currency: input?.currency ?? "EUR" },
            { provider: "skyscanner", priceMinor: 17500, currency: input?.currency ?? "EUR" }
          ]
        }
      ];
    }
  }
};
