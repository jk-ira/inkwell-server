const { Op } = require('sequelize');
const { Comment, User, Post } = require('../models');
const { escapeLike } = require('../utils/sql');

const authorInclude = { model: User, as: 'author', attributes: ['id', 'username', 'displayName'] };

function buildTree(rows) {
  const nodes = new Map();
  rows.forEach((row) => {
    const r = row.get({ plain: true });
    nodes.set(r.id, {
      id: r.id, postId: r.postId, parentId: r.parentId,
      author: { id: r.author.id, username: r.author.username, displayName: r.author.displayName },
      content: r.status === 'visible' ? r.content : null, // hidden/deleted comments are masked
      status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt, replies: [],
    });
  });
  const roots = [];
  for (const n of nodes.values()) {
    const parent = n.parentId && nodes.get(n.parentId);
    (parent ? parent.replies : roots).push(n);
  }
  const prune = (list) => list.filter((n) => { n.replies = prune(n.replies); return n.status === 'visible' || n.replies.length > 0; });
  return prune(roots);
}

const listForPost = async (postId) =>
  buildTree(await Comment.findAll({ where: { postId }, include: [authorInclude], order: [['createdAt', 'ASC']] }));

const findById = (id) => Comment.findByPk(id);

async function getOne(id) {
  const row = await Comment.findByPk(id, { include: [authorInclude] });
  return row ? buildTree([row])[0] : null;
}

async function create({ postId, userId, parentId, content }) {
  const c = await Comment.create({ postId, userId, parentId: parentId ?? null, content });
  return getOne(c.id);
}

async function updateContent(id, content) {
  await Comment.update({ content }, { where: { id } });
  return getOne(id);
}

// Owner delete: soft-delete when replies exist (keeps the thread intact), otherwise remove the row
async function ownerDelete(id) {
  if (await Comment.count({ where: { parentId: id } })) await Comment.update({ status: 'deleted' }, { where: { id } });
  else await Comment.destroy({ where: { id } });
}

const hardDelete = async (id) => (await Comment.destroy({ where: { id } })) > 0;
const setStatus = async (id, status) => (await Comment.update({ status }, { where: { id } }))[0] > 0;

async function adminList({ status, q, page, limit }) {
  const w = {};
  if (status) w.status = status;
  if (q) w.content = { [Op.iLike]: `%${escapeLike(q)}%` };
  const total = await Comment.count({ where: w });
  const rows = await Comment.findAll({
    where: w, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit,
    include: [authorInclude, { model: Post, as: 'post', attributes: ['id', 'title', 'slug'] }],
  });
  return {
    total,
    rows: rows.map((row) => {
      const r = row.get({ plain: true });
      return {
        id: r.id, content: r.content, status: r.status, parentId: r.parentId, createdAt: r.createdAt,
        author: r.author, post: r.post,
      };
    }),
  };
}

module.exports = { listForPost, findById, getOne, create, updateContent, ownerDelete, hardDelete, setStatus, adminList };
