import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, type Transaction } from 'sequelize';

import { Lease } from './entities/lease.model';
import { LeaseOccupant } from './entities/lease-occupant.model';
import { Person } from '../people/entities/person.model';
import { Unit } from '../properties/entities/unit.model';
import { Property } from '../properties/entities/property.model';
import { Floor } from '../properties/entities/floor.model';
import { LeaseStatus, OccupantRole, Relation } from '../../common/domain.enums';

import type { CreateLeaseDto, OccupantInputDto } from './dto/create-lease.dto';
import type { UpdateLeaseDto } from './dto/update-lease.dto';
import type { AddOccupantDto, UpdateOccupantDto } from './dto/occupant.dto';
import type { ChangePrimaryDto } from './dto/change-primary.dto';

/** Everything a tenancy screen needs in one go. */
const FULL_INCLUDE = [
  {
    model: LeaseOccupant,
    include: [{ model: Person }],
  },
  {
    model: Unit,
    include: [{ model: Property }, { model: Floor }],
  },
];

@Injectable()
export class LeasesService {
  constructor(
    @InjectModel(Lease) private readonly leases: typeof Lease,
    @InjectModel(LeaseOccupant) private readonly occupants: typeof LeaseOccupant,
    @InjectModel(Person) private readonly people: typeof Person,
    @InjectModel(Unit) private readonly units: typeof Unit,
    private readonly sequelize: Sequelize,
  ) {}

  /* --------------------------------------------------------------------- */
  /* Reads                                                                  */
  /* --------------------------------------------------------------------- */

  findAll(ownerId: string, filters: { status?: LeaseStatus; unitId?: string } = {}) {
    const where: Record<string, unknown> = { ownerId };
    if (filters.status) where.status = filters.status;
    if (filters.unitId) where.unitId = filters.unitId;

    return this.leases.findAll({
      where,
      include: FULL_INCLUDE,
      order: [['termStart', 'DESC']],
    });
  }

  async findOne(ownerId: string, id: string) {
    const lease = await this.leases.findOne({
      where: { id, ownerId },
      include: FULL_INCLUDE,
    });
    if (!lease) throw new NotFoundException('Lease not found');
    return lease;
  }

  /* --------------------------------------------------------------------- */
  /* Create                                                                 */
  /* --------------------------------------------------------------------- */

  /**
   * Creates the tenancy and everybody on it in one transaction.
   *
   * A lease with no primary tenant, or a primary whose person record failed to
   * save, is not a state worth being able to reach — so either all of it lands
   * or none of it does.
   */
  async create(ownerId: string, dto: CreateLeaseDto) {
    await this.assertUnit(ownerId, dto.unitId);

    if (!dto.primaryPersonId && !dto.primaryPerson) {
      throw new BadRequestException(
        'A lease needs a primary tenant: give primaryPersonId or primaryPerson',
      );
    }

    return this.sequelize.transaction(async (tx) => {
      const primary = await this.resolvePerson(
        ownerId,
        { personId: dto.primaryPersonId, person: dto.primaryPerson },
        tx,
      );

      const lease = await this.leases.create(
        {
          ownerId,
          unitId: dto.unitId,
          termStart: dto.termStart,
          termEnd: dto.termEnd ?? null,
          rent: dto.rent,
          deposit: dto.deposit ?? '0',
          dueDay: dto.dueDay ?? 5,
          emergencyName: dto.emergencyName ?? null,
          emergencyPhone: dto.emergencyPhone ?? null,
          note: dto.note ?? null,
        } as Partial<Lease> as Lease,
        { transaction: tx },
      );

      await this.occupants.create(
        {
          leaseId: lease.id,
          personId: primary.id,
          role: OccupantRole.Primary,
          movedIn: dto.termStart,
        } as Partial<LeaseOccupant> as LeaseOccupant,
        { transaction: tx },
      );

      for (const member of dto.members ?? []) {
        await this.addOccupantRow(ownerId, lease.id, member, dto.termStart, tx);
      }

      return this.leases.findByPk(lease.id, {
        include: FULL_INCLUDE,
        transaction: tx,
      });
    });
  }

  async update(ownerId: string, id: string, dto: UpdateLeaseDto) {
    const lease = await this.findOne(ownerId, id);
    await lease.update(dto);
    return this.findOne(ownerId, id);
  }

  async remove(ownerId: string, id: string) {
    const lease = await this.findOne(ownerId, id);
    await lease.destroy();
    return { id };
  }

  /* --------------------------------------------------------------------- */
  /* Occupants                                                              */
  /* --------------------------------------------------------------------- */

  async addOccupant(ownerId: string, leaseId: string, dto: AddOccupantDto) {
    const lease = await this.findOne(ownerId, leaseId);

    await this.sequelize.transaction((tx) =>
      this.addOccupantRow(ownerId, lease.id, dto, lease.termStart, tx),
    );

    return this.findOne(ownerId, leaseId);
  }

  async updateOccupant(
    ownerId: string,
    leaseId: string,
    occupantId: string,
    dto: UpdateOccupantDto,
  ) {
    await this.findOne(ownerId, leaseId);

    const occupant = await this.occupants.findOne({
      where: { id: occupantId, leaseId },
    });
    if (!occupant) throw new NotFoundException('That person is not on this lease');

    if (occupant.role === OccupantRole.Primary && dto.relation) {
      throw new BadRequestException(
        'The primary tenant has no relation to themselves. Use the change-primary endpoint instead.',
      );
    }

    this.assertRelationSpelledOut(dto.relation, dto.relationNote);

    // Their person record travels with them, so name and contact changes are
    // edited through /people rather than here.
    await occupant.update({
      relation: dto.relation ?? occupant.relation,
      relationNote: dto.relationNote ?? occupant.relationNote,
      movedIn: dto.movedIn ?? occupant.movedIn,
      movedOut: dto.movedOut ?? occupant.movedOut,
    });

    return this.findOne(ownerId, leaseId);
  }

