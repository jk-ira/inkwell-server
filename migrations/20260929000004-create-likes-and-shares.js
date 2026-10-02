'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('likes', {
      post_id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, references: { model: 'posts', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('likes', ['user_id'], { name: 'likes_user_idx' });

    await queryInterface.createTable('shares', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
      post_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'posts', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      platform: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'link' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addConstraint('shares', {
      type: 'check', fields: ['platform'], name: 'shares_platform_check',
      where: { platform: ['link', 'twitter', 'facebook', 'whatsapp', 'linkedin', 'email', 'other'] },
    });
    await queryInterface.addIndex('shares', ['post_id'], { name: 'shares_post_idx' });
    await queryInterface.addIndex('shares', ['user_id'], { name: 'shares_user_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('shares');
    await queryInterface.dropTable('likes');
  },
};
