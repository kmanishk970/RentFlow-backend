'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** psql meta-commands are not valid over the wire, so they are stripped. */
const META_COMMAND = /^\s*\\/;

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

    const statements = sql
      .split('\n')
      .filter((line) => !META_COMMAND.test(line))
      .join('\n');

    await queryInterface.sequelize.query(statements);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM owners WHERE email = 'owner@rentflow.test';`,
    );
  },
};
