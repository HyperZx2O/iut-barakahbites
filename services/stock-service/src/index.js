const app = require('./app');
const { initDb } = app;

const PORT = process.env.PORT || 3003;

async function start() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`stock-service listening on port ${PORT}`);
  });

  // background init
  initDb().catch(err => console.error('Stock DB init failed:', err.message));
}

start().catch(err => {
  console.error('Failed to start stock-service:', err);
  process.exit(1);
});
