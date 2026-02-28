const express = require('express');
const helmet = require('helmet');
const Redis = require('ioredis');
const { REDIS_URL } = require('./config');
const authRoutes = require('./routes/auth');
const monitorRoutes = require('./routes/monitor');
const adminRoutes = require('./routes/admin');
const { recordRequest, recordLatency, recordFailure } = require('./routes/monitor');
const { isAlive } = require('./serviceState');

const app = express();
app.use(helmet());
app.use(express.json());
const { validateEnv } = require('../shared/configValidator');
validateEnv(['REDIS_URL']);
const { metricsMiddleware, getMetrics } = require('../shared/metrics');
app.use(metricsMiddleware);
app.get('/metrics', (req, res) => res.json(getMetrics()));

// Redis client for rate limiting
const redisClient = new Redis(REDIS_URL);

const { validateEnv } = require('../shared/configValidator');
validateEnv(['REDIS_URL']);
const { metricsMiddleware, getMetrics } = require('../shared/metrics');
app.use(metricsMiddleware);
app.get('/metrics', (req, res) => res.json(getMetrics()));

// Chaos middleware — safe routes are always accessible per spec §3.5
const SAFE_ROUTES = ['/admin/kill', '/admin/revive', '/health'];
app.use((req, res, next) => {
  if (isAlive() || SAFE_ROUTES.includes(req.path)) {
    return next();
  }
  return res.status(503).json({ error: 'Service is down (chaos mode)' });
});

// Redis-backed sliding-window rate limiter for login
// Spec §3.1 / §13 / §14-B3: max 3 attempts per studentId per 60s window
// Key pattern: ratelimit:<studentId>
async function redisRateLimiter(req, res, next) {
  const studentId = req.body.studentId;
  if (!studentId) {
    return next(); // let the route handler deal with validation
  }

  const key = `ratelimit:${studentId}`;
  const now = Date.now();
  const windowMs = 60000;

  try {
    // Remove entries older than 60s, count remaining, add current
    const multi = redisClient.multi();
    multi.zremrangebyscore(key, 0, now - windowMs);
    multi.zcard(key);
    multi.zadd(key, now, `${now}-${Math.random()}`);
    multi.expire(key, 60);
    const results = await multi.exec();

    const count = results[1][1]; // zcard result
    if (count >= 3) {
      return res.status(429).json({ error: 'Too many login attempts. Try again in 60 seconds.' });
    }
  } catch (err) {
    console.error('Rate limiter Redis error, allowing request:', err.message);
    // Fail open if Redis is down
  }

  next();
}

// Apply Redis rate limiter only to login route
app.use('/auth/login', redisRateLimiter);

app.use('/auth', authRoutes);
app.use('/', monitorRoutes);
app.use('/admin', adminRoutes);

module.exports = app;
module.exports.redisClient = redisClient;
