const { randomUUID } = require('crypto');

function tracingMiddleware(req, res, next) {
    const correlationId = req.headers['x-correlation-id'] || randomUUID();
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
}

module.exports = { tracingMiddleware };
