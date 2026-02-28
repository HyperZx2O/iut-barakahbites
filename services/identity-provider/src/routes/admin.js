const express = require('express');
const { kill, revive } = require('../serviceState');

const router = express.Router();

// Admin routes are always responsive, even in killed state.
// The safe-route exemption in app.js ensures these are never blocked.

router.post('/kill', (req, res) => {
  kill();
  res.status(200).json({ status: 'killed' });
});

router.post('/revive', (req, res) => {
  revive();
  res.status(200).json({ status: 'alive' });
});

module.exports = router;
