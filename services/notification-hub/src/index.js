require('dotenv').config();
const express = require('express');
const Redis = process.env.NODE_ENV === 'test' ? require('ioredis-mock') : require('ioredis');
const sseManager = require('./sseManager');

const app = express();
app.use(express.json());
app.use(require('helmet')({
  contentSecurityPolicy: false, // For SSE/dev simplicity
}));

// CORS config
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  // Required for SSE over certain proxies (like Nginx)
  res.setHeader('X-Accel-Buffering', 'no');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Redis client (using environment variable REDIS_URL or default)
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

const { validateEnv } = require('../shared/configValidator');
validateEnv(['REDIS_URL']);
const { metricsMiddleware, getMetrics } = require('../shared/metrics');
const { tracingMiddleware } = require('../shared/tracing');
app.use(tracingMiddleware);
app.use(metricsMiddleware);

// Health endpoint – checks Redis connectivity
app.get('/health', async (req, res) => {
  const deps = { redis: 'ok' };
  let status = 'ok';
  try {
    await redis.ping();
  } catch (err) {
    deps.redis = 'down';
    status = 'degraded';
  }
  const statusCode = status === 'ok' ? 200 : 503;
  res.status(statusCode).json({
    status,
    service: 'notification-hub',
    dependencies: deps,
    uptime: getMetrics('notification-hub').uptime,
    alive: !isKilled
  });
});

app.get('/metrics', (req, res) => res.json(getMetrics('notification-hub')));

// Admin chaos endpoints – similar to other services (kill/revive flag)
let isKilled = false;
const SAFE_ROUTES = ['/health', '/metrics', '/admin/kill', '/admin/revive'];
app.use((req, res, next) => {
  const isSafe = SAFE_ROUTES.includes(req.path) || req.path.startsWith('/events/');
  if (isKilled && !isSafe) {
    return res.status(503).json({ error: 'Service is down (chaos mode)' });
  }
  next();
});

app.post('/admin/kill', (req, res) => {
  isKilled = true;
  res.json({ status: 'killed' });
});

app.post('/admin/revive', (req, res) => {
  isKilled = false;
  res.json({ status: 'alive' });
});

// SSE endpoint – stream events for a given studentId
app.get('/events/:studentId', (req, res) => {
  const { studentId } = req.params;
  // Set required SSE headers
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders(); // ensure headers are sent immediately

  // Add client to manager
  sseManager.addClient(studentId, res);

  // Cleanup on client disconnect
  req.on('close', () => {
    sseManager.removeClient(studentId, res);
  });
});

// Internal notification endpoint – called by Kitchen Queue
app.post('/notify', async (req, res) => {
  const { studentId, orderId, status, items } = req.body;
  if (!studentId || !orderId || !status) {
    return res.status(400).json({ error: 'Missing required fields: studentId, orderId, status' });
  }
  // Broadcast to all instances via Redis Pub/Sub as per spec §3.5
  try {
    const payload = JSON.stringify({ studentId, orderId, status, items, timestamp: new Date().toISOString() });
    await redis.publish('notification-hub', payload);
    res.json({ result: 'notified' });
  } catch (err) {
    console.error('Failed to publish notification to Redis:', err.message);
    // Fallback back to local broadcast if Redis fails
    sseManager.broadcast(studentId, { orderId, status });
    res.json({ result: 'notified (local fallback)' });
  }
});

// Setup Redis subscriber for cross-instance notifications
const subscriber = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
subscriber.subscribe('notification-hub', (err) => {
  if (err) console.error('Failed to subscribe to notification-hub channel', err);
});
subscriber.on('message', (channel, message) => {
  if (channel !== 'notification-hub') return;
  try {
    const payload = JSON.parse(message);
    const { studentId } = payload;
    if (studentId) {
      sseManager.broadcast(studentId, payload);
    }
  } catch (e) {
    console.error('Invalid notification payload', e);
  }
});

// Start server
const PORT = process.env.PORT || 3005;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`notification-hub listening on ${PORT}`);
  });
}
module.exports = app;

