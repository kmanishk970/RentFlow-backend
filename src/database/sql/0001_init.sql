-- RentFlow — initial schema
--
-- This file is the contract. Prisma's schema.prisma is the client generated
-- against it: four things below cannot be expressed in Prisma at all — check
-- constraints, partial unique indexes, the exclusion constraint, and the
-- composite foreign key — so they are written here by hand and must stay here.

-- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- lets the exclusion constraint mix an equality test with a range overlap
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "id_kind"          AS ENUM ('aadhaar','pan','passport','voter_id','driving_licence');
CREATE TYPE "occupant_role"    AS ENUM ('primary','member');
CREATE TYPE "relation"         AS ENUM ('wife','husband','son','daughter','father','mother','brother','sister','friend','other');
CREATE TYPE "lease_status"     AS ENUM ('draft','active','ended','terminated');
CREATE TYPE "charge_kind"      AS ENUM ('rent','electricity','water','maintenance','parking','other');
CREATE TYPE "electricity_mode" AS ENUM ('meter','flat');
CREATE TYPE "payment_method"   AS ENUM ('bank_transfer','cash','upi','cheque');
CREATE TYPE "document_kind"    AS ENUM ('agreement','id_proof','police_verification','property_doc','other');
CREATE TYPE "notification_kind" AS ENUM ('rent_reminder','lease_expiry','tenant_update','document_update','payment_received');

-- ---------------------------------------------------------------------------
-- Owner — the root everything else hangs off. One login owns one portfolio.
-- ---------------------------------------------------------------------------

CREATE TABLE "owners" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- stored lowercased by the API, so a plain unique index is enough
  "email"            text NOT NULL,
  "password_hash"    text NOT NULL,
  "name"             text NOT NULL,
  "phone"            text,
  "company"          text,
  "address"          text,
  "photo_key"        text,
  "photo_url"        text,
  "plan"             text NOT NULL DEFAULT 'free',
  -- default tariff, copied onto each bill so a rise is never retroactive
  "electricity_rate" numeric(8,2) NOT NULL DEFAULT 10,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "owners_email_lowercase" CHECK ("email" = lower("email")),
  CONSTRAINT "owners_rate_positive"   CHECK ("electricity_rate" > 0)
);
CREATE UNIQUE INDEX "owners_email_key" ON "owners" ("email");

-- ---------------------------------------------------------------------------
-- Property → floor → unit
-- ---------------------------------------------------------------------------

CREATE TABLE "properties" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id"   uuid NOT NULL REFERENCES "owners"("id") ON DELETE CASCADE,
  "name"       text NOT NULL,
  "locality"   text NOT NULL,
  "address"    text NOT NULL,
  "kind"       text NOT NULL,
  "image_key"  text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "properties_kind_known"
    CHECK ("kind" IN ('residential','commercial','mixed'))
);
CREATE INDEX "properties_owner_id_idx" ON "properties" ("owner_id");

CREATE TABLE "floors" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "level"       smallint NOT NULL,          -- 0 = ground
  "name"        text NOT NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "floors_level_sane" CHECK ("level" BETWEEN -5 AND 200)
);
CREATE UNIQUE INDEX "floors_property_id_level_key" ON "floors" ("property_id", "level");
-- lets a unit name both its floor and its property and stay consistent
CREATE UNIQUE INDEX "floors_id_property_id_key"    ON "floors" ("id", "property_id");

