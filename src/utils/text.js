const sanitizeHtml = require('sanitize-html');
const crypto = require('crypto');

// Defence in depth: strip every HTML tag from user text before storing it.
// (The frontend must still render content as plain text / safe Markdown.)
const clean = (s) => sanitizeHtml(String(s), { allowedTags: [], allowedAttributes: {} }).replace(/&amp;/g, '&').trim();

const excerptOf = (content) => content.replace(/\s+/g, ' ').trim().slice(0, 200);

const makeSlug = (title) => {
  const base = title.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim()
    .replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'post';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
};

module.exports = { clean, excerptOf, makeSlug };
