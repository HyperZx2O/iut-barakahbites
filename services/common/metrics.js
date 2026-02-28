// metrics.js – shared utilities for request timing and latency histogram
// Export functions to record a request duration and retrieve aggregated metrics

const MAX_LATENCY_SAMPLES = 1000;
const latencies = [];
let totalRequests = 0;
let totalLatencyMs = 0;
let failedRequests = 0;
let histogram = {
  '0-10': 0,
  '10-50': 0,
  '50-100': 0,
  '100-500': 0,
  '500-1000': 0,
  '1000+': 0,
};

function _bucket(duration) {
  if (duration < 10) return '0-10';
  if (duration < 50) return '10-50';
  if (duration < 100) return '50-100';
  if (duration < 500) return '100-500';
  if (duration < 1000) return '500-1000';
  return '1000+';
}

function record(duration, statusCode) {
  totalRequests += 1;
  totalLatencyMs += duration;
  latencies.push(duration);
  if (latencies.length > MAX_LATENCY_SAMPLES) latencies.shift();
  if (statusCode >= 500) failedRequests += 1;
  const bucket = _bucket(duration);
  histogram[bucket] = (histogram[bucket] || 0) + 1;
}

function snapshot() {
  return {
    totalRequests,
    totalLatencyMs,
    failedRequests,
    latencies: [...latencies],
    histogram: { ...histogram },
  };
}

module.exports = { record, snapshot };
