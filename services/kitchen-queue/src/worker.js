const { Worker } = require('bullmq');
const { connection } = require('./queue');

let isKilled = false;

function setKilled(flag) {
  isKilled = flag;
}

const { notifyHub } = require('../shared/notifier');

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
      await notifyHub(studentId, orderId, 'READY', items);
    } catch (err) {
      console.error(`Failed to notify hub: ${err.message}`);
      throw err; // Allow BullMQ to retry
    }
  },
  { connection }
);

console.log('Kitchen Worker started');

module.exports = { worker, setKilled };
