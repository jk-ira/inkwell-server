const config = require('./config');
config.assertSecure();
const app = require('./app');
const { sequelize } = require('./models');

let server;
sequelize.authenticate()
  .then(() => {
    server = app.listen(config.port, () => {
      console.log(`API listening on http://localhost:${config.port}  (health: /api/health)`);
    });
  })
  .catch((err) => {
    console.error('Cannot connect to PostgreSQL. Check DATABASE_URL in .env and that the database is running and migrated.');
    console.error(err.message);
    process.exit(1);
  });

const shutdown = () => (server ? server.close(() => sequelize.close().then(() => process.exit(0))) : process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
