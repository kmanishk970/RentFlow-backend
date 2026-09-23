import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';

import { LedgerService } from '../billing/ledger.service';

/**
 * Dashboard figures.
 *
 * Six numbers come back as six numbers. The frontend currently downloads every
 * bill and payment for every tenancy and reduces them in the browser — fine
 * against fourteen seed rows, hopeless at ten thousand, and the whole reason
 * this endpoint exists.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly ledger: LedgerService,
  ) {}

  async summary(ownerId: string) {
    const [occupancy] = await this.sequelize.query<{
      totalUnits: string;
      occupied: string;
      maintenance: string;
      contractedRent: string;
    }>(
      `
      with active as (
        select distinct unit_id
        from leases
        where owner_id = :ownerId
          and status = 'active'
          and term_start <= current_date
          and (term_end is null or term_end > current_date)
      )
      select count(*)                                             as "totalUnits",
             count(*) filter (where a.unit_id is not null)         as "occupied",
             count(*) filter (where u.under_maintenance)           as "maintenance",
             coalesce(sum(l.rent) filter (
               where a.unit_id is not null), 0)                    as "contractedRent"
      from units u
      join properties p on p.id = u.property_id and p.owner_id = :ownerId
      left join active a on a.unit_id = u.id
      left join lateral (
        select rent from leases
        where unit_id = u.id and status = 'active'
        order by term_start desc limit 1
      ) l on true
      `,
      { replacements: { ownerId }, type: QueryTypes.SELECT },
    );

    const positions = await this.ledger.positionsForOwner(ownerId);

    const outstanding = positions.reduce(
      (sum, p) => sum + Math.max(0, -Number(p.closing ?? 0)),
      0,
    );
    const advance = positions.reduce(
      (sum, p) => sum + Math.max(0, Number(p.closing ?? 0)),
      0,
    );
    const billed = positions.reduce((sum, p) => sum + Number(p.billed ?? 0), 0);
    const collected = positions.reduce(
      (sum, p) => sum + Number(p.collected ?? 0),
      0,
    );

    const totalUnits = Number(occupancy?.totalUnits ?? 0);
    const occupied = Number(occupancy?.occupied ?? 0);

    return {
      units: {
        total: totalUnits,
        occupied,
        vacant: totalUnits - occupied - Number(occupancy?.maintenance ?? 0),
        maintenance: Number(occupancy?.maintenance ?? 0),
        occupancyPct: totalUnits ? Math.round((occupied / totalUnits) * 100) : 0,
      },
      rent: {
        contractedMonthly: Number(occupancy?.contractedRent ?? 0).toFixed(2),
        billed: billed.toFixed(2),
        collected: collected.toFixed(2),
        outstanding: outstanding.toFixed(2),
        advance: advance.toFixed(2),
      },
      tenancies: {
        active: positions.length,
        owing: positions.filter((p) => Number(p.closing ?? 0) < 0).length,
      },
    };
  }

  /** Billed against collected, by month, for the dashboard chart. */
  async monthlyTrend(ownerId: string, months = 6) {
    return this.sequelize.query<{
      period: string;
      billed: string;
      collected: string;
    }>(
      `
      with months as (
        select generate_series(
                 date_trunc('month', current_date) - make_interval(months => :months - 1),
                 date_trunc('month', current_date),
                 interval '1 month'
               )::date as period
      ),
      billed as (
        select b.period, coalesce(sum(l.amount), 0) as amount
        from bills b
        left join bill_lines l on l.bill_id = b.id
        where b.owner_id = :ownerId
        group by b.period
      ),
      collected as (
        select period, sum(amount) as amount
        from payments where owner_id = :ownerId
        group by period
      )
      select to_char(m.period, 'YYYY-MM')      as "period",
             coalesce(b.amount, 0)::text        as "billed",
             coalesce(c.amount, 0)::text        as "collected"
      from months m
      left join billed b on b.period = m.period
      left join collected c on c.period = m.period
      order by m.period
      `,
      { replacements: { ownerId, months }, type: QueryTypes.SELECT },
    );
  }
}
