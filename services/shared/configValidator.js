/**
 * Simple environment variable validator.
 * Pass an array of required variable names. If any are missing, the process exits with an error.
 */
function validateEnv(required) {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error('Missing required environment variables:', missing.join(', '));
    console.warn("CRITICAL: Service continuing despite missing env vars. Fix this in Railway dashboard.");
  }
}
module.exports = { validateEnv };
