import { useEffect, useMemo, useState } from 'react';
import { GraphQLClient, gql } from 'graphql-request';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

const GQL = 'http://localhost:4000/graphql';

async function devLogin() {
  const res = await fetch('http://localhost:4000/auth/dev-login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'dev', password: 'dev' }), credentials: 'include'
  });
  if (!res.ok) throw new Error('login failed');
  return res.json();
}
async function refresh() {
  const res = await fetch('http://localhost:4000/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error('refresh failed');
  return res.json();
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [q, setQ] = useState('Rovaniemi');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('');
  const [hotelCityCode, setHotelCityCode] = useState('RVN');
  const [checkInDate, setCheckInDate] = useState('2025-12-01');

  useEffect(() => { const t = localStorage.getItem('jwt'); if (t) setToken(t); }, []);

  const client = useMemo(() => new GraphQLClient(GQL, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }), [token]);

  const searchMutation = useMutation({
    mutationFn: async () => {
      const query = gql`query($i: SearchInput!){
        search(input: $i){ place{ name countryCode } offers{ provider priceMinor currency } }
      }`;
      const input: any = { query: q, guests: 1, currency: 'EUR', hotelCityCode, checkInDate: checkInDate + 'T00:00:00.000Z' };
      if (lat && lng && radius) { input.lat = Number(lat); input.lng = Number(lng); input.radiusKm = Number(radius); }
      try {
        const data = await client.request<any>(query, { input });
        return data.search;
      } catch (e:any) {
        if (e.response?.status === 401) {
          const r = await refresh(); localStorage.setItem('jwt', r.token); setToken(r.token);
          const data = await client.request<any>(query, { input });
          return data.search;
        }
        throw e;
      }
    },
    onError: (e:any) => toast.error(e.message || 'Search failed'),
    onSuccess: () => toast.success('Search OK')
  });

  async function login() {
    try {
      const { token } = await devLogin(); localStorage.setItem('jwt', token); setToken(token); toast.success('Logged in');
    } catch (e:any) { toast.error(e.message); }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Travel Search</h1>
      <div style={{ marginBottom: 8 }}>
        {!token ? <button onClick={login}>Dev Login</button> : <span>âœ… Logged in</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(160px,1fr))', gap: 8, alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="City" />
        <input value={lat} onChange={e => setLat(e.target.value)} placeholder="Lat (opt)" />
        <input value={lng} onChange={e => setLng(e.target.value)} placeholder="Lng (opt)" />
        <input value={radius} onChange={e => setRadius(e.target.value)} placeholder="Radius km (opt)" />
        <input value={hotelCityCode} onChange={e => setHotelCityCode(e.target.value.toUpperCase())} placeholder="Hotel City Code (IATA)" />
        <input value={checkInDate} onChange={e => setCheckInDate(e.target.value)} placeholder="Check-in YYYY-MM-DD" />
        <button onClick={() => searchMutation.mutate()} disabled={searchMutation.isPending}>Search</button>
      </div>
      {searchMutation.data && <div style={{ marginTop: 16 }}>
        {searchMutation.data.map((r:any, i:number) => (
          <div key={i} style={{ padding: 12, border: '1px solid #ddd', marginBottom: 8 }}>
            <div><strong>{r.place.name}</strong> ({r.place.countryCode})</div>
            <ul>{r.offers.map((o:any, j:number) => <li key={j}>{o.provider}: {o.priceMinor/100} {o.currency}</li>)}</ul>
          </div>
        ))}
      </div>}
    </main>
  );
}

