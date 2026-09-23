'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * The initial schema.
 *
 * This runs the DDL in src/database/sql/0001_init.sql rather than building
 * tables through queryInterface, because four things the schema depends on
 * cannot be expressed through Sequelize's migration API at all:
 *
 *   - check constraints (about twenty)
 *   - partial unique indexes   — one primary per lease, ID uniqueness
 *   - the exclusion constraint — no overlapping leases on a unit
 *   - the composite foreign key — units to floors on (id, property_id)
 *
 * Keeping them in SQL means the file is readable as a schema, and the rules
 * hold no matter what writes to the database. The .sql file is the contract;
 * the models in src/modules are typed access to it.
 */
module.exports = {
  async up(queryInterface) {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'sql', '0001_init.sql'),
      'utf8',
    );
    await queryInterface.sequelize.query(sql);
  },

  async down(queryInterface) {
    // Order matters only for the enums; the tables go together.
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS notifications, documents, payments, bill_lines, bills,
        meter_readings, lease_occupants, leases, people, units, floors,
        properties, owners CASCADE;
      DROP FUNCTION IF EXISTS set_updated_at CASCADE;
      DROP TYPE IF EXISTS notification_kind, document_kind, payment_method,
        electricity_mode, charge_kind, lease_status, relation, occupant_role,
        id_kind CASCADE;
    `);
  },
};
