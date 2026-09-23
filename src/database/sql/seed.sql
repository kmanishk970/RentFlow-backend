-- RentFlow — seed data
--
-- Plain SQL, no ORM and no Node dependencies: `psql -f db/seed.sql` is the
-- whole story. Re-runnable, because it clears its own owner first and the
-- cascade takes everything beneath.
--
-- Deliberately not a copy of the frontend fixture. That one was written for a
-- screenshot; this exists to exercise the ledger, so every case the
-- carry-forward has to handle appears at least once:
--
--   May 2026  settled in full
--   Jun 2026  settled in two instalments
--   Jul 2026  paid Rs 800 short — dues carry forward
--   Aug 2026  overpaid — clears the arrears, leaves Rs 500 credit
--   Sep 2026  untouched, and past its due date
--
-- Unit 102's meter is replaced in July, so that month is billed flat. Unit 101
-- carries two consecutive leases that meet exactly. Unit 201 has none at all,
-- which is what "vacant" means now occupancy is derived rather than stored.
--
-- Ids are literal and stable so the inserts below can reference each other
-- without round-tripping, and so re-seeding gives you the same ids every time.

BEGIN;

DELETE FROM owners WHERE email = 'owner@rentflow.test';

-- ---------------------------------------------------------------------------
-- Owner, property, units
-- ---------------------------------------------------------------------------

INSERT INTO owners (id, email, password_hash, name, phone, company, address, plan, electricity_rate) VALUES
  ('a0000000-0000-4000-8000-000000000001',
   'owner@rentflow.test',
   -- placeholder until auth lands; not a usable hash
   '$2b$10$seedseedseedseedseedseedseedseedseedseedseedseedseedsee',
   'Rajesh Kapoor', '+91 98765 00000', 'Kapoor Properties',
   '14th Cross, 5th Block, Koramangala, Bangalore - 560095',
   'professional', 10);

INSERT INTO properties (id, owner_id, name, locality, address, kind) VALUES
  ('b0000000-0000-4000-8000-000000000010',
   'a0000000-0000-4000-8000-000000000001',
   'Sunrise Apartments', 'Koramangala, Bangalore',
   '42, 6th Main, Koramangala 4th Block', 'residential');

INSERT INTO floors (id, property_id, level, name) VALUES
  ('c0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000010', 0, 'Ground Floor'),
  ('c0000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000010', 1, 'First Floor');

INSERT INTO units (id, floor_id, property_id, number, default_rent, default_deposit) VALUES
  ('d0000000-0000-4000-8000-000000000030', 'c0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000010', '101', 18000, 54000),
  ('d0000000-0000-4000-8000-000000000031', 'c0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000010', '102', 18000, 54000),
  -- never let: "vacant" is the absence of a lease, not a column
  ('d0000000-0000-4000-8000-000000000032', 'c0000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000010', '201', 22000, 66000);

-- ---------------------------------------------------------------------------
-- People — recorded once each, whatever leases they turn up on
-- ---------------------------------------------------------------------------

INSERT INTO people (id, owner_id, full_name, phone, email, occupation, date_of_birth,
                    address_line, city, state, pincode, id_kind, id_number) VALUES
  ('e0000000-0000-4000-8000-000000000040', 'a0000000-0000-4000-8000-000000000001',
   'Arjun Mehta', '+91 98765 43210', 'arjun.mehta@gmail.com', 'Software Engineer', '1992-04-18',
   '12, MG Road', 'Bangalore', 'Karnataka', '560001', 'aadhaar', '2345 6789 0123'),

  ('e0000000-0000-4000-8000-000000000041', 'a0000000-0000-4000-8000-000000000001',
   'Priya Mehta', '+91 98765 11111', NULL, 'Architect', '1994-11-02',
   NULL, NULL, NULL, NULL, 'aadhaar', '4567 8901 2345'),

  -- a child: no phone, no ID, and an age that will not rot
  ('e0000000-0000-4000-8000-000000000042', 'a0000000-0000-4000-8000-000000000001',
   'Aarav Mehta', NULL, NULL, NULL, '2021-06-30',
   NULL, NULL, NULL, NULL, NULL, NULL),

  ('e0000000-0000-4000-8000-000000000043', 'a0000000-0000-4000-8000-000000000001',
   'Sneha Reddy', '+91 87654 32109', 'sneha.reddy@yahoo.com', 'Marketing Manager', '1990-01-22',
   '45, Brigade Road', 'Bangalore', 'Karnataka', '560025', 'pan', 'ABCDE1234F'),

  ('e0000000-0000-4000-8000-000000000044', 'a0000000-0000-4000-8000-000000000001',
   'Vikram Singh', '+91 76543 21098', NULL, 'Business Analyst', '1988-09-09',
   NULL, NULL, NULL, NULL, 'passport', 'K1234567');

