const express = require('express');
const config = require('../config');
const Post = require('../services/post');
const Comment = require('../services/comment');
const Interaction = require('../services/interaction');
const validate = require('../middleware/validate');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { HttpError, asyncHandler, pageMeta } = require('../utils/http');
const { z, idParam, pagination } = require('../utils/schemas');
const { clean, excerptOf, makeSlug } = require('../utils/text');

const router = express.Router();

const strip = ({ _authorStatus, ...post }) => post;
const isPublic = (p) => p.status === 'published' && p._authorStatus === 'active';
const isOwnerOrAdmin = (p, u) => !!u && (u.id === p.author.id || u.role === 'admin');
const canView = (p, u) => isPublic(p) || isOwnerOrAdmin(p, u);

// Post must exist and be publicly visible (used by like / comment / share)
async function requirePublished(id, viewerId) {
  const post = await Post.findByIdOrSlug(id, viewerId);
  if (!post || !isPublic(post)) throw new HttpError(404, 'Post not found');
  return post;
}

const coverUrl = z.string().trim().url().max(2000).refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL');
const createSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  content: z.string().trim().min(1, 'Content is required').max(50000),
  coverImageUrl: coverUrl.nullable().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
});
const updateSchema = createSchema.partial().omit({ status: true })
  .extend({ status: z.enum(['draft', 'published']).optional() })
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');

// ---- Public reads --------------------------------------------------------------------------
router.get('/', optionalAuth, validate({
  query: z.object({
    ...pagination,
    q: z.string().trim().max(100).optional(),
    author: z.string().trim().max(30).optional(),
    sort: z.enum(['newest', 'oldest', 'popular']).default('newest'),
  }),
}), asyncHandler(async (req, res) => {
  const { page, limit, q, author, sort } = req.query;
  const { rows, total } = await Post.list({ viewerId: req.user?.id, page, limit, q, authorUsername: author, sort, publicOnly: true });
  res.json({ data: rows, pagination: pageMeta(page, limit, total) });
}));

router.get('/:idOrSlug', optionalAuth, asyncHandler(async (req, res) => {
  const post = await Post.findByIdOrSlug(req.params.idOrSlug, req.user?.id);
  if (!post || !canView(post, req.user)) throw new HttpError(404, 'Post not found');
  res.json({ data: strip(post) });
}));

router.get('/:id/comments', optionalAuth, validate({ params: idParam }), asyncHandler(async (req, res) => {
  const post = await Post.findByIdOrSlug(req.params.id, req.user?.id);
  if (!post || !canView(post, req.user)) throw new HttpError(404, 'Post not found');
  res.json({ data: await Comment.listForPost(post.id) });
}));

// ---- Authenticated writes ------------------------------------------------------------------
router.post('/', requireAuth, validate({ body: createSchema }), asyncHandler(async (req, res) => {
  const title = clean(req.body.title);
  const content = clean(req.body.content);
  if (title.length < 3 || !content) throw new HttpError(400, 'Validation failed', [{ field: 'title/content', message: 'Title or content is empty after sanitising' }]);
  const post = await Post.create({
    authorId: req.user.id, title, slug: makeSlug(title), excerpt: excerptOf(content), content,
    coverImageUrl: req.body.coverImageUrl, status: req.body.status,
  });
  res.status(201).json({ data: strip(post) });
}));

router.patch('/:id', requireAuth, validate({ params: idParam, body: updateSchema }), asyncHandler(async (req, res) => {
  const post = await Post.findByIdOrSlug(req.params.id, req.user.id);
  if (!post || !canView(post, req.user)) throw new HttpError(404, 'Post not found');
  if (!isOwnerOrAdmin(post, req.user)) throw new HttpError(403, 'You can only edit your own posts');
  if (req.body.status !== undefined && post.status === 'hidden' && req.user.role !== 'admin') {
    throw new HttpError(403, 'This post was hidden by a moderator; its status cannot be changed');
  }
  const changes = { ...req.body };
  if (changes.title !== undefined) changes.title = clean(changes.title);
  if (changes.content !== undefined) { changes.content = clean(changes.content); changes.excerpt = excerptOf(changes.content); }
  if (changes.title !== undefined && changes.title.length < 3) throw new HttpError(400, 'Title is too short after sanitising');
  if (changes.content !== undefined && !changes.content) throw new HttpError(400, 'Content is empty after sanitising');
  res.json({ data: strip(await Post.update(post.id, post, changes)) });
}));

router.delete('/:id', requireAuth, validate({ params: idParam }), asyncHandler(async (req, res) => {
  const post = await Post.findByIdOrSlug(req.params.id, req.user.id);
  if (!post || !canView(post, req.user)) throw new HttpError(404, 'Post not found');
  if (!isOwnerOrAdmin(post, req.user)) throw new HttpError(403, 'You can only delete your own posts');
  await Post.remove(post.id);
  res.json({ data: { id: post.id, deleted: true } });
}));

// ---- Interactions --------------------------------------------------------------------------
router.post('/:id/like', requireAuth, validate({ params: idParam }), asyncHandler(async (req, res) => {
  await requirePublished(req.params.id, req.user.id);
  res.json({ data: { liked: true, likeCount: await Interaction.like(req.params.id, req.user.id) } });
}));

router.delete('/:id/like', requireAuth, validate({ params: idParam }), asyncHandler(async (req, res) => {
  await requirePublished(req.params.id, req.user.id);
  res.json({ data: { liked: false, likeCount: await Interaction.unlike(req.params.id, req.user.id) } });
}));

router.post('/:id/comments', requireAuth, validate({
  params: idParam,
  body: z.object({ content: z.string().trim().min(1).max(2000), parentId: z.string().uuid().nullable().optional() }),
}), asyncHandler(async (req, res) => {
  await requirePublished(req.params.id, req.user.id);
  const content = clean(req.body.content);
  if (!content) throw new HttpError(400, 'Comment is empty after sanitising');
  if (req.body.parentId) {
    const parent = await Comment.findById(req.body.parentId);
    if (!parent || parent.postId !== req.params.id) throw new HttpError(400, 'Parent comment not found on this post');
    if (parent.status !== 'visible') throw new HttpError(400, 'You cannot reply to a removed comment');
  }
  const comment = await Comment.create({ postId: req.params.id, userId: req.user.id, parentId: req.body.parentId, content });
  res.status(201).json({ data: comment });
}));

const SHARE_PLATFORMS = ['link', 'twitter', 'facebook', 'whatsapp', 'linkedin', 'email', 'other'];
router.post('/:id/share', requireAuth, validate({
  params: idParam, body: z.object({ platform: z.enum(SHARE_PLATFORMS).default('link') }),
}), asyncHandler(async (req, res) => {
  const post = await requirePublished(req.params.id, req.user.id);
  const shareCount = await Interaction.share(post.id, req.user.id, req.body.platform);
  const url = `${config.publicAppUrl}/posts/${post.slug}`;
  const u = encodeURIComponent(url); const t = encodeURIComponent(post.title);
  res.status(201).json({
    data: {
      platform: req.body.platform, shareCount, shareUrl: url,
      links: {
        twitter: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
        whatsapp: `https://wa.me/?text=${t}%20${u}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
        email: `mailto:?subject=${t}&body=${u}`,
      },
    },
  });
}));

module.exports = router;
