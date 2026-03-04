const startTime = Date.now();

// Each entry is { value: number, timestamp: number } so we can do windowed averages.
// We cap at MAX_LATENCY_SAMPLES OR 5 minutes of history, whichever is smaller.
const latencies = [];
const MAX_LATENCY_SAMPLES = 1000;
const LATENCY_WINDOW_MS = 300000; // 5 minutes — keeps p99 accurate

let totalRequests = 0;
let failedRequests = 0;
let totalLatencyMs = 0;
let totalOrders = 0;
const orderTimestamps = [];

function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const now = Date.now();
    const duration = now - start;

    totalRequests += 1;
    totalLatencyMs += duration;

    // Store with timestamp for windowed calculation
    latencies.push({ value: duration, timestamp: now });

    // Evict entries older than LATENCY_WINDOW_MS, then cap by count
    const cutoff = now - LATENCY_WINDOW_MS;
    while (latencies.length > 0 && latencies[0].timestamp < cutoff) {
      latencies.shift();
    }
    while (latencies.length > MAX_LATENCY_SAMPLES) {
      latencies.shift();
    }

    if (res.statusCode >= 500) {
      failedRequests += 1;
    }

    // Consider as "Order" for metrics if it matches specific core actions:
    if (
      req.method === 'POST' &&
      (req.path === '/order' || req.path === '/notify' || req.path === '/queue/order' || req.path.match(/^\/stock\/[^/]+\/decrement$/) || req.path === '/auth/login') &&
      res.statusCode < 500
    ) {
      totalOrders += 1;
      orderTimestamps.push(now);
      while (orderTimestamps.length > 0 && orderTimestamps[0] < now - 60000) {
        orderTimestamps.shift();
      }
    }
  });
  next();
}

function getMetrics(serviceName) {
  const now = Date.now();
  const uptime = Math.floor((now - startTime) / 1000);
  const avgLatency = totalRequests ? Math.round(totalLatencyMs / totalRequests) : 0;

  // 30-second windowed average — used by the admin dashboard alert system
  const windowCutoff = now - 30000;
  const windowedSamples = latencies.filter(l => l.timestamp >= windowCutoff);
  const windowedAvgLatencyMs = windowedSamples.length
    ? Math.round(windowedSamples.reduce((sum, l) => sum + l.value, 0) / windowedSamples.length)
    : 0;

  const recentOrders = orderTimestamps.filter((t) => t >= now - 60000);
  // Extrapolate throughput proportionally if uptime < 60s
  const ordersPerMinute = uptime > 0 ? (recentOrders.length * 60) / Math.max(1, Math.min(uptime, 60)) : 0;

  let p99 = 0;
  if (latencies.length > 0) {
    const sorted = latencies.map(l => l.value).sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.99) - 1;
    p99 = sorted[Math.max(0, idx)];
  }

  return {
    service: serviceName,
    totalOrders: totalOrders || totalRequests, // use generic hits if no core order actions
    ordersPerMinute: Number(ordersPerMinute.toFixed(1)),
    failedRequests,
    averageLatencyMs: avgLatency,
    windowedAvgLatencyMs,            // NEW — 30-second window average
    p99LatencyMs: p99,
    uptime,
    timestamp: new Date().toISOString()
  };
}

module.exports = { metricsMiddleware, getMetrics };
