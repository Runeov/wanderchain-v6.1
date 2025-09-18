"use client";
import { useEffect, useState } from "react";

export default function SearchTest() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            input: {
              query: "Rovaniemi",
              guests: 1,
              currency: "EUR",
              hotelCityCode: "RVN",
              checkInDate: "2025-12-01",
            },
          }),
        });
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setErr(e?.message || "request failed");
      }
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>/search-test</h1>
      {err && <pre style={{ color: "crimson" }}>{err}</pre>}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
