const startTime = Date.now();
const latencies = [];
const MAX_LATENCY_SAMPLES = 1000;
let totalRequests = 0;
let failedRequests = 0;
let totalLatencyMs = 0;
let totalOrders = 0;
const orderTimestamps = [];

function metricsMiddleware(req, res, next) {
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

    // Consider as "Order" for metrics if it matches specific core actions:
    if (
      req.method === 'POST' &&
      (req.path === '/order' || req.path === '/notify' || req.path === '/queue/order' || req.path.match(/^\/stock\/[^/]+\/decrement$/) || req.path === '/auth/login') &&
      res.statusCode < 500
    ) {
      totalOrders += 1;
      const now = Date.now();
      orderTimestamps.push(now);
      while (orderTimestamps.length > 0 && orderTimestamps[0] < now - 60000) {
        orderTimestamps.shift();
      }
    }
  });
  next();
}

function getMetrics(serviceName) {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const avgLatency = totalRequests ? Math.round(totalLatencyMs / totalRequests) : 0;

  const now = Date.now();
  const recentOrders = orderTimestamps.filter((t) => t >= now - 60000);
  // Extrapolate throughput proportionally if uptime < 60s
  const ordersPerMinute = uptime > 0 ? (recentOrders.length * 60) / Math.max(1, Math.min(uptime, 60)) : 0;

  let p99 = 0;
  if (latencies.length > 0) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.99) - 1;
    p99 = sorted[Math.max(0, idx)];
  }

  return {
    service: serviceName,
    totalOrders: totalOrders || totalRequests, // use generic hits if no core order actions
    ordersPerMinute: Number(ordersPerMinute.toFixed(1)),
    failedRequests,
    averageLatencyMs: avgLatency,
    p99LatencyMs: p99,
    uptime,
    timestamp: new Date().toISOString()
  };
}

module.exports = { metricsMiddleware, getMetrics };
