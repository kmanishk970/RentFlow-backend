// Config for sequelize-cli only. The application reads the same variables
// through @nestjs/config in src/config/configuration.ts — this file exists
// because the CLI runs outside Nest and cannot use it.
require('dotenv').config();

const shared = {
  dialect: 'postgres',
  logging: false,
  // Migration bookkeeping lives beside the tables it tracks.
  migrationStorageTableName: 'sequelize_meta',
  seederStorage: 'sequelize',
  seederStorageTableName: 'sequelize_seeds',
};

module.exports = {
  development: { ...shared, url: process.env.DATABASE_URL },
  test: { ...shared, url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL },
  production: {
    ...shared,
    url: process.env.DATABASE_URL,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  },
};
