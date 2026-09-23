# RentFlow — backend

The API behind [the RentFlow frontend](../frontend), which currently runs on a
mock in `src/lib/api/index.ts`. This repo is the database layer so far: schema,
migration and seed. No NestJS application yet.

Full schema rationale — why a tenancy is separate from a person, what stays
derived, the ledger query — is in the design doc that accompanies this.

## Running it

```bash
cp .env.example .env
npm install
npm run db:up          # postgres 16 in docker, port 5432
npx prisma migrate deploy
npm run seed
```

`npm run studio` opens Prisma Studio if you want to browse the result.

To start over: `npm run db:reset` drops, re-migrates and re-seeds.

## What the seed gives you

One owner (`owner@rentflow.test`), one property, three units, five people and
three leases. It is not a copy of the frontend fixture — that one was written
for a screenshot. This one exists to exercise the ledger, so every case the
carry-forward has to handle appears at least once:

| Month | What happens |
|---|---|
| May 2026 | settled in full |
| Jun 2026 | settled in two instalments |
| Jul 2026 | paid ₹800 short — dues carry forward |
| Aug 2026 | overpaid — clears the arrears and leaves ₹500 credit |
| Sep 2026 | untouched, and past its due date |

Unit 102's meter is replaced in July, so that month is billed flat: the
difference across a meter swap is meaningless. Unit 101 carries two consecutive
leases, and unit 201 has none at all — which is what "vacant" means now that
occupancy is derived rather than stored.

## The constraints are the point

Four rules live in the database rather than in application code, so no endpoint,
script or `psql` session can get around them. They are worth trying to break
before building on top:

```sql
-- 1. A unit cannot be let twice over the same dates.
--    The two leases on unit 101 meet exactly and are allowed; move either
--    date by a day and this is refused.
insert into leases (owner_id, unit_id, term_start, term_end, rent)
select owner_id, unit_id, '2026-06-01', '2026-08-01', 18000 from leases limit 1;
--    ERROR:  conflicting key value violates exclusion constraint

-- 2. At most one current primary per lease.
insert into lease_occupants (lease_id, person_id, role)
select id, (select id from people limit 1), 'primary' from leases limit 1;
--    ERROR:  duplicate key value violates unique constraint

-- 3. One bill per lease per month.
insert into bills (owner_id, lease_id, period, due_date)
select owner_id, lease_id, period, due_date from bills limit 1;
--    ERROR:  duplicate key value violates unique constraint

-- 4. A meter counts up.
update bill_lines set meter_current = 0 where electricity_mode = 'meter';
--    ERROR:  new row violates check constraint "bill_lines_meter_counts_up"
```

## The ledger

Carry-forward is one query — the window function *is* the running balance.

```sql
with charged as (
  select b.id, b.period, b.due_date, coalesce(sum(l.amount), 0) as total
  from bills b left join bill_lines l on l.bill_id = b.id
  where b.lease_id = $1
  group by b.id
),
received as (
  select period, sum(amount) as paid
  from payments where lease_id = $1 group by period
),
ledger as (
  select c.period, c.due_date, c.total, coalesce(r.paid, 0) as paid,
         sum(coalesce(r.paid, 0) - c.total) over (order by c.period) as closing
  from charged c left join received r using (period)
)
select period, total, paid, closing,
       greatest(0, -closing) as shortfall,
       greatest(0,  closing) as credit,
       case when closing >= 0            then 'paid'
            when current_date > due_date then 'overdue'
            when paid > 0                then 'partial'
            else 'pending' end as status
from ledger order by period;
```

This is `src/lib/rent-ledger.ts` from the frontend expressed in SQL, and the
seed is built so the two can be compared row for row. Keep the TypeScript
version — it is already tested, and the frontend needs it for optimistic
updates.

The previous meter reading for a unit is a separate lookup, and deliberately not
"last month": if a month was never billed the meter still ran through it, so the
figure to subtract from is the last reading actually taken.

```sql
select reading, read_on, starts_new_meter
from meter_readings
where unit_id = $1 and read_on < $2
order by read_on desc limit 1;
```

If any reading between the two is marked `starts_new_meter`, the difference is
meaningless — bill that month flat and carry on from the new opening figure.

## Working with Prisma here

`prisma/migrations/0001_init/migration.sql` is the contract. `schema.prisma` is
the typed client generated against it. Four things in that SQL cannot be
expressed in Prisma and are invisible to it:

- check constraints (about twenty)
- partial unique indexes — one primary per lease, ID uniqueness
- the exclusion constraint — no overlapping leases on a unit
- the composite foreign key — units to floors on `(id, property_id)`

They still run. The consequence is a rule with no exceptions:

> **Always `npm run migrate:new`, never a bare `prisma migrate dev`.**
> That is `--create-only`. Read the generated SQL before applying it — Prisma
> can propose dropping what it cannot see.

If that inversion becomes annoying, Drizzle or plain SQL migrations keep you
closer to the file that actually defines the database. The DDL is portable
either way; nothing above is Prisma-specific.

## Next

1. NestJS app shell — `main.ts`, config with schema validation, `PrismaService`
2. `auth` — JWT and refresh, replacing the boolean in the frontend's `lib/auth.tsx`
3. `properties` — the first vertical slice, read endpoints first
4. `people` + `leases` — the split, and migrating the frontend's tenant shape onto it
5. `billing` — bills, payments, and the ledger endpoint
6. `documents` — object storage and presigned URLs
7. `notifications` + dashboard aggregates

Each step converts a few functions in the frontend's `src/lib/api/index.ts`.
Nothing else there needs to change.