CREATE TABLE "units" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "floor_id"          uuid NOT NULL,
  -- denormalised so owner-scoped queries are one join shallower; the composite
  -- foreign key below is what stops it drifting from the floor it belongs to
  "property_id"       uuid NOT NULL,
  "number"            text NOT NULL,
  -- what a NEW lease is offered at. The agreed figures live on the lease.
  "default_rent"      numeric(12,2) NOT NULL,
  "default_deposit"   numeric(12,2) NOT NULL DEFAULT 0,
  -- occupancy is derived from leases; this is the only real status column
  "under_maintenance" boolean NOT NULL DEFAULT false,
  "created_at"        timestamptz NOT NULL DEFAULT now(),
  "updated_at"        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "units_rent_positive"     CHECK ("default_rent" >= 0),
  CONSTRAINT "units_deposit_positive"  CHECK ("default_deposit" >= 0),
  CONSTRAINT "units_floor_matches_property"
    FOREIGN KEY ("floor_id", "property_id")
    REFERENCES "floors" ("id", "property_id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "units_property_id_number_key" ON "units" ("property_id", "number");
CREATE INDEX "units_floor_id_idx" ON "units" ("floor_id");

-- ---------------------------------------------------------------------------
-- People — the human being, recorded once
-- ---------------------------------------------------------------------------

CREATE TABLE "people" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id"      uuid NOT NULL REFERENCES "owners"("id") ON DELETE CASCADE,
  "full_name"     text NOT NULL,
  "phone"         text,
  "email"         text,
  "occupation"    text,
  -- a date, not an age: an age is wrong again on the next birthday
  "date_of_birth" date,
  "address_line"  text,
  "city"          text,
  "state"         text,
  "pincode"       text,
  "id_kind"       "id_kind",
  "id_number"     text,
  "photo_key"     text,
  "photo_url"     text,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_at"    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "people_pincode_format"
    CHECK ("pincode" IS NULL OR "pincode" ~ '^[1-9][0-9]{5}$'),
  CONSTRAINT "people_id_number_needs_kind"
    CHECK ("id_number" IS NULL OR "id_kind" IS NOT NULL),
  CONSTRAINT "people_dob_past"
    CHECK ("date_of_birth" IS NULL OR "date_of_birth" < CURRENT_DATE)
);
CREATE INDEX "people_owner_id_idx" ON "people" ("owner_id");
-- the same ID document cannot be filed twice under one owner
CREATE UNIQUE INDEX "people_owner_id_document_key"
  ON "people" ("owner_id", "id_kind", "id_number")
  WHERE "id_number" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Leases and who lives on them
-- ---------------------------------------------------------------------------

CREATE TABLE "leases" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id"         uuid NOT NULL REFERENCES "owners"("id") ON DELETE CASCADE,
  "unit_id"          uuid NOT NULL REFERENCES "units"("id"),
  "term_start"       date NOT NULL,
  "term_end"         date,                  -- null = open-ended
  "rent"             numeric(12,2) NOT NULL,
  "deposit"          numeric(12,2) NOT NULL DEFAULT 0,
  "deposit_returned" numeric(12,2) NOT NULL DEFAULT 0,
  "due_day"          smallint NOT NULL DEFAULT 5,
  "status"           "lease_status" NOT NULL DEFAULT 'active',
  "emergency_name"   text,
  "emergency_phone"  text,
  "note"             text,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),
  -- 28 so every month has the day
  CONSTRAINT "leases_due_day_range" CHECK ("due_day" BETWEEN 1 AND 28),
  CONSTRAINT "leases_term_ordered"  CHECK ("term_end" IS NULL OR "term_end" > "term_start"),
  CONSTRAINT "leases_rent_positive" CHECK ("rent" >= 0),
  CONSTRAINT "leases_deposit_positive" CHECK ("deposit" >= 0 AND "deposit_returned" >= 0)
);

-- One unit cannot be let twice over the same dates. The range is built inline
-- rather than stored, so there is no generated column for Prisma to trip over.
ALTER TABLE "leases" ADD CONSTRAINT "leases_no_overlap_per_unit"
  EXCLUDE USING gist (
    "unit_id" WITH =,
    daterange("term_start", COALESCE("term_end", 'infinity'::date), '[)') WITH &&
  ) WHERE ("status" <> 'terminated');

CREATE INDEX "leases_unit_id_idx"        ON "leases" ("unit_id");
CREATE INDEX "leases_owner_id_status_idx" ON "leases" ("owner_id", "status");

