/**
 * Simple request metrics collector with latency histogram.
 * Buckets are defined in milliseconds.
 */
const buckets = [10, 50, 100, 500, Infinity]; // bucket upper bounds

let requestCount = 0;
let failedCount = 0;
let totalLatency = 0;
const histogram = buckets.map(() => 0); // parallel array of counts

function record(duration, statusCode) {
  requestCount += 1;
  totalLatency += duration;
  if (statusCode >= 500) failedCount += 1;
  // place duration in appropriate bucket
  for (let i = 0; i < buckets.length; i++) {
    if (duration <= buckets[i]) {
      histogram[i] += 1;
      break;
    }
  }
}

function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    record(duration, res.statusCode);
  });
  next();
}

function getMetrics() {
  const avgLatency = requestCount ? Math.round(totalLatency / requestCount) : 0;
  const bucketMap = {};
  for (let i = 0; i < buckets.length; i++) {
    const label = i === 0 ? `<=${buckets[i]}ms` : i === buckets.length - 1 ? `> ${buckets[i - 1]}ms` : `${buckets[i - 1] + 1}-${buckets[i]}ms`;
    bucketMap[label] = histogram[i];
  }
  return {
    totalRequests: requestCount,
    failedRequests: failedCount,
    averageLatencyMs: avgLatency,
    latencyHistogram: bucketMap,
  };
}

module.exports = { metricsMiddleware, getMetrics };
