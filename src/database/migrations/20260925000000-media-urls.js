'use strict';

/**
 * Where an uploaded file can be fetched from.
 *
 * The schema already had a key per file — `storage_key` on a document,
 * `photo_key` on a person or owner — from when storage was going to be an
 * S3 bucket the API signed URLs against. Cloudinary hands back a delivery URL
 * at upload time instead, and that URL is what a page renders, so it is stored
 * rather than rebuilt on every read.
 *
 * The keys keep their meaning: they now hold the Cloudinary public id, which
 * is what deleting an asset needs. URL to show it, key to remove it.
 *
 * IF NOT EXISTS throughout, because 0001_init.sql carries the same columns for
 * a database created from scratch.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "url" text;
      ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "resource_type" text;
      ALTER TABLE "people"    ADD COLUMN IF NOT EXISTS "photo_url" text;
      ALTER TABLE "owners"    ADD COLUMN IF NOT EXISTS "photo_url" text;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "documents" DROP COLUMN IF EXISTS "url";
      ALTER TABLE "documents" DROP COLUMN IF EXISTS "resource_type";
      ALTER TABLE "people"    DROP COLUMN IF EXISTS "photo_url";
      ALTER TABLE "owners"    DROP COLUMN IF EXISTS "photo_url";
    `);
  },
};