CREATE TABLE "lease_occupants" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lease_id"      uuid NOT NULL REFERENCES "leases"("id") ON DELETE CASCADE,
  "person_id"     uuid NOT NULL REFERENCES "people"("id"),
  "role"          "occupant_role" NOT NULL,
  -- how this person relates to the primary; null on the primary itself
  "relation"      "relation",
  "relation_note" text,
  "moved_in"      date,
  "moved_out"     date,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "lease_occupants_member_has_relation"
    CHECK ("role" = 'primary' OR "relation" IS NOT NULL),
  -- "other" is the escape hatch, so it has to be spelled out
  CONSTRAINT "lease_occupants_other_is_spelled_out"
    CHECK ("relation" IS DISTINCT FROM 'other' OR "relation_note" IS NOT NULL),
  CONSTRAINT "lease_occupants_dates_ordered"
    CHECK ("moved_out" IS NULL OR "moved_in" IS NULL OR "moved_out" >= "moved_in")
);
CREATE UNIQUE INDEX "lease_occupants_lease_id_person_id_key"
  ON "lease_occupants" ("lease_id", "person_id");
-- at most one *current* primary per lease
CREATE UNIQUE INDEX "lease_occupants_one_primary_per_lease"
  ON "lease_occupants" ("lease_id")
  WHERE "role" = 'primary' AND "moved_out" IS NULL;
CREATE INDEX "lease_occupants_person_id_idx" ON "lease_occupants" ("person_id");

-- ---------------------------------------------------------------------------
-- Meter readings — logged against the unit, because the meter outlives the
-- tenancy. A reading can be taken without billing anything.
-- ---------------------------------------------------------------------------

CREATE TABLE "meter_readings" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id"         uuid NOT NULL REFERENCES "owners"("id") ON DELETE CASCADE,
  "unit_id"          uuid NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
  "read_on"          date NOT NULL,
  "reading"          numeric(12,2) NOT NULL,
  -- the meter was replaced or rolled over: this row opens a fresh count, and
  -- consumption is never computed across it
  "starts_new_meter" boolean NOT NULL DEFAULT false,
  "note"             text,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "meter_readings_not_negative" CHECK ("reading" >= 0)
);
CREATE UNIQUE INDEX "meter_readings_unit_id_read_on_key"
  ON "meter_readings" ("unit_id", "read_on");
CREATE INDEX "meter_readings_unit_id_read_on_idx"
  ON "meter_readings" ("unit_id", "read_on" DESC);

-- ---------------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------------

CREATE TABLE "bills" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id"   uuid NOT NULL REFERENCES "owners"("id") ON DELETE CASCADE,
  "lease_id"   uuid NOT NULL REFERENCES "leases"("id") ON DELETE CASCADE,
  -- first of the month it covers. A date sorts and does arithmetic, which the
  -- frontend's "2026-09" string cannot.
  "period"     date NOT NULL,
  "due_date"   date NOT NULL,
  "note"       text,
  "issued_at"  timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bills_period_is_month_start"
    CHECK ("period" = date_trunc('month', "period")::date)
);
-- re-billing a month replaces it; it never doubles what is owed
CREATE UNIQUE INDEX "bills_lease_id_period_key" ON "bills" ("lease_id", "period");
CREATE INDEX "bills_owner_id_period_idx" ON "bills" ("owner_id", "period" DESC);

CREATE TABLE "bill_lines" (
  "id"      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bill_id" uuid NOT NULL REFERENCES "bills"("id") ON DELETE CASCADE,
  "kind"    "charge_kind" NOT NULL,
  "label"   text,
  "amount"  numeric(12,2) NOT NULL,

  -- The electricity working, frozen at billing time. A bill is a financial
  -- document: correcting a reading later must not rewrite what was charged.
  "electricity_mode"    "electricity_mode",
  "meter_previous"      numeric(12,2),
  "meter_current"       numeric(12,2),
  "unit_rate"           numeric(8,2),
  -- provenance only — the frozen numbers above are what was billed, these say
  -- which readings they came from
  "previous_reading_id" uuid REFERENCES "meter_readings"("id") ON DELETE SET NULL,
  "current_reading_id"  uuid REFERENCES "meter_readings"("id") ON DELETE SET NULL,

  CONSTRAINT "bill_lines_amount_not_negative" CHECK ("amount" >= 0),
  CONSTRAINT "bill_lines_electricity_has_mode"
    CHECK ("kind" <> 'electricity' OR "electricity_mode" IS NOT NULL),
  CONSTRAINT "bill_lines_metered_has_working"
    CHECK ("electricity_mode" IS DISTINCT FROM 'meter'
           OR ("meter_previous" IS NOT NULL
               AND "meter_current" IS NOT NULL
               AND "unit_rate" IS NOT NULL)),
  -- a meter counts up
  CONSTRAINT "bill_lines_meter_counts_up"
    CHECK ("meter_current" IS NULL OR "meter_previous" IS NULL
           OR "meter_current" >= "meter_previous")
);
CREATE INDEX "bill_lines_bill_id_idx" ON "bill_lines" ("bill_id");

