import http from 'k6/http';
import { check, sleep } from 'k6';
export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500']
  },
  stages: [
    { duration: '30s', target: 200 },
    { duration: '1m', target: 1000 },
    { duration: '30s', target: 0 }
  ]
};
const URL = 'http://localhost:4000/graphql';
const HEAD = (jwt) => ({ headers: { 'Content-Type': 'application/json', ...(jwt?{Authorization:`Bearer ${jwt}`}:{}) } });
export default function () {
  const jwt = __ENV.JWT || '';
  const payload = JSON.stringify({ query: 'query($i:SearchInput!){search(input:$i){place{name}}}', variables: { i: { query: 'Rovaniemi', lat: 66.5039, lng: 25.7294, radiusKm: 50 } } });
  let res = http.post(URL, payload, HEAD(jwt));
  check(res, { 'status 200/401': (r) => r.status === 200 || r.status === 401 });
  sleep(0.05);
}
