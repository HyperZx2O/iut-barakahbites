const express = require('express');
const helmet = require('helmet');
const Redis = require('ioredis');
const http = require('http');
const { URL } = require('url');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const { JWT_SECRET, REDIS_URL, STOCK_SERVICE_URL, KITCHEN_QUEUE_URL, NOTIFICATION_HUB_URL } = require('./config');

const { validateEnv } = require('../shared/configValidator');
validateEnv(['REDIS_URL', 'JWT_SECRET', 'STOCK_SERVICE_URL', 'KITCHEN_QUEUE_URL', 'NOTIFICATION_HUB_URL']);

const { metricsMiddleware, getMetrics } = require('../shared/metrics');
const { tracingMiddleware } = require('../shared/tracing');
const { notifyHub } = require('../shared/notifier');

// Initialize Redis client with basic error handling (fail‑open)
const redisClient = new Redis(process.env.REDIS_URL);
redisClient.on('error', (err) => {
  console.error('Redis client error (connection may be unavailable):', err.message);
});

const app = express();
app.use(helmet());
app.use(express.json());

// CORS config
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization,idempotency-key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(tracingMiddleware);
app.use(metricsMiddleware);

const swaggerDocument = JSON.parse(fs.readFileSync(path.join(__dirname, 'swagger.json'), 'utf8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Existing metrics endpoint – replace body with shared data
app.get('/metrics', (req, res) => {
  res.json(getMetrics('order-gateway'));
});

let isKilled = false;
const SAFE_ROUTES = ['/admin/kill', '/admin/revive', '/health'];

// Deprecated per‑service metrics middleware removed – shared metrics now applied via ../shared/metrics.js

// Chaos middleware – keep admin + health always reachable
app.use((req, res, next) => {
  if (!isKilled || SAFE_ROUTES.includes(req.path)) {
    return next();
  }
  return res.status(503).json({ error: 'Service is down (chaos mode)' });
});

// ---- JWT utilities & middleware ----
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function jwtAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  const token = authHeader.slice('Bearer '.length);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = payload;
  next();
}

// Redis-backed sliding-window rate limiter for orders
// Max 5 orders per 60s per user
async function orderRateLimiter(req, res, next) {
  const studentId = req.user?.sub || req.user?.studentId;
  if (!studentId) return next();

  const key = `ratelimit:order:${studentId}`;
  const now = Date.now();
  const windowMs = 60000;

  try {
    const multi = redisClient.multi();
    multi.zremrangebyscore(key, 0, now - windowMs);
    multi.zcard(key);
    multi.zadd(key, now, `${now}-${Math.random()}`);
    multi.expire(key, 60);
    const results = await multi.exec();

    const count = results[1][1]; // zcard result
    if (count >= 5) { // 5 orders per minute max
      return res.status(429).json({ error: 'Too many orders placed. Try again in 60 seconds.' });
    }
  } catch (err) {
    console.error('Rate limiter Redis error, allowing request:', err.message);
  }

  next();
}

// Idempotency middleware for /order endpoint
async function idempotency(req, res, next) {
  const headerKey = req.headers['idempotency-key'];
  const bodyKey = req.body && req.body.idempotencyKey;
  const key = headerKey || bodyKey;
  if (!key) return next();
  try {
    const cached = await redisClient.get(`idempotency:${key}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      return res.status(parsed.status).json(parsed.body);
    }
    // expose for handler to persist on success
    req.idempotencyKey = key;
  } catch (err) {
    console.error('Idempotency Redis error:', err.message);
  }
  next();
}

// Helper to perform HTTP request to another service (simple wrapper)
function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// POST /order – supports multiple items per order
app.post('/order', jwtAuth, orderRateLimiter, idempotency, async (req, res) => {
  const body = req.body || {};

  // Accept either: { items: [{itemId, quantity}] }  OR legacy { itemId, quantity }
  let items = body.items;
  if (!items || !Array.isArray(items) || items.length === 0) {
    if (body.itemId) {
      items = [{ itemId: body.itemId, quantity: body.quantity ?? 1 }];
    } else {
      return res.status(400).json({ error: 'items array (or itemId) is required' });
    }
  }

  // Validate each item
  for (const it of items) {
    if (!it.itemId) return res.status(400).json({ error: 'Each item must have an itemId' });
    if (!it.quantity || Number(it.quantity) < 1) return res.status(400).json({ error: `Invalid quantity for item ${it.itemId}` });
  }

  const studentId = req.user.sub || req.user.studentId;
  const orderId = `ord_${randomUUID()}`;

  // Notify INITIAL state
  notifyHub(studentId, orderId, 'PENDING', items);

  // Decrement stock for EACH item sequentially — roll back on failure
  const decremented = [];
  for (const it of items) {
    const { itemId, quantity } = it;

    // Cache-first stock check
    const cacheKey = `stock:${itemId}`;
    try {
      const cachedStock = await redisClient.get(cacheKey);
      if (cachedStock !== null && Number(cachedStock) <= 0) {
        return res.status(409).json({ error: `Item ${itemId} is out of stock.` });
      }
    } catch (err) {
      console.error('Redis cache error:', err.message);
    }

    // Call Stock Service to decrement
    const stockUrl = new URL(`${STOCK_SERVICE_URL}/stock/${itemId}/decrement`);
    const stockOptions = {
      method: 'POST',
      hostname: stockUrl.hostname,
      port: stockUrl.port,
      path: stockUrl.pathname,
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': req.correlationId
      },
    };
    let stockResponse;
    let failed = false;
    let errMsg = '';
    let statusCode = 500;

    try {
      stockResponse = await httpRequest(stockOptions, { quantity, orderId });
      if (stockResponse.statusCode !== 200) {
        failed = true;
        errMsg = stockResponse.body?.error ?? 'Stock decrement failed';
        statusCode = stockResponse.statusCode;
        if (statusCode === 409) {
          await redisClient.set(`stock:${itemId}`, '0', 'EX', 60);
        }
      }
    } catch (err) {
      console.error('Error contacting Stock Service:', err.message);
      failed = true;
      errMsg = 'Failed to contact stock service';
      statusCode = 502;
    }

    if (failed) {
      // SAGA COMPENSATION: Roll back any previously decremented items
      if (decremented.length > 0) {
        console.warn(`Order ${orderId} failed on ${itemId}. Rolling back ${decremented.length} items...`);
        for (const doneItem of decremented) {
          const rollbackUrl = new URL(`${STOCK_SERVICE_URL}/stock/${doneItem.itemId}/replenish`);
          await httpRequest({
            method: 'POST',
            hostname: rollbackUrl.hostname,
            port: rollbackUrl.port,
            path: rollbackUrl.pathname,
            headers: {
              'Content-Type': 'application/json',
              'x-correlation-id': req.correlationId
            }
          }, { quantity: doneItem.quantity });
        }
      }
      return res.status(statusCode).json({ error: errMsg });
    }

    // Update cache on success
    if (typeof stockResponse.body?.newStock === 'number') {
      await redisClient.set(`stock:${itemId}`, String(stockResponse.body.newStock), 'EX', 60);
    }
    decremented.push(it);
  }

  // Notify stock verified
  notifyHub(studentId, orderId, 'STOCK_VERIFIED', items);

  // Persist order state (store items as JSON string)
  const orderKey = `orders:${orderId}`;
  const createdAt = new Date().toISOString();
  try {
    await redisClient.hset(orderKey,
      'orderId', orderId,
      'status', 'PENDING',
      'studentId', studentId || '',
      'items', JSON.stringify(items),
      'createdAt', createdAt
    );
    await redisClient.expire(orderKey, 3600);
  } catch (err) {
    console.error('Failed to persist order state:', err.message);
  }

  // Publish to Kitchen Queue (fire-and-forget)
  const queueUrl = new URL(`${KITCHEN_QUEUE_URL}/queue/order`);
  const queueOptions = {
    method: 'POST',
    hostname: queueUrl.hostname,
    port: queueUrl.port,
    path: queueUrl.pathname,
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': req.correlationId
    },
  };
  httpRequest(queueOptions, { orderId, studentId, items }).catch((e) => {
    console.error('Failed to publish to Kitchen Queue:', e.message);
  });

  const responseBody = { orderId, status: 'PENDING', message: 'Order received. Processing...' };

  // Store idempotency response
  if (req.idempotencyKey) {
    try {
      await redisClient.set(
        `idempotency:${req.idempotencyKey}`,
        JSON.stringify({ status: 202, body: responseBody }),
        'EX', 86400
      );
    } catch (err) {
      console.error('Failed to store idempotency key:', err.message);
    }
  }

  return res.status(202).json(responseBody);
});


// GET /items – list items with stock count (spec §5 View 2)
app.get('/items', async (req, res) => {
  const stockUrl = new URL(`${STOCK_SERVICE_URL}/stock`);
  const stockOptions = {
    method: 'GET',
    hostname: stockUrl.hostname,
    port: stockUrl.port,
    path: stockUrl.pathname,
    headers: {
      'x-correlation-id': req.correlationId
    },
  };
  try {
    const stockResponse = await httpRequest(stockOptions);
    if (stockResponse.statusCode === 200) {
      return res.json(stockResponse.body);
    }
    return res.status(stockResponse.statusCode).json(stockResponse.body);
  } catch (err) {
    console.error('Error fetching items from stock service:', err.message);
    return res.status(502).json({ error: 'Failed to fetch items' });
  }
});

// GET /order/:orderId – retrieve cached order state
app.get('/order/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const key = `orders:${orderId}`;
  try {
    const data = await redisClient.hgetall(key);
    if (!data || Object.keys(data).length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.json(data);
  } catch (err) {
    console.error('Error reading order state:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Health endpoint with dependency status
app.get('/health', async (req, res) => {
  const deps = { redis: 'ok' };
  let status = 'ok';

  try {
    await redisClient.ping();
  } catch (err) {
    deps.redis = 'down';
    status = 'degraded';
  }

  const statusCode = status === 'ok' ? 200 : 503;
  return res.status(statusCode).json({
    status,
    service: 'order-gateway',
    dependencies: deps,
    uptime: getMetrics('order-gateway').uptime,
    alive: !isKilled
  });
});

// Admin chaos endpoints
app.post('/admin/kill', (req, res) => {
  isKilled = true;
  res.json({ status: 'killed' });
});

app.post('/admin/revive', (req, res) => {
  isKilled = false;
  res.json({ status: 'alive' });
});

module.exports = app;
module.exports.redisClient = redisClient;
