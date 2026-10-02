'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('comments', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
      post_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'posts', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      // replies: a comment pointing at another comment on the same post
      parent_id: { type: Sequelize.UUID, references: { model: 'comments', key: 'id' }, onDelete: 'CASCADE' },
      content: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'visible' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addConstraint('comments', { type: 'check', fields: ['status'], name: 'comments_status_check', where: { status: ['visible', 'hidden', 'deleted'] } });
    await queryInterface.sequelize.query('ALTER TABLE comments ADD CONSTRAINT comments_content_len CHECK (char_length(content) BETWEEN 1 AND 2000)');
    await queryInterface.addIndex('comments', ['post_id', 'created_at'], { name: 'comments_post_idx' });
    await queryInterface.addIndex('comments', ['parent_id'], { name: 'comments_parent_idx' });
    await queryInterface.addIndex('comments', ['user_id'], { name: 'comments_user_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('comments');
  },
};