  async removeOccupant(ownerId: string, leaseId: string, occupantId: string) {
    await this.findOne(ownerId, leaseId);

    const occupant = await this.occupants.findOne({
      where: { id: occupantId, leaseId },
    });
    if (!occupant) throw new NotFoundException('That person is not on this lease');

    if (occupant.role === OccupantRole.Primary) {
      throw new BadRequestException(
        'The primary tenant cannot be removed. Hand the tenancy over first, or end the lease.',
      );
    }

    await occupant.destroy();
    return this.findOne(ownerId, leaseId);
  }

  /* --------------------------------------------------------------------- */
  /* Change of primary tenant                                               */
  /* --------------------------------------------------------------------- */

  /**
   * Promotes a member to primary and demotes the outgoing one in their place.
   *
   * Both rows move inside one transaction, because the database allows at most
   * one current primary per lease: demote-then-promote leaves the lease briefly
   * headless, and promote-then-demote is refused outright. Either way, a
   * failure between the two would be a mess — so there is no between.
   */
  async changePrimary(ownerId: string, leaseId: string, dto: ChangePrimaryDto) {
    const lease = await this.findOne(ownerId, leaseId);
    this.assertRelationSpelledOut(dto.outgoingRelation, dto.outgoingRelationNote);

    const incoming = (lease.occupants ?? []).find((o) => o.id === dto.occupantId);
    if (!incoming) throw new NotFoundException('That person is not on this lease');
    if (incoming.role === OccupantRole.Primary) {
      throw new BadRequestException('They are already the primary tenant');
    }
    if (incoming.movedOut) {
      throw new BadRequestException('That person has already moved out');
    }

    const outgoing = (lease.occupants ?? []).find(
      (o) => o.role === OccupantRole.Primary && !o.movedOut,
    );

    await this.sequelize.transaction(async (tx) => {
      if (outgoing) {
        // Demote first: the partial unique index permits only one current
        // primary, so the seat has to be empty before the other one takes it.
        await outgoing.update(
          {
            role: OccupantRole.Member,
            relation: dto.outgoingRelation,
            relationNote:
              dto.outgoingRelation === Relation.Other
                ? (dto.outgoingRelationNote ?? null)
                : null,
          },
          { transaction: tx },
        );
      }

      await incoming.update(
        {
          role: OccupantRole.Primary,
          relation: null,
          relationNote: null,
          movedIn: incoming.movedIn ?? dto.effectiveFrom ?? lease.termStart,
        },
        { transaction: tx },
      );
    });

    return this.findOne(ownerId, leaseId);
  }

  /* --------------------------------------------------------------------- */
  /* Helpers                                                                */
  /* --------------------------------------------------------------------- */

  /** The unit must be one of this owner's, whatever id the caller sent. */
  private async assertUnit(ownerId: string, unitId: string) {
    const unit = await this.units.findOne({
      where: { id: unitId },
      include: [{ model: Property, where: { ownerId }, attributes: [] }],
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  /** Either an existing person of this owner's, or a new one. */
  private async resolvePerson(
    ownerId: string,
    input: { personId?: string; person?: Partial<Person> },
    tx: Transaction,
  ): Promise<Person> {
    if (input.personId) {
      const existing = await this.people.findOne({
        where: { id: input.personId, ownerId },
        transaction: tx,
      });
      if (!existing) throw new NotFoundException('Person not found');
      return existing;
    }

    if (!input.person) {
      throw new BadRequestException('Give a personId or the person.s details');
    }

    return this.people.create(
      { ...input.person, ownerId } as Partial<Person> as Person,
      { transaction: tx },
    );
  }

  private async addOccupantRow(
    ownerId: string,
    leaseId: string,
    dto: OccupantInputDto,
    defaultMovedIn: string,
    tx: Transaction,
  ) {
    this.assertRelationSpelledOut(dto.relation, dto.relationNote);

    const person = await this.resolvePerson(
      ownerId,
      { personId: dto.personId, person: dto.person },
      tx,
    );

    return this.occupants.create(
      {
        leaseId,
        personId: person.id,
        role: OccupantRole.Member,
        relation: dto.relation,
        relationNote:
          dto.relation === Relation.Other ? (dto.relationNote ?? null) : null,
        movedIn: dto.movedIn ?? defaultMovedIn,
      } as Partial<LeaseOccupant> as LeaseOccupant,
      { transaction: tx },
    );
  }

  /**
   * "Other" is the escape hatch, so it has to be spelled out. The database says
   * the same thing; catching it here gives a message naming the field.
   */
  private assertRelationSpelledOut(relation?: Relation, note?: string) {
    if (relation === Relation.Other && !note?.trim()) {
      throw new BadRequestException(
        'When the relation is "other", say what it is in relationNote',
      );
    }
  }

  /** Used by the billing module to confirm a lease belongs to this owner. */
  async assertOwns(ownerId: string, leaseId: string) {
    const lease = await this.leases.findOne({
      where: { id: leaseId, ownerId },
      attributes: ['id', 'unitId', 'rent', 'dueDay', 'termStart', 'termEnd'],
    });
    if (!lease) throw new NotFoundException('Lease not found');
    return lease;
  }

  /** Leases currently running, used by the dashboard. */
  activeLeases(ownerId: string) {
    const today = new Date().toISOString().slice(0, 10);
    return this.leases.findAll({
      where: {
        ownerId,
        status: LeaseStatus.Active,
        termStart: { [Op.lte]: today },
        [Op.or]: [{ termEnd: null }, { termEnd: { [Op.gt]: today } }],
      },
    });
  }
}
