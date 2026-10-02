'use strict';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../src/config'); // also loads .env

module.exports = {
  async up(queryInterface) {
    const { ADMIN_EMAIL: email, ADMIN_USERNAME: username, ADMIN_PASSWORD: password } = process.env;
    if (!email || !username || !password) throw new Error('Set ADMIN_EMAIL, ADMIN_USERNAME and ADMIN_PASSWORD in .env');
    if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');
    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE lower(email) = lower(:email)', { replacements: { email } });
    if (existing.length) {
      await queryInterface.sequelize.query("UPDATE users SET role = 'admin', status = 'active' WHERE id = :id", { replacements: { id: existing[0].id } });
      return;
    }
    const now = new Date();
    await queryInterface.bulkInsert('users', [{
      id: crypto.randomUUID(), username, email, password_hash: await bcrypt.hash(password, config.bcryptRounds),
      display_name: username, bio: '', role: 'admin', status: 'active',
      password_changed_at: now, created_at: now, updated_at: now,
    }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { email: process.env.ADMIN_EMAIL, role: 'admin' });
  },
};
