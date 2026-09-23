import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';

export type MonthStatus = 'paid' | 'partial' | 'pending' | 'overdue';

export interface LedgerRow {
  /** "2026-09-01" — the first of the month the bill covers. */
  period: string;
  dueDate: string;
  /** Everything charged that month. */
  total: string;
  /** Money set against it. */
  paid: string;
  /** Running balance after it: positive is credit, negative is dues. */
  closing: string;
  /** What is still owed, carried arrears included. */
  shortfall: string;
  /** Money sitting in the tenant's favour. */
  credit: string;
  status: MonthStatus;
  rent: string;
  electricity: string;
  other: string;
  units: string | null;
  unitRate: string | null;
}

export interface LedgerSummary {
  balance: string;
  outstanding: string;
  advance: string;
  monthsOwing: number;
  billed: string;
  collected: string;
}

/**
 * The rent ledger.
 *
 * A month is never read on its own: anything left over rolls into the next as
 * credit, anything short rolls in as dues. That running balance is a window
 * function — `sum(paid - total) over (order by period)` *is* the carry-forward,
 * so the whole statement is one round trip rather than a month-by-month walk in
 * application code.
 *
 * This is src/lib/rent-ledger.ts from the frontend, expressed in SQL. Both are
 * kept: the TypeScript one still drives optimistic updates in the browser.
 */
@Injectable()
export class LedgerService {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async forLease(leaseId: string): Promise<LedgerRow[]> {
    return this.sequelize.query<LedgerRow>(
      `
      with charged as (
        select b.id, b.period, b.due_date,
               coalesce(sum(l.amount), 0)                                       as total,
               coalesce(sum(l.amount) filter (where l.kind = 'rent'), 0)         as rent,
               coalesce(sum(l.amount) filter (where l.kind = 'electricity'), 0)  as electricity,
               coalesce(sum(l.amount) filter (
                 where l.kind not in ('rent', 'electricity')), 0)               as other,
               -- the metered working, when there is one
               max(l.meter_current - l.meter_previous) filter (
                 where l.electricity_mode = 'meter')                            as units,
               max(l.unit_rate) filter (where l.electricity_mode = 'meter')      as unit_rate
        from bills b
        left join bill_lines l on l.bill_id = b.id
        where b.lease_id = :leaseId
        group by b.id
      ),
      received as (
        select period, sum(amount) as paid
        from payments
        where lease_id = :leaseId
        group by period
      ),
      ledger as (
        select c.period, c.due_date, c.total, c.rent, c.electricity, c.other,
               c.units, c.unit_rate,
               coalesce(r.paid, 0) as paid,
               -- the carry-forward, in one line
               sum(coalesce(r.paid, 0) - c.total) over (order by c.period) as closing
        from charged c
        left join received r using (period)
      )
      select to_char(period, 'YYYY-MM-DD')   as "period",
             to_char(due_date, 'YYYY-MM-DD') as "dueDate",
             total, paid, closing,
             greatest(0, -closing) as shortfall,
             greatest(0,  closing) as credit,
             rent, electricity, other, units,
             unit_rate as "unitRate",
             case when closing >= 0            then 'paid'
                  when current_date > due_date then 'overdue'
                  when paid > 0                then 'partial'
                  else 'pending' end as status
      from ledger
      order by period
      `,
      { replacements: { leaseId }, type: QueryTypes.SELECT },
    );
  }

  /** Where a tenancy stands after every month so far. */
  summarise(rows: LedgerRow[]): LedgerSummary {
    const last = rows.at(-1);
    const balance = Number(last?.closing ?? 0);

    const sum = (pick: (r: LedgerRow) => string) =>
      rows.reduce((total, row) => total + Number(pick(row)), 0);

    return {
      balance: balance.toFixed(2),
      outstanding: Math.max(0, -balance).toFixed(2),
      advance: Math.max(0, balance).toFixed(2),
      monthsOwing: rows.filter(
        (r) => r.status === 'overdue' || r.status === 'partial',
      ).length,
      billed: sum((r) => r.total).toFixed(2),
      collected: sum((r) => r.paid).toFixed(2),
    };
  }

  /**
   * Every lease's current position in one query, for the dashboard.
   *
   * The alternative — running `forLease` per tenancy — is the N+1 that makes a
   * summary page slow once a landlord has more than a handful of units.
   */
  async positionsForOwner(ownerId: string) {
    return this.sequelize.query<{
      leaseId: string;
      closing: string;
      billed: string;
      collected: string;
      monthsOwing: string;
    }>(
      `
      with charged as (
        select b.lease_id, b.period, b.due_date, coalesce(sum(l.amount), 0) as total
        from bills b
        left join bill_lines l on l.bill_id = b.id
        where b.owner_id = :ownerId
        group by b.id
      ),
      received as (
        select lease_id, period, sum(amount) as paid
        from payments where owner_id = :ownerId
        group by lease_id, period
      ),
      ledger as (
        select c.lease_id, c.period, c.due_date, c.total,
               coalesce(r.paid, 0) as paid,
               sum(coalesce(r.paid, 0) - c.total)
                 over (partition by c.lease_id order by c.period) as closing
        from charged c
        left join received r on r.lease_id = c.lease_id and r.period = c.period
      ),
      -- The closing balance is the LAST month's, so it is picked with
      -- distinct on rather than joined back: joining ranked rows to ledger rows
      -- multiplies them, and sum(total) then counts every month once per month.
      latest as (
        select distinct on (lease_id) lease_id, closing
        from ledger
        order by lease_id, period desc
      ),
      totals as (
        select lease_id,
               sum(total) as billed,
               sum(paid)  as collected,
               count(*) filter (
                 where closing < 0 and current_date > due_date) as months_owing
        from ledger
        group by lease_id
      )
      select t.lease_id   as "leaseId",
             l.closing    as "closing",
             t.billed     as "billed",
             t.collected  as "collected",
             t.months_owing as "monthsOwing"
      from totals t
      join latest l on l.lease_id = t.lease_id
      `,
      { replacements: { ownerId }, type: QueryTypes.SELECT },
    );
  }
}
