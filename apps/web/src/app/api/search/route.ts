export const dynamic = "force-dynamic";
const GQL = process.env.API_URL ?? "http://127.0.0.1:4000/graphql";

const QUERY = `
  query ($input: SearchInput!) {
    search(input: $input) {
      place { name countryCode }
      offers { provider priceMinor currency }
    }
  }
`;

function json(value: any, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function callGql(input: any) {
  const r = await fetch(GQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { input } }),
    cache: "no-store",
  });
  const text = await r.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = body?.input ?? {};
    if (!input || typeof input !== "object") return json({ ok:false, error:"Missing 'input' object"}, 400);
    const out = await callGql(input);
    return json(out, out.ok ? 200 : 400);
  } catch (err:any) {
    return json({ ok:false, error: err?.message ?? "Unhandled error"}, 500);
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const input = Object.fromEntries(url.searchParams.entries());
  const out = await callGql(input);
  return json(out, out.ok ? 200 : 400);
}
