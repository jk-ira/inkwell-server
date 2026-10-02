const { Op, fn, col, where, literal } = require('sequelize');
const { Post, User, sequelize } = require('../models');
const { escapeLike } = require('../utils/sql');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLISHED_OR_CREATED = 'COALESCE("Post"."published_at", "Post"."created_at")';

// Counts and "liked by the current viewer" are computed with correlated sub-selects
const computed = (viewerId) => [
  [literal('(SELECT COUNT(*) FROM likes l WHERE l.post_id = "Post"."id")::int'), 'likeCount'],
  [literal(`(SELECT COUNT(*) FROM comments c WHERE c.post_id = "Post"."id" AND c.status = 'visible')::int`), 'commentCount'],
  [literal('(SELECT COUNT(*) FROM shares s WHERE s.post_id = "Post"."id")::int'), 'shareCount'],
  [literal(viewerId
    ? `EXISTS (SELECT 1 FROM likes l WHERE l.post_id = "Post"."id" AND l.user_id = ${sequelize.escape(viewerId)})`
    : 'false'), 'likedByMe'],
];

const ORDER = {
  newest: [[literal(PUBLISHED_OR_CREATED), 'DESC'], ['id', 'ASC']],
  oldest: [[literal(PUBLISHED_OR_CREATED), 'ASC'], ['id', 'ASC']],
  popular: [[literal('"likeCount"'), 'DESC'], [literal('"commentCount"'), 'DESC'], [literal(PUBLISHED_OR_CREATED), 'DESC']],
};

const authorInclude = ({ activeOnly = false, username } = {}) => {
  const conds = [];
  if (activeOnly) conds.push({ status: 'active' });
  if (username) conds.push(where(fn('lower', col('author.username')), username.toLowerCase()));
  return {
    model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'status'], required: true,
    ...(conds.length && { where: { [Op.and]: conds } }),
  };
};

const toPost = (row, { withContent = true } = {}) => {
  if (!row) return null;
  const r = row.get({ plain: true });
  return {
    id: r.id, title: r.title, slug: r.slug, excerpt: r.excerpt,
    ...(withContent && { content: r.content }),
    coverImageUrl: r.coverImageUrl, status: r.status,
    publishedAt: r.publishedAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
    author: { id: r.author.id, username: r.author.username, displayName: r.author.displayName },
    counts: { likes: r.likeCount, comments: r.commentCount, shares: r.shareCount },
    likedByMe: r.likedByMe,
  };
};

async function list({ viewerId = null, page = 1, limit = 10, q, authorId, authorUsername, status, publicOnly = false, sort = 'newest' }) {
  const w = {};
  if (publicOnly) w.status = 'published';
  if (status) w.status = status;
  if (authorId) w.authorId = authorId;
  if (q) {
    const pat = { [Op.iLike]: `%${escapeLike(q)}%` };
    w[Op.or] = [{ title: pat }, { content: pat }];
  }
  const include = [authorInclude({ activeOnly: publicOnly, username: authorUsername })];
  const total = await Post.count({ where: w, include });
  const rows = await Post.findAll({
    where: w, include,
    attributes: { include: computed(viewerId), exclude: ['content'] }, // list view: no full content
    order: ORDER[sort] || ORDER.newest, limit, offset: (page - 1) * limit,
  });
  return { rows: rows.map((r) => toPost(r, { withContent: false })), total };
}

async function findByIdOrSlug(idOrSlug, viewerId = null) {
  const row = await Post.findOne({
    where: UUID_RE.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
    include: [authorInclude()],
    attributes: { include: computed(viewerId) },
  });
  return row ? { ...toPost(row), _authorStatus: row.author.status } : null;
}

async function create({ authorId, title, slug, excerpt, content, coverImageUrl, status }) {
  const post = await Post.create({
    authorId, title, slug, excerpt, content, coverImageUrl: coverImageUrl ?? null, status,
    publishedAt: status === 'published' ? new Date() : null,
  });
  return findByIdOrSlug(post.id, authorId);
}

async function update(id, existing, { title, content, excerpt, coverImageUrl, status }) {
  const changes = {};
  if (title !== undefined) changes.title = title;
  if (content !== undefined) { changes.content = content; changes.excerpt = excerpt; }
  if (coverImageUrl !== undefined) changes.coverImageUrl = coverImageUrl;
  if (status !== undefined) {
    changes.status = status;
    if (status === 'published' && !existing.publishedAt) changes.publishedAt = new Date();
  }
  if (Object.keys(changes).length) await Post.update(changes, { where: { id } });
  return findByIdOrSlug(id, existing.author.id);
}

const remove = async (id) => (await Post.destroy({ where: { id } })) > 0;

module.exports = { list, findByIdOrSlug, create, update, remove };
