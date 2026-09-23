import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { Property } from './entities/property.model';
import { Floor } from './entities/floor.model';
import { Unit } from './entities/unit.model';
import { Lease } from '../leases/entities/lease.model';
import { LeaseStatus } from '../../common/domain.enums';
import type { CreatePropertyDto } from './dto/create-property.dto';
import type { UpdatePropertyDto } from './dto/update-property.dto';
import type { CreateFloorDto } from './dto/create-floor.dto';
import type { CreateUnitDto } from './dto/create-unit.dto';
import type { UpdateUnitDto } from './dto/update-unit.dto';

/**
 * Properties, floors and units.
 *
 * Every method takes `ownerId` as its first argument and every query filters on
 * it. Nothing here trusts an id from the URL on its own: asking for a property
 * that belongs to somebody else returns 404, not 403 — a stranger's id should
 * not be confirmable.
 */
@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property) private readonly properties: typeof Property,
    @InjectModel(Floor) private readonly floors: typeof Floor,
    @InjectModel(Unit) private readonly units: typeof Unit,
    @InjectModel(Lease) private readonly leases: typeof Lease,
  ) {}

  /** The whole tree, which is the shape every property screen wants. */
  async findAll(ownerId: string) {
    const properties = await this.properties.findAll({
      where: { ownerId },
      include: [
        {
          model: Floor,
          include: [{ model: Unit }],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    return Promise.all(properties.map((p) => this.withOccupancy(p)));
  }

  async findOne(ownerId: string, id: string) {
    const property = await this.properties.findOne({
      where: { id, ownerId },
      include: [{ model: Floor, include: [{ model: Unit }] }],

    });

    if (!property) throw new NotFoundException('Property not found');
    return this.withOccupancy(property);
  }

  create(ownerId: string, dto: CreatePropertyDto) {
    return this.properties.create({ ...dto, ownerId } as Partial<Property> as Property);
  }

  async update(ownerId: string, id: string, dto: UpdatePropertyDto) {
    const property = await this.properties.findOne({ where: { id, ownerId } });
    if (!property) throw new NotFoundException('Property not found');
    return property.update(dto);
  }

  async remove(ownerId: string, id: string) {
    const deleted = await this.properties.destroy({ where: { id, ownerId } });
    if (!deleted) throw new NotFoundException('Property not found');
    return { id };
  }

  /* --------------------------------------------------------------------- */
  /* Floors                                                                 */
  /* --------------------------------------------------------------------- */

  async addFloor(ownerId: string, propertyId: string, dto: CreateFloorDto) {
    // Establishes ownership before writing anything beneath it.
    await this.assertProperty(ownerId, propertyId);
    return this.floors.create({ ...dto, propertyId } as Partial<Floor> as Floor);
  }

  async removeFloor(ownerId: string, propertyId: string, floorId: string) {
    await this.assertProperty(ownerId, propertyId);
    const deleted = await this.floors.destroy({
      where: { id: floorId, propertyId },
    });
    if (!deleted) throw new NotFoundException('Floor not found');
    return { id: floorId };
  }

  /* --------------------------------------------------------------------- */
  /* Units                                                                  */
  /* --------------------------------------------------------------------- */

  async addUnit(ownerId: string, propertyId: string, dto: CreateUnitDto) {
    await this.assertProperty(ownerId, propertyId);

    // The floor has to belong to this property, or the composite foreign key
    // would reject it later with a far less useful message.
    const floor = await this.floors.findOne({
      where: { id: dto.floorId, propertyId },
    });
    if (!floor) throw new NotFoundException('That floor is not in this property');

    return this.units.create({
      ...dto,
      propertyId,
      defaultDeposit: dto.defaultDeposit ?? '0',
    } as Partial<Unit> as Unit);
  }

  async findUnits(ownerId: string) {
    const units = await this.units.findAll({
      include: [{ model: Property, where: { ownerId }, attributes: [] }],
    });
    return this.decorateUnits([...units].sort(PropertiesService.byNumber));
  }

  async findUnit(ownerId: string, id: string) {
    const unit = await this.units.findOne({
      where: { id },
      include: [
        { model: Property, where: { ownerId } },
        { model: Floor },
      ],
    });
    if (!unit) throw new NotFoundException('Unit not found');

    const [decorated] = await this.decorateUnits([unit]);
    return decorated;
  }

  async updateUnit(ownerId: string, id: string, dto: UpdateUnitDto) {
    const unit = await this.units.findOne({
      where: { id },
      include: [{ model: Property, where: { ownerId }, attributes: [] }],
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit.update(dto);
  }

  async removeUnit(ownerId: string, id: string) {
    const unit = await this.units.findOne({
      where: { id },
      include: [{ model: Property, where: { ownerId }, attributes: [] }],
    });
    if (!unit) throw new NotFoundException('Unit not found');
    await unit.destroy();
    return { id };
  }

  /* --------------------------------------------------------------------- */
  /* Occupancy — derived, never stored                                      */
  /* --------------------------------------------------------------------- */

  /**
   * "Occupied" and "vacant" are questions about leases, so they are answered
   * from leases. Only `underMaintenance` is a fact about the unit itself, which
   * is why it is the one status column in the schema.
   */
  private async activeLeaseUnitIds(unitIds: string[]): Promise<Set<string>> {
    if (unitIds.length === 0) return new Set();

    const today = new Date().toISOString().slice(0, 10);
    const active = await this.leases.findAll({
      attributes: ['unitId'],
      where: {
        unitId: { [Op.in]: unitIds },
        status: LeaseStatus.Active,
        termStart: { [Op.lte]: today },
        [Op.or]: [{ termEnd: null }, { termEnd: { [Op.gt]: today } }],
      },
      raw: true,
    });

    return new Set(active.map((l) => l.unitId));
  }

  /**
   * Occupied outranks maintenance: a unit with a tenant in it is occupied
   * whatever work is going on, and rent is still due. "Maintenance" means the
   * unit is empty and deliberately held off the market.
   */
  private statusFor(unit: Unit, occupied: Set<string>) {
    if (occupied.has(unit.id)) return 'occupied';
    return unit.underMaintenance ? 'maintenance' : 'vacant';
  }

  private async decorateUnits(units: Unit[]) {
    const occupied = await this.activeLeaseUnitIds(units.map((u) => u.id));
    return units.map((unit) => ({
      ...unit.toJSON(),
      status: this.statusFor(unit, occupied),
    }));
  }

  /** Unit numbers are strings but read as numbers: 2 before 10, not after. */
  private static byNumber(a: { number: string }, b: { number: string }) {
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  }

  private async withOccupancy(property: Property) {
    const units = (property.floors ?? []).flatMap((f) => f.units ?? []);
    const occupied = await this.activeLeaseUnitIds(units.map((u) => u.id));

    return {
      ...property.toJSON(),
      floors: [...(property.floors ?? [])]
        .sort((a, b) => a.level - b.level)
        .map((floor) => ({
          ...floor.toJSON(),
          units: [...(floor.units ?? [])]
            .sort(PropertiesService.byNumber)
            .map((unit) => ({
              ...unit.toJSON(),
              status: this.statusFor(unit, occupied),
            })),
        })),
    };
  }

  private async assertProperty(ownerId: string, propertyId: string) {
    const property = await this.properties.findOne({
      where: { id: propertyId, ownerId },
      attributes: ['id'],
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }
}
