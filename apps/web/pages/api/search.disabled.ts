import type { NextApiRequest, NextApiResponse } from "next";
const GQL = process.env.API_URL ?? "http://localhost:4000/graphql";
const QUERY = `
  query ($input: SearchInput!) {
    search(input: $input) {
      place { name countryCode }
      offers { provider priceMinor currency }
    }
  }
`;
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const input = req.method === "POST" ? req.body?.input : req.query;
    const r = await fetch(GQL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { input } }),
    });
    const data = await r.json();
    res.status(r.ok ? 200 : 400).json(data);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? "search failed" });
  }
}
