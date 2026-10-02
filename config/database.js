// Used by sequelize-cli (db:create, db:migrate, db:seed:all). Reads DATABASE_URL from .env
require('dotenv').config({ quiet: true });

const url = new URL(process.env.DATABASE_URL);

const base = {
  username: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.slice(1)),
  host: url.hostname,
  port: Number(url.port) || 5432,
  dialect: 'postgres',
  logging: false,
  ...(process.env.DB_SSL === 'true' && { dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } }),
};

module.exports = { development: base, test: base, production: base };
