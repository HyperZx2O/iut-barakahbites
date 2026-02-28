const http = require('http');
const app = require('./app'); // corrected relative path
const { PORT } = require('./config');

http.createServer(app).listen(PORT, () => {
  console.log(`order-gateway listening on ${PORT}`);
});
