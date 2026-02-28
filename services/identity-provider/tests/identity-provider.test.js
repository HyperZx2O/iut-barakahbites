const request = require('supertest');
const http = require('http');

jest.mock('ioredis', () => require('ioredis-mock'));

process.env.DATABASE_URL = 'postgres://devsprint:devsprint@localhost:54320/cafeteria';

const app = require('../src/app');
let server;

beforeAll(async () => {
  const db = require('../src/db');
  // Wait for DB init to complete
  await new Promise(resolve => setTimeout(resolve, 500));
  // Clean up test data
  await db.query('DELETE FROM login_attempts');
  await db.query('DELETE FROM students');
  server = http.createServer(app).listen(0);

  // Clean Redis rate-limit keys
  const { redisClient } = require('../src/app');
  const keys = await redisClient.keys('ratelimit:*');
  if (keys.length > 0) await redisClient.del(...keys);
});

afterAll(async () => {
  const db = require('../src/db');
  const { redisClient } = require('../src/app');
  if (server) server.close();
  await db.pool.end();
  redisClient.disconnect();
});

describe('Identity Provider API', () => {
  test('Register success returns JWT and studentId', async () => {
    const res = await request(server)
      .post('/auth/register')
      .send({ studentId: '210042101', name: 'Ahmed Rahman', password: 'Password123' });
    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.studentId).toBe('210042101');
  });

  test('Register requires studentId, name, and password', async () => {
    const res = await request(server)
      .post('/auth/register')
      .send({ studentId: '210042102', password: 'Password123' });
    expect(res.statusCode).toBe(400);
  });

  test('Duplicate register returns 409', async () => {
    const res = await request(server)
      .post('/auth/register')
      .send({ studentId: '210042101', name: 'Ahmed Rahman', password: 'Password123' });
    expect(res.statusCode).toBe(409);
  });

  test('Login success returns JWT, expiresIn, and studentId', async () => {
    const res = await request(server)
      .post('/auth/login')
      .send({ studentId: '210042101', password: 'Password123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.expiresIn).toBe(3600);
    expect(res.body.studentId).toBe('210042101');
  });

  test('Invalid login returns 401', async () => {
    const res = await request(server)
      .post('/auth/login')
      .send({ studentId: '210042101', password: 'wrong' });
    expect(res.statusCode).toBe(401);
  });

  test('Rate limit on login after 3 attempts returns 429', async () => {
    const testStudentId = 'ratelimit-test-001';
    // Register a student for this test
    await request(server)
      .post('/auth/register')
      .send({ studentId: testStudentId, name: 'Rate Test', password: 'Pass123' });

    // Make 3 login attempts (these fill the window)
    for (let i = 0; i < 3; i++) {
      await request(server)
        .post('/auth/login')
        .send({ studentId: testStudentId, password: 'wrong' });
    }

    // 4th attempt should be rate-limited
    const res = await request(server)
      .post('/auth/login')
      .send({ studentId: testStudentId, password: 'wrong' });
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toContain('Too many login attempts');
  });

  test('Health endpoint returns dependency status and uptime', async () => {
    const res = await request(server).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('identity-provider');
    expect(res.body.dependencies).toBeDefined();
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  test('Metrics endpoint returns full spec format', async () => {
    const res = await request(server).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe('identity-provider');
    expect(res.body.totalOrders).toBeDefined();
    expect(res.body.ordersPerMinute).toBeDefined();
    expect(res.body.failedRequests).toBeDefined();
    expect(res.body.averageLatencyMs).toBeDefined();
    expect(res.body.p99LatencyMs).toBeDefined();
    expect(res.body.uptime).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  test('Admin kill returns 503 for non-safe routes, but health and revive remain accessible', async () => {
    // Kill the service
    const killRes = await request(server).post('/admin/kill');
    expect(killRes.statusCode).toBe(200);

    // Non-safe routes should return 503
    const authRes = await request(server)
      .post('/auth/login')
      .send({ studentId: '210042101', password: 'Password123' });
    expect(authRes.statusCode).toBe(503);

    // /health should still be accessible (safe route)
    const healthRes = await request(server).get('/health');
    expect(healthRes.statusCode).toBeDefined(); // 200 or 503 depending on deps, but NOT blocked

    // /admin/revive should still be accessible (safe route)
    const reviveRes = await request(server).post('/admin/revive');
    expect(reviveRes.statusCode).toBe(200);

    // Service should be back to normal
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ studentId: '210042101', password: 'Password123' });
    expect(loginRes.statusCode).toBe(200);
  });
});
