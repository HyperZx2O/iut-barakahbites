const { PORT } = require('./config');
const app = require('./app');
const http = require('http');

const { init } = require('./db');

async function start() {
  await init();
  const server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`identity-provider listening on ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start identity-provider:', err);
  process.exit(1);
});
