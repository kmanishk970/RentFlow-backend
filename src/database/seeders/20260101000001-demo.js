'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Demo data, as plain SQL for the same reason as the schema: it is readable,
 * and it exercises the ledger rather than describing it.
 */
module.exports = {
  async up(queryInterface) {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'sql', 'seed.sql'),
      'utf8',
    );
    // psql meta-commands (\echo) are not valid over the wire.
    await queryInterface.sequelize.query(
      sql.split('\n').filter((line) => !line.startsWith('\')).join('\n'),
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM owners WHERE email = 'owner@rentflow.test';`,
    );
  },
};
