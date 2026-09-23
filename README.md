# RentFlow — backend

NestJS over PostgreSQL, with Sequelize. The API behind
[the RentFlow frontend](../frontend), which currently runs on a mock in
`src/lib/api/index.ts`.

So far this is the database layer and the application shell: schema, migration,
seed, models and wiring. No feature endpoints yet.

## Structure

```
src/
  main.ts                    bootstrap, CORS, global validation pipe
  app.module.ts              config + database; feature modules land here
  config/
    configuration.ts         typed config read once at boot
    env.validation.ts        environment validated at startup, not first query
  common/
    domain.enums.ts          mirrors the Postgres enum types
    decorators/ filters/ guards/ interceptors/
  database/
    database.module.ts       Sequelize root, every model registered
    sequelize-cli.config.js  for the CLI, which runs outside Nest
    migrations/              run the SQL below, tracked in sequelize_meta
    seeders/
    sql/
      0000_create_database.sql
      0001_init.sql          the schema — this file is the contract
      seed.sql               demo data
  modules/
    owners/entities/         Owner
    properties/entities/     Property, Floor, Unit
    people/entities/         Person
    leases/entities/         Lease, LeaseOccupant
    billing/entities/        MeterReading, Bill, BillLine, Payment
    documents/entities/      Document
    notifications/entities/  Notification
```

Each feature module owns its models, DTOs, controller and service. Only the
entities exist so far.

## Setting up against your Rent_Manager server

A pgAdmin **server group** is a folder in the pgAdmin tree — it organises
connections, it is not a place on the server. The database is created on
whichever server sits inside that group, and then appears under it.

1. In pgAdmin, open the server inside **Rent_Manager** and connect to its
   `postgres` database.
2. Run `src/database/sql/0000_create_database.sql`. That creates
   **rent_manager**, which will appear under that server.
3. Copy `.env.example` to `.env` and put your Postgres password in
   `DATABASE_URL`.
4. Then:

```bash
npm install
npm run db:migrate     # applies 0001_init.sql, tracked in sequelize_meta
npm run db:seed        # demo data
npm run start:dev
```

`docker-compose.yml` is optional and only there for a throwaway instance. It
listens on **5433** so it can never collide with your local 5432.

## What the seed gives you

One owner (`owner@rentflow.test`), one property, three units, five people and
three leases. Not a copy of the frontend fixture — that was written for a
screenshot. This exists to exercise the ledger, so every case the carry-forward
has to handle appears at least once:

| Month | What happens |
|---|---|
| May 2026 | settled in full |
| Jun 2026 | settled in two instalments |
| Jul 2026 | paid ₹800 short — dues carry forward |
| Aug 2026 | overpaid — clears the arrears, leaves ₹500 credit |
| Sep 2026 | untouched, and past its due date |

Unit 102's meter is replaced in July, so that month is billed flat: the
difference across a meter swap is meaningless. Unit 101 carries two consecutive
leases. Unit 201 has none at all — which is what "vacant" means now that
occupancy is derived rather than stored.

## The constraints are the point

Four rules live in the database rather than in application code, so no endpoint,
script or pgAdmin session can get around them. Worth trying to break before
building on top — each of these should be refused:

```sql
-- 1. A unit cannot be let twice over the same dates.
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
seed is built so the two can be compared row for row.

The previous meter reading is a separate lookup, and deliberately not "last
month": if a month was never billed the meter still ran through it, so the
figure to subtract from is the last reading actually taken.

```sql
select reading, read_on, starts_new_meter
from meter_readings
where unit_id = $1 and read_on < $2
order by read_on desc limit 1;
```

If any reading between the two is marked `starts_new_meter`, the difference is
meaningless — bill that month flat and carry on from the new opening figure.

## Working with Sequelize here

`src/database/sql/0001_init.sql` is the contract. The migration executes it
rather than building tables through `queryInterface`, because four things the
schema depends on cannot be expressed through Sequelize's migration API:

- check constraints (about twenty)
- partial unique indexes — one primary per lease, ID uniqueness
- the exclusion constraint — no overlapping leases on a unit
- the composite foreign key — units to floors on `(id, property_id)`

Two rules follow from that:

> **`synchronize` is never true.** `sequelize.sync()` would quietly drop every
> constraint it cannot express. It is set to `false` in `database.module.ts`
> and should stay there.

> **Schema changes are written as SQL**, in a new file under
> `src/database/sql/`, with a migration that runs it. The models describe the
> tables; they do not define them.

Money is `DECIMAL`, which node-postgres returns as a **string**. That is left
alone on purpose — parsing it to a float is how rounding errors get into a rent
ledger. Convert at the edge with a decimal library or integer paise, never by
multiplying a float.

## Next

1. `auth` — JWT and refresh, replacing the boolean in the frontend's `lib/auth.tsx`
2. `properties` — the first vertical slice, read endpoints first
3. `people` + `leases` — the split, and migrating the frontend's tenant shape onto it
4. `billing` — bills, payments, and the ledger endpoint
5. `documents` — object storage and presigned URLs
6. `notifications` + dashboard aggregates

Each step converts a few functions in the frontend's `src/lib/api/index.ts`.
Nothing else there needs to change.
