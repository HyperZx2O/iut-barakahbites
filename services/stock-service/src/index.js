const app = require('./app');
const { initDb } = app;

const PORT = process.env.PORT || 3003;

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`stock-service listening on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start stock-service:', err);
  process.exit(1);
});
