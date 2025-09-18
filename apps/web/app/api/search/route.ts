export const dynamic = "force-dynamic";
const GQL = process.env.API_URL ?? "http://localhost:4000/graphql";
const QUERY = `
  query ($input: SearchInput!) {
    search(input: $input) {
      place { name countryCode }
      offers { provider priceMinor currency }
    }
  }
`;
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = body?.input ?? {};
    const r = await fetch(GQL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { input } }),
      cache: "no-store",
    });
    const data = await r.json();
    return new Response(JSON.stringify(data), { status: r.ok ? 200 : 400, headers: { "content-type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? "search failed" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