-- ---------------------------------------------------------------------------
-- Leases
--
-- The two on unit 101 are consecutive. The ranges are half-open, so they meet
-- exactly on 2025-12-31 without overlapping and the exclusion constraint
-- allows it. Move either date by a day and the insert is refused.
-- ---------------------------------------------------------------------------

INSERT INTO leases (id, owner_id, unit_id, term_start, term_end, rent, deposit,
                    deposit_returned, due_day, status, emergency_name, emergency_phone) VALUES
  ('f0000000-0000-4000-8000-000000000050', 'a0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000030', '2024-01-01', '2025-12-31',
   17000, 51000, 51000, 5, 'ended', NULL, NULL),

  ('f0000000-0000-4000-8000-000000000051', 'a0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000030', '2025-12-31', '2027-12-31',
   18000, 54000, 0, 5, 'active', 'Ramesh Mehta', '+91 98765 22222'),

  ('f0000000-0000-4000-8000-000000000052', 'a0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000031', '2026-03-01', '2027-02-28',
   18000, 54000, 0, 5, 'active', NULL, NULL);

INSERT INTO lease_occupants (lease_id, person_id, role, relation, relation_note, moved_in, moved_out) VALUES
  -- the previous tenant of 101, kept rather than overwritten
  ('f0000000-0000-4000-8000-000000000050', 'e0000000-0000-4000-8000-000000000044', 'primary', NULL, NULL, '2024-01-01', '2025-12-30'),

  ('f0000000-0000-4000-8000-000000000051', 'e0000000-0000-4000-8000-000000000040', 'primary', NULL,     NULL, '2025-12-31', NULL),
  ('f0000000-0000-4000-8000-000000000051', 'e0000000-0000-4000-8000-000000000041', 'member',  'wife',   NULL, '2025-12-31', NULL),
  ('f0000000-0000-4000-8000-000000000051', 'e0000000-0000-4000-8000-000000000042', 'member',  'son',    NULL, '2025-12-31', NULL),

  ('f0000000-0000-4000-8000-000000000052', 'e0000000-0000-4000-8000-000000000043', 'primary', NULL,     NULL, '2026-03-01', NULL);

-- ---------------------------------------------------------------------------
-- Meter readings
--
-- Logged against the unit, ahead of any billing — which is the point of the
-- table. Readings accumulate, because a meter only counts up.
-- ---------------------------------------------------------------------------

