const rateLimit = require('express-rate-limit');
const config = require('../config');

const make = (limit) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { message: 'Too many requests, please try again later' } }),
  });

module.exports = { apiLimiter: make(config.rateLimitMax), authLimiter: make(config.authRateLimitMax) };
