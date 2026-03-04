const http = require('http');
const app = require('./app'); // corrected relative path
const { PORT } = require('./config');

http.createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`order-gateway listening on ${PORT}`);
});
