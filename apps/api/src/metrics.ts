import * as Prom from 'prom-client';
export const register = new Prom.Registry();
Prom.collectDefaultMetrics({ register });

export const metrics = {
  httpRequests: new Prom.Counter({ name: 'http_requests_total', help: 'HTTP requests', registers: [register], labelNames: ['route','code'] }),
  searchRequests: new Prom.Counter({ name: 'search_requests_total', help: 'GraphQL search requests', registers: [register] }),
  providerCalls: new Prom.Counter({ name: 'provider_calls_total', help: 'Provider calls', registers: [register], labelNames: ['provider','status'] }),
  searchDuration: new Prom.Histogram({ name: 'search_duration_ms', help: 'Search duration', registers: [register], buckets: [50,100,200,300,500,1000,2000] })
};
