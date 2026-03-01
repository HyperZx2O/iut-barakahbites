const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  PORT: process.env.PORT || 3002,
  JWT_SECRET: process.env.JWT_SECRET || 'change_this_secret',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  STOCK_SERVICE_URL: process.env.STOCK_SERVICE_URL || 'http://stock-service:3003',
  KITCHEN_QUEUE_URL: process.env.KITCHEN_QUEUE_URL || 'http://kitchen-queue:3004',
  NOTIFICATION_HUB_URL: process.env.NOTIFICATION_HUB_URL || 'http://notification-hub:3005',
};