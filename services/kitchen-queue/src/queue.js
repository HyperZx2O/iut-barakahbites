const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null // Required for BullMQ
});
connection.on('error', (err) => console.error('Redis connection error (BullMQ):', err.message));

const kitchenQueue = new Queue('kitchenQueue', { connection });

module.exports = { kitchenQueue, connection };
