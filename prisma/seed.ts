import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Seed data.
 *
 * Deliberately not a copy of the frontend fixture. That one was written for a
 * screenshot; this one exists to exercise the ledger, so every case the
 * carry-forward has to handle appears at least once:
 *
 *   - a month settled in full
 *   - a month settled in two instalments
 *   - a month paid short, whose dues carry into the next
 *   - a month overpaid, whose credit carries into the next
 *   - a month nobody has paid
 *   - a unit whose meter was replaced mid-tenancy
 *   - a lease that has ended, and a new one on the same unit after it
 *
 * Run with `npm run seed`. It is idempotent: it clears its own owner first.
 */

const prisma = new PrismaClient();

const OWNER_EMAIL = "owner@rentflow.test";
const RATE = new Prisma.Decimal(10);

/** "2026-09" → the Date Postgres stores for that month's first day. */
const month = (key: string) => new Date(`${key}-01T00:00:00Z`);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const rupees = (n: number) => new Prisma.Decimal(n);

async function main() {
  // Re-runnable: the cascade takes every row that hangs off this owner.
  await prisma.owner.deleteMany({ where: { email: OWNER_EMAIL } });

  const owner = await prisma.owner.create({
    data: {
      email: OWNER_EMAIL,
      // bcrypt("rentflow") — replaced by real hashing when auth lands
      passwordHash: "$2b$10$Xy9r4vQqJ1kZ0m8Lh5eTde1Hh8fQ0yZ8s0m0m0m0m0m0m0m0m0m0",
      name: "Rajesh Kapoor",
      phone: "+91 98765 00000",
      company: "Kapoor Properties",
      address: "14th Cross, 5th Block, Koramangala, Bangalore - 560095",
      plan: "professional",
      electricityRate: RATE,
    },
  });

  const property = await prisma.property.create({
    data: {
      ownerId: owner.id,
      name: "Sunrise Apartments",
      locality: "Koramangala, Bangalore",
      address: "42, 6th Main, Koramangala 4th Block",
      kind: "residential",
    },
  });

  const ground = await prisma.floor.create({
    data: { propertyId: property.id, level: 0, name: "Ground Floor" },
  });
  const first = await prisma.floor.create({
    data: { propertyId: property.id, level: 1, name: "First Floor" },
  });

  const [u101, u102, u201] = await Promise.all(
    [
      { floor: ground, number: "101", rent: 18000 },
      { floor: ground, number: "102", rent: 18000 },
      { floor: first, number: "201", rent: 22000 },
    ].map((u) =>
      prisma.unit.create({
        data: {
          floorId: u.floor.id,
          propertyId: property.id,
          number: u.number,
          defaultRent: rupees(u.rent),
          defaultDeposit: rupees(u.rent * 3),
        },
      }),
    ),
  );

  // -------------------------------------------------------------------------
  // People
  // -------------------------------------------------------------------------

  const arjun = await prisma.person.create({
    data: {
      ownerId: owner.id,
      fullName: "Arjun Mehta",
      phone: "+91 98765 43210",
      email: "arjun.mehta@gmail.com",
      occupation: "Software Engineer",
      dateOfBirth: day("1992-04-18"),
      addressLine: "12, MG Road",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560001",
      idKind: "aadhaar",
      idNumber: "2345 6789 0123",
    },
  });

  const priya = await prisma.person.create({
    data: {
      ownerId: owner.id,
      fullName: "Priya Mehta",
      phone: "+91 98765 11111",
      occupation: "Architect",
      dateOfBirth: day("1994-11-02"),
      idKind: "aadhaar",
      idNumber: "4567 8901 2345",
    },
  });

  const aarav = await prisma.person.create({
    data: {
      ownerId: owner.id,
      fullName: "Aarav Mehta",
      dateOfBirth: day("2021-06-30"),
    },
  });

  const sneha = await prisma.person.create({
    data: {
      ownerId: owner.id,
      fullName: "Sneha Reddy",
      phone: "+91 87654 32109",
      email: "sneha.reddy@yahoo.com",
      occupation: "Marketing Manager",
      dateOfBirth: day("1990-01-22"),
      idKind: "pan",
      idNumber: "ABCDE1234F",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560025",
    },
  });

  const vikram = await prisma.person.create({
    data: {
      ownerId: owner.id,
      fullName: "Vikram Singh",
      phone: "+91 76543 21098",
      occupation: "Business Analyst",
      dateOfBirth: day("1988-09-09"),
      idKind: "passport",
      idNumber: "K1234567",
    },
  });

  // -------------------------------------------------------------------------
  // Leases
  //
  // u101 carries two consecutive leases. The exclusion constraint permits it
  // because the ranges are half-open and meet exactly — if you nudge either
  // date so they overlap by one day, the insert is refused. Worth trying.
  // -------------------------------------------------------------------------

  const ended = await prisma.lease.create({
    data: {
      ownerId: owner.id,
      unitId: u101.id,
      termStart: day("2024-01-01"),
      termEnd: day("2025-12-31"),
      rent: rupees(17000),
      deposit: rupees(51000),
      depositReturned: rupees(51000),
      status: "ended",
      occupants: {
        create: [
          { personId: vikram.id, role: "primary", movedIn: day("2024-01-01"), movedOut: day("2025-12-30") },
        ],
      },
    },
  });

  const mehtas = await prisma.lease.create({
    data: {
      ownerId: owner.id,
      unitId: u101.id,
      termStart: day("2025-12-31"),
      termEnd: day("2027-12-31"),
      rent: rupees(18000),
      deposit: rupees(54000),
      dueDay: 5,
      emergencyName: "Ramesh Mehta",
      emergencyPhone: "+91 98765 22222",
      occupants: {
        create: [
          { personId: arjun.id, role: "primary", movedIn: day("2025-12-31") },
          { personId: priya.id, role: "member", relation: "wife", movedIn: day("2025-12-31") },
          { personId: aarav.id, role: "member", relation: "son", movedIn: day("2025-12-31") },
        ],
      },
    },
  });

  const snehas = await prisma.lease.create({
    data: {
      ownerId: owner.id,
      unitId: u102.id,
      termStart: day("2026-03-01"),
      termEnd: day("2027-02-28"),
      rent: rupees(18000),
      deposit: rupees(54000),
      occupants: {
        create: [{ personId: sneha.id, role: "primary", movedIn: day("2026-03-01") }],
      },
    },
  });

  // u201 is vacant: no lease at all, which is what "vacant" means now that
  // occupancy is derived rather than stored.
  void u201;

  // -------------------------------------------------------------------------
  // Meter readings — logged against the unit, ahead of any billing
  // -------------------------------------------------------------------------

  /** Records a run of monthly readings and returns them keyed by month. */
  async function readings(
    unitId: string,
    start: string,
    from: number,
    steps: { month: string; units: number; newMeter?: boolean }[],
  ) {
    let running = from;
    const made: Record<string, { id: string; reading: number }> = {};

    // the opening figure, taken before the first billed month
    const opening = await prisma.meterReading.create({
      data: {
        ownerId: owner.id,
        unitId,
        readOn: day(start),
        reading: rupees(running),
        note: "Opening reading",
      },
    });
    made.opening = { id: opening.id, reading: running };

    for (const step of steps) {
      running = step.newMeter ? step.units : running + step.units;
      const row = await prisma.meterReading.create({
        data: {
          ownerId: owner.id,
          unitId,
          readOn: day(`${step.month}-01`),
          reading: rupees(running),
          startsNewMeter: step.newMeter ?? false,
          note: step.newMeter ? "Meter replaced" : null,
        },
      });
      made[step.month] = { id: row.id, reading: running };
    }
    return made;
  }

  const m101 = await readings(u101.id, "2026-04-01", 4820, [
    { month: "2026-05", units: 62 },
    { month: "2026-06", units: 71 },
    { month: "2026-07", units: 55 },
    { month: "2026-08", units: 68 },
    { month: "2026-09", units: 49 },
  ]);

  // u102's meter was swapped in July: the count restarts from zero, and
  // consumption is not computable across that row.
  const m102 = await readings(u102.id, "2026-04-01", 9140, [
    { month: "2026-05", units: 40 },
    { month: "2026-06", units: 52 },
    { month: "2026-07", units: 0, newMeter: true },
    { month: "2026-08", units: 44 },
    { month: "2026-09", units: 51 },
  ]);

  // -------------------------------------------------------------------------
  // Bills and payments
  // -------------------------------------------------------------------------

  async function bill(
    leaseId: string,
    period: string,
    rent: number,
    electricity: {
      previous: { id: string; reading: number };
      current: { id: string; reading: number };
    } | { flat: number },
    extra?: { label: string; amount: number },
  ) {
    const lines: Prisma.BillLineCreateWithoutBillInput[] = [
      { kind: "rent", amount: rupees(rent) },
    ];

    if ("flat" in electricity) {
      lines.push({
        kind: "electricity",
        label: "Flat charge — meter replaced",
        amount: rupees(electricity.flat),
        electricityMode: "flat",
      });
    } else {
      const used = electricity.current.reading - electricity.previous.reading;
      lines.push({
        kind: "electricity",
        amount: rupees(used * RATE.toNumber()),
        electricityMode: "meter",
        meterPrevious: rupees(electricity.previous.reading),
        meterCurrent: rupees(electricity.current.reading),
        unitRate: RATE,
        previousReading: { connect: { id: electricity.previous.id } },
        currentReading: { connect: { id: electricity.current.id } },
      });
    }

    if (extra) {
      lines.push({ kind: "maintenance", label: extra.label, amount: rupees(extra.amount) });
    }

    return prisma.bill.create({
      data: {
        ownerId: owner.id,
        leaseId,
        period: month(period),
        dueDate: day(`${period}-05`),
        lines: { create: lines },
      },
    });
  }

  const pay = (leaseId: string, period: string, amount: number, paidOn: string, method: "bank_transfer" | "cash" | "upi" | "cheque") =>
    prisma.payment.create({
      data: {
        ownerId: owner.id,
        leaseId,
        period: month(period),
        amount: rupees(amount),
        paidOn: day(paidOn),
        method,
        reference: `TXN${period.replace("-", "")}${Math.abs(amount) % 1000}`,
      },
    });

  // --- u101 / the Mehtas -----------------------------------------------------
  // May settled in full; June in two instalments; July paid short so ₹800
  // carries; August overpaid so ₹500 comes back the other way; September
  // untouched, and already past its due date.

  await bill(mehtas.id, "2026-05", 18000, { previous: m101.opening, current: m101["2026-05"] });
  await pay(mehtas.id, "2026-05", 18620, "2026-05-03", "bank_transfer");

  await bill(mehtas.id, "2026-06", 18000, { previous: m101["2026-05"], current: m101["2026-06"] });
  await pay(mehtas.id, "2026-06", 10000, "2026-06-04", "upi");
  await pay(mehtas.id, "2026-06", 8710, "2026-06-16", "cash");

  await bill(mehtas.id, "2026-07", 18000, { previous: m101["2026-06"], current: m101["2026-07"] });
  await pay(mehtas.id, "2026-07", 17750, "2026-07-06", "upi"); // ₹800 short

  await bill(mehtas.id, "2026-08", 18000, { previous: m101["2026-07"], current: m101["2026-08"] });
  await pay(mehtas.id, "2026-08", 19980, "2026-08-02", "bank_transfer"); // clears the ₹800, leaves ₹500

  await bill(mehtas.id, "2026-09", 18000, { previous: m101["2026-08"], current: m101["2026-09"] });
  // nothing paid — overdue once past 2026-09-05

  // --- u102 / Sneha ----------------------------------------------------------
  // July is billed flat, because the meter was replaced and the difference
  // across the swap is meaningless.

  await bill(snehas.id, "2026-05", 18000, { previous: m102.opening, current: m102["2026-05"] });
  await pay(snehas.id, "2026-05", 18400, "2026-05-05", "bank_transfer");

  await bill(snehas.id, "2026-06", 18000, { previous: m102["2026-05"], current: m102["2026-06"] });
  await pay(snehas.id, "2026-06", 18520, "2026-06-03", "bank_transfer");

  await bill(snehas.id, "2026-07", 18000, { flat: 500 }, { label: "Water tanker", amount: 350 });
  await pay(snehas.id, "2026-07", 18850, "2026-07-04", "upi");

  await bill(snehas.id, "2026-08", 18000, { previous: m102["2026-07"], current: m102["2026-08"] });
  await pay(snehas.id, "2026-08", 18440, "2026-08-05", "bank_transfer");

  // --- the ended lease still owns its history --------------------------------
  await bill(ended.id, "2025-12", 17000, { flat: 610 });
  await pay(ended.id, "2025-12", 17610, "2025-12-04", "cheque");

  const counts = {
    properties: await prisma.property.count({ where: { ownerId: owner.id } }),
    units: await prisma.unit.count(),
    people: await prisma.person.count({ where: { ownerId: owner.id } }),
    leases: await prisma.lease.count({ where: { ownerId: owner.id } }),
    readings: await prisma.meterReading.count({ where: { ownerId: owner.id } }),
    bills: await prisma.bill.count({ where: { ownerId: owner.id } }),
    payments: await prisma.payment.count({ where: { ownerId: owner.id } }),
  };

  console.log(`Seeded ${OWNER_EMAIL}`);
  console.table(counts);
  console.log(
    "\nTry the ledger:\n" +
      `  select period, total, paid, closing, status from ledger('${mehtas.id}');\n` +
      "  (or paste the query from the schema doc — lease id above)\n",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