CREATE TABLE "payments" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id"   uuid NOT NULL REFERENCES "owners"("id") ON DELETE CASCADE,
  "lease_id"   uuid NOT NULL REFERENCES "leases"("id") ON DELETE CASCADE,
  -- the month this money is set against; surplus and shortfall carry forward.
  -- Deliberately not a foreign key to a bill: a month can be paid before it is
  -- billed, and one payment routinely clears arrears as well as the month.
  "period"     date NOT NULL,
  "amount"     numeric(12,2) NOT NULL,
  "paid_on"    date NOT NULL,
  "method"     "payment_method" NOT NULL,
  "reference"  text,
  "note"       text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "payments_period_is_month_start"
    CHECK ("period" = date_trunc('month', "period")::date),
  CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0)
);
CREATE INDEX "payments_lease_id_period_idx" ON "payments" ("lease_id", "period");
CREATE INDEX "payments_owner_id_paid_on_idx" ON "payments" ("owner_id", "paid_on" DESC);

-- ---------------------------------------------------------------------------
-- Documents and notifications
-- ---------------------------------------------------------------------------

CREATE TABLE "documents" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id"      uuid NOT NULL REFERENCES "owners"("id") ON DELETE CASCADE,
  "kind"          "document_kind" NOT NULL,
  "title"         text NOT NULL,
  -- filed against any of these, or none
  "property_id"   uuid REFERENCES "properties"("id") ON DELETE SET NULL,
  "lease_id"      uuid REFERENCES "leases"("id") ON DELETE SET NULL,
  "person_id"     uuid REFERENCES "people"("id") ON DELETE SET NULL,
  -- the bytes live in object storage: the key deletes the asset, the url
  -- fetches it (Cloudinary hands both back at upload time)
  "storage_key"   text NOT NULL,
  "url"           text,
  "resource_type" text,
  -- the other side of an ID card, when it has one
  "back_storage_key" text,
  "back_url"         text,
  "back_resource_type" text,
  "original_name" text NOT NULL,
  "mime_type"     text NOT NULL,
  "size_bytes"    bigint NOT NULL,
  "uploaded_at"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "documents_size_positive" CHECK ("size_bytes" > 0)
);
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents" ("storage_key");
CREATE INDEX "documents_owner_id_kind_idx" ON "documents" ("owner_id", "kind");
CREATE INDEX "documents_lease_id_idx" ON "documents" ("lease_id");
CREATE INDEX "documents_person_id_idx" ON "documents" ("person_id");

CREATE TABLE "notifications" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id"   uuid NOT NULL REFERENCES "owners"("id") ON DELETE CASCADE,
  "kind"       "notification_kind" NOT NULL,
  "title"      text NOT NULL,
  "body"       text NOT NULL,
  "lease_id"   uuid REFERENCES "leases"("id") ON DELETE CASCADE,
  -- a timestamp, not a boolean: it also tells you when
  "read_at"    timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "notifications_owner_id_created_at_idx"
  ON "notifications" ("owner_id", "created_at" DESC);
-- the unread badge is the hot query
CREATE INDEX "notifications_unread_idx"
  ON "notifications" ("owner_id", "created_at" DESC)
  WHERE "read_at" IS NULL;

-- ---------------------------------------------------------------------------
-- updated_at
--
-- Prisma's @updatedAt only fires on writes through the client. This keeps the
-- column honest for migrations, psql sessions and anything else.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "owners_updated_at"     BEFORE UPDATE ON "owners"     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "properties_updated_at" BEFORE UPDATE ON "properties" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "units_updated_at"      BEFORE UPDATE ON "units"      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "people_updated_at"     BEFORE UPDATE ON "people"     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "leases_updated_at"     BEFORE UPDATE ON "leases"     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "bills_updated_at"      BEFORE UPDATE ON "bills"      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "payments_updated_at"   BEFORE UPDATE ON "payments"   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
