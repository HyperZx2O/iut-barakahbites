const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.REDIS_URL);

const kitchenQueue = new Queue('kitchenQueue', { connection });

module.exports = { kitchenQueue, connection };
