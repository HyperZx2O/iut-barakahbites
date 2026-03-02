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

  // Seed default students for spec compliance
  const students = [
    { id: '240041221', name: 'Admin One', pass: 'admin1' },
    { id: '240041116', name: 'Admin Two', pass: 'admin2' },
    { id: '240041117', name: 'Admin Three', pass: 'admin3' },
  ];

  for (const s of students) {
    const hash = await bcrypt.hash(s.pass, 10);
    await pool.query(
      'INSERT INTO students (student_id, name, password_hash) VALUES ($1, $2, $3) ON CONFLICT (student_id) DO UPDATE SET password_hash = EXCLUDED.password_hash',
      [s.id, s.name, hash]
    );
  }
  console.log('[SEED] New student credentials seeded successfully');
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  init,
};
