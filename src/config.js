require('dotenv').config({ quiet: true });
const env = process.env;

const config = {
  nodeEnv: env.NODE_ENV || 'development',
  port: parseInt(env.PORT || '4000', 10),
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(env.BCRYPT_ROUNDS || '12', 10),
  corsOrigins: (env.CORS_ORIGINS)
    .split(',').map((s) => s.trim()).filter(Boolean),
  publicAppUrl: (env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  trustProxy: env.TRUST_PROXY === 'true',
  rateLimitMax: parseInt(env.RATE_LIMIT_MAX || '300', 10),      // per 15 min per IP, all /api
  authRateLimitMax: parseInt(env.AUTH_RATE_LIMIT_MAX || '20', 10), // per 15 min per IP, login/register
};

config.assertSecure = () => {
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long (see .env.example)');
  }
};

module.exports = config;
