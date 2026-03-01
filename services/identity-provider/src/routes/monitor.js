const express = require('express');
const db = require('../db');
const Redis = require('ioredis');
const { REDIS_URL } = require('../config');

const router = express.Router();

const { getMetrics } = require('../../shared/metrics');

// Registrations and logins tracked manually as service-specific metrics
let registrations = 0;
let logins = 0;
let failures = 0;

const startTime = Date.now();

function increment(metric) {
  if (metric === 'registrations') registrations++;
  else if (metric === 'logins') logins++;
  else if (metric === 'failures') failures++;
}

// Health endpoint — checks dependencies
router.get('/health', async (req, res) => {
  const deps = { postgres: 'ok', redis: 'ok' };
  let status = 'ok';

  // Check Postgres
  try {
    await db.query('SELECT 1');
  } catch {
    deps.postgres = 'down';
    status = 'degraded';
  }

  // Check Redis
  try {
    const redis = new Redis(REDIS_URL);
    await redis.ping();
    redis.disconnect();
  } catch {
    deps.redis = 'down';
    status = 'degraded';
  }

  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const statusCode = status === 'ok' ? 200 : 503;

  return res.status(statusCode).json({
    status,
    service: 'identity-provider',
    dependencies: deps,
    uptime: uptimeSeconds,
  });
});

// Metrics endpoint — full spec §4 format
router.get('/metrics', (req, res) => {
  const baseMetrics = getMetrics('identity-provider');
  return res.status(200).json({
    ...baseMetrics,
    // Identity-provider specific extras
    registrations,
    logins,
    loginFailures: failures,
  });
});

module.exports = router;
module.exports.increment = increment;
module.exports.recordRequest = () => { }; // No-ops as middleware handles it
module.exports.recordFailure = () => { };
module.exports.recordLatency = () => { };
