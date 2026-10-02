const { Op, fn, col, where, literal } = require('sequelize');
const { User } = require('../models');
const { escapeLike } = require('../utils/sql');

const map = (u) => u && {
  id: u.id, username: u.username, email: u.email, displayName: u.displayName, bio: u.bio,
  role: u.role, status: u.status, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt, updatedAt: u.updatedAt,
};
const publicView = (u) => u && { id: u.id, username: u.username, displayName: u.displayName, bio: u.bio, createdAt: u.createdAt };
const lowerEq = (column, value) => where(fn('lower', col(column)), value.toLowerCase());

async function create({ username, email, passwordHash, displayName }) {
  return map(await User.create({ username, email, passwordHash, displayName }));
}

const findById = async (id) => map(await User.findByPk(id));

// For the auth middleware: also returns passwordChangedAt to invalidate old tokens
async function findForAuth(id) {
  const u = await User.findByPk(id);
  return u ? { user: map(u), passwordChangedAt: u.passwordChangedAt } : null;
}

async function findByLogin(identifier) {
  const u = await User.findOne({ where: { [Op.or]: [lowerEq('email', identifier), lowerEq('username', identifier)] } });
  return u ? { user: map(u), passwordHash: u.passwordHash } : null;
}

async function findPublicByUsername(username) {
  return publicView(map(await User.findOne({ where: { [Op.and]: [lowerEq('username', username), { status: 'active' }] } })));
}

const getPasswordHash = async (id) => (await User.findByPk(id, { attributes: ['passwordHash'] }))?.passwordHash;

async function updateProfile(id, { displayName, bio }) {
  const u = await User.findByPk(id);
  const changes = {};
  if (displayName !== undefined) changes.displayName = displayName;
  if (bio !== undefined) changes.bio = bio;
  return map(await u.update(changes));
}

const updatePassword = (id, hash) => User.update({ passwordHash: hash, passwordChangedAt: new Date() }, { where: { id } });
const touchLogin = (id) => User.update({ lastLoginAt: new Date() }, { where: { id } });

async function adminList({ q, role, status, page, limit }) {
  const w = {};
  if (role) w.role = role;
  if (status) w.status = status;
  if (q) {
    const pat = { [Op.iLike]: `%${escapeLike(q)}%` };
    w[Op.or] = [{ username: pat }, { email: pat }, { displayName: pat }];
  }
  const total = await User.count({ where: w });
  const rows = await User.findAll({
    where: w,
    attributes: { include: [
      [literal('(SELECT COUNT(*) FROM posts p WHERE p.author_id = "User"."id")::int'), 'postCount'],
      [literal('(SELECT COUNT(*) FROM comments c WHERE c.user_id = "User"."id")::int'), 'commentCount'],
    ] },
    order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit,
  });
  return { total, rows: rows.map((u) => ({ ...map(u), postCount: u.get('postCount'), commentCount: u.get('commentCount') })) };
}

async function adminUpdate(id, { role, status }) {
  const u = await User.findByPk(id);
  if (!u) return null;
  const changes = {};
  if (role) changes.role = role;
  if (status) changes.status = status;
  return map(await u.update(changes));
}

// FK constraints cascade to the user's posts, comments, likes and shares
const remove = async (id) => (await User.destroy({ where: { id } })) > 0;

module.exports = { create, findById, findForAuth, findByLogin, findPublicByUsername, getPasswordHash, updateProfile, updatePassword, touchLogin, adminList, adminUpdate, remove };
