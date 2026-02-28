const { Pool } = require('pg');
const { DATABASE_URL } = require('./config');

const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Initialize tables matching spec §12 schema.
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      student_id VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id SERIAL PRIMARY KEY,
      student_id VARCHAR(20) NOT NULL,
      attempted_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_login_attempts_student_time
    ON login_attempts(student_id, attempted_at);
  `);
}

init().catch(err => {
  console.error('Database initialization error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
