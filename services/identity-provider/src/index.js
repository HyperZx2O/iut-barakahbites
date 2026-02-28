const { PORT } = require('./config');
const app = require('./app');
const http = require('http');

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`identity-provider listening on ${PORT}`);
});
