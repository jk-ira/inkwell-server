'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('posts', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
      author_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(200), allowNull: false },
      slug: { type: Sequelize.STRING(260), allowNull: false, unique: true },
      excerpt: { type: Sequelize.STRING(300), allowNull: false, defaultValue: '' },
      content: { type: Sequelize.TEXT, allowNull: false },
      cover_image_url: { type: Sequelize.TEXT },
      status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'draft' },
      published_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addConstraint('posts', { type: 'check', fields: ['status'], name: 'posts_status_check', where: { status: ['draft', 'published', 'hidden'] } });
    await queryInterface.addIndex('posts', ['status', 'published_at'], { name: 'posts_status_published_idx' });
    await queryInterface.addIndex('posts', ['author_id'], { name: 'posts_author_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('posts');
  },
};
