const { Pool } = require('pg');
const { DATABASE_URL } = require('./config');
const bcrypt = require('bcrypt');

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

  // Seed default student for spec compliance
  // Password is 'password123'
  const defaultHash = await bcrypt.hash('password123', 10);
  await pool.query(
    'INSERT INTO students (student_id, name, password_hash) VALUES ($1, $2, $3) ON CONFLICT (student_id) DO UPDATE SET password_hash = EXCLUDED.password_hash',
    ['210042101', 'Ahmed Rahman', defaultHash]
  );
  console.log('[SEED] Default student 210042101 seeded/updated successfully');
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  init,
};
