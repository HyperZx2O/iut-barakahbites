// config.js – simple environment validation utility
module.exports = function validateEnv(required) {
  const missing = [];
  required.forEach((key) => {
    if (!process.env[key]) missing.push(key);
  });
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
};
