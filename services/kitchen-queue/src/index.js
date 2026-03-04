require('dotenv').config();
const express = require('express');
const { kitchenQueue, connection } = require('./queue');
const { setKilled } = require('./worker');

const app = express();
app.use(express.json());

// CORS config
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const { validateEnv } = require('../shared/configValidator');
validateEnv(['REDIS_URL', 'NOTIFICATION_HUB_URL']);

const { metricsMiddleware, getMetrics } = require('../shared/metrics');
const { tracingMiddleware } = require('../shared/tracing');
const { notifyHub } = require('../shared/notifier');

app.use(tracingMiddleware);
app.use(metricsMiddleware);

// In‑memory flag for chaos kill/revive
let isKilled = false;
const SAFE_ROUTES = ['/admin/kill', '/admin/revive', '/health'];

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
  // Return 200 even if degraded to let Railway finish the deployment
  res.status(200).json({
    status,
    service: 'kitchen-queue',
    dependencies: deps,
    uptime: getMetrics('kitchen-queue').uptime,
    alive: !isKilled
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json(getMetrics('kitchen-queue'));
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
  const { orderId, studentId, items, metadata } = req.body || {};
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

  const payload = { orderId, studentId, items, metadata };
  const job = await kitchenQueue.add('process', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });

  await connection.set(idemKey, job.id, 'EX', 3600); // keep for 1h

  // Notify state change
  notifyHub(studentId, orderId, 'IN_KITCHEN', items, metadata || {});

  // Persist basic kitchen status for this order
  const orderKey = `orders:${orderId}`;
  const createdAt = new Date().toISOString();
  await connection.hset(orderKey,
    'orderId', orderId,
    'studentId', studentId,
    'status', 'IN_KITCHEN',
    'metadata', JSON.stringify(metadata || {}),
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
