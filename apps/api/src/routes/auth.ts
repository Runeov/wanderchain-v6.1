import { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';

const r = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const REFRESH_TTL = Number(process.env.REFRESH_TTL_SECONDS || 86400);
const ACCESS_TTL = String(Number(process.env.ACCESS_TTL_SECONDS || 3600)) + 's';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/dev-login', async (req, reply) => {
    if (process.env.DEV_LOGIN_ENABLED !== 'true') return reply.code(404).send({ error: 'disabled' });
    const body = (req.body || {}) as any;
    const u = process.env.DEV_LOGIN_USER || 'dev';
    const p = process.env.DEV_LOGIN_PASS || 'dev';
    if (body.username === u && body.password === p) {
      const sub = 'dev'; const rt = app.jwt.sign({ sub, typ: 'rt' }, { expiresIn: REFRESH_TTL + 's' });
      await r.setex(`rt:${sub}:${rt.slice(-16)}`, REFRESH_TTL, '1');
      reply.setCookie('rt', rt, { httpOnly: true, sameSite: 'lax', path: '/' });
      const token = app.jwt.sign({ sub, role: 'dev' }, { expiresIn: ACCESS_TTL });
      return { token };
    }
    return reply.code(401).send({ error: 'invalid' });
  });

  app.post('/auth/refresh', async (req, reply) => {
    try {
      const cookies = (req as any).cookies || {};
      const rt = cookies['rt']; if (!rt) return reply.code(401).send({ error: 'no refresh' });
      const payload = app.jwt.verify(rt) as any;
      if (payload.typ !== 'rt') return reply.code(401).send({ error: 'bad refresh' });
      const ok = await r.get(`rt:${payload.sub}:${rt.slice(-16)}`);
      if (!ok) return reply.code(401).send({ error: 'expired' });
      const token = app.jwt.sign({ sub: payload.sub, role: 'dev' }, { expiresIn: ACCESS_TTL });
      return { token };
    } catch { return reply.code(401).send({ error: 'refresh failed' }); }
  });
}


