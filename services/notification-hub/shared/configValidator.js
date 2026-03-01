/**
 * Simple environment variable validator.
 * Pass an array of required variable names. If any are missing, the process exits with an error.
 */
function validateEnv(required) {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}
module.exports = { validateEnv };
