const { Worker } = require('bullmq');
const { connection } = require('./queue');

let isKilled = false;

function setKilled(flag) {
  isKilled = flag;
}

// Ensure NOTIFICATION_HUB_URL always includes /notify path
const baseNotificationUrl = process.env.NOTIFICATION_HUB_URL || 'http://notification-hub:3005';
const notifyUrl = `${baseNotificationUrl.replace(/\/+$/, '')}/notify`;

const worker = new Worker(
  'kitchenQueue',
  async (job) => {
    if (isKilled) {
      return;
    }
    const { orderId, studentId, items } = job.data;

    // Simulate preparation time 3‑7 seconds
    const delay = Math.floor(Math.random() * 4000) + 3000;
    await new Promise((r) => setTimeout(r, delay));

    // Update kitchen status to READY
    const orderKey = `orders:${orderId}`;
    await connection.hset(orderKey,
      'orderId', orderId,
      'studentId', studentId,
      'status', 'READY',
      'readyAt', new Date().toISOString()
    );
    await connection.expire(orderKey, 3600);

    // Notify Notification Hub
    try {
      await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, studentId, status: 'READY', items }),
      });
    } catch (err) {
      console.error(`Failed to notify hub: ${err.message}`);
      throw err; // Allow BullMQ to retry
    }
  },
  { connection }
);

console.log('Kitchen Worker started');

module.exports = { worker, setKilled };
