const request = require('supertest');
const http = require('http');
const { EventEmitter } = require('events');

jest.mock('ioredis', () => require('ioredis-mock'));

// ★ Capture the REAL http.request BEFORE any jest.spyOn touches it.
//   This avoids infinite recursion when falling through to the real implementation.
const _realHttpRequest = http.request;

const app = require('../src/app');
const { signToken } = require('../../identity-provider/src/auth');

let server;
let redisClient;
let httpRequestSpy;

const validToken = signToken({ sub: '240041221', name: 'Test User' });
const authHeader = `Bearer ${validToken}`;

/**
 * Helper: creates a mock ClientRequest that emits data/end on the
 * response after the callback has registered its listeners.
 */
function makeFakeReq(statusCode, body, callback) {
  const req = new EventEmitter();
  req.write = jest.fn();
  req.end = jest.fn(() => {
    const res = new EventEmitter();
    res.statusCode = statusCode;

    // 1. Call callback so the caller can attach res.on('data') / res.on('end')
    if (typeof callback === 'function') callback(res);

    // 2. Emit events on the next tick so listeners are already registered
    process.nextTick(() => {
      res.emit('data', JSON.stringify(body));
      res.emit('end');
    });
  });
  return req;
}

/**
 * Install the default http.request spy.
 * Intercepts calls aimed at stock-service (port 3003) and kitchen-queue (port 3004).
 * Everything else (e.g. supertest's own calls) falls through to the real http.request.
 */
function installDefaultMock(stockStatus = 200, stockBody = undefined) {
  const defaultStockBody = stockBody || { itemId: 'test-item', remaining: 10, decremented: 1, newStock: 10 };

  httpRequestSpy = jest.spyOn(http, 'request').mockImplementation((options, callback) => {
    const port = String(options.port || '');
    const host = String(options.hostname || '');

    const isStock = port === '3003' || host.includes('stock-service');
    const isKitchen = port === '3004' || host.includes('kitchen-queue');

    if (isStock) {
      // If the path is /stock, return a catalog array. Otherwise return the decrement result object.
      if (options.path === '/stock') {
        return makeFakeReq(stockStatus, [{ item_id: 'test-item', price: 10 }], callback);
      }
      return makeFakeReq(stockStatus, defaultStockBody, callback);
    }
    if (isKitchen) {
      return makeFakeReq(200, { status: 'IN_KITCHEN' }, callback);
    }

    // ★ Fall through to the REAL http.request (captured before spying)
    return _realHttpRequest.call(http, options, callback);
  });
}

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

  installDefaultMock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  if (server) server.close();
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

      // At least one call should have targeted stock-service
      const stockCalls = httpRequestSpy.mock.calls.filter(
        (c) => String(c[0].port) === '3003' || (c[0].hostname || '').includes('stock-service')
      );
      expect(stockCalls.length).toBeGreaterThan(0);
    });

    test('Cache Hit (Zero) - returns 409 without calling Stock Service', async () => {
      await redisClient.set('stock:item-zero', '0');

      const res = await request(server)
        .post('/order')
        .set('Authorization', authHeader)
        .send({ itemId: 'item-zero' });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toContain('is out of stock');

      // Ensure the Stock Service DECREMENT was NOT called
      const wasDecrementCalled = httpRequestSpy.mock.calls.some(
        (c) => (String(c[0].port) === '3003' || (c[0].hostname || '').includes('stock-service')) &&
          (c[0].path || '').includes('/decrement')
      );
      expect(wasDecrementCalled).toBe(false);
    });

    test('Stock Service Failure (409) - updates cache to 0', async () => {
      // Re-install the mock with a 409 status for the stock service
      jest.restoreAllMocks();
      installDefaultMock(409, { error: 'Insufficient stock' });

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

      // Clear HTTP spy call history
      httpRequestSpy.mockClear();

      // Second Request with same key
      const res2 = await request(server)
        .post('/order')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', idempotencyKey)
        .send({ itemId: 'item-idemp' });

      expect(res2.statusCode).toBe(202);
      expect(res2.body.message).toBe('Order received. Processing...');

      // Verify no EXTERNAL service calls were made (supertest itself uses http.request, so filter)
      const externalCalls = httpRequestSpy.mock.calls.filter((c) => {
        const port = String(c[0].port || '');
        return port === '3003' || port === '3004';
      });
      expect(externalCalls).toHaveLength(0);
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

      const kitchenCalled = httpRequestSpy.mock.calls.some(
        (c) => String(c[0].port) === '3004' || (c[0].hostname || '').includes('kitchen-queue')
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
