const express = require('express');
const User = require('../services/user');
const Post = require('../services/post');
const Comment = require('../services/comment');
const Admin = require('../services/admin');
const validate = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const { HttpError, asyncHandler, pageMeta } = require('../utils/http');
const { z, idParam, pagination } = require('../utils/schemas');

const router = express.Router();
router.use(requireAdmin);

router.get('/stats', asyncHandler(async (req, res) => res.json({ data: await Admin.stats() })));

router.get('/audit-log', validate({ query: z.object(pagination) }), asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { rows, total } = await Admin.listActions({ page, limit });
  res.json({ data: rows, pagination: pageMeta(page, limit, total) });
}));

// ---- Users ---------------------------------------------------------------------------------
router.get('/users', validate({
  query: z.object({ ...pagination, q: z.string().trim().max(100).optional(),
    role: z.enum(['user', 'admin']).optional(), status: z.enum(['active', 'suspended']).optional() }),
}), asyncHandler(async (req, res) => {
  const { rows, total } = await User.adminList(req.query);
  res.json({ data: rows, pagination: pageMeta(req.query.page, req.query.limit, total) });
}));

router.patch('/users/:id', validate({
  params: idParam,
  body: z.object({ role: z.enum(['user', 'admin']).optional(), status: z.enum(['active', 'suspended']).optional() })
    .refine((b) => b.role || b.status, 'Provide role and/or status'),
}), asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(400, 'You cannot change your own role or status');
  const user = await User.adminUpdate(req.params.id, req.body);
  if (!user) throw new HttpError(404, 'User not found');
  await Admin.logAction(req.user.id, 'user.update', 'user', user.id, req.body);
  res.json({ data: user });
}));

router.delete('/users/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(400, 'You cannot delete your own account here');
  const target = await User.findById(req.params.id);
  if (!target) throw new HttpError(404, 'User not found');
  await User.remove(target.id); // cascades to the user's posts, comments, likes and shares
  await Admin.logAction(req.user.id, 'user.delete', 'user', target.id, { username: target.username });
  res.json({ data: { id: target.id, deleted: true } });
}));

// ---- Posts ---------------------------------------------------------------------------------
router.get('/posts', validate({
  query: z.object({ ...pagination, q: z.string().trim().max(100).optional(), author: z.string().trim().max(30).optional(),
    status: z.enum(['draft', 'published', 'hidden']).optional(), sort: z.enum(['newest', 'oldest', 'popular']).default('newest') }),
}), asyncHandler(async (req, res) => {
  const { page, limit, q, author, status, sort } = req.query;
  const { rows, total } = await Post.list({ viewerId: req.user.id, page, limit, q, authorUsername: author, status, sort });
  res.json({ data: rows, pagination: pageMeta(page, limit, total) });
}));

router.patch('/posts/:id/status', validate({
  params: idParam, body: z.object({ status: z.enum(['draft', 'published', 'hidden']) }),
}), asyncHandler(async (req, res) => {
  const post = await Post.findByIdOrSlug(req.params.id, req.user.id);
  if (!post) throw new HttpError(404, 'Post not found');
  const updated = await Post.update(post.id, post, { status: req.body.status });
  await Admin.logAction(req.user.id, 'post.status', 'post', post.id, { from: post.status, to: req.body.status });
  const { _authorStatus, ...out } = updated;
  res.json({ data: out });
}));

router.delete('/posts/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const post = await Post.findByIdOrSlug(req.params.id, req.user.id);
  if (!post) throw new HttpError(404, 'Post not found');
  await Post.remove(post.id);
  await Admin.logAction(req.user.id, 'post.delete', 'post', post.id, { title: post.title });
  res.json({ data: { id: post.id, deleted: true } });
}));

// ---- Comments ------------------------------------------------------------------------------
router.get('/comments', validate({
  query: z.object({ ...pagination, q: z.string().trim().max(100).optional(), status: z.enum(['visible', 'hidden', 'deleted']).optional() }),
}), asyncHandler(async (req, res) => {
  const { rows, total } = await Comment.adminList(req.query);
  res.json({ data: rows, pagination: pageMeta(req.query.page, req.query.limit, total) });
}));

router.patch('/comments/:id/status', validate({
  params: idParam, body: z.object({ status: z.enum(['visible', 'hidden']) }),
}), asyncHandler(async (req, res) => {
  if (!(await Comment.setStatus(req.params.id, req.body.status))) throw new HttpError(404, 'Comment not found');
  await Admin.logAction(req.user.id, 'comment.status', 'comment', req.params.id, { to: req.body.status });
  res.json({ data: { id: req.params.id, status: req.body.status } });
}));

router.delete('/comments/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  if (!(await Comment.hardDelete(req.params.id))) throw new HttpError(404, 'Comment not found');
  await Admin.logAction(req.user.id, 'comment.delete', 'comment', req.params.id);
  res.json({ data: { id: req.params.id, deleted: true } });
}));

module.exports = router;
