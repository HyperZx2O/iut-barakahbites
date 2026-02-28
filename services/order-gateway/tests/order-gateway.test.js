const request = require('supertest');
const http = require('http');
const { EventEmitter } = require('events');
const app = require('../src/app');
const { signToken } = require('../../identity-provider/src/auth');

let server;
let redisClient;
let httpRequestSpy;

const validToken = signToken({ sub: '210042101', name: 'Test User' });
const authHeader = `Bearer ${validToken}`;

beforeAll(() => {
  server = http.createServer(app).listen(0);
  ({ redisClient } = require('../src/app'));
});

beforeEach(async () => {
  // Clear redis before each test to ensure clean state
  const keys = await redisClient.keys('*');
  if (keys.length > 0) {
    await redisClient.del(...keys);
  }

  // Mock http.request to simulate Stock and Kitchen services
  httpRequestSpy = jest.spyOn(http, 'request').mockImplementation((options, callback) => {
    const req = new EventEmitter();
    req.write = jest.fn();
    req.end = jest.fn(() => {
      const res = new EventEmitter();
      res.statusCode = 200;

      // Routing logic for the mock based on the destination hostname/port
      if (options.port === '3003' || (options.hostname && options.hostname.includes('stock-service'))) {
        const itemBody = { itemId: 'test-item', remaining: 10, decremented: 1, newStock: 10 };
        res.emit('data', JSON.stringify(itemBody));
      } else if (options.port === '3004' || (options.hostname && options.hostname.includes('kitchen-queue'))) {
        res.emit('data', JSON.stringify({ status: 'IN_KITCHEN' }));
      }

      res.emit('end');
      if (typeof callback === 'function') callback(res);
    });
    return req;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  server.close();
  if (redisClient && typeof redisClient.disconnect === 'function') {
    redisClient.disconnect();
  }
});

describe('Order Gateway API', () => {
  describe('JWT Validation', () => {
    test('Rejects missing Authorization header', async () => {
      const res = await request(server).post('/order').send({ itemId: 'test-item' });
      expect(res.statusCode).toBe(401);
    });

    test('Rejects invalid token', async () => {
      const res = await request(server)
        .post('/order')
        .set('Authorization', 'Bearer invalidtoken')
        .send({ itemId: 'test-item' });
      expect(res.statusCode).toBe(401);
    });

    test('Accepts valid token and returns orderId + PENDING status', async () => {
      const res = await request(server)
        .post('/order')
        .set('Authorization', authHeader)
        .send({ itemId: 'test-item' });
      expect(res.statusCode).toBe(202);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.orderId).toBeDefined();
    });
  });

  describe('Stock Caching', () => {
    test('Cache Miss - fetches from Stock and updates cache', async () => {
      await request(server)
        .post('/order')
        .set('Authorization', authHeader)
        .send({ itemId: 'item-1' });

      const cached = await redisClient.get('stock:item-1');
      expect(cached).toBe('10'); // Based on mock newStock: 10
      expect(httpRequestSpy).toHaveBeenCalled();
    });

    test('Cache Hit (Zero) - returns 409 without calling Stock Service', async () => {
      await redisClient.set('stock:item-zero', '0');

      const res = await request(server)
        .post('/order')
        .set('Authorization', authHeader)
        .send({ itemId: 'item-zero' });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toContain('Item out of stock');

      // Ensure the Stock Service was NOT called
      const wasStockCalled = httpRequestSpy.mock.calls.some((call) =>
        call[0].port === '3003' || (call[0].hostname && call[0].hostname.includes('stock-service'))
      );
      expect(wasStockCalled).toBe(false);
    });

    test('Stock Service Failure (409) - updates cache to 0', async () => {
      // Override mock specifically for this test to return 409
      jest.restoreAllMocks();
      httpRequestSpy = jest.spyOn(http, 'request').mockImplementation((options, callback) => {
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn(() => {
          const res = new EventEmitter();
          if (options.port === '3003' || (options.hostname && options.hostname.includes('stock-service'))) {
            res.statusCode = 409;
            res.emit('data', JSON.stringify({ error: 'Insufficient stock' }));
          }
          res.emit('end');
          if (typeof callback === 'function') callback(res);
        });
        return req;
      });

      const res = await request(server)
        .post('/order')
        .set('Authorization', authHeader)
        .send({ itemId: 'item-fail' });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('Insufficient stock');

      const cached = await redisClient.get('stock:item-fail');
      expect(cached).toBe('0');
    });
  });

  describe('Idempotency', () => {
    test('Identical request with same Idempotency-Key header returns cached response', async () => {
      const idempotencyKey = 'idemp-key-123';

      // First Request
      const res1 = await request(server)
        .post('/order')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', idempotencyKey)
        .send({ itemId: 'item-idemp' });

      expect(res1.statusCode).toBe(202);

      // Clear HTTP spy to verify no new calls are made
      httpRequestSpy.mockClear();

      // Second Request with same key
      const res2 = await request(server)
        .post('/order')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', idempotencyKey)
        .send({ itemId: 'item-idemp' });

      expect(res2.statusCode).toBe(202);
      expect(res2.body.message).toBe('Order received. Processing...');
      expect(httpRequestSpy).not.toHaveBeenCalled();
    });
  });

  describe('Service Coordination', () => {
    test('Publishes to Kitchen Queue on successful stock verification', async () => {
      await request(server)
        .post('/order')
        .set('Authorization', authHeader)
        .send({ itemId: 'item-kitchen' });

      // Wait slightly for async fire-and-forget promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 50));

      const kitchenCalled = httpRequestSpy.mock.calls.some((call) =>
        call[0].port === '3004' || (call[0].hostname && call[0].hostname.includes('kitchen-queue'))
      );
      expect(kitchenCalled).toBe(true);
    });
  });

  describe('Order status lookup', () => {
    test('GET /order/:orderId returns persisted order data', async () => {
      const createRes = await request(server)
        .post('/order')
        .set('Authorization', authHeader)
        .send({ itemId: 'item-status' });

      const { orderId } = createRes.body;
      expect(orderId).toBeDefined();

      const statusRes = await request(server).get(`/order/${orderId}`);
      expect(statusRes.statusCode).toBe(200);
      expect(statusRes.body.orderId).toBe(orderId);
      expect(statusRes.body.status).toBe('PENDING');
    });
  });
});
