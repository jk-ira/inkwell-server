const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../services/user');
const { HttpError, asyncHandler } = require('../utils/http');

const signToken = (user) => jwt.sign({ sub: user.id }, config.jwtSecret, { algorithm: 'HS256', expiresIn: config.jwtExpiresIn });

async function resolveUser(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Invalid authorization header');
  let payload;
  try { payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }); }
  catch { throw new HttpError(401, 'Invalid or expired token'); }
  const found = await User.findForAuth(payload.sub);
  if (!found) throw new HttpError(401, 'Account no longer exists');
  if (Math.floor(found.passwordChangedAt.getTime() / 1000) > payload.iat) throw new HttpError(401, 'Token expired, please log in again');
  if (found.user.status !== 'active') throw new HttpError(403, 'Account suspended');
  return found.user;
}

// Public endpoints: attaches req.user when a valid token is present, otherwise continues anonymously
const optionalAuth = asyncHandler(async (req, res, next) => {
  try { req.user = await resolveUser(req); } catch { req.user = null; }
  next();
});

const requireAuth = asyncHandler(async (req, res, next) => {
  const user = await resolveUser(req);
  if (!user) throw new HttpError(401, 'Authentication required');
  req.user = user;
  next();
});

const requireAdmin = [
  requireAuth,
  (req, res, next) => (req.user.role === 'admin' ? next() : next(new HttpError(403, 'Admin access required'))),
];

module.exports = { signToken, optionalAuth, requireAuth, requireAdmin };
