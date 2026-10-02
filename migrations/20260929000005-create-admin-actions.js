'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_actions', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
      admin_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      action: { type: Sequelize.STRING(50), allowNull: false },
      target_type: { type: Sequelize.STRING(20), allowNull: false },
      target_id: { type: Sequelize.UUID },
      details: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('admin_actions', ['created_at'], { name: 'admin_actions_created_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_actions');
  },
};