-- Unit 101: 4820 opening, then 62 / 71 / 55 / 68 / 49 units consumed
INSERT INTO meter_readings (id, owner_id, unit_id, read_on, reading, note) VALUES
  ('11110000-0000-4000-8000-000000000060', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000030', '2026-04-01', 4820, 'Opening reading'),
  ('11110000-0000-4000-8000-000000000061', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000030', '2026-05-01', 4882, NULL),
  ('11110000-0000-4000-8000-000000000062', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000030', '2026-06-01', 4953, NULL),
  ('11110000-0000-4000-8000-000000000063', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000030', '2026-07-01', 5008, NULL),
  ('11110000-0000-4000-8000-000000000064', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000030', '2026-08-01', 5076, NULL),
  ('11110000-0000-4000-8000-000000000065', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000030', '2026-09-01', 5125, NULL);

-- Unit 102: the meter is replaced on 1 July and restarts from zero. The
-- difference across that row is meaningless, which is what starts_new_meter
-- says — and why July is billed flat below.
INSERT INTO meter_readings (id, owner_id, unit_id, read_on, reading, starts_new_meter, note) VALUES
  ('11110000-0000-4000-8000-000000000070', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000031', '2026-04-01', 9140, false, 'Opening reading'),
  ('11110000-0000-4000-8000-000000000071', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000031', '2026-05-01', 9180, false, NULL),
  ('11110000-0000-4000-8000-000000000072', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000031', '2026-06-01', 9232, false, NULL),
  ('11110000-0000-4000-8000-000000000073', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000031', '2026-07-01',    0, true,  'Meter replaced'),
  ('11110000-0000-4000-8000-000000000074', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000031', '2026-08-01',   44, false, NULL),
  ('11110000-0000-4000-8000-000000000075', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000031', '2026-09-01',   95, false, NULL);

-- ---------------------------------------------------------------------------
-- Bills
-- ---------------------------------------------------------------------------

INSERT INTO bills (id, owner_id, lease_id, period, due_date) VALUES
  -- the ended lease keeps its history
  ('22220000-0000-4000-8000-000000000100', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000050', '2025-12-01', '2025-12-05'),
  -- unit 101, the Mehtas
  ('22220000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000051', '2026-05-01', '2026-05-05'),
  ('22220000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000051', '2026-06-01', '2026-06-05'),
  ('22220000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000051', '2026-07-01', '2026-07-05'),
  ('22220000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000051', '2026-08-01', '2026-08-05'),
  ('22220000-0000-4000-8000-000000000105', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000051', '2026-09-01', '2026-09-05'),
  -- unit 102, Sneha
  ('22220000-0000-4000-8000-000000000111', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000052', '2026-05-01', '2026-05-05'),
  ('22220000-0000-4000-8000-000000000112', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000052', '2026-06-01', '2026-06-05'),
  ('22220000-0000-4000-8000-000000000113', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000052', '2026-07-01', '2026-07-05'),
  ('22220000-0000-4000-8000-000000000114', 'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000052', '2026-08-01', '2026-08-05');

-- Rent lines
INSERT INTO bill_lines (bill_id, kind, amount) VALUES
  ('22220000-0000-4000-8000-000000000100', 'rent', 17000),
  ('22220000-0000-4000-8000-000000000101', 'rent', 18000),
  ('22220000-0000-4000-8000-000000000102', 'rent', 18000),
  ('22220000-0000-4000-8000-000000000103', 'rent', 18000),
  ('22220000-0000-4000-8000-000000000104', 'rent', 18000),
  ('22220000-0000-4000-8000-000000000105', 'rent', 18000),
  ('22220000-0000-4000-8000-000000000111', 'rent', 18000),
  ('22220000-0000-4000-8000-000000000112', 'rent', 18000),
  ('22220000-0000-4000-8000-000000000113', 'rent', 18000),
  ('22220000-0000-4000-8000-000000000114', 'rent', 18000);

-- Metered electricity. The readings are frozen onto the line: correcting a
-- reading later must never rewrite what was charged. The reading ids alongside
-- are provenance only.
INSERT INTO bill_lines (bill_id, kind, amount, electricity_mode, meter_previous, meter_current, unit_rate,
                        previous_reading_id, current_reading_id) VALUES
  -- 101: 62 units
  ('22220000-0000-4000-8000-000000000101', 'electricity', 620, 'meter', 4820, 4882, 10,
   '11110000-0000-4000-8000-000000000060', '11110000-0000-4000-8000-000000000061'),
  -- 71 units
  ('22220000-0000-4000-8000-000000000102', 'electricity', 710, 'meter', 4882, 4953, 10,
   '11110000-0000-4000-8000-000000000061', '11110000-0000-4000-8000-000000000062'),
  -- 55 units
  ('22220000-0000-4000-8000-000000000103', 'electricity', 550, 'meter', 4953, 5008, 10,
   '11110000-0000-4000-8000-000000000062', '11110000-0000-4000-8000-000000000063'),
  -- 68 units
  ('22220000-0000-4000-8000-000000000104', 'electricity', 680, 'meter', 5008, 5076, 10,
   '11110000-0000-4000-8000-000000000063', '11110000-0000-4000-8000-000000000064'),
  -- 49 units
  ('22220000-0000-4000-8000-000000000105', 'electricity', 490, 'meter', 5076, 5125, 10,
   '11110000-0000-4000-8000-000000000064', '11110000-0000-4000-8000-000000000065'),
  -- 102: 40 units
  ('22220000-0000-4000-8000-000000000111', 'electricity', 400, 'meter', 9140, 9180, 10,
   '11110000-0000-4000-8000-000000000070', '11110000-0000-4000-8000-000000000071'),
  -- 52 units
  ('22220000-0000-4000-8000-000000000112', 'electricity', 520, 'meter', 9180, 9232, 10,
   '11110000-0000-4000-8000-000000000071', '11110000-0000-4000-8000-000000000072'),
  -- 44 units, counted from the replacement meter's own zero
  ('22220000-0000-4000-8000-000000000114', 'electricity', 440, 'meter', 0, 44, 10,
   '11110000-0000-4000-8000-000000000073', '11110000-0000-4000-8000-000000000074');

-- Flat electricity, where a reading difference would be meaningless
INSERT INTO bill_lines (bill_id, kind, label, amount, electricity_mode) VALUES
  ('22220000-0000-4000-8000-000000000100', 'electricity', NULL, 610, 'flat'),
  ('22220000-0000-4000-8000-000000000113', 'electricity', 'Flat charge — meter replaced', 500, 'flat');

-- One month with an extra, to prove a bill is not just rent plus power
INSERT INTO bill_lines (bill_id, kind, label, amount) VALUES
  ('22220000-0000-4000-8000-000000000113', 'maintenance', 'Water tanker', 350);

-- ---------------------------------------------------------------------------
-- Payments
--
-- Set against a month, never against a bill: a month can be paid before it is
-- billed, and one payment routinely clears arrears as well as the month.
-- ---------------------------------------------------------------------------

INSERT INTO payments (owner_id, lease_id, period, amount, paid_on, method, reference) VALUES
  -- ended lease, settled
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000050', '2025-12-01', 17610, '2025-12-04', 'cheque', 'CHQ202512001'),

  -- May: settled in full (18000 + 620)
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000051', '2026-05-01', 18620, '2026-05-03', 'bank_transfer', 'TXN202605001'),

  -- June: two instalments totalling 18710
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000051', '2026-06-01', 10000, '2026-06-04', 'upi',  'UPI202606001'),
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000051', '2026-06-01',  8710, '2026-06-16', 'cash', 'CASH202606002'),

  -- July: 18550 owed, 17750 paid — Rs 800 carries into August
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000051', '2026-07-01', 17750, '2026-07-06', 'upi', 'UPI202607001'),

  -- August: 18680 owed plus the 800 arrears; 19980 paid clears both and
  -- leaves Rs 500 in the tenant's favour
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000051', '2026-08-01', 19980, '2026-08-02', 'bank_transfer', 'TXN202608001'),

  -- September: nothing. Overdue once past the 5th.

  -- Sneha: every month settled on time
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000052', '2026-05-01', 18400, '2026-05-05', 'bank_transfer', 'TXN202605011'),
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000052', '2026-06-01', 18520, '2026-06-03', 'bank_transfer', 'TXN202606011'),
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000052', '2026-07-01', 18850, '2026-07-04', 'upi',           'UPI202607011'),
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000052', '2026-08-01', 18440, '2026-08-05', 'bank_transfer', 'TXN202608011');

COMMIT;

\echo ''
\echo 'Seeded owner@rentflow.test'
\echo ''
\echo 'The Mehtas ledger (lease f0000000-0000-4000-8000-000000000051):'

WITH charged AS (
  SELECT b.id, b.period, b.due_date, COALESCE(sum(l.amount), 0) AS total
  FROM bills b LEFT JOIN bill_lines l ON l.bill_id = b.id
  WHERE b.lease_id = 'f0000000-0000-4000-8000-000000000051'
  GROUP BY b.id
),
received AS (
  SELECT period, sum(amount) AS paid
  FROM payments WHERE lease_id = 'f0000000-0000-4000-8000-000000000051' GROUP BY period
),
ledger AS (
  SELECT c.period, c.due_date, c.total, COALESCE(r.paid, 0) AS paid,
         sum(COALESCE(r.paid, 0) - c.total) OVER (ORDER BY c.period) AS closing
  FROM charged c LEFT JOIN received r USING (period)
)
SELECT to_char(period, 'Mon YYYY') AS month, total, paid,
       greatest(0, -closing) AS owing,
       greatest(0,  closing) AS credit,
       CASE WHEN closing >= 0            THEN 'paid'
            WHEN current_date > due_date THEN 'overdue'
            WHEN paid > 0                THEN 'partial'
            ELSE 'pending' END AS status
FROM ledger ORDER BY period;
