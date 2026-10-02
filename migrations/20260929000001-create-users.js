'use strict';

/** Requires PostgreSQL 13+ (gen_random_uuid is built in) */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
      username: { type: Sequelize.STRING(30), allowNull: false },
      email: { type: Sequelize.STRING(254), allowNull: false },
      password_hash: { type: Sequelize.TEXT, allowNull: false },
      display_name: { type: Sequelize.STRING(60), allowNull: false },
      bio: { type: Sequelize.STRING(500), allowNull: false, defaultValue: '' },
      role: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'user' },
      status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'active' },
      password_changed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      last_login_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addConstraint('users', { type: 'check', fields: ['role'], name: 'users_role_check', where: { role: ['user', 'admin'] } });
    await queryInterface.addConstraint('users', { type: 'check', fields: ['status'], name: 'users_status_check', where: { status: ['active', 'suspended'] } });
    // case-insensitive uniqueness
    await queryInterface.sequelize.query('CREATE UNIQUE INDEX users_username_lower_uq ON users (lower(username))');
    await queryInterface.sequelize.query('CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email))');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
