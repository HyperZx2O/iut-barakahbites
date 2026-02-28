require('dotenv').config();
const express = require('express');
const { kitchenQueue, connection } = require('./queue');
const { setKilled } = require('./worker');

const app = express();
app.use(express.json());
const { validateEnv } = require('../shared/configValidator');
validateEnv(['REDIS_URL']);
const { metricsMiddleware, getMetrics } = require('../shared/metrics');
app.use(metricsMiddleware);
app.get('/metrics', (req, res) => res.json(getMetrics()));
const { validateEnv } = require('../shared/configValidator');
validateEnv(['REDIS_URL']);
const { metricsMiddleware, getMetrics } = require('../shared/metrics');
app.use(metricsMiddleware);
app.get('/metrics', (req, res) => res.json(getMetrics()));

// In‑memory flag for chaos kill/revive
let isKilled = false;
const SAFE_ROUTES = ['/admin/kill', '/admin/revive', '/health'];

// Metrics state
const startTime = Date.now();
let totalRequests = 0;
let failedRequests = 0;
let totalLatencyMs = 0;
let totalOrders = 0;
const latencies = [];
const orderTimestamps = [];
const MAX_LATENCY_SAMPLES = 1000;

// Metrics middleware
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
    if (req.method === 'POST' && req.path === '/queue/order' && res.statusCode < 500) {
      totalOrders += 1;
      const now = Date.now();
      orderTimestamps.push(now);
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

// Health endpoint
app.get('/health', async (req, res) => {
  let status = 'ok';
  const deps = { redis: 'ok' };
  try {
    await connection.ping();
  } catch (err) {
    status = 'degraded';
    deps.redis = 'down';
  }
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const statusCode = status === 'ok' ? 200 : 503;
  res.status(statusCode).json({
    status,
    service: 'kitchen-queue',
    dependencies: deps,
    uptime,
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const avgLatency = totalRequests ? Math.round(totalLatencyMs / totalRequests) : 0;
  const now = Date.now();
  const recentOrders = orderTimestamps.filter((t) => t >= now - 60000);
  const ordersPerMinute = uptime > 0 ? (recentOrders.length * 60) / Math.max(1, uptime) : 0;

  let p99LatencyMs = 0;
  if (latencies.length) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.99) - 1;
    p99LatencyMs = sorted[Math.max(0, idx)];
  }

  res.json({
    service: 'kitchen-queue',
    totalOrders,
    ordersPerMinute: Number(ordersPerMinute.toFixed(1)),
    failedRequests,
    averageLatencyMs: avgLatency,
    p99LatencyMs,
    uptime,
    timestamp: new Date().toISOString(),
  });
});

// Admin chaos endpoints
app.post('/admin/kill', (req, res) => {
  isKilled = true;
  setKilled(true);
  res.json({ status: 'killed' });
});
app.post('/admin/revive', (req, res) => {
  isKilled = false;
  setKilled(false);
  res.json({ status: 'alive' });
});

// POST /queue/order endpoint
app.post('/queue/order', async (req, res) => {
  if (isKilled) {
    return res.status(503).json({ error: 'Service killed for chaos testing' });
  }
  const { orderId, studentId, items } = req.body || {};
  if (!orderId || !studentId || !items) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Idempotency via Redis key
  const idemKey = `idempotency:${orderId}`;
  const exists = await connection.get(idemKey);
  if (exists) {
    return res.status(200).json({
      orderId,
      status: 'IN_KITCHEN',
      message: 'Duplicate order ignored',
    });
  }

  const payload = { orderId, studentId, items };
  const job = await kitchenQueue.add('process', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });

  await connection.set(idemKey, job.id, 'EX', 3600); // keep for 1h

  // Persist basic kitchen status for this order
  const orderKey = `orders:${orderId}`;
  const createdAt = new Date().toISOString();
  await connection.hset(orderKey,
    'orderId', orderId,
    'studentId', studentId,
    'status', 'IN_KITCHEN',
    'createdAt', createdAt
  );
  await connection.expire(orderKey, 3600);

  res.status(202).json({
    orderId,
    status: 'IN_KITCHEN',
    estimatedTime: '3-7 seconds',
  });
});

// GET /queue/status/:orderId – return current kitchen status
app.get('/queue/status/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const key = `orders:${orderId}`;
  const data = await connection.hgetall(key);
  if (!data || Object.keys(data).length === 0) {
    return res.status(404).json({ error: 'Order not found' });
  }
  return res.json(data);
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3004;
  app.listen(PORT, () => {
    console.log(`Kitchen Queue Service listening on port ${PORT}`);
  });
}
