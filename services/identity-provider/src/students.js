const db = require('./db');

// Create a new student. Returns the student object on success, or null if duplicate.
async function createStudent(studentId, name, passwordHash) {
    try {
        const result = await db.query(
            'INSERT INTO students (student_id, name, password_hash) VALUES ($1, $2, $3) RETURNING id, student_id, name, created_at',
            [studentId, name, passwordHash]
        );
        return result.rows[0];
    } catch (err) {
        if (err.code === '23505') {
            return null; // duplicate student_id
        }
        throw err;
    }
}

// Find a student by student_id. Returns null if not found.
async function findStudent(studentId) {
    const result = await db.query(
        'SELECT id, student_id, name, password_hash FROM students WHERE student_id = $1',
        [studentId]
    );
    return result.rows[0] || null;
}

module.exports = { createStudent, findStudent };
