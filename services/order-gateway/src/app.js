const express = require('express');
const helmet = require('helmet');
const Redis = require('ioredis');
const http = require('http');
const { URL } = require('url');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

const { JWT_SECRET, REDIS_URL, STOCK_SERVICE_URL, KITCHEN_QUEUE_URL } = require('./config');

// Initialize Redis client with basic error handling (fail‑open)
const redisClient = new Redis(REDIS_URL);
redisClient.on('error', (err) => {
  console.error('Redis client error (connection may be unavailable):', err.message);
});

const app = express();
app.use(helmet());
app.use(express.json());

// ---- Metrics & Chaos State ----
const startTime = Date.now();
const latencies = [];
const MAX_LATENCY_SAMPLES = 1000;
let totalRequests = 0;
let failedRequests = 0;
let totalLatencyMs = 0;
let totalOrders = 0;
const orderTimestamps = [];
let isKilled = false;
const SAFE_ROUTES = ['/admin/kill', '/admin/revive', '/health'];

// Request timing + metrics
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    totalRequests += 1;
    totalLatencyMs += duration;
    latencies.push(duration);
    if (latencies.length > MAX_LATENCY_SAMPLES) {
      latencies.shift();
    }
    if (res.statusCode >= 500) {
      failedRequests += 1;
    }
    if (req.method === 'POST' && req.path === '/order' && res.statusCode < 500) {
      totalOrders += 1;
      const now = Date.now();
      orderTimestamps.push(now);
      // Trim to last 60s
      while (orderTimestamps.length > 0 && orderTimestamps[0] < now - 60000) {
        orderTimestamps.shift();
      }
    }
  });
  next();
});

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

// POST /order – main entrypoint
app.post('/order', jwtAuth, idempotency, async (req, res) => {
  const { itemId, quantity = 1 } = req.body || {};
  if (!itemId) {
    return res.status(400).json({ error: 'itemId is required' });
  }

  const studentId = req.user.sub || req.user.studentId;

  // Cache‑first stock check
  const cacheKey = `stock:${itemId}`;
  try {
    const cachedStock = await redisClient.get(cacheKey);
    if (cachedStock !== null && Number(cachedStock) <= 0) {
      return res.status(409).json({ error: 'Item out of stock.' });
    }
  } catch (err) {
    console.error('Redis cache error:', err.message);
  }

  // Call Stock Service to decrement stock
  const stockUrl = new URL(`${STOCK_SERVICE_URL}/stock/${itemId}/decrement`);
  const stockOptions = {
    method: 'POST',
    hostname: stockUrl.hostname,
    port: stockUrl.port,
    path: stockUrl.pathname,
    headers: { 'Content-Type': 'application/json' },
  };
  let stockResponse;
  try {
    stockResponse = await httpRequest(stockOptions, { quantity, orderId: `ord-${randomUUID()}` });
  } catch (err) {
    console.error('Error contacting Stock Service:', err.message);
    return res.status(502).json({ error: 'Failed to contact stock service' });
  }
  if (stockResponse.statusCode !== 200) {
    const errMsg = stockResponse.body && stockResponse.body.error ? stockResponse.body.error : 'Stock decrement failed';
    if (stockResponse.statusCode === 409) {
      await redisClient.set(cacheKey, '0', 'EX', 60);
      return res.status(409).json({ error: errMsg });
    }
    return res.status(500).json({ error: errMsg });
  }

  // Update cache with new stock count if provided
  if (stockResponse.body && typeof stockResponse.body.newStock === 'number') {
    await redisClient.set(cacheKey, String(stockResponse.body.newStock), 'EX', 60);
  }

  // Generate orderId and persist basic order state for lookup
  const orderId = `ord_${randomUUID()}`;
  const orderKey = `orders:${orderId}`;
  const createdAt = new Date().toISOString();
  try {
    await redisClient.hset(orderKey,
      'orderId', orderId,
      'status', 'PENDING',
      'studentId', studentId || '',
      'itemId', itemId,
      'quantity', String(quantity),
      'createdAt', createdAt
    );
    await redisClient.expire(orderKey, 3600);
  } catch (err) {
    console.error('Failed to persist order state:', err.message);
  }

  // Publish to Kitchen Queue asynchronously (fire‑and‑forget)
  const queueUrl = new URL(`${KITCHEN_QUEUE_URL}/queue/order`);
  const queueOptions = {
    method: 'POST',
    hostname: queueUrl.hostname,
    port: queueUrl.port,
    path: queueUrl.pathname,
    headers: { 'Content-Type': 'application/json' },
  };
  const queuePayload = {
    orderId,
    studentId,
    items: [{ itemId, quantity }],
  };
  httpRequest(queueOptions, queuePayload).catch((e) => {
    console.error('Failed to publish to Kitchen Queue:', e.message);
  });

  const responseBody = {
    orderId,
    status: 'PENDING',
    message: 'Order received. Processing...',
  };

  // Store idempotency response if key provided (header or body)
  const idemKey = req.idempotencyKey;
  if (idemKey) {
    try {
      await redisClient.set(
        `idempotency:${idemKey}`,
        JSON.stringify({ status: 202, body: responseBody }),
        'EX',
        86400
      );
    } catch (err) {
      console.error('Failed to store idempotency key:', err.message);
    }
  }

  return res.status(202).json(responseBody);
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

  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const statusCode = status === 'ok' ? 200 : 503;
  return res.status(statusCode).json({
    status,
    service: 'order-gateway',
    dependencies: deps,
    uptime: uptimeSeconds,
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const avgLatency = totalRequests ? Math.round(totalLatencyMs / totalRequests) : 0;
  const now = Date.now();
  const recentOrders = orderTimestamps.filter((t) => t >= now - 60000);
  const ordersPerMinute = uptimeSeconds > 0 ? (recentOrders.length * 60) / Math.max(1, (uptimeSeconds)) : 0;

  // p99 latency
  let p99 = 0;
  if (latencies.length > 0) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.99) - 1;
    p99 = sorted[Math.max(0, idx)];
  }

  return res.json({
    service: 'order-gateway',
    totalOrders,
    ordersPerMinute: Number(ordersPerMinute.toFixed(1)),
    failedRequests,
    averageLatencyMs: avgLatency,
    p99LatencyMs: p99,
    uptime: uptimeSeconds,
    timestamp: new Date().toISOString(),
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
