const { PORT } = require('./config');
const app = require('./app');
const http = require('http');

const { init } = require('./db');

async function start() {
  const server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`identity-provider listening on ${PORT}`);
  });

  // Run DB init in background so it doesn't block health checks
  init().catch(err => {
    console.error('Background DB initialization failed:', err.message);
  });
}

start().catch(err => {
  console.error('Failed to start identity-provider:', err);
  process.exit(1);
});
