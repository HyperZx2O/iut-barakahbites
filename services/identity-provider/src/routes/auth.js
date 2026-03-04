const express = require('express');
const bcrypt = require('bcrypt');
const { signToken } = require('../auth');
const { createStudent, findStudent } = require('../students');
const { increment } = require('./monitor');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  const { studentId, name, password } = req.body;
  const tid = studentId?.trim();
  if (!tid || !name || !password) {
    return res.status(400).json({ error: 'studentId, name, and password required' });
  }
  const hash = await bcrypt.hash(password, 10);
  const student = await createStudent(tid, name, hash);
  if (!student) {
    return res.status(409).json({ error: 'User already exists' });
  }
  increment('registrations');
  const token = signToken({ sub: studentId, name });
  return res.status(201).json({ token, studentId });
});

// Login
router.post('/login', async (req, res) => {
  const { studentId, password } = req.body;
  const tid = studentId?.trim();

  if (!tid || !password) {
    return res.status(400).json({ error: 'studentId and password required' });
  }

  console.log(`[AUTH] Login attempt for: ${tid}`);
  const student = await findStudent(tid);

  if (!student) {
    console.log(`[AUTH] Login failed: Student ID "${tid}" not found`);
    increment('failures');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, student.password_hash);
  if (!match) {
    console.log(`[AUTH] Login failed: Password mismatch for "${tid}"`);
    increment('failures');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  console.log(`[AUTH] Login success: ${tid} (${student.name})`);
  increment('logins');
  const token = signToken({ sub: tid, name: student.name });
  return res.status(200).json({ token, expiresIn: 3600, studentId: tid });
});

module.exports = router;
