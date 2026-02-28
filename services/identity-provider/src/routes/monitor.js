const express = require('express');
const db = require('../db');
const Redis = require('ioredis');
const { REDIS_URL } = require('../config');

const router = express.Router();

const startTime = Date.now();
const latencies = [];       // rolling array of recent response times
const MAX_LATENCY_SAMPLES = 1000;

let totalRequests = 0;
let failedRequests = 0;
let registrations = 0;
let logins = 0;
let failures = 0;

// Rolling per-minute tracking
const requestTimestamps = [];

function increment(metric) {
  if (metric === 'registrations') registrations++;
  else if (metric === 'logins') logins++;
  else if (metric === 'failures') failures++;
}

function recordRequest() {
  totalRequests++;
  const now = Date.now();
  requestTimestamps.push(now);
  // Trim timestamps older than 60s
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift();
  }
}

function recordFailure() {
  failedRequests++;
}

function recordLatency(ms) {
  latencies.push(ms);
  if (latencies.length > MAX_LATENCY_SAMPLES) {
    latencies.shift();
  }
}

function getOrdersPerMinute() {
  const now = Date.now();
  const recent = requestTimestamps.filter(t => t >= now - 60000);
  return parseFloat((recent.length).toFixed(1));
}

function getAverageLatency() {
  if (latencies.length === 0) return 0;
  const sum = latencies.reduce((a, b) => a + b, 0);
  return Math.round(sum / latencies.length);
}

function getP99Latency() {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.99) - 1;
  return sorted[Math.max(0, idx)];
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
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  return res.status(200).json({
    service: 'identity-provider',
    totalOrders: totalRequests,
    ordersPerMinute: getOrdersPerMinute(),
    failedRequests,
    averageLatencyMs: getAverageLatency(),
    p99LatencyMs: getP99Latency(),
    uptime: uptimeSeconds,
    timestamp: new Date().toISOString(),
    // Identity-provider specific extras
    registrations,
    logins,
    loginFailures: failures,
  });
});

module.exports = router;
module.exports.increment = increment;
module.exports.recordRequest = recordRequest;
module.exports.recordFailure = recordFailure;
module.exports.recordLatency = recordLatency;
