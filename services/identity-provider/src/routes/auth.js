const express = require('express');
const bcrypt = require('bcrypt');
const { signToken } = require('../auth');
const { createStudent, findStudent } = require('../students');
const { increment } = require('./monitor');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  const { studentId, name, password } = req.body;
  if (!studentId || !name || !password) {
    return res.status(400).json({ error: 'studentId, name, and password required' });
  }
  const hash = await bcrypt.hash(password, 10);
  const student = await createStudent(studentId, name, hash);
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
  if (!studentId || !password) {
    return res.status(400).json({ error: 'studentId and password required' });
  }
  const student = await findStudent(studentId);
  if (!student) {
    console.log(`[DEBUG] Login failed: Student ID ${studentId} not found in DB`);
    increment('failures');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const match = await bcrypt.compare(password, student.password_hash);
  if (!match) {
    console.log(`[DEBUG] Login failed: Password mismatch for ${studentId}`);
    increment('failures');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  increment('logins');
  const token = signToken({ sub: studentId, name: student.name });
  return res.status(200).json({ token, expiresIn: 3600, studentId });
});

module.exports = router;
