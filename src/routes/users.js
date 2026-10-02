const express = require('express');
const User = require('../services/user');
const Post = require('../services/post');
const validate = require('../middleware/validate');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { HttpError, asyncHandler, pageMeta } = require('../utils/http');
const { z, pagination } = require('../utils/schemas');

const router = express.Router();
const nameParam = z.object({ username: z.string().trim().min(1).max(30) });

router.get('/users/:username', validate({ params: nameParam }), asyncHandler(async (req, res) => {
  const user = await User.findPublicByUsername(req.params.username);
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ data: user });
}));

router.get('/users/:username/posts', optionalAuth, validate({ params: nameParam, query: z.object(pagination) }),
  asyncHandler(async (req, res) => {
    const user = await User.findPublicByUsername(req.params.username);
    if (!user) throw new HttpError(404, 'User not found');
    const { page, limit } = req.query;
    const { rows, total } = await Post.list({ viewerId: req.user?.id, page, limit, authorId: user.id, publicOnly: true });
    res.json({ data: rows, pagination: pageMeta(page, limit, total) });
  }));

// The logged-in user's own posts (drafts, published and hidden)
router.get('/me/posts', requireAuth, validate({
  query: z.object({ ...pagination, status: z.enum(['draft', 'published', 'hidden']).optional() }),
}), asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const { rows, total } = await Post.list({ viewerId: req.user.id, page, limit, authorId: req.user.id, status });
  res.json({ data: rows, pagination: pageMeta(page, limit, total) });
}));

module.exports = router;
