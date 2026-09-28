'use strict';

/**
 * The other side of an ID card.
 *
 * An Aadhaar or a driving licence is one document photographed twice, not two
 * documents. Filing the back as its own row made the tenant's list read as
 * duplicates — the same title over and over — and left nothing saying which
 * image was which.
 *
 * Nullable throughout: a PAN card, a passport page or any single-sided scan
 * has a front and nothing else.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "back_storage_key" text;
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "back_url" text;
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "back_resource_type" text;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "documents" DROP COLUMN IF EXISTS "back_storage_key";
      ALTER TABLE "documents" DROP COLUMN IF EXISTS "back_url";
      ALTER TABLE "documents" DROP COLUMN IF EXISTS "back_resource_type";
    `);
  },
};
