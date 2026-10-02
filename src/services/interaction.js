const { Like, Share } = require('../models');

const likeCount = (postId) => Like.count({ where: { postId } });

async function like(postId, userId) {
  await Like.bulkCreate([{ postId, userId }], { ignoreDuplicates: true }); // ON CONFLICT DO NOTHING => idempotent
  return likeCount(postId);
}

async function unlike(postId, userId) {
  await Like.destroy({ where: { postId, userId } });
  return likeCount(postId);
}

async function share(postId, userId, platform) {
  await Share.create({ postId, userId, platform });
  return Share.count({ where: { postId } });
}

module.exports = { like, unlike, share };
