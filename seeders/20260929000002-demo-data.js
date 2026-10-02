'use strict';
// Demo users (password for all: Password123), posts, threaded comments, likes and shares.
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../src/config');

const uuid = () => crypto.randomUUID();
const ago = (days, hours = 0) => new Date(Date.now() - days * 86400000 - hours * 3600000);

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query("SELECT 1 FROM users WHERE username = 'demo_alice'");
    if (existing.length) return; // already seeded

    const passwordHash = await bcrypt.hash('Password123', config.bcryptRounds);
    const mkUser = (username, displayName, bio, daysAgo) => ({
      id: uuid(), username, email: `${username}@example.com`, password_hash: passwordHash, display_name: displayName, bio,
      role: 'user', status: 'active', password_changed_at: ago(daysAgo), created_at: ago(daysAgo), updated_at: ago(daysAgo),
    });
    const alice = mkUser('demo_alice', 'Alice Mukisa', 'Writes about travel and food.', 30);
    const bob = mkUser('demo_bob', 'Bob Otieno', 'Software developer. Coffee enthusiast.', 25);
    const carol = mkUser('demo_carol', 'Carol Nkosi', 'Reader, occasional writer.', 20);
    await queryInterface.bulkInsert('users', [alice, bob, carol]);

    const mkPost = (author, title, slug, content, status, daysAgo) => ({
      id: uuid(), author_id: author.id, title, slug, excerpt: content.replace(/\s+/g, ' ').slice(0, 200), content,
      cover_image_url: null, status, published_at: status === 'published' ? ago(daysAgo) : null,
      created_at: ago(daysAgo), updated_at: ago(daysAgo),
    });
    const p1 = mkPost(alice, 'A weekend in Kampala', 'a-weekend-in-kampala-demo01',
      'Kampala is loud, green and generous. Start with rolex breakfast at a roadside stand, then wander through the markets before the afternoon traffic builds.\n\nEvening plans: a rooftop view over the seven hills and a plate of grilled tilapia.', 'published', 6);
    const p2 = mkPost(bob, 'Five habits that made me a better developer', 'five-habits-better-developer-demo02',
      'Read the error message twice. Write the test first when the bug is confusing. Keep functions small. Review your own diff before asking anyone else. Take real breaks.\n\nNone of these are clever, and all of them work.', 'published', 4);
    const p3 = mkPost(carol, 'Why I still buy paper books', 'why-i-still-buy-paper-books-demo03',
      'A paper book never runs out of battery, never pings me, and looks good on a shelf. I read more when the phone is in another room.', 'published', 2);
    const p4 = mkPost(alice, 'Street food ranking (work in progress)', 'street-food-ranking-demo04',
      'Draft notes for a longer post. Chapati, samosas and grilled maize are in the running so far.', 'draft', 1);
    await queryInterface.bulkInsert('posts', [p1, p2, p3, p4]);

    const mkComment = (post, user, content, parent, daysAgo, hours = 0) => ({
      id: uuid(), post_id: post.id, user_id: user.id, parent_id: parent ? parent.id : null, content,
      status: 'visible', created_at: ago(daysAgo, hours), updated_at: ago(daysAgo, hours),
    });
    const c1 = mkComment(p1, bob, 'Rolex for breakfast is the right call. Any tips for the markets?', null, 5);
    const c2 = mkComment(p1, alice, 'Go early, bring small notes, and bargain politely.', c1, 5, -2);
    const c3 = mkComment(p1, carol, 'Thanks for the rooftop tip!', c2, 4);
    const c4 = mkComment(p2, carol, 'Number two saved me last week.', null, 3);
    const c5 = mkComment(p2, alice, 'Real breaks are underrated. Great list.', null, 3, -1);
    const c6 = mkComment(p3, bob, 'Same here. Phone in another room is the trick.', null, 1);
    await queryInterface.bulkInsert('comments', [c1, c2, c3, c4, c5, c6]);

    const like = (post, user) => ({ post_id: post.id, user_id: user.id, created_at: new Date() });
    await queryInterface.bulkInsert('likes', [
      like(p1, bob), like(p1, carol), like(p2, alice), like(p2, carol), like(p3, alice), like(p3, bob),
    ]);
    const share = (post, user, platform) => ({ id: uuid(), post_id: post.id, user_id: user.id, platform, created_at: new Date() });
    await queryInterface.bulkInsert('shares', [share(p1, bob, 'link'), share(p2, carol, 'twitter')]);
  },

  async down(queryInterface) {
    // posts, comments, likes and shares cascade with the users
    await queryInterface.sequelize.query("DELETE FROM users WHERE username IN ('demo_alice', 'demo_bob', 'demo_carol')");
  },
};
