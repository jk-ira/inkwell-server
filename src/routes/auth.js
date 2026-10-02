const express = require('express');
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require('../services/user');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const { signToken, requireAuth } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../utils/http');
const { z, password } = require('../utils/schemas');
const { clean } = require('../utils/text');

const router = express.Router();
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // equalises timing when the account does not exist

const registerSchema = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,30}$/, 'Username must be 3-30 characters: letters, numbers, underscore'),
  email: z.string().trim().toLowerCase().email('Invalid email').max(254),
  password,
  displayName: z.string().trim().min(1).max(60).optional(),
});

router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(async (req, res) => {
  const { username, email, password: pw, displayName } = req.body;
  const passwordHash = await bcrypt.hash(pw, config.bcryptRounds);
  let user;
  try {
    user = await User.create({ username, email, passwordHash, displayName: clean(displayName || username) || username });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      const field = (err.parent?.constraint || '').includes('email') ? 'email' : 'username';
      throw new HttpError(409, `${field === 'email' ? 'Email' : 'Username'} is already taken`, [{ field, message: 'already in use' }]);
    }
    throw err;
  }
  res.status(201).json({ data: { user, token: signToken(user) } });
}));

router.post('/login', authLimiter,
  validate({ body: z.object({ identifier: z.string().trim().min(1).max(254), password: z.string().min(1).max(200) }) }),
  asyncHandler(async (req, res) => {
    const found = await User.findByLogin(req.body.identifier);
    const ok = await bcrypt.compare(req.body.password, found ? found.passwordHash : DUMMY_HASH);
    if (!found || !ok) throw new HttpError(401, 'Invalid credentials');
    if (found.user.status !== 'active') throw new HttpError(403, 'Account suspended');
    await User.touchLogin(found.user.id);
    res.json({ data: { user: found.user, token: signToken(found.user) } });
  }));

router.get('/me', requireAuth, (req, res) => res.json({ data: { user: req.user } }));

router.patch('/me', requireAuth,
  validate({ body: z.object({ displayName: z.string().trim().min(1).max(60).optional(), bio: z.string().trim().max(500).optional() })
    .refine((b) => Object.keys(b).length > 0, 'Provide at least one field') }),
  asyncHandler(async (req, res) => {
    const { displayName, bio } = req.body;
    const user = await User.updateProfile(req.user.id, {
      displayName: displayName !== undefined ? clean(displayName) || req.user.displayName : undefined,
      bio: bio !== undefined ? clean(bio) : undefined,
    });
    res.json({ data: { user } });
  }));

router.post('/change-password', authLimiter, requireAuth,
  validate({ body: z.object({ currentPassword: z.string().min(1).max(200), newPassword: password }) }),
  asyncHandler(async (req, res) => {
    const hash = await User.getPasswordHash(req.user.id);
    if (!(await bcrypt.compare(req.body.currentPassword, hash))) throw new HttpError(400, 'Current password is incorrect');
    await User.updatePassword(req.user.id, await bcrypt.hash(req.body.newPassword, config.bcryptRounds));
    // all previously issued tokens are now invalid; return a fresh one
    res.json({ data: { token: signToken(req.user) } });
  }));

module.exports = router;
