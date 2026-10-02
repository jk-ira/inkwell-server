const { Op } = require('sequelize');
const { AdminAction, User, Post, Comment, Like, Share } = require('../models');

const logAction = (adminId, action, targetType, targetId, details = {}) =>
  AdminAction.create({ adminId, action, targetType, targetId, details });

async function listActions({ page, limit }) {
  const total = await AdminAction.count();
  const rows = await AdminAction.findAll({
    include: [{ model: User, as: 'admin', attributes: ['id', 'username'] }],
    order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit,
  });
  return {
    total,
    rows: rows.map((a) => ({
      id: a.id, action: a.action, targetType: a.targetType, targetId: a.targetId, details: a.details,
      admin: a.admin ? { id: a.admin.id, username: a.admin.username } : null, createdAt: a.createdAt,
    })),
  };
}

async function stats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [users, suspended, newUsers, posts, published, draft, hidden, comments, hiddenComments, likes, shares] = await Promise.all([
    User.count(), User.count({ where: { status: 'suspended' } }), User.count({ where: { createdAt: { [Op.gt]: weekAgo } } }),
    Post.count(), Post.count({ where: { status: 'published' } }), Post.count({ where: { status: 'draft' } }), Post.count({ where: { status: 'hidden' } }),
    Comment.count(), Comment.count({ where: { status: 'hidden' } }), Like.count(), Share.count(),
  ]);
  return {
    users: { total: users, suspended, newLast7Days: newUsers },
    posts: { total: posts, published, draft, hidden },
    comments: { total: comments, hidden: hiddenComments },
    likes, shares,
  };
}

module.exports = { logAction, listActions, stats };
